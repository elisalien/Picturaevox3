// public/admin.js V5.0 - STABLE - Turquoise - View Only
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

// Canvas standard
const stage = new Konva.Stage({
  container: 'canvas-container',
  width: window.innerWidth,
  height: window.innerHeight,
  draggable: true
});

const layer = new Konva.Layer();
stage.add(layer);

window.stage = stage;

// 🌐 Initialiser ConnectionManager
const connectionManager = new ConnectionManager(socket);

// ✅ Initialiser le BrushManager
const brushManager = new BrushManager(layer, socket);

let currentZoom = 0.5;
let currentTool = 'view';

// === 🗺️ MINIMAP ===
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const minimapContainer = document.getElementById('minimap-container');

const CANVAS_VIRTUAL_SIZE = 5000;

function updateMinimap() {
  if (!minimapCanvas || !minimapContainer) return;
  
  const w = minimapContainer.clientWidth;
  const h = minimapContainer.clientHeight;
  
  minimapCanvas.width = w;
  minimapCanvas.height = h;
  
  const scaleX = w / CANVAS_VIRTUAL_SIZE;
  const scaleY = h / CANVAS_VIRTUAL_SIZE;
  
  // Fond
  minimapCtx.fillStyle = '#0a0a0a';
  minimapCtx.fillRect(0, 0, w, h);
  
  // Viewport actuel
  const viewX = -stage.x() / stage.scaleX();
  const viewY = -stage.y() / stage.scaleY();
  const viewW = stage.width() / stage.scaleX();
  const viewH = stage.height() / stage.scaleY();
  
  minimapCtx.strokeStyle = 'rgba(0, 217, 255, 0.8)';
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(
    viewX * scaleX,
    viewY * scaleY,
    viewW * scaleX,
    viewH * scaleY
  );
  
  // Dessins (points simplifiés)
  minimapCtx.fillStyle = 'rgba(107, 91, 255, 0.6)';
  const children = layer.getChildren();
  for (let i = 0; i < children.length; i++) {
    const shape = children[i];
    if (shape.getClassName() === 'Line' && shape.points) {
      const points = shape.points();
      if (points.length >= 2) {
        const x = points[0] * scaleX;
        const y = points[1] * scaleY;
        minimapCtx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }
}

// Update minimap régulièrement
setInterval(updateMinimap, 1000);

// === 🎨 GESTION CANVAS ===

stage.on('mousedown touchstart pointerdown', () => {
  if (currentTool === 'view') {
    stage.container().style.cursor = 'grabbing';
  }
});

stage.on('mouseup touchend pointerup', () => {
  if (currentTool === 'view') {
    stage.container().style.cursor = 'grab';
  }
});

stage.on('dragend', updateMinimap);

// === 🌐 SOCKET LISTENERS ===

socket.on('initShapes', shapes => {
  console.log(`📥 ADMIN: Loading ${shapes.length} shapes...`);
  
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
  updateMinimap();
  
  console.log(`✅ ADMIN: ${shapes.length} shapes loaded`);
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
  const particleCount = 4;
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * data.size * 1.4;
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    
    const dot = new Konva.Circle({
      x: data.x + offsetX,
      y: data.y + offsetY,
      radius: 1 + Math.random() * 2,
      fill: data.color,
      opacity: 0.4 + Math.random() * 0.3,
      hitStrokeWidth: 0,
      listening: false
    });
    layer.add(dot);
  }
  layer.batchDraw();
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
  updateMinimap();
});

socket.on('deleteShape', ({ id }) => {
  const shape = layer.findOne('#' + id);
  if (shape) {
    shape.destroy();
    layer.draw();
    updateMinimap();
  }
});

socket.on('clearCanvas', () => {
  layer.destroyChildren();
  brushManager.clearEverything();
  layer.draw();
  updateMinimap();
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
  updateMinimap();
});

socket.on('adminResetBrushEffects', () => {
  brushManager.clearAllEffects();
  layer.batchDraw();
});

// === 💬 NOTIFICATIONS ===
function showAdminNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'admin-notification';
  notification.textContent = `👑 ${message}`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 2000);
}

// === 🎛️ INTERFACE ADMIN ===

const centerOriginBtn = document.getElementById('center-origin');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const resetZoomBtn = document.getElementById('reset-zoom');
const eraserBtn = document.getElementById('eraser');
const resetEffectsBtn = document.getElementById('reset-effects');
const clearBtn = document.getElementById('clear-canvas');
const undoBtn = document.getElementById('undo');
const exportBtn = document.getElementById('export');
const backHomeBtn = document.getElementById('back-home');

// === 🎯 CENTRER SUR ORIGINE ===
centerOriginBtn?.addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
  currentZoom = 1;
  updateMinimap();
  showAdminNotification('Centré sur origine (0,0)');
});

// === 🔍 ZOOM ===
function setZoomAdmin(newZoom) {
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
  updateMinimap();
}

zoomInBtn?.addEventListener('click', () => {
  setZoomAdmin(currentZoom * 1.3);
  showAdminNotification(`Zoom: ${Math.round(currentZoom * 100)}%`);
});

zoomOutBtn?.addEventListener('click', () => {
  setZoomAdmin(currentZoom / 1.3);
  showAdminNotification(`Zoom: ${Math.round(currentZoom * 100)}%`);
});

