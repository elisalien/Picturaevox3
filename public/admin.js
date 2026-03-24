// public/admin.js V6.0 - Picturaevox 3.5 - Admin Control Panel with Game Management
// =================================================================================

const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

// === KONVA CANVAS SETUP ===
const stage = new Konva.Stage({
  container: 'canvas-container',
  width: window.innerWidth,
  height: window.innerHeight,
  draggable: true
});

const layer = new Konva.Layer();
stage.add(layer);
window.stage = stage;

// === CONNECTION MANAGER ===
const connectionManager = new ConnectionManager(socket);

// === BRUSH MANAGER ===
const brushManager = new BrushManager(layer, socket);

// === STATE ===
let currentZoom = 0.5;
let currentTool = 'view'; // 'view' or 'eraser'
let isUIVisible = true;

const adminState = {
  games: {
    cadavre:   { enabled: false, status: 'stopped', players: 0 },
    telephone: { enabled: false, status: 'stopped', players: 0 },
    devine:    { enabled: false, status: 'stopped', players: 0 },
    theme:     { enabled: false, status: 'stopped', players: 0 }
  },
  outputLayout: {
    canvas: true,
    cadavre: false,
    telephone: false,
    devine: false,
    theme: false
  },
  connectedPlayers: 0
};

// === RESIZE ===
window.addEventListener('resize', () => {
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  stage.batchDraw();
  updateMinimap();
});

// =============================================
// MINIMAP
// =============================================
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const CANVAS_VIRTUAL_SIZE = 8000;

