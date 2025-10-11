// public/app.js V3.1 - Avec gestion réseau robuste, zoom et texture unifiée
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

const stage = new Konva.Stage({
  container: 'canvas-container',
  width: window.innerWidth,
  height: window.innerHeight
});
const layer = new Konva.Layer();
stage.add(layer);

// 🌐 Initialiser ConnectionManager
const connectionManager = new ConnectionManager(socket);

// Initialiser le BrushManager unifié
const brushManager = new BrushManager(layer, socket);

let currentTool = 'brush';
let currentColor = '#FFFFFF';
let currentSize = parseInt(document.getElementById('size-slider-v3').value, 10);
let currentZoom = 1;
let isDrawing = false;
let lastLine;
let currentId;
let lastPanPos = null;

// === UTILITAIRES ===
function throttle(func, wait) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      func.apply(this, args);
    }
  };
}

function generateId() {
  return 'shape_' + Date.now() + '_' + Math.round(Math.random() * 10000);
}

function getPressure(evt) {
  if (evt.originalEvent && evt.originalEvent.pressure !== undefined) {
    return Math.max(0.1, evt.originalEvent.pressure);
  }
  return 1;
}

function getPressureSize(pressure) {
  const minSize = Math.max(1, currentSize * 0.3);
  const maxSize = currentSize * 1.5;
  return minSize + (maxSize - minSize) * pressure;
}

function getScenePos(pointer) {
  return {
    x: (pointer.x - stage.x()) / stage.scaleX(),
    y: (pointer.y - stage.y()) / stage.scaleY()
  };
}

const emitDrawingThrottled = throttle((data) => {
  connectionManager.emit('drawing', data);
}, 50);

const emitTextureThrottled = throttle((data) => {
  connectionManager.emit('texture', data);
}, 120); // Unifié mobile/PC

// === 🎨 INTERFACE UTILISATEUR ===

// Outils de dessin
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.id === 'undo') {
      handleUndo();
      return;
    }
    
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.id;
    updateCursor();
  });
});

// Slider d'épaisseur V3
const sizeSlider = document.getElementById('size-slider-v3');
const sizeValue = document.getElementById('size-value');

sizeSlider.addEventListener('input', e => {
  currentSize = parseInt(e.target.value, 10);
  sizeValue.textContent = currentSize + 'px';
  
  // Feedback visuel
  const percent = (currentSize - 1) / 19 * 100;
  sizeSlider.style.background = `linear-gradient(to right, 
    rgba(107, 91, 255, 0.8) 0%, 
    rgba(107, 91, 255, 0.8) ${percent}%, 
    rgba(107, 91, 255, 0.3) ${percent}%, 
    rgba(107, 91, 255, 0.3) 100%
  )`;
});

// 🔍 ZOOM CONTROLS
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');

function setZoom(newZoom) {
  newZoom = Math.max(0.1, Math.min(5, newZoom));
  
  const center = {
    x: stage.width() / 2,
    y: stage.height() / 2
  };
  
  const oldScale = stage.scaleX();
  const mousePointTo = {
    x: (center.x - stage.x()) / oldScale,
    y: (center.y - stage.y()) / oldScale
  };
  
  stage.scale({ x: newZoom, y: newZoom });
  
  const newPos = {
    x: center.x - mousePointTo.x * newZoom,
    y: center.y - mousePointTo.y * newZoom
  };
  stage.position(newPos);
  stage.batchDraw();
  
  currentZoom = newZoom;
  
  // Feedback visuel
  zoomResetBtn.textContent = Math.round(newZoom * 100) + '%';
  zoomResetBtn.style.fontSize = '10px';
  zoomResetBtn.style.fontWeight = '600';
}

zoomInBtn.addEventListener('click', () => {
  setZoom(currentZoom * 1.2);
});

zoomOutBtn.addEventListener('click', () => {
  setZoom(currentZoom / 1.2);
});

zoomResetBtn.addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
  currentZoom = 1;
  zoomResetBtn.textContent = '⚫';
  zoomResetBtn.style.fontSize = '18px';
});