resetZoomBtn?.addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.batchDraw();
  currentZoom = 1;
  updateMinimap();
  showAdminNotification('Zoom 100%');
});

// === 🧽 GOMME ===
eraserBtn?.addEventListener('click', () => {
  currentTool = currentTool === 'eraser' ? 'view' : 'eraser';
  eraserBtn.classList.toggle('active');
  stage.container().style.cursor = currentTool === 'eraser' ? 'crosshair' : 'grab';
  showAdminNotification(currentTool === 'eraser' ? 'Mode suppression' : 'Mode navigation');
});

stage.on('click', evt => {
  if (currentTool === 'eraser') {
    const target = evt.target;
    
    if (target !== stage && target.id && target.id()) {
      const id = target.id();
      
      target.stroke('#ff0000');
      target.opacity(0.5);
      layer.draw();
      
      setTimeout(() => {
        target.destroy();
        layer.draw();
        updateMinimap();
        connectionManager.emit('deleteShape', { id });
        showAdminNotification('Supprimé 🧽');
      }, 150);
    }
  }
});

// === ✨ RESET EFFETS ===
resetEffectsBtn?.addEventListener('click', () => {
  brushManager.clearAllEffects();
  layer.batchDraw();
  connectionManager.emit('adminResetBrushEffects');
  showAdminNotification('Effets réinitialisés ✨');
});

// === 🧼 CLEAR ===
clearBtn?.addEventListener('click', () => {
  if (confirm('⚠️ Effacer TOUT pour TOUS ?')) {
    layer.destroyChildren();
    brushManager.clearEverything();
    layer.draw();
    updateMinimap();
    
    connectionManager.emit('clearCanvas');
    connectionManager.emit('adminResetBrushEffects');
    
    showAdminNotification('Canvas nettoyé 🧼');
  }
});

// === ↶ UNDO ===
undoBtn?.addEventListener('click', () => {
  connectionManager.emit('undo');
  showAdminNotification('Undo global ↶');
});

// === 📷 EXPORT ===
exportBtn?.addEventListener('click', () => {
  const uri = stage.toDataURL({ pixelRatio: 2 });
  const link = document.createElement('a');
  link.download = `picturavox-admin-${Date.now()}.png`;
  link.href = uri;
  link.click();
  showAdminNotification('Exporté 📷');
});

// === 🏠 RETOUR ===
backHomeBtn?.addEventListener('click', () => {
  window.location.href = '/';
});

// === 🖱️ ZOOM MOLETTE ===
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
  updateMinimap();
});

// === 👁️ TOGGLE UI ===
let isUIVisible = true;

function toggleUI() {
  isUIVisible = !isUIVisible;
  
  const elementsToToggle = [
    document.querySelector('.admin-toolbar'),
    document.querySelector('.admin-badge'),
    document.querySelector('.status-bar'),
    document.getElementById('minimap-container')
  ];
  
  elementsToToggle.forEach(el => {
    if (el) {
      if (isUIVisible) {
        el.classList.remove('ui-hidden');
      } else {
        el.classList.add('ui-hidden');
      }
    }
  });
  
  const toggleBtn = document.getElementById('toggle-ui');
  if (toggleBtn) {
    toggleBtn.textContent = isUIVisible ? '👁️' : '👁️‍🗨️';
  }
  
  showAdminNotification(isUIVisible ? 'UI visible' : 'UI cachée');
}

document.getElementById('toggle-ui')?.addEventListener('click', toggleUI);

// === ⌨️ RACCOURCIS CLAVIER ===
document.addEventListener('keydown', (e) => {
  // H pour toggle UI
  if (e.key === 'h' || e.key === 'H') {
    if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      toggleUI();
    }
  }
  
  // Ctrl+Z pour undo
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    connectionManager.emit('undo');
    showAdminNotification('Undo global ↶');
  }
  
  // Ctrl+Shift+E pour reset effets
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    brushManager.clearAllEffects();
    layer.batchDraw();
    connectionManager.emit('adminResetBrushEffects');
    showAdminNotification('Effets réinitialisés ✨');
  }
  
  // Ctrl+Shift+R pour clear canvas
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    if (confirm('⚠️ Reset COMPLET ?')) {
      layer.destroyChildren();
      brushManager.clearEverything();
      layer.draw();
      updateMinimap();
      connectionManager.emit('clearCanvas');
      connectionManager.emit('adminResetBrushEffects');
      showAdminNotification('Reset complet 🧼✨');
    }
  }
  
  // Échap pour désactiver gomme
  if (e.key === 'Escape' && currentTool === 'eraser') {
    currentTool = 'view';
    eraserBtn?.classList.remove('active');
    stage.container().style.cursor = 'grab';
    showAdminNotification('Mode navigation');
  }
});

// === 🎬 INITIALISATION ===
stage.container().style.cursor = 'grab';
stage.scale({ x: 0.5, y: 0.5 });
stage.position({ 
  x: window.innerWidth / 4, 
  y: window.innerHeight / 4 
});
updateMinimap();

console.log('✅ Admin.js V5.0 - Turquoise - Stable');
console.log('👑 Raccourcis: H=Toggle UI | Ctrl+Z=Undo | Ctrl+Shift+E=Reset effets | Ctrl+Shift+R=Clear');
console.log('🎯 Centrer sur origine | Drag pour naviguer | Molette pour zoom');