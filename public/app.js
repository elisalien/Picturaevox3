// public/app.js V5 - Multi-touch navigation + tutorial
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

const connectionManager = new ConnectionManager(socket);
const brushManager = new BrushManager(layer, socket);

let currentTool = 'brush';
let currentColor = '#FFFFFF';
let currentSize = parseInt(document.getElementById('size-slider').value, 10);
let currentZoom = 1;
let isDrawing = false;
let lastLine;
let currentId;
let lastPanPos = null;

// === MULTI-TOUCH STATE ===
let activeTouches = new Map();
let isPinching = false;
let lastPinchDist = 0;
let lastPinchCenter = null;

// === PREVENT BROWSER ZOOM ON CANVAS ===
const canvasContainer = document.getElementById('canvas-container');

// Block all default touch behaviors on the canvas
canvasContainer.addEventListener('touchstart', (e) => {
  e.preventDefault();
}, { passive: false });

canvasContainer.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

canvasContainer.addEventListener('touchend', (e) => {
  e.preventDefault();
}, { passive: false });

// Block double-tap zoom globally
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Block gesture events (Safari)
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

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
}, 120);

// === MULTI-TOUCH: PINCH ZOOM + 2-FINGER PAN ===
function getTouchDistance(t1, t2) {
  return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
}

function getTouchCenter(t1, t2) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2
  };
}

canvasContainer.addEventListener('touchstart', (e) => {
  for (const touch of e.changedTouches) {
    activeTouches.set(touch.identifier, touch);
  }

  if (activeTouches.size >= 2) {
    // Cancel any drawing in progress
    if (isDrawing) {
      isDrawing = false;
      lastLine = null;
    }
    isPinching = true;

    const touches = Array.from(activeTouches.values());
    lastPinchDist = getTouchDistance(touches[0], touches[1]);
    lastPinchCenter = getTouchCenter(touches[0], touches[1]);
  }
}, { passive: true });

canvasContainer.addEventListener('touchmove', (e) => {
  for (const touch of e.changedTouches) {
    activeTouches.set(touch.identifier, touch);
  }

  if (isPinching && activeTouches.size >= 2) {
    const touches = Array.from(activeTouches.values());
    const newDist = getTouchDistance(touches[0], touches[1]);
    const newCenter = getTouchCenter(touches[0], touches[1]);

    // Pinch zoom
    const scale = newDist / lastPinchDist;
    const oldScale = stage.scaleX();
    let newScale = oldScale * scale;
    newScale = Math.max(0.1, Math.min(5, newScale));

    const mousePointTo = {
      x: (lastPinchCenter.x - stage.x()) / oldScale,
      y: (lastPinchCenter.y - stage.y()) / oldScale
    };

    // Pan (two-finger drag)
    const dx = newCenter.x - lastPinchCenter.x;
    const dy = newCenter.y - lastPinchCenter.y;

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: newCenter.x - mousePointTo.x * newScale + dx,
      y: newCenter.y - mousePointTo.y * newScale + dy
    });
    stage.batchDraw();

    currentZoom = newScale;
    updateZoomDisplay();

    lastPinchDist = newDist;
    lastPinchCenter = newCenter;
  }
}, { passive: true });

function endPinch(e) {
  for (const touch of e.changedTouches) {
    activeTouches.delete(touch.identifier);
  }
  if (activeTouches.size < 2) {
    isPinching = false;
    lastPinchDist = 0;
    lastPinchCenter = null;
  }
}

canvasContainer.addEventListener('touchend', endPinch, { passive: true });
canvasContainer.addEventListener('touchcancel', endPinch, { passive: true });

// === INTERFACE UTILISATEUR ===

// Sélection des outils
document.querySelectorAll('.toolbar-main .tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.id === 'undo') {
      handleUndo();
      return;
    }
    document.querySelectorAll('.toolbar-main .tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.id;
    updateCursor();
  });
});

// Sélection des couleurs
document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    currentColor = dot.dataset.color;
  });
});

// Slider d'épaisseur
const sizeSlider = document.getElementById('size-slider');
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

// ZOOM CONTROLS
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');

function setZoom(newZoom) {
  newZoom = Math.max(0.1, Math.min(5, newZoom));
  const center = { x: stage.width() / 2, y: stage.height() / 2 };
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
  updateZoomDisplay();
}

