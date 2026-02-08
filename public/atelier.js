// public/atelier.js V4 - Avec undo, resize, design amélioré
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

const connectionManager = new ConnectionManager(socket);
const brushManager = new BrushManager(layer, socket);

let currentTool = 'brush';
let currentColor = '#FF5252';
let currentSize = 4;
let isDrawing = false;
let lastLine;
let currentId;
let lastPanPos = null;
let currentZoom = 1;
let isCreatingShape = false;
let shapePreview = null;
let shapeStartPos = null;

// === RESIZE ===
window.addEventListener('resize', () => {
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  stage.batchDraw();
});

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
}, 150);

function createTextureEffect(x, y, color, size) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const particleCount = isMobile ? 6 : 8;

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * size * 1.4;
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    const alpha = 0.35 + Math.random() * 0.35;
    const dotSize = 1.2 + Math.random() * (size / 2.5);

    if (Math.random() < 0.7) {
      const lineLength = 1 + Math.random() * 2.5;
      const lineAngle = Math.random() * Math.PI * 2;
      const line = new Konva.Line({
        points: [x + offsetX, y + offsetY, x + offsetX + Math.cos(lineAngle) * lineLength, y + offsetY + Math.sin(lineAngle) * lineLength],
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

// === INTERFACE UTILISATEUR ===

// Gestion des outils (sidebar)
document.querySelectorAll('.artist-sidebar .tool-btn, .artist-sidebar .shape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.id === 'undo-btn') {
      handleUndo();
      return;
    }
    if (['zoom-in', 'zoom-out', 'reset-zoom', 'export', 'back-home'].includes(btn.id)) return;
    document.querySelectorAll('.artist-sidebar .tool-btn, .artist-sidebar .shape-btn').forEach(b => {
      if (!['zoom-in', 'zoom-out', 'reset-zoom', 'undo-btn', 'export', 'back-home'].includes(b.id)) {
        b.classList.remove('active');
      }
    });
    btn.classList.add('active');
    currentTool = btn.id;
    updateCursor();
  });
});

function updateCursor() {
  const container = stage.container();
  container.style.cursor = currentTool === 'pan' ? 'grab' : 'crosshair';
}

function handleUndo() {
  connectionManager.emit('undo');
  showNotification('Annulé ↶');
}

function showNotification(text) {
  const notification = document.createElement('div');
  notification.className = 'undo-notification';
  notification.textContent = text;
  document.body.appendChild(notification);
  setTimeout(() => {
    if (notification.parentNode) notification.parentNode.removeChild(notification);
  }, 800);
}

// Couleurs
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
    updateColorPicker();
  });
});

const colorPicker = document.getElementById('color-picker');
colorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
  document.querySelectorAll('.color-btn').forEach(c => c.classList.remove('active'));
});

function updateColorPicker() {
  colorPicker.value = currentColor;
}

// Slider épaisseur
const sizeSlider = document.getElementById('size-slider');
const sizeDisplay = document.getElementById('size-display');
sizeSlider.addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value, 10);
  sizeDisplay.textContent = currentSize + 'px';
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
  updateZoomDisplay();
});

// Boutons zoom
document.getElementById('zoom-in')?.addEventListener('click', () => {
  const newScale = Math.min(5, currentZoom * 1.2);
  stage.scale({ x: newScale, y: newScale });
  stage.batchDraw();
  currentZoom = newScale;
  updateZoomDisplay();
});

document.getElementById('zoom-out')?.addEventListener('click', () => {
  const newScale = Math.max(0.1, currentZoom / 1.2);
  stage.scale({ x: newScale, y: newScale });
  stage.batchDraw();
  currentZoom = newScale;
  updateZoomDisplay();
});

document.getElementById('reset-zoom')?.addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
  currentZoom = 1;
  updateZoomDisplay();
});

function updateZoomDisplay() {
  const zoomIndicator = document.getElementById('zoom-indicator');
  if (zoomIndicator) zoomIndicator.textContent = Math.round(currentZoom * 100) + '%';
}

// Pipette couleur
function pickColor(x, y) {
  const canvas = stage.toCanvas({ x: x, y: y, width: 1, height: 1 });
  const ctx = canvas.getContext('2d');
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  if (pixel[3] > 0) {
    const color = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
    currentColor = color;
    colorPicker.value = color;
    document.querySelectorAll('.color-btn').forEach(c => c.classList.remove('active'));
  }
}