function updateMinimap() {
  if (!minimapCanvas || !minimapCtx) return;

  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  if (w <= 0 || h <= 0) return;

  const scaleX = w / CANVAS_VIRTUAL_SIZE;
  const scaleY = h / CANVAS_VIRTUAL_SIZE;

  // Dark background
  minimapCtx.fillStyle = '#080810';
  minimapCtx.fillRect(0, 0, w, h);

  // Subtle grid
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  minimapCtx.lineWidth = 1;
  const gridSize = 1000;
  for (let x = 0; x < CANVAS_VIRTUAL_SIZE; x += gridSize) {
    minimapCtx.beginPath();
    minimapCtx.moveTo(x * scaleX, 0);
    minimapCtx.lineTo(x * scaleX, h);
    minimapCtx.stroke();
  }
  for (let y = 0; y < CANVAS_VIRTUAL_SIZE; y += gridSize) {
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, y * scaleY);
    minimapCtx.lineTo(w, y * scaleY);
    minimapCtx.stroke();
  }

  // Draw shape positions
  minimapCtx.fillStyle = 'rgba(0, 217, 255, 0.6)';
  const children = layer.getChildren();
  for (let i = 0; i < children.length; i++) {
    const shape = children[i];
    if (shape.getClassName() === 'Line' && typeof shape.points === 'function') {
      const points = shape.points();
      if (points && points.length >= 2) {
        const x = (points[0] + CANVAS_VIRTUAL_SIZE / 2) * scaleX;
        const y = (points[1] + CANVAS_VIRTUAL_SIZE / 2) * scaleY;
        minimapCtx.fillRect(x - 1, y - 1, 3, 3);
      }
    }
    if (shape.getClassName() === 'Circle') {
      const x = (shape.x() + CANVAS_VIRTUAL_SIZE / 2) * scaleX;
      const y = (shape.y() + CANVAS_VIRTUAL_SIZE / 2) * scaleY;
      minimapCtx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  // Viewport rectangle
  const viewX = (-stage.x() / stage.scaleX() + CANVAS_VIRTUAL_SIZE / 2) * scaleX;
  const viewY = (-stage.y() / stage.scaleY() + CANVAS_VIRTUAL_SIZE / 2) * scaleY;
  const viewW = (stage.width() / stage.scaleX()) * scaleX;
  const viewH = (stage.height() / stage.scaleY()) * scaleY;

  minimapCtx.strokeStyle = 'rgba(0, 217, 255, 0.85)';
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(viewX, viewY, viewW, viewH);

  // Center origin marker
  const centerX = (CANVAS_VIRTUAL_SIZE / 2) * scaleX;
  const centerY = (CANVAS_VIRTUAL_SIZE / 2) * scaleY;
  minimapCtx.fillStyle = 'rgba(0, 217, 255, 0.4)';
  minimapCtx.fillRect(centerX - 2, centerY - 2, 4, 4);
}

setInterval(updateMinimap, 500);
setTimeout(updateMinimap, 100);

// =============================================
// CANVAS INTERACTION
// =============================================

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

// Wheel zoom
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
  newScale = Math.max(0.05, Math.min(8, newScale));

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

// Click to delete in eraser mode
stage.on('click', (evt) => {
  if (currentTool !== 'eraser') return;
  const target = evt.target;
  if (target !== stage && target.id && target.id()) {
    const id = target.id();
    // Flash red then destroy
    target.stroke('#ff0000');
    target.opacity(0.5);
    layer.draw();
    setTimeout(() => {
      target.destroy();
      layer.draw();
      updateMinimap();
      connectionManager.emit('deleteShape', { id });
      showAdminNotification('Element supprime');
    }, 120);
  }
});

// =============================================
// SOCKET: CANVAS EVENTS
// =============================================

socket.on('connect', () => {
  socket.emit('admin:join');
  console.log('[Admin] Connected, emitted admin:join');
});

socket.on('initShapes', (shapes) => {
  console.log(`[Admin] Loading ${shapes.length} shapes...`);
  shapes.forEach((data) => {
    if (data.type === 'permanentTrace') {
      let element;
      switch (data.shapeType) {
        case 'Star':    element = new Konva.Star(data.attrs); break;
        case 'Circle':  element = new Konva.Circle(data.attrs); break;
        case 'Line':    element = new Konva.Line(data.attrs); break;
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
  updateMinimap();
  console.log(`[Admin] ${shapes.length} shapes loaded`);
});

socket.on('drawing', (data) => {
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

socket.on('draw', (data) => {
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

socket.on('brushEffect', (data) => {
  brushManager.createNetworkEffect(data);
});

socket.on('cleanupUserEffects', (data) => {
  brushManager.cleanupUserEffects(data.socketId);
});

socket.on('texture', (data) => {
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * data.size * 1.4;
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    const alpha = 0.35 + Math.random() * 0.35;
    const dotSize = 1.2 + Math.random() * (data.size / 2.5);

    if (Math.random() < 0.7) {
      const lineLength = 1 + Math.random() * 2.5;
      const lineAngle = Math.random() * Math.PI * 2;
      const line = new Konva.Line({
        points: [
          data.x + offsetX, data.y + offsetY,
          data.x + offsetX + Math.cos(lineAngle) * lineLength,
          data.y + offsetY + Math.sin(lineAngle) * lineLength
        ],
        stroke: data.color,
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
        x: data.x + offsetX,
        y: data.y + offsetY,
        radius: dotSize * 0.6,
        fill: data.color,
        opacity: alpha * 0.9,
        hitStrokeWidth: 0,
        listening: false
      });
      layer.add(dot);
    }
  }
  layer.batchDraw();
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
  console.log('[Admin] Canvas cleared by server');
});

socket.on('restoreShapes', (shapes) => {
  layer.destroyChildren();
  brushManager.clearEverything();
  shapes.forEach((data) => {
    if (data.type === 'permanentTrace') {
      let element;
      switch (data.shapeType) {
        case 'Star':    element = new Konva.Star(data.attrs); break;
        case 'Circle':  element = new Konva.Circle(data.attrs); break;
        case 'Line':    element = new Konva.Line(data.attrs); break;
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
  updateMinimap();
});

socket.on('adminResetBrushEffects', () => {
  brushManager.clearAllEffects();
  layer.batchDraw();
});

// =============================================
// SOCKET: ADMIN STATE EVENTS
// =============================================

socket.on('admin:state', (state) => {
  console.log('[Admin] Received admin:state', state);
  if (state.games) {
    Object.keys(state.games).forEach((game) => {
      if (adminState.games[game]) {
        Object.assign(adminState.games[game], state.games[game]);
      }
    });
  }
  if (state.outputLayout) {
    Object.assign(adminState.outputLayout, state.outputLayout);
  }
  if (typeof state.connectedPlayers === 'number') {
    adminState.connectedPlayers = state.connectedPlayers;
  }
  refreshAllUI();
});

socket.on('admin:gamesUpdate', (gamesData) => {
  console.log('[Admin] Received admin:gamesUpdate', gamesData);
  if (gamesData) {
    Object.keys(gamesData).forEach((game) => {
      if (adminState.games[game]) {
        Object.assign(adminState.games[game], gamesData[game]);
      }
    });
  }
  refreshGameCards();
});

// Listen for Cadavre Exquis specific events
socket.on('game:playerList', (playerList) => {
  adminState.games.cadavre.players = playerList.length;
  updateGameCardUI('cadavre');
});

socket.on('game:status', (status) => {
  adminState.games.cadavre.status = status;
  updateGameCardUI('cadavre');
});

socket.on('game:started', (data) => {
  adminState.games.cadavre.status = 'playing';
  updateGameCardUI('cadavre');
  showAdminNotification('Cadavre Exquis demarre !');
});

socket.on('game:revealing', (results) => {
  adminState.games.cadavre.status = 'revealing';
  updateGameCardUI('cadavre');
  showAdminNotification('Cadavre Exquis - Revelation !');
});

socket.on('game:reset', () => {
  adminState.games.cadavre.status = 'waiting';
  updateGameCardUI('cadavre');
});

socket.on('game:timer', (value) => {
  // Could display timer in admin if desired
});

// Generic game events for other games
socket.on('telephone:update', (data) => {
  if (data.status) adminState.games.telephone.status = data.status;
  if (typeof data.players === 'number') adminState.games.telephone.players = data.players;
  updateGameCardUI('telephone');
});

socket.on('devine:update', (data) => {
  if (data.status) adminState.games.devine.status = data.status;
  if (typeof data.players === 'number') adminState.games.devine.players = data.players;
  updateGameCardUI('devine');
});

socket.on('theme:update', (data) => {
  if (data.status) adminState.games.theme.status = data.status;
  if (typeof data.players === 'number') adminState.games.theme.players = data.players;
  updateGameCardUI('theme');
});

// =============================================
// UI UPDATE FUNCTIONS
// =============================================

function refreshAllUI() {
  refreshGameCards();
  refreshOutputLayout();
  updatePlayerCount();
}

function refreshGameCards() {
  ['cadavre', 'telephone', 'devine', 'theme'].forEach(updateGameCardUI);
}

function updateGameCardUI(game) {
  const state = adminState.games[game];
  if (!state) return;

  const card = document.getElementById('card-' + game);
  const statusEl = document.getElementById('status-' + game);
  const playersEl = document.getElementById('players-' + game);
  const toggleEl = document.getElementById('toggle-' + game);
  const launchBtn = document.getElementById('launch-' + game);

  if (card) {
    card.classList.toggle('enabled', state.enabled);
  }

  if (statusEl) {
    statusEl.className = 'game-card-status';
    if (!state.enabled) {
      statusEl.classList.add('stopped');
      statusEl.textContent = 'OFF';
    } else if (state.status === 'playing') {
      statusEl.classList.add('playing');
      statusEl.textContent = 'EN JEU';
    } else if (state.status === 'revealing') {
      statusEl.classList.add('revealing');
      statusEl.textContent = 'REVEAL';
    } else if (state.status === 'waiting') {
      statusEl.classList.add('waiting');
      statusEl.textContent = 'LOBBY';
    } else {
      statusEl.classList.add('stopped');
      statusEl.textContent = state.enabled ? 'PRET' : 'OFF';
    }
  }

  if (playersEl) {
    playersEl.textContent = state.players + ' joueur' + (state.players !== 1 ? 's' : '');
  }

  if (toggleEl) {
    toggleEl.checked = state.enabled;
  }

  if (launchBtn) {
    launchBtn.disabled = !state.enabled || state.status === 'playing';
  }
}

function refreshOutputLayout() {
  const layout = adminState.outputLayout;
  document.getElementById('layout-canvas').checked = layout.canvas;
  document.getElementById('layout-cadavre').checked = layout.cadavre;
  document.getElementById('layout-telephone').checked = layout.telephone;
  document.getElementById('layout-devine').checked = layout.devine;
  document.getElementById('layout-theme').checked = layout.theme;
}

function updatePlayerCount() {
  const el = document.getElementById('player-count');
  if (el) {
    el.textContent = adminState.connectedPlayers;
  }
}

// =============================================
// NOTIFICATIONS
// =============================================

function showAdminNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'admin-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 1400);
}

// =============================================
// TOOLBAR BUTTONS
// =============================================

const panBtn = document.getElementById('pan');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const resetZoomBtn = document.getElementById('reset-zoom');
const deleteModeBtn = document.getElementById('delete-mode');
const undoBtn = document.getElementById('undo');
const resetEffectsBtn = document.getElementById('reset-effects');
const clearBtn = document.getElementById('clear-canvas');
const exportBtn = document.getElementById('export');
const hideUiBtn = document.getElementById('hide-ui');

// Pan mode
panBtn.addEventListener('click', () => {
  currentTool = 'view';
  deleteModeBtn.classList.remove('active');
  panBtn.classList.add('active');
  stage.container().style.cursor = 'grab';
  stage.draggable(true);
  showAdminNotification('Mode navigation');
});

// Zoom
function setZoomAdmin(newZoom) {
  newZoom = Math.max(0.05, Math.min(8, newZoom));
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

zoomInBtn.addEventListener('click', () => {
  setZoomAdmin(currentZoom * 1.3);
  showAdminNotification('Zoom: ' + Math.round(currentZoom * 100) + '%');
});

zoomOutBtn.addEventListener('click', () => {
  setZoomAdmin(currentZoom / 1.3);
  showAdminNotification('Zoom: ' + Math.round(currentZoom * 100) + '%');
});

resetZoomBtn.addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
  currentZoom = 1;
  updateMinimap();
  showAdminNotification('Zoom 100%');
});

// Delete mode
deleteModeBtn.addEventListener('click', () => {
  if (currentTool === 'eraser') {
    currentTool = 'view';
    deleteModeBtn.classList.remove('active');
    panBtn.classList.add('active');
    stage.container().style.cursor = 'grab';
    stage.draggable(true);
    showAdminNotification('Mode navigation');
  } else {
    currentTool = 'eraser';
    deleteModeBtn.classList.add('active');
    panBtn.classList.remove('active');
    stage.container().style.cursor = 'crosshair';
    stage.draggable(false);
    showAdminNotification('Mode suppression');
  }
});

// Undo
undoBtn.addEventListener('click', () => {
  connectionManager.emit('undo');
  showAdminNotification('Undo global');
});

// Reset effects
resetEffectsBtn.addEventListener('click', () => {
  brushManager.clearAllEffects();
  layer.batchDraw();
  connectionManager.emit('adminResetBrushEffects');
  showAdminNotification('Effets reinitialises');
});

// Clear canvas
clearBtn.addEventListener('click', () => {
  if (confirm('Effacer TOUT le canvas pour TOUS les participants ?')) {
    layer.destroyChildren();
    brushManager.clearEverything();
    layer.draw();
    updateMinimap();
    connectionManager.emit('clearCanvas');
    connectionManager.emit('adminResetBrushEffects');
    showAdminNotification('Canvas nettoye');
  }
});

// Export PNG
exportBtn.addEventListener('click', () => {
  const uri = stage.toDataURL({ pixelRatio: 2 });
  const link = document.createElement('a');
  link.download = 'picturaevox-admin-' + Date.now() + '.png';
  link.href = uri;
  link.click();
  showAdminNotification('PNG exporte');
});

// =============================================
// SIDEBAR - GAME CONTROLS
// =============================================

// Toggle sidebar
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '\u203A' : '\u2039';
});

// Game enable/disable toggles
['cadavre', 'telephone', 'devine', 'theme'].forEach((game) => {
  const toggle = document.getElementById('toggle-' + game);
  if (toggle) {
    toggle.addEventListener('change', () => {
      adminState.games[game].enabled = toggle.checked;
      connectionManager.emit('admin:enableGame', { game, enabled: toggle.checked });
      updateGameCardUI(game);
      showAdminNotification(
        (toggle.checked ? 'Active' : 'Desactive') + ': ' +
        document.querySelector('#card-' + game + ' .game-card-name').textContent
      );
    });
  }
});

// Launch buttons
document.getElementById('launch-cadavre').addEventListener('click', () => {
  connectionManager.emit('game:start');
  showAdminNotification('Lancement Cadavre Exquis');
});

document.getElementById('launch-telephone').addEventListener('click', () => {
  connectionManager.emit('telephone:start');
  showAdminNotification('Lancement Telephone Gribouillis');
});

document.getElementById('launch-devine').addEventListener('click', () => {
  connectionManager.emit('devine:start');
  showAdminNotification('Lancement Dessine-Devine');
});

document.getElementById('launch-theme').addEventListener('click', () => {
  const customTheme = document.getElementById('theme-custom-input').value.trim();
  const presetTheme = document.getElementById('theme-preset-select').value;
  const theme = customTheme || presetTheme || 'Theme libre';
  connectionManager.emit('theme:start', { theme });
  showAdminNotification('Lancement Grand Theme: ' + theme);
});

// Theme preset select fills the custom input
document.getElementById('theme-preset-select').addEventListener('change', (e) => {
  if (e.target.value) {
    document.getElementById('theme-custom-input').value = e.target.value;
  }
});

// Reset buttons
document.getElementById('reset-cadavre').addEventListener('click', () => {
  connectionManager.emit('game:reset');
  adminState.games.cadavre.status = 'waiting';
  updateGameCardUI('cadavre');
  showAdminNotification('Cadavre Exquis reset');
});

document.getElementById('reset-telephone').addEventListener('click', () => {
  connectionManager.emit('telephone:reset');
  adminState.games.telephone.status = 'stopped';
  updateGameCardUI('telephone');
  showAdminNotification('Telephone reset');
});

document.getElementById('reset-devine').addEventListener('click', () => {
  connectionManager.emit('devine:reset');
  adminState.games.devine.status = 'stopped';
  updateGameCardUI('devine');
  showAdminNotification('Dessine-Devine reset');
});

document.getElementById('reset-theme').addEventListener('click', () => {
  connectionManager.emit('theme:reset');
  adminState.games.theme.status = 'stopped';
  updateGameCardUI('theme');
  showAdminNotification('Grand Theme reset');
});

// Output layout checkboxes
['canvas', 'cadavre', 'telephone', 'devine', 'theme'].forEach((key) => {
  const checkbox = document.getElementById('layout-' + key);
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      adminState.outputLayout[key] = checkbox.checked;
    });
  }
});

// Send layout button
document.getElementById('send-layout').addEventListener('click', () => {
  connectionManager.emit('admin:outputLayout', { layout: adminState.outputLayout });
  showAdminNotification('Layout envoye a Output');
});

// Open output
document.getElementById('open-output').addEventListener('click', () => {
  window.open('/output', '_blank');
});

// Reset all
document.getElementById('reset-all').addEventListener('click', () => {
  if (confirm('ATTENTION: Cela va reinitialiser TOUT (canvas + tous les jeux + galeries). Continuer ?')) {
    if (confirm('Confirmer le RESET COMPLET ?')) {
      // Clear canvas
      layer.destroyChildren();
      brushManager.clearEverything();
      layer.draw();
      updateMinimap();
      connectionManager.emit('clearCanvas');
      connectionManager.emit('adminResetBrushEffects');

      // Reset all games
      connectionManager.emit('game:reset');
      connectionManager.emit('game:clearGallery');
      connectionManager.emit('telephone:reset');
      connectionManager.emit('devine:reset');
      connectionManager.emit('theme:reset');
      connectionManager.emit('admin:resetAll');

      // Reset local state
      Object.keys(adminState.games).forEach((game) => {
        adminState.games[game].status = 'stopped';
        adminState.games[game].players = 0;
      });
      refreshGameCards();

      showAdminNotification('RESET COMPLET effectue');
    }
  }
});

// =============================================
// TOGGLE UI (H key)
// =============================================

function toggleUI() {
  isUIVisible = !isUIVisible;
  const elements = [
    document.getElementById('admin-toolbar'),
    document.getElementById('admin-badge'),
    document.getElementById('status-bar'),
    document.getElementById('minimap'),
    document.getElementById('sidebar'),
    document.querySelector('.sidebar-toggle')
  ];
  elements.forEach((el) => {
    if (el) {
      el.style.display = isUIVisible ? '' : 'none';
    }
  });
  if (hideUiBtn) {
    hideUiBtn.style.opacity = isUIVisible ? '1' : '0.3';
  }
  showAdminNotification(isUIVisible ? 'UI visible' : 'UI masquee');
}

hideUiBtn.addEventListener('click', toggleUI);

// =============================================
// KEYBOARD SHORTCUTS
// =============================================

document.addEventListener('keydown', (e) => {
  // Ignore shortcuts when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // H - Toggle UI
  if (e.key === 'h' || e.key === 'H') {
    if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      toggleUI();
    }
  }

  // V - Pan mode
  if (e.key === 'v' || e.key === 'V') {
    if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      panBtn.click();
    }
  }

  // D - Delete mode
  if (e.key === 'd' || e.key === 'D') {
    if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      deleteModeBtn.click();
    }
  }

  // + - Zoom in
  if (e.key === '+' || e.key === '=') {
    if (!e.ctrlKey) {
      e.preventDefault();
      zoomInBtn.click();
    }
  }

  // - - Zoom out
  if (e.key === '-') {
    if (!e.ctrlKey) {
      e.preventDefault();
      zoomOutBtn.click();
    }
  }

  // 0 - Reset zoom
  if (e.key === '0') {
    if (!e.ctrlKey) {
      e.preventDefault();
      resetZoomBtn.click();
    }
  }

  // Ctrl+Z - Undo
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    connectionManager.emit('undo');
    showAdminNotification('Undo global');
  }

  // Ctrl+S - Export
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    exportBtn.click();
  }

  // Ctrl+Shift+E - Reset effects
  if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
    e.preventDefault();
    resetEffectsBtn.click();
  }

  // Ctrl+Shift+R - Clear canvas
  if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
    e.preventDefault();
    clearBtn.click();
  }

  // Escape - Exit delete mode
  if (e.key === 'Escape') {
    if (currentTool === 'eraser') {
      currentTool = 'view';
      deleteModeBtn.classList.remove('active');
      panBtn.classList.add('active');
      stage.container().style.cursor = 'grab';
      stage.draggable(true);
      showAdminNotification('Mode navigation');
    }
  }

  // Tab - Toggle sidebar
  if (e.key === 'Tab') {
    e.preventDefault();
    sidebarToggle.click();
  }
});