function updateZoomDisplay() {
  const textEl = zoomResetBtn.querySelector('.zoom-text');
  if (textEl) textEl.textContent = Math.round(currentZoom * 100) + '%';
}

zoomInBtn.addEventListener('click', () => setZoom(currentZoom * 1.2));
zoomOutBtn.addEventListener('click', () => setZoom(currentZoom / 1.2));
zoomResetBtn.addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
  currentZoom = 1;
  updateZoomDisplay();
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

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    handleUndo();
  }
});

// === EVENEMENTS DE DESSIN ===

stage.on('mousedown touchstart pointerdown', (evt) => {
  // Block drawing if pinching
  if (isPinching) return;

  // On touch, only draw with single finger
  if (evt.evt && evt.evt.touches && evt.evt.touches.length > 1) return;

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
    emitTextureThrottled({ x: scenePos.x, y: scenePos.y, color: currentColor, size: pressureSize });
    createTextureEffect(scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }

  if (['neon', 'fire', 'sparkles', 'watercolor', 'electric', 'petals'].includes(currentTool)) {
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
  // Block drawing if pinching
  if (isPinching) return;

  if (evt.evt && evt.evt.touches && evt.evt.touches.length > 1) return;

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
    emitTextureThrottled({ x: scenePos.x, y: scenePos.y, color: currentColor, size: pressureSize });
    createTextureEffect(scenePos.x, scenePos.y, currentColor, pressureSize);
    return;
  }

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

  if (['neon', 'fire', 'sparkles', 'watercolor', 'electric', 'petals'].includes(currentTool)) {
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

// === EFFET TEXTURE ===
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

// === SOCKET LISTENERS ===

socket.on('initShapes', shapes => {
  shapes.forEach(data => {
    if (data.type === 'permanentTrace') {
      let element;
      switch(data.shapeType) {
        case 'Star': element = new Konva.Star(data.attrs); break;
        case 'Circle': element = new Konva.Circle(data.attrs); break;
        case 'Line': element = new Konva.Line(data.attrs); break;
        case 'Ellipse': element = new Konva.Ellipse(data.attrs); break;
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

socket.on('brushEffect', (data) => brushManager.createNetworkEffect(data));
socket.on('cleanupUserEffects', (data) => brushManager.cleanupUserEffects(data.socketId));

socket.on('drawing', data => {
  let shape = layer.findOne('#' + data.id);
  if (shape) {
    shape.points(data.points);
    shape.strokeWidth(data.strokeWidth);
  } else {
    const line = new Konva.Line({
      id: data.id, points: data.points, stroke: data.stroke,
      strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
      lineCap: 'round', lineJoin: 'round'
    });
    layer.add(line);
  }
  layer.batchDraw();
});

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
      let element;
      switch(data.shapeType) {
        case 'Star': element = new Konva.Star(data.attrs); break;
        case 'Circle': element = new Konva.Circle(data.attrs); break;
        case 'Line': element = new Konva.Line(data.attrs); break;
        case 'Ellipse': element = new Konva.Ellipse(data.attrs); break;
      }
      if (element) {
        element.id(data.id);
        element.isPermanentTrace = true;
        layer.add(element);
      }
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
    case 'shape-line': case 'shape-arrow': shape = new Konva.Line(config); break;
  }
  if (shape) { shape.id(data.id); layer.add(shape); layer.draw(); }
});

socket.on('adminResetBrushEffects', () => {
  brushManager.clearAllEffects();
  showNotification('Effets réinitialisés');
});

// === TUTORIAL ===
function showTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  overlay.style.display = 'flex';
  overlay.classList.remove('hiding');
}

function hideTutorial(permanent) {
  const overlay = document.getElementById('tutorial-overlay');
  overlay.classList.add('hiding');
  if (permanent) {
    localStorage.setItem('picturaevox-tutorial-seen', '1');
  }
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

document.getElementById('tutorial-start').addEventListener('click', () => hideTutorial(false));
document.getElementById('tutorial-skip').addEventListener('click', () => hideTutorial(true));
document.getElementById('show-tutorial').addEventListener('click', (e) => {
  e.preventDefault();
  showTutorial();
});

// Show tutorial on first visit
if (!localStorage.getItem('picturaevox-tutorial-seen')) {
  showTutorial();
}

updateCursor();
console.log('App.js V5 loaded — multi-touch navigation');
