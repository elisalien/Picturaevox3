// public/admin.js V3.1 - Rendu identique à public + pouvoirs admin + texture unifiée
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

window.stage = stage;

// 🌐 Initialiser ConnectionManager
const connectionManager = new ConnectionManager(socket);

// ✅ Initialiser le BrushManager unifié (MÊME RENDU que public)
const brushManager = new BrushManager(layer, socket);

let currentTool = 'pan';
let currentColor = '#FFFFFF';
let currentSize = parseInt(document.getElementById('size-slider-v3').value, 10);
let currentZoom = 1;
let isDrawing = false;
let lastLine;
let currentId;
let lastPanPos = null;

// === UTILITAIRES (identiques à app.js) ===
function throttle(func, wait) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    if (confirm('ADMIN: Reset COMPLET (dessins + effets) ?')) {
      layer.destroyChildren();
      brushManager.clearEverything();
      layer.draw();
      connectionManager.emit('clearCanvas');
      connectionManager.emit('adminResetBrushEffects');
      showAdminNotification('Reset COMPLET Global 🧼✨');
    }
  }
});

// === 🎨 ÉVÉNEMENTS DE DESSIN (identiques à app.js) ===

stage.on('mousedown touchstart pointerdown', (evt) => {
  const pointer = stage.getPointerPosition();
  
  if (currentTool === 'pan') {
    lastPanPos = pointer;
    isDrawing = false;
    stage.container().style.cursor = 'grabbing';
    return;
  }
  
  if (currentTool === 'eraser-admin') {
    return; // Géré par le clic
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

  // ✅ BRUSH ANIMÉS - MÊME RENDU QUE PUBLIC
  if (['neon', 'fire', 'sparkles', 'watercolor', 'electric', 'petals'].includes(currentTool)) {
    isDrawing = true;
    currentId = generateId();
    brushManager.createAndEmitEffect(currentTool, scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }
  
  // Mode brush normal
  isDrawing = true;
  currentId = generateId();
  
  lastLine = new Konva.Line({
    id: currentId,
    points: [scenePos.x, scenePos.y],
    stroke: currentColor,
    strokeWidth: pressureSize,
    globalCompositeOperation: 'source-over',
    lineCap: 'round',
    lineJoin: 'round'
  });
  layer.add(lastLine);
  
  emitDrawingThrottled({
    id: currentId,
    points: [scenePos.x, scenePos.y],
    stroke: currentColor,
    strokeWidth: pressureSize,
    globalCompositeOperation: 'source-over'
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

  // ✅ BRUSH ANIMÉS - MÊME RENDU
  if (['neon', 'fire', 'sparkles', 'watercolor', 'electric', 'petals'].includes(currentTool)) {
    brushManager.createAndEmitEffect(currentTool, scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }
  
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

// === 🌐 SOCKET LISTENERS (identiques à app.js) ===

socket.on('initShapes', shapes => {
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
  
  console.log(`✅ ADMIN: Loaded ${shapes.length} shapes`);
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

socket.on('brushEffect', (data) => {
  brushManager.createNetworkEffect(data);
});

socket.on('texture', data => {
  createTextureEffect(data.x, data.y, data.color, data.size);
});

socket.on('cleanupUserEffects', (data) => {
  brushManager.cleanupUserEffects(data.socketId);
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

socket.on('adminResetBrushEffects', () => {
  brushManager.clearAllEffects();
  layer.batchDraw();
});

// Fonction pour afficher une notification admin
function showAdminNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: rgba(255, 140, 0, 0.95);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    z-index: 3000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border-left: 4px solid #ff8c00;
    animation: adminNotification 2s ease-out;
  `;
  notification.textContent = `👑 ADMIN: ${message}`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 2000);
}

// Style CSS pour les notifications admin
const adminStyle = document.createElement('style');
adminStyle.textContent = `
  @keyframes adminNotification {
    0% {
      opacity: 0;
      transform: translateX(100px);
    }
    20% {
      opacity: 1;
      transform: translateX(0);
    }
    80% {
      opacity: 1;
      transform: translateX(0);
    }
    100% {
      opacity: 0;
      transform: translateX(100px);
    }
  }
`;
document.head.appendChild(adminStyle);

// Initialisation
stage.draggable(true);
stage.container().style.cursor = 'grab';
updateCursor();

console.log('✅ Admin.js V3.1 loaded - Unified texture rendering with public'); (now - lastTime >= wait) {
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

// Outils de dessin publics (toolbar du bas)
document.querySelectorAll('.toolbar-v3 .tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toolbar-v3 .tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.id;
    updateCursor();
  });
});

// Outils admin (toolbar du haut)
const panBtn = document.getElementById('pan');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const resetZoomBtn = document.getElementById('reset-zoom');
const eraserBtn = document.getElementById('eraser');
const resetEffectsBtn = document.getElementById('reset-effects');
const clearBtn = document.getElementById('clear-canvas');
const undoBtn = document.getElementById('undo');
const exportBtn = document.getElementById('export');
const backHomeBtn = document.getElementById('back-home');

// Slider d'épaisseur V3
const sizeSlider = document.getElementById('size-slider-v3');
const sizeValue = document.getElementById('size-value');

sizeSlider.addEventListener('input', e => {
  currentSize = parseInt(e.target.value, 10);
  sizeValue.textContent = currentSize + 'px';
  
  const percent = (currentSize - 1) / 19 * 100;
  sizeSlider.style.background = `linear-gradient(to right, 
    rgba(107, 91, 255, 0.8) 0%, 
    rgba(107, 91, 255, 0.8) ${percent}%, 
    rgba(107, 91, 255, 0.3) ${percent}%, 
    rgba(107, 91, 255, 0.3) 100%
  )`;
});

// === 👑 POUVOIRS ADMIN ===

// Pan admin
panBtn?.addEventListener('click', () => {
  setActiveAdminButton(panBtn);
  currentTool = 'pan';
  stage.draggable(true);
  stage.container().style.cursor = 'grab';
});

// Zoom admin
function setZoomAdmin(newZoom) {
  newZoom = Math.max(0.1, Math.min(5, newZoom));
  const oldScale = stage.scaleX();
  stage.scale({ x: newZoom, y: newZoom });
  stage.batchDraw();
  currentZoom = newZoom;
}

zoomInBtn?.addEventListener('click', () => {
  setActiveAdminButton(zoomInBtn);
  setZoomAdmin(currentZoom * 1.2);
});

zoomOutBtn?.addEventListener('click', () => {
  setActiveAdminButton(zoomOutBtn);
  setZoomAdmin(currentZoom / 1.2);
});

resetZoomBtn?.addEventListener('click', () => {
  setActiveAdminButton(panBtn);
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
  stage.draggable(true);
  currentZoom = 1;
  currentTool = 'pan';
  stage.container().style.cursor = 'grab';
});

// Gomme objet admin
eraserBtn?.addEventListener('click', () => {
  setActiveAdminButton(eraserBtn);
  currentTool = 'eraser-admin';
  stage.draggable(false);
  stage.container().style.cursor = 'crosshair';
});

// Reset effets
resetEffectsBtn?.addEventListener('click', () => {
  setActiveAdminButton(resetEffectsBtn);
  brushManager.clearAllEffects();
  layer.batchDraw();
  connectionManager.emit('adminResetBrushEffects');
  showAdminNotification('Effets Reset Globalement ✨');
});

// Clear canvas
clearBtn?.addEventListener('click', () => {
  if (confirm('ADMIN: Effacer TOUT pour TOUS les utilisateurs ?')) {
    setActiveAdminButton(clearBtn);
    
    layer.destroyChildren();
    brushManager.clearEverything();
    layer.draw();
    
    connectionManager.emit('clearCanvas');
    connectionManager.emit('adminResetBrushEffects');
    
    showAdminNotification('Reset COMPLET Global 🧼✨');
  }
});

// Undo admin
undoBtn?.addEventListener('click', () => {
  connectionManager.emit('undo');
  showAdminNotification('Undo Global ↶ (Limité à 2 actions)');
});

// Export PNG
exportBtn?.addEventListener('click', () => {
  setActiveAdminButton(exportBtn);
  const uri = stage.toDataURL({ pixelRatio: 4 });
  const link = document.createElement('a');
  link.download = 'picturavox-canvas.png';
  link.href = uri;
  link.click();
});

// Retour public
backHomeBtn?.addEventListener('click', () => {
  window.location.href = '/';
});

function setActiveAdminButton(activeBtn) {
  [panBtn, zoomInBtn, zoomOutBtn, resetZoomBtn, eraserBtn, resetEffectsBtn, clearBtn, undoBtn, exportBtn, backHomeBtn]
    .forEach(btn => btn?.classList.remove('active'));
  activeBtn?.classList.add('active');
}

// === 🔍 ZOOM CONTROLS PUBLICS (toolbar du bas) ===
const zoomInPublic = document.getElementById('zoom-in-public');
const zoomOutPublic = document.getElementById('zoom-out-public');
const zoomResetPublic = document.getElementById('zoom-reset-public');

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
  
  zoomResetPublic.textContent = Math.round(newZoom * 100) + '%';
  zoomResetPublic.style.fontSize = '10px';
  zoomResetPublic.style.fontWeight = '600';
}

zoomInPublic?.addEventListener('click', () => {
  setZoom(currentZoom * 1.2);
});

zoomOutPublic?.addEventListener('click', () => {
  setZoom(currentZoom / 1.2);
});

zoomResetPublic?.addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
  currentZoom = 1;
  zoomResetPublic.textContent = '⚫';
  zoomResetPublic.style.fontSize = '18px';
});

// Zoom molette
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
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  stage.position(newPos);
  stage.batchDraw();
  
  currentZoom = newScale;
  zoomResetPublic.textContent = Math.round(newScale * 100) + '%';
  zoomResetPublic.style.fontSize = '10px';
  zoomResetPublic.style.fontWeight = '600';
});

// Gestion du curseur
function updateCursor() {
  const container = stage.container();
  switch(currentTool) {
    case 'pan':
      container.style.cursor = 'grab';
      break;
    case 'eraser-admin':
      container.style.cursor = 'crosshair';
      break;
    default:
      container.style.cursor = 'crosshair';
  }
}

// Clic pour gomme objet admin
stage.on('click', evt => {
  if (currentTool === 'eraser-admin') {
    const target = evt.target;
    
    if (target.getClassName() === 'Line' && target.id()) {
      const shape = target;
      const id = shape.id();
      
      shape.stroke('#ff0000');
      shape.opacity(0.5);
      layer.draw();
      
      setTimeout(() => {
        shape.destroy();
        layer.draw();
        connectionManager.emit('deleteShape', { id });
        console.log(`🧽 ADMIN: Deleted shape ${id}`);
      }, 150);
    }
  }
});

// Feedback au survol en mode gomme admin
stage.on('mouseover', evt => {
  if (currentTool === 'eraser-admin') {
    const target = evt.target;
    if (target.getClassName() === 'Line' && target.id()) {
      target.opacity(0.7);
      target.stroke('#ff4444');
      layer.draw();
      stage.container().style.cursor = 'pointer';
    }
  }
});

stage.on('mouseout', evt => {
  if (currentTool === 'eraser-admin') {
    const target = evt.target;
    if (target.getClassName() === 'Line' && target.id()) {
      target.opacity(1);
      target.stroke(target.attrs.stroke || target.stroke());
      layer.draw();
      stage.container().style.cursor = 'crosshair';
    }
  }
});

// === RACCOURCIS CLAVIER ADMIN ===
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    connectionManager.emit('undo');
    showAdminNotification('Undo Global ↶');
  }
  
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    brushManager.clearAllEffects();
    layer.batchDraw();
    connectionManager.emit('adminResetBrushEffects');
    showAdminNotification('Effets Reset Globalement ✨');
  }
  
  if