// Fonctions formes
function createCircle(startPos, endPos) {
  const radius = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));
  return new Konva.Circle({ x: startPos.x, y: startPos.y, radius, stroke: currentColor, strokeWidth: currentSize, fill: 'transparent' });
}

function createRectangle(startPos, endPos) {
  return new Konva.Rect({
    x: Math.min(startPos.x, endPos.x), y: Math.min(startPos.y, endPos.y),
    width: Math.abs(endPos.x - startPos.x), height: Math.abs(endPos.y - startPos.y),
    stroke: currentColor, strokeWidth: currentSize, fill: 'transparent'
  });
}

function createTriangle(startPos, endPos) {
  const width = endPos.x - startPos.x;
  return new Konva.Line({
    points: [startPos.x, endPos.y, startPos.x + width/2, startPos.y, endPos.x, endPos.y, startPos.x, endPos.y],
    stroke: currentColor, strokeWidth: currentSize, fill: 'transparent', closed: true
  });
}

function createStar(startPos, endPos) {
  const centerX = (startPos.x + endPos.x) / 2;
  const centerY = (startPos.y + endPos.y) / 2;
  const radius = Math.sqrt(Math.pow(endPos.x - centerX, 2) + Math.pow(endPos.y - centerY, 2));
  return new Konva.Star({ x: centerX, y: centerY, numPoints: 5, innerRadius: radius * 0.4, outerRadius: radius, stroke: currentColor, strokeWidth: currentSize, fill: 'transparent' });
}

function createLine(startPos, endPos) {
  return new Konva.Line({ points: [startPos.x, startPos.y, endPos.x, endPos.y], stroke: currentColor, strokeWidth: currentSize, lineCap: 'round' });
}

function createArrow(startPos, endPos) {
  const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
  const arrowLength = 20;
  const arrowAngle = Math.PI / 6;
  const arrow1X = endPos.x - arrowLength * Math.cos(angle - arrowAngle);
  const arrow1Y = endPos.y - arrowLength * Math.sin(angle - arrowAngle);
  const arrow2X = endPos.x - arrowLength * Math.cos(angle + arrowAngle);
  const arrow2Y = endPos.y - arrowLength * Math.sin(angle + arrowAngle);
  return new Konva.Line({
    points: [startPos.x, startPos.y, endPos.x, endPos.y, arrow1X, arrow1Y, endPos.x, endPos.y, arrow2X, arrow2Y],
    stroke: currentColor, strokeWidth: currentSize, lineCap: 'round'
  });
}

// Raccourcis clavier
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    handleUndo();
  }
});

// === EVENEMENTS DE DESSIN ===