// =============================================
// OSC CONFIGURATION
// =============================================

const oscState = {
  enabled: false,
  touchdesigner: { enabled: false, host: '127.0.0.1', port: 7000 },
  ableton: { enabled: false, host: '127.0.0.1', port: 9000 }
};

function updateOscUI() {
  document.getElementById('osc-enabled').checked = oscState.enabled;
  document.getElementById('osc-td-enabled').checked = oscState.touchdesigner.enabled;
  document.getElementById('osc-td-host').value = oscState.touchdesigner.host;
  document.getElementById('osc-td-port').value = oscState.touchdesigner.port;
  document.getElementById('osc-ableton-enabled').checked = oscState.ableton.enabled;
  document.getElementById('osc-ableton-host').value = oscState.ableton.host;
  document.getElementById('osc-ableton-port').value = oscState.ableton.port;

  const statusEl = document.getElementById('osc-status');
  if (oscState.enabled) {
    const targets = [];
    if (oscState.touchdesigner.enabled) targets.push('TD');
    if (oscState.ableton.enabled) targets.push('ABL');
    statusEl.className = 'game-card-status playing';
    statusEl.textContent = targets.length ? targets.join('+') : 'ON';
  } else {
    statusEl.className = 'game-card-status stopped';
    statusEl.textContent = 'OFF';
  }
}