// Zoom molette souris
stage.on('wheel', (e) => {
  e.evt.preventDefault();
  
  const scaleBy = 1.1;
  const pointer = stage.getPointerPosition();
  const mousePointTo = {
    x: (pointer.x - stage.x()) / stage.scaleX(),
    y: (pointer.y - stage.y()) / stage.scaleY(),
  };

  let direction = e.evt.deltaY > 0 ? -1 : 1;
  let newScale = stage.scaleX() * (scaleBy ** direction);
  
  newScale = Math.max(0.1, Math.min(5, newScale));
  
  stage.scale({ x: newScale, y: newScale });
  
  const newPos = {
    x: pointer
    const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  stage.position(newPos);
  stage.batchDraw();
  
  currentZoom = newScale;
  zoomResetBtn.textContent = Math.round(newScale * 100) + '%';
  zoomResetBtn.style.fontSize = '10px';
  zoomResetBtn.style.fontWeight = '600';
});

// Gestion du curseur
function updateCursor() {
  const container = stage.container();
  switch(currentTool) {
    case 'pan':
      container.style.cursor = 'grab';
      break;
    default:
      container.style.cursor = 'crosshair';
  }
}

// Fonction pour gérer l'undo avec notification visuelle
function handleUndo() {
  connectionManager.emit('undo');
  showUndoNotification();
}

// Fonction pour afficher une notification d'undo
function showUndoNotification() {
  const notification = document.createElement('div');
  notification.className = 'undo-notification';
  notification.textContent = 'Annulé ↶';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 800);
}

// Raccourci Ctrl+Z pour undo
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    handleUndo();
  }
});

// === 🎨 ÉVÉNEMENTS DE DESSIN ===

