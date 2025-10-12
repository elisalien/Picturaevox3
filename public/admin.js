// public/admin.js V4.0 - ADMIN VIEW ONLY (pas de dessin, juste navigation)
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

// Canvas énorme pour vue d'ensemble
const CANVAS_WIDTH = 10000;
const CANVAS_HEIGHT = 10000;

const stage = new Konva.Stage({
  container: 'canvas-container',
  width: window.innerWidth,
  height: window.innerHeight,
  draggable: true // ✅ Toujours draggable pour l'admin
});

const layer = new Konva.Layer();
stage.add(layer);

window.stage = stage;

// 🌐 Initialiser ConnectionManager
const connectionManager = new ConnectionManager(socket);

// ✅ Initialiser le BrushManager (pour recevoir les effets, mais pas pour dessiner)
const brushManager = new BrushManager(layer, socket);

let currentZoom = 0.5; // Zoom initial pour voir plus large
let currentTool = 'view'; // Mode visualisation uniquement

// === UTILITAIRES ===
function generateId() {
  return 'shape_' + Date.now() + '_' + Math.round(Math.random() * 10000);
}

// === 🗺️ MINIMAP ===
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const minimapContainer = document.getElementById('minimap-container');

function updateMinimap() {
  if (!minimapCanvas) return;
  
  minimapCanvas.width = minimapContainer.clientWidth;
  minimapCanvas.height = minimapContainer.clientHeight;
  
  const scaleX = minimapCanvas.width / CANVAS_WIDTH;
  const scaleY = minimapCanvas.height / CANVAS_HEIGHT;
  
  // Fond
  minimapCtx.fillStyle = '#111';
  minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  
  // Viewport actuel
  const viewX = -stage.x() / stage.scaleX();
  const viewY = -stage.y() / stage.scaleY();
  const viewW = stage.width() / stage.scaleX();
  const viewH = stage.height() / stage.scaleY();
  
  minimapCtx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(
    viewX * scaleX,
    viewY * scaleY,
    viewW * scaleX,
    viewH * scaleY
  );
  
  // Dessins (approximatif)
  minimapCtx.fillStyle = 'rgba(107, 91, 255, 0.5)';
  layer.children.forEach(shape => {
    if (shape.getClassName() === 'Line') {
      const points = shape.points();
      if (points.length >= 2) {
        const x = points[0] * scaleX;
        const y = points[1] * scaleY;
        minimapCtx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  });
}

// Mettre à jour la minimap régulièrement
setInterval(updateMinimap, 500);

// === 🎯 PAS DE DESSIN - SEULEMENT NAVIGATION ===

// Désactiver tous les événements de dessin
stage.on('mousedown touchstart pointerdown', (evt) => {
  // ✅ Admin ne peut PAS dessiner, seulement naviguer
  // Le draggable est géré automatiquement par Konva
  stage.container().style.cursor = 'grabbing';
});

stage.on('mouseup touchend pointerup', () => {
  stage.container().style.cursor = 'grab';
});

// === 🌐 SOCKET LISTENERS (RECEVOIR tous les dessins) ===

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
  // Créer l'effet texture visuellement
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

// Fonction notification admin
function showAdminNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(255, 140, 0, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    z-index: 3000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border-left: 4px solid #ff8c00;
    animation: adminNotification 2s ease-out;
  `;
  notification.textContent = `👑 ${message}`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 2000);
}

const adminStyle = document.createElement('style');
adminStyle.textContent = `
  @keyframes adminNotification {
    0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    20% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  }
`;
document.head.appendChild(adminStyle);

// === 🎨 INTERFACE ADMIN ===

const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const resetZoomBtn = document.getElementById('reset-zoom');
const eraserBtn = document.getElementById('eraser');
const resetEffectsBtn = document.getElementById('reset-effects');
const clearBtn = document.getElementById('clear-canvas');
const undoBtn = document.getElementById('undo');
const exportBtn = document.getElementById('export');
const backHomeBtn = document.getElementById('back-home');

// === 👑 POUVOIRS ADMIN ===

// Zoom
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
  showAdminNotification('Zoom +');
});

zoomOutBtn?.addEventListener('click', () => {
  setZoomAdmin(currentZoom / 1.3);
  showAdminNotification('Zoom -');
});

resetZoomBtn?.addEventListener('click', () => {
  stage.scale({ x: 0.5, y: 0.5 });
  stage.position({ x: stage.width() / 4, y: stage.height() / 4 });
  stage.batchDraw();
  currentZoom = 0.5;
  updateMinimap();
  showAdminNotification('Vue réinitialisée');
});

// Gomme objet
eraserBtn?.addEventListener('click', () => {
  currentTool = currentTool === 'eraser' ? 'view' : 'eraser';
  eraserBtn.classList.toggle('active');
  stage.container().style.cursor = currentTool === 'eraser' ? 'crosshair' : 'grab';
  showAdminNotification(currentTool === 'eraser' ? 'Mode suppression activé' : 'Mode navigation');
});

// Clic pour supprimer
stage.on('click', evt => {
  if (currentTool === 'eraser') {
    const target = evt.target;
    
    if (target !== stage && target.id()) {
      const id = target.id();
      
      target.stroke('#ff0000');
      target.opacity(0.5);
      layer.draw();
      
      setTimeout(() => {
        target.destroy();
        layer.draw();
        updateMinimap();
        connectionManager.emit('deleteShape', { id });
        showAdminNotification('Élément supprimé 🧽');
      }, 150);
    }
  }
});

// Reset effets
resetEffectsBtn?.addEventListener('click', () => {
  brushManager.clearAllEffects();
  layer.batchDraw();
  connectionManager.emit('adminResetBrushEffects');
  showAdminNotification('Effets réinitialisés ✨');
});

// Clear canvas
clearBtn?.addEventListener('click', () => {
  if (confirm('⚠️ ADMIN: Effacer TOUT pour TOUS les utilisateurs ?')) {
    layer.destroyChildren();
    brushManager.clearEverything();
    layer.draw();
    updateMinimap();
    
    connectionManager.emit('clearCanvas');
    connectionManager.emit('adminResetBrushEffects');
    
    showAdminNotification('Canvas nettoyé 🧼');
  }
});

// Undo
undoBtn?.addEventListener('click', () => {
  connectionManager.emit('undo');
  showAdminNotification('Undo global ↶');
});

// Export PNG
exportBtn?.addEventListener('click', () => {
  const uri = stage.toDataURL({ pixelRatio: 2 });
  const link = document.createElement('a');
  link.download = `picturavox-admin-${Date.now()}.png`;
  link.href = uri;
  link.click();
  showAdminNotification('Image exportée 📷');
});

// Retour public
backHomeBtn?.addEventListener('click', () => {
  window.location.href = '/';
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
      el.style.opacity = isUIVisible ? '1' : '0';
      el.style.pointerEvents = isUIVisible ? 'auto' : 'none';
      el.style.transition = 'opacity 0.3s ease';
    }
  });
  
  const toggleBtn = document.getElementById('toggle-ui');
  if (toggleBtn) {
    toggleBtn.textContent = isUIVisible ? '👁️' : '👁️‍🗨️';
    toggleBtn.style.opacity = '1';
    toggleBtn.style.pointerEvents = 'auto';
  }
  
  if (isUIVisible) {
    showAdminNotification('UI visible');
  }
}

document.getElementById('toggle-ui')?.addEventListener('click', toggleUI);

// Raccourci H pour toggle UI
document.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      toggleUI();
    }
  }
  
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    connectionManager.emit('undo');
    showAdminNotification('Undo global ↶');
  }
  
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    brushManager.clearAllEffects();
    layer.batchDraw();
    connectionManager.emit('adminResetBrushEffects');
    showAdminNotification('Effets réinitialisés ✨');
  }
  
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    if (confirm('⚠️ ADMIN: Reset COMPLET ?')) {
      layer.destroyChildren();
      brushManager.clearEverything();
      layer.draw();
      updateMinimap();
      connectionManager.emit('clearCanvas');
      connectionManager.emit('adminResetBrushEffects');
      showAdminNotification('Reset complet 🧼✨');
    }
  }
});

// Drag sur minimap
stage.on('dragend', updateMinimap);

// Initialisation
stage.container().style.cursor = 'grab';
updateMinimap();

console.log('✅ Admin.js V4.0 - VIEW ONLY MODE - Press H to toggle UI');
console.log('👑 Navigation: Drag canvas, Molette pour zoom, Clic pour supprimer en mode gomme');