socket.on('osc:config', (config) => {
  Object.assign(oscState, config);
  updateOscUI();

  // Show warning if OSC unavailable (cloud deployment)
  const oscCard = document.getElementById('osc-card');
  const applyBtn = document.getElementById('osc-apply');
  if (config.available === false) {
    oscCard.style.opacity = '0.5';
    const warning = document.createElement('div');
    warning.style.cssText = 'font-size:10px;color:#FF9800;margin-top:6px;';
    warning.textContent = config.isCloud
      ? 'OSC indisponible (deploiement cloud — UDP non supporte)'
      : 'OSC indisponible (module node-osc manquant)';
    warning.id = 'osc-warning';
    if (!document.getElementById('osc-warning')) {
      oscCard.appendChild(warning);
    }
    applyBtn.disabled = true;
    applyBtn.style.opacity = '0.4';
    document.getElementById('osc-enabled').disabled = true;
  }

  console.log('[Admin] OSC config received', config);
});

document.getElementById('osc-apply').addEventListener('click', () => {
  const config = {
    enabled: document.getElementById('osc-enabled').checked,
    touchdesigner: {
      enabled: document.getElementById('osc-td-enabled').checked,
      host: document.getElementById('osc-td-host').value.trim() || '127.0.0.1',
      port: parseInt(document.getElementById('osc-td-port').value, 10) || 7000
    },
    ableton: {
      enabled: document.getElementById('osc-ableton-enabled').checked,
      host: document.getElementById('osc-ableton-host').value.trim() || '127.0.0.1',
      port: parseInt(document.getElementById('osc-ableton-port').value, 10) || 9000
    }
  };

  connectionManager.emit('osc:configure', config);
  Object.assign(oscState, config);
  updateOscUI();
  showAdminNotification('OSC ' + (config.enabled ? 'active' : 'desactive'));
});