stage.on('mousedown touchstart pointerdown', (evt) => {
  const pointer = stage.getPointerPosition();
  
  if (currentTool === 'pan') {
    lastPanPos = pointer;
    isDrawing = false;
    stage.container().style.cursor = 'grabbing';
    return;
  }
  
  const scenePos = getScenePos(pointer);
  const pressure = getPressure(evt);
  const pressureSize = getPressureSize(pressure);
  
  if (currentTool === 'texture') {
    isDrawing = true;
    currentId = generateId();
    emitTextureThrottled({
      x: scenePos.x,
      y: scenePos.y,
      color: currentColor,
      size: pressureSize
    });
    createTextureEffect(scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }

  // BRUSH ANIMÉS - Avec tracés permanents via BrushManager
  if (['neon', 'fire', 'sparkles', 'watercolor', 'electric', 'petals'].includes(currentTool)) {
    isDrawing = true;
    currentId = generateId();
    brushManager.createAndEmitEffect(currentTool, scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }
  
  // Mode brush normal ou gomme
  isDrawing = true;
  currentId = generateId();
  
  lastLine = new Konva.Line({
    id: currentId,
    points: [scenePos.x, scenePos.y],
    stroke: currentColor,
    strokeWidth: pressureSize,
    globalCompositeOperation: currentTool === 'eraser' ? 'destination-out' : 'source-over',
    lineCap: 'round',
    lineJoin: 'round'
  });
  layer.add(lastLine);
  
  emitDrawingThrottled({
    id: currentId,
    points: [scenePos.x, scenePos.y],
    stroke: currentColor,
    strokeWidth: pressureSize,
    globalCompositeOperation: currentTool === 'eraser' ? 'destination-out' : 'source-over'
  });
});

stage.on('mousemove touchmove pointermove', (evt) => {
  const pointer = stage.getPointerPosition();
  
  if (currentTool === 'pan' && lastPanPos) {
    const dx = pointer.x - lastPanPos.x;
    const dy = pointer.y - lastPanPos.y;
    stage.x(stage.x() + dx);
    stage.y(stage.y() + dy);
    stage.batchDraw();
    lastPanPos = pointer;
    return;
  }
  
  if (!isDrawing) return;
  
  const scenePos = getScenePos(pointer);
  const pressure = getPressure(evt);
  const pressureSize = getPressureSize(pressure);
  
  if (currentTool === 'texture') {
    emitTextureThrottled({
      x: scenePos.x,
      y: scenePos.y,
      color: currentColor,
      size: pressureSize
    });
    createTextureEffect(scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }

  // BRUSH ANIMÉS - Continuer l'effet avec tracés permanents
  if (['neon', 'fire', 'sparkles', 'watercolor', 'electric', 'petals'].includes(currentTool)) {
    brushManager.createAndEmitEffect(currentTool, scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }
  
  // Mode brush normal ou gomme
  if (lastLine) {
    lastLine.points(lastLine.points().concat([scenePos.x, scenePos.y]));
    lastLine.strokeWidth(pressureSize);
    layer.batchDraw();
    
    emitDrawingThrottled({
      id: currentId,
      points: lastLine.points(),
      stroke: lastLine.stroke(),
      strokeWidth: pressureSize,
      globalCompositeOperation: lastLine.globalCompositeOperation()
    });
  }
});

stage.on('mouseup touchend pointerup', () => {
  if (currentTool === 'pan') {
    lastPanPos = null;
    stage.container().style.cursor = 'grab';
    return;
  }

  if (!isDrawing) return;
  isDrawing = false;
  
  // Les brush animés et texture n'ont pas besoin d'événement final
  if (currentTool === 'texture' || ['neon', 'fire', 'sparkles', 'watercolor', 'electric', 'petals'].includes(currentTool)) {
    return;
  }
  
  if (lastLine) {
    connectionManager.emit('draw', {
      id: currentId,
      points: lastLine.points(),
      stroke: lastLine.stroke(),
      strokeWidth: lastLine.strokeWidth(),
      globalCompositeOperation: lastLine.globalCompositeOperation()
    });
  }
});

// === EFFET TEXTURE UNIFIÉ (identique mobile/PC) ===
function createTextureEffect(x, y, color, size) {
  // Détection device pour adapter les performances
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowPerf = isMobile || navigator.hardwareConcurrency <= 2;
  
  // Paramètres unifiés mais adaptatifs
  const particleCount = isLowPerf ? 6 : 8;
  const spreadMultiplier = 1.4;
  const minDotSize = 1.2;
  const maxDotSizeMultiplier = 2.5;
  
  for (let i = 0; i < particleCount; i++) {
    // Position aléatoire avec spread constant
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * size * spreadMultiplier;
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    
    // Opacité uniforme
    const alpha = 0.35 + Math.random() * 0.35;
    
    // Taille de particule proportionnelle
    const dotSize = minDotSize + Math.random() * (size / maxDotSizeMultiplier);
    
    // Type de particule (70% lignes, 30% points)
    const useLineParticle = Math.random() < 0.7;
    
    if (useLineParticle) {
      // Particule ligne (effet spray principal)
      const lineLength = 1 + Math.random() * 2.5;
      const lineAngle = Math.random() * Math.PI * 2;
      const endX = x + offsetX + Math.cos(lineAngle) * lineLength;
      const endY = y + offsetY + Math.sin(lineAngle) * lineLength;
      
      const line = new Konva.Line({
        points: [x + offsetX, y + offsetY, endX, endY],
        stroke: color,
        strokeWidth: dotSize * 0.8,
        opacity: alpha,
        lineCap: 'round',
        lineJoin: 'round',
        hitStrokeWidth: 0,
        listening: false
      });
      layer.add(line);
    } else {
      // Particule point (variation)
      const dot = new Konva.Circle({
        x: x + offsetX,
        y: y + offsetY,
        radius: dotSize * 0.6,
        fill: color,
        opacity: alpha * 0.9,
        hitStrokeWidth: 0,
        listening: false
      });
      layer.add(dot);
    }
  }
  
  layer.batchDraw();
}

// === 🌐 SOCKET LISTENERS ===

// Initialize existing shapes on load (INCLUDING permanent traces)
socket.on('initShapes', shapes => {
  shapes.forEach(data => {
    if (data.type === 'permanentTrace') {
      // ✅ Recréer les tracés permanents depuis les données serveur
      let element;
      
      switch(data.shapeType) {
        case 'Star':
          element = new Konva.Star(data.attrs);
          break;
        case 'Circle':
          element = new Konva.Circle(data.attrs);
          break;
        case 'Line':
          element = new Konva.Line(data.attrs);
          break;
        case 'Ellipse':
          element = new Konva.Ellipse(data.attrs);
          break;
      }
      
      if (element) {
        element.id(data.id);
        element.isPermanentTrace = true;
        layer.add(element);
      }
    } else {
      // Tracé normal (brush classique)
      const line = new Konva.Line({
        id: data.id,
        points: data.points,
        stroke: data.stroke,
        strokeWidth: data.strokeWidth,
        globalCompositeOperation: data.globalCompositeOperation,
        lineCap: 'round',
        lineJoin: 'round'
      });
      layer.add(line);
    }
  });
  layer.draw();
  
  console.log(`✅ Loaded ${shapes.length} shapes (including permanent traces)`);
});

socket.on('brushEffect', (data) => {
  brushManager.createNetworkEffect(data);
});

socket.on('cleanupUserEffects', (data) => {
  brushManager.cleanupUserEffects(data.socketId);
});

socket.on('drawing', data => {
  let shape = layer.findOne('#' + data.id);
  if (shape) {
    shape.points(data.points);
    shape.strokeWidth(data.strokeWidth);
  } else {
    const line = new Konva.Line({
      id: data.id,
      points: data.points,
      stroke: data.stroke,
      strokeWidth: data.strokeWidth,
      globalCompositeOperation: data.globalCompositeOperation,
      lineCap: 'round',
      lineJoin: 'round'
    });
    layer.add(line);
  }
  layer.batchDraw();
});

socket.on('texture', data => {
  createTextureEffect(data.x, data.y, data.color, data.size);
});

socket.on('draw', data => {
  let shape = layer.findOne('#' + data.id);
  if (shape) {
    shape.points(data.points);
    shape.stroke(data.stroke);
    shape.strokeWidth(data.strokeWidth);
    shape.globalCompositeOperation(data.globalCompositeOperation);
  } else {
    const line = new Konva.Line({
      id: data.id,
      points: data.points,
      stroke: data.stroke,
      strokeWidth: data.strokeWidth,
      globalCompositeOperation: data.globalCompositeOperation,
      lineCap: 'round',
      lineJoin: 'round'
    });
    layer.add(line);
  }
  layer.draw();
});

socket.on('deleteShape', ({ id }) => {
  const shape = layer.findOne('#' + id);
  if (shape) {
    shape.destroy();
    layer.draw();
  }
});

socket.on('clearCanvas', () => {
  layer.destroyChildren();
  brushManager.clearEverything();
  layer.draw();
});

socket.on('restoreShapes', (shapes) => {
  layer.destroyChildren();
  brushManager.clearEverything();
  
  shapes.forEach(data => {
    if (data.type === 'permanentTrace') {
      let element;
      
      switch(data.shapeType) {
        case 'Star':
          element = new Konva.Star(data.attrs);
          break;
        case 'Circle':
          element = new Konva.Circle(data.attrs);
          break;
        case 'Line':
          element = new Konva.Line(data.attrs);
          break;
        case 'Ellipse':
          element = new Konva.Ellipse(data.attrs);
          break;
      }
      
      if (element) {
        element.id(data.id);
        element.isPermanentTrace = true;
        layer.add(element);
      }
    } else {
      const line = new Konva.Line({
        id: data.id,
        points: data.points,
        stroke: data.stroke,
        strokeWidth: data.strokeWidth,
        globalCompositeOperation: data.globalCompositeOperation,
        lineCap: 'round',
        lineJoin: 'round'
      });
      layer.add(line);
    }
  });
  layer.draw();
});

socket.on('shapeCreate', data => {
  let shape;
  const config = data.config;
  
  switch(data.type) {
    case 'shape-circle':
      shape = new Konva.Circle(config);
      break;
    case 'shape-rectangle':
      shape = new Konva.Rect(config);
      break;
    case 'shape-line':
    case 'shape-arrow':
      shape = new Konva.Line(config);
      break;
  }
  
  if (shape) {
    shape.id(data.id);
    layer.add(shape);
    layer.draw();
  }
});

socket.on('adminResetBrushEffects', () => {
  brushManager.clearAllEffects();
  showUndoNotification('Effets réinitialisés ✨');
});

// Initialisation du curseur
updateCursor();

console.log('✅ App.js V3.1 loaded - Unified texture rendering mobile/PC');