stage.on('mousedown touchstart pointerdown', (evt) => {
  const pointer = stage.getPointerPosition();

  if (currentTool === 'pan') { lastPanPos = pointer; return; }
  if (currentTool === 'eyedropper') { pickColor(getScenePos(pointer).x, getScenePos(pointer).y); return; }

  if (currentTool.startsWith('shape-')) {
    isCreatingShape = true;
    shapeStartPos = getScenePos(pointer);
    return;
  }

  const pressure = getPressure(evt);
  const pressureSize = getPressureSize(pressure);
  const scenePos = getScenePos(pointer);

  if (currentTool === 'texture') {
    isDrawing = true;
    currentId = generateId();
    emitTextureThrottled({ x: scenePos.x, y: scenePos.y, color: currentColor, size: pressureSize });
    createTextureEffect(scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }

  if (['sparkles', 'watercolor', 'electric', 'petals', 'neon', 'fire'].includes(currentTool)) {
    isDrawing = true;
    currentId = generateId();
    brushManager.createAndEmitEffect(currentTool, scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }

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
    stage.x(stage.x() + pointer.x - lastPanPos.x);
    stage.y(stage.y() + pointer.y - lastPanPos.y);
    stage.batchDraw();
    lastPanPos = pointer;
    return;
  }

  if (isCreatingShape && shapeStartPos) {
    if (shapePreview) shapePreview.destroy();
    const scenePos = getScenePos(pointer);
    switch(currentTool) {
      case 'shape-circle': shapePreview = createCircle(shapeStartPos, scenePos); break;
      case 'shape-rectangle': shapePreview = createRectangle(shapeStartPos, scenePos); break;
      case 'shape-triangle': shapePreview = createTriangle(shapeStartPos, scenePos); break;
      case 'shape-star': shapePreview = createStar(shapeStartPos, scenePos); break;
      case 'shape-line': shapePreview = createLine(shapeStartPos, scenePos); break;
      case 'shape-arrow': shapePreview = createArrow(shapeStartPos, scenePos); break;
    }
    if (shapePreview) {
      shapePreview.opacity(0.5);
      layer.add(shapePreview);
      layer.batchDraw();
    }
    return;
  }

  if (!isDrawing) return;
  const pressure = getPressure(evt);
  const pressureSize = getPressureSize(pressure);
  const scenePos = getScenePos(pointer);

  if (currentTool === 'texture') {
    emitTextureThrottled({ x: scenePos.x, y: scenePos.y, color: currentColor, size: pressureSize });
    createTextureEffect(scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }

  if (['sparkles', 'watercolor', 'electric', 'petals', 'neon', 'fire'].includes(currentTool)) {
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
  if (currentTool === 'pan') { lastPanPos = null; return; }

  if (isCreatingShape && shapePreview) {
    shapePreview.opacity(1);
    const shapeId = generateId();
    shapePreview.id(shapeId);
    connectionManager.emit('shapeCreate', { id: shapeId, type: currentTool, config: shapePreview.getAttrs() });
    isCreatingShape = false;
    shapeStartPos = null;
    shapePreview = null;
    return;
  }

  if (!isDrawing) return;
  isDrawing = false;

  if (['sparkles', 'watercolor', 'electric', 'petals', 'neon', 'fire'].includes(currentTool)) {
    brushManager.endStroke();
    return;
  }
  if (currentTool === 'texture') return;

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

// Bouton Undo dédié
document.getElementById('undo-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleUndo();
});

// Boutons d'action
document.getElementById('export')?.addEventListener('click', () => {
  const uri = stage.toDataURL({ pixelRatio: 2 });
  const link = document.createElement('a');
  link.download = 'atelier-canvas.png';
  link.href = uri;
  link.click();
});

document.getElementById('back-home')?.addEventListener('click', () => {
  window.location.href = '/';
});

// === SOCKET LISTENERS ===

socket.on('initShapes', shapes => {
  shapes.forEach(data => {
    if (data.type === 'permanentTrace') {
      brushManager.renderPermanentTraces([data]);
    } else {
      const line = new Konva.Line({
        id: data.id, points: data.points, stroke: data.stroke,
        strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
        lineCap: 'round', lineJoin: 'round'
      });
      layer.add(line);
    }
  });
  layer.draw();
});

socket.on('drawing', data => {
  let shape = layer.findOne('#' + data.id);
  if (!shape) {
    shape = new Konva.Line({
      id: data.id, points: data.points, stroke: data.stroke,
      strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
      lineCap: 'round', lineJoin: 'round'
    });
    layer.add(shape);
  } else {
    shape.points(data.points);
    shape.strokeWidth(data.strokeWidth);
  }
  layer.batchDraw();
});

socket.on('brushEffect', (data) => brushManager.createNetworkEffect(data));
socket.on('cleanupUserEffects', (data) => brushManager.cleanupUserEffects(data.socketId));
socket.on('texture', data => createTextureEffect(data.x, data.y, data.color, data.size));

socket.on('draw', data => {
  let shape = layer.findOne('#' + data.id);
  if (shape) {
    shape.points(data.points);
    shape.stroke(data.stroke);
    shape.strokeWidth(data.strokeWidth);
    shape.globalCompositeOperation(data.globalCompositeOperation);
  } else {
    const line = new Konva.Line({
      id: data.id, points: data.points, stroke: data.stroke,
      strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
      lineCap: 'round', lineJoin: 'round'
    });
    layer.add(line);
  }
  layer.draw();
});

socket.on('deleteShape', ({ id }) => {
  const shape = layer.findOne('#' + id);
  if (shape) { shape.destroy(); layer.draw(); }
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
      brushManager.renderPermanentTraces([data]);
    } else {
      const line = new Konva.Line({
        id: data.id, points: data.points, stroke: data.stroke,
        strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
        lineCap: 'round', lineJoin: 'round'
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
    case 'shape-circle': shape = new Konva.Circle(config); break;
    case 'shape-rectangle': shape = new Konva.Rect(config); break;
    case 'shape-triangle': case 'shape-line': case 'shape-arrow': shape = new Konva.Line(config); break;
    case 'shape-star': shape = new Konva.Star(config); break;
  }
  if (shape) { shape.id(data.id); layer.add(shape); layer.draw(); }
});

socket.on('adminResetBrushEffects', () => {
  brushManager.clearAllEffects();
  showNotification('Effets réinitialisés');
});

console.log('Atelier.js V4 loaded');