// Quick toggle
document.getElementById('osc-enabled').addEventListener('change', () => {
  // Just update the UI, actual config is sent on Apply
});

// =============================================
// QR CODE GENERATOR
// =============================================

// Auto-detect server IP
(function autoDetectIP() {
  const ip = window.location.hostname;
  const port = window.location.port || '3000';
  const ipInput = document.getElementById('qr-server-ip');
  const portInput = document.getElementById('qr-server-port');
  if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
    ipInput.value = ip;
  } else {
    ipInput.placeholder = 'Ex: 192.168.1.42';
  }
  if (port) portInput.value = port;
})();

function generateWifiString(ssid, password, security) {
  if (!ssid) return '';
  if (security === 'nopass' || !password) {
    return `WIFI:T:nopass;S:${ssid};;`;
  }
  return `WIFI:T:${security};S:${ssid};P:${password};;`;
}

function getQROptions(size) {
  return {
    width: size,
    margin: 2,
    color: { dark: '#ffffff', light: '#000000' },
    errorCorrectionLevel: 'M'
  };
}

async function renderQR(container, text, size) {
  container.innerHTML = '';
  if (!text) return null;
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, getQROptions(size || 140));
  container.appendChild(canvas);
  return canvas;
}

document.getElementById('qr-generate').addEventListener('click', async () => {
  const ip = document.getElementById('qr-server-ip').value.trim();
  const port = document.getElementById('qr-server-port').value.trim() || '3000';
  const page = document.getElementById('qr-target-page').value;
  const wifiEnabled = document.getElementById('qr-wifi-enabled').checked;
  const ssid = document.getElementById('qr-wifi-ssid').value.trim();
  const password = document.getElementById('qr-wifi-password').value;
  const security = document.getElementById('qr-wifi-security').value;

  if (!ip) {
    showAdminNotification('Entrez l\'IP du serveur');
    return;
  }

  const url = `http://${ip}:${port}${page}`;
  const display = document.getElementById('qr-display');
  display.style.display = 'block';

  // Wi-Fi QR
  const wifiSection = document.getElementById('qr-wifi-section');
  if (wifiEnabled && ssid) {
    wifiSection.style.display = '';
    const wifiString = generateWifiString(ssid, password, security);
    await renderQR(document.getElementById('qr-wifi-canvas'), wifiString, 140);
    document.getElementById('qr-wifi-label').textContent = ssid + (password ? ' (WPA)' : ' (ouvert)');
  } else {
    wifiSection.style.display = 'none';
  }

  // URL QR
  await renderQR(document.getElementById('qr-url-canvas'), url, 140);
  document.getElementById('qr-url-label').textContent = url;

  showAdminNotification('QR codes generes');
});

// Fullscreen QR
document.getElementById('qr-fullscreen').addEventListener('click', async () => {
  const ip = document.getElementById('qr-server-ip').value.trim();
  const port = document.getElementById('qr-server-port').value.trim() || '3000';
  const page = document.getElementById('qr-target-page').value;
  const wifiEnabled = document.getElementById('qr-wifi-enabled').checked;
  const ssid = document.getElementById('qr-wifi-ssid').value.trim();
  const password = document.getElementById('qr-wifi-password').value;
  const security = document.getElementById('qr-wifi-security').value;

  if (!ip) return;

  const url = `http://${ip}:${port}${page}`;
  const overlay = document.getElementById('qr-overlay');
  const content = document.getElementById('qr-overlay-content');
  content.innerHTML = '';

  const qrSize = Math.min(window.innerWidth, window.innerHeight) * 0.35;

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'color:#fff; font-size:28px; font-weight:700; margin-bottom:30px; letter-spacing:1px;';
  title.textContent = 'PICTURAEVOX';
  content.appendChild(title);

  // Wi-Fi QR
  if (wifiEnabled && ssid) {
    const wifiLabel = document.createElement('div');
    wifiLabel.style.cssText = 'color:#888; font-size:14px; text-transform:uppercase; letter-spacing:2px; margin-bottom:10px;';
    wifiLabel.textContent = '1. Connecte-toi au Wi-Fi';
    content.appendChild(wifiLabel);

    const wifiContainer = document.createElement('div');
    content.appendChild(wifiContainer);
    const wifiString = generateWifiString(ssid, password, security);
    await QRCode.toCanvas(document.createElement('canvas'), wifiString, getQROptions(qrSize)).then(canvas => {
      wifiContainer.appendChild(canvas);
    });

    const ssidLabel = document.createElement('div');
    ssidLabel.style.cssText = 'color:#aaa; font-size:16px; margin-top:8px; margin-bottom:30px;';
    ssidLabel.textContent = ssid;
    content.appendChild(ssidLabel);

    const step2Label = document.createElement('div');
    step2Label.style.cssText = 'color:#888; font-size:14px; text-transform:uppercase; letter-spacing:2px; margin-bottom:10px;';
    step2Label.textContent = '2. Ouvre cette page';
    content.appendChild(step2Label);
  } else {
    const scanLabel = document.createElement('div');
    scanLabel.style.cssText = 'color:#888; font-size:14px; text-transform:uppercase; letter-spacing:2px; margin-bottom:10px;';
    scanLabel.textContent = 'Scanne pour jouer';
    content.appendChild(scanLabel);
  }

  // URL QR
  const urlContainer = document.createElement('div');
  content.appendChild(urlContainer);
  await QRCode.toCanvas(document.createElement('canvas'), url, getQROptions(qrSize)).then(canvas => {
    urlContainer.appendChild(canvas);
  });

  const urlLabel = document.createElement('div');
  urlLabel.style.cssText = 'color:#00d9ff; font-size:16px; font-weight:600; margin-top:8px;';
  urlLabel.textContent = url;
  content.appendChild(urlLabel);

  // Hint
  const hint = document.createElement('div');
  hint.style.cssText = 'color:#444; font-size:12px; margin-top:24px;';
  hint.textContent = 'Cliquer pour fermer';
  content.appendChild(hint);

  overlay.style.display = 'flex';
});

document.getElementById('qr-overlay').addEventListener('click', () => {
  document.getElementById('qr-overlay').style.display = 'none';
});

// Download QR as PNG
document.getElementById('qr-download').addEventListener('click', async () => {
  const ip = document.getElementById('qr-server-ip').value.trim();
  const port = document.getElementById('qr-server-port').value.trim() || '3000';
  const page = document.getElementById('qr-target-page').value;
  const wifiEnabled = document.getElementById('qr-wifi-enabled').checked;
  const ssid = document.getElementById('qr-wifi-ssid').value.trim();
  const password = document.getElementById('qr-wifi-password').value;
  const security = document.getElementById('qr-wifi-security').value;

  if (!ip) return;

  const url = `http://${ip}:${port}${page}`;
  const exportSize = 400;

  // Create a combined canvas for download
  const combinedCanvas = document.createElement('canvas');
  const hasWifi = wifiEnabled && ssid;
  combinedCanvas.width = hasWifi ? exportSize * 2 + 80 : exportSize + 40;
  combinedCanvas.height = exportSize + 120;
  const ctx = combinedCanvas.getContext('2d');

  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

  let xOffset = 20;

  if (hasWifi) {
    // Wi-Fi QR
    const wifiCanvas = document.createElement('canvas');
    const wifiString = generateWifiString(ssid, password, security);
    await QRCode.toCanvas(wifiCanvas, wifiString, { ...getQROptions(exportSize), width: exportSize });
    ctx.drawImage(wifiCanvas, 0, 0, wifiCanvas.width, wifiCanvas.height, xOffset, 10, exportSize, exportSize);

    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('1. Wi-Fi: ' + ssid, xOffset + exportSize / 2, exportSize + 35);

    xOffset += exportSize + 40;
  }

  // URL QR
  const urlCanvas = document.createElement('canvas');
  await QRCode.toCanvas(urlCanvas, url, { ...getQROptions(exportSize), width: exportSize });
  ctx.drawImage(urlCanvas, 0, 0, urlCanvas.width, urlCanvas.height, xOffset, 10, exportSize, exportSize);

  ctx.fillStyle = '#00d9ff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((hasWifi ? '2. ' : '') + url, xOffset + exportSize / 2, exportSize + 35);

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PICTURAEVOX', combinedCanvas.width / 2, exportSize + 75);

  // Download - must be in DOM for some browsers
  const link = document.createElement('a');
  link.download = 'picturaevox-qrcodes.png';
  link.href = combinedCanvas.toDataURL('image/png');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showAdminNotification('QR codes telecharges');
});

// =============================================
// INITIALIZATION
// =============================================

stage.container().style.cursor = 'grab';
stage.scale({ x: 0.5, y: 0.5 });
stage.position({
  x: window.innerWidth / 4,
  y: window.innerHeight / 4
});
updateMinimap();
refreshAllUI();

// Also join gamemaster room to receive game events
socket.emit('gamemaster:join');

console.log('[Admin] Picturaevox 3.5 Admin Panel loaded');
console.log('[Admin] Shortcuts: H=UI | V=Pan | D=Delete | +/-=Zoom | 0=Reset | Ctrl+Z=Undo | Ctrl+S=Export | Tab=Sidebar');
