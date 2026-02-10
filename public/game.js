// game.js — Cadavre Exquis player logic
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

let gameCanvas = null;
let myRole = null;
let myTeamId = null;
let hasSubmitted = false;

// === DOM ELEMENTS ===
const lobbyPhase = document.getElementById('lobby-phase');
const drawPhase = document.getElementById('draw-phase');
const donePhase = document.getElementById('done-phase');
const spectatorPhase = document.getElementById('spectator-phase');
const pseudoInput = document.getElementById('pseudo-input');
const joinBtn = document.getElementById('join-btn');
const waitingSection = document.getElementById('waiting-section');
const playerCount = document.getElementById('player-count');
const playerList = document.getElementById('player-list');
const roleBadge = document.getElementById('role-badge');
const timerDisplay = document.getElementById('timer-display');
const rulesPopup = document.getElementById('rules-popup');
const rulesOkBtn = document.getElementById('rules-ok-btn');
const rulesText = document.getElementById('rules-text');
const projectionPopup = document.getElementById('projection-popup');
const projectionOkBtn = document.getElementById('projection-ok-btn');
const submitBtn = document.getElementById('submit-btn');
const replayBtn = document.getElementById('replay-btn');
const eraserBtn = document.getElementById('eraser-btn');
const undoBtn = document.getElementById('undo-btn');
const gameSizeSlider = document.getElementById('game-size-slider');

// === PHASE MANAGEMENT ===
function showPhase(phase) {
  lobbyPhase.style.display = 'none';
  drawPhase.classList.remove('visible');
  donePhase.classList.remove('visible');
  spectatorPhase.classList.remove('visible');

  switch (phase) {
    case 'lobby':
      lobbyPhase.style.display = '';
      break;
    case 'draw':
      drawPhase.classList.add('visible');
      break;
    case 'done':
      donePhase.classList.add('visible');
      break;
    case 'spectator':
      spectatorPhase.classList.add('visible');
      break;
  }
}

// === ROLE LABELS ===
const roleLabels = {
  head: { fr: 'Tete', emoji: '&#x1F9D1;', desc: 'la <strong>tete</strong>' },
  torso: { fr: 'Corps', emoji: '&#x1F455;', desc: 'le <strong>corps</strong>' },
  legs: { fr: 'Jambes', emoji: '&#x1F9B5;', desc: 'les <strong>jambes</strong>' }
};

// === LOBBY ===
joinBtn.addEventListener('click', () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return;
  socket.emit('game:join', { pseudo });
  joinBtn.disabled = true;
  pseudoInput.disabled = true;
  waitingSection.classList.add('visible');
});

pseudoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// === DRAW TOOLBAR ===
document.querySelectorAll('.draw-toolbar .color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('.draw-toolbar .color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    if (gameCanvas) {
      gameCanvas.setColor(dot.dataset.color);
    }
    // Deactivate eraser
    eraserBtn.classList.remove('active');
  });
});

gameSizeSlider.addEventListener('input', (e) => {
  if (gameCanvas) gameCanvas.setSize(parseInt(e.target.value, 10));
});

eraserBtn.addEventListener('click', () => {
  if (!gameCanvas) return;
  const isActive = eraserBtn.classList.toggle('active');
  gameCanvas.setTool(isActive ? 'eraser' : 'brush');
});

undoBtn.addEventListener('click', () => {
  if (gameCanvas) gameCanvas.undo();
});

submitBtn.addEventListener('click', () => {
  submitDrawing();
});

replayBtn.addEventListener('click', () => {
  socket.emit('game:reset');
});

rulesOkBtn.addEventListener('click', () => {
  rulesPopup.classList.remove('visible');
});

projectionOkBtn.addEventListener('click', () => {
  projectionPopup.classList.remove('visible');
  showPhase('done');
});

// === SUBMIT DRAWING ===
function submitDrawing() {
  if (hasSubmitted || !gameCanvas) return;
  hasSubmitted = true;

  const imageData = gameCanvas.exportImage();
  socket.emit('game:submitDrawing', {
    imageData,
    role: myRole,
    teamId: myTeamId
  });

  // Show projection popup
  projectionPopup.classList.add('visible');
}

// === SOCKET EVENTS ===

socket.on('game:playerList', (players) => {
  playerCount.textContent = players.length;
  playerList.innerHTML = players.map(p => `<span class="player-tag">${escapeHtml(p.pseudo)}</span>`).join('');
});

socket.on('game:assigned', ({ role, teamId, totalTeams }) => {
  myRole = role;
  myTeamId = teamId;
  hasSubmitted = false;

  const roleInfo = roleLabels[role] || { fr: role, emoji: '', desc: role };
  roleBadge.innerHTML = `${roleInfo.emoji} ${roleInfo.fr}`;
  rulesText.innerHTML = `Tu dessines ${roleInfo.desc} du personnage.<br>Les reperes t'aident a aligner ton dessin avec les autres joueurs, mais tu dessines comme tu veux !`;

  // Show rules popup first
  showPhase('draw');
  rulesPopup.classList.add('visible');

  // Create game canvas
  if (gameCanvas) gameCanvas.destroy();
  gameCanvas = new GameCanvas('game-canvas-container', { role });

  // Reset toolbar
  document.querySelectorAll('.draw-toolbar .color-dot').forEach((d, i) => {
    d.classList.toggle('active', i === 0);
  });
  gameSizeSlider.value = 4;
  eraserBtn.classList.remove('active');
});

socket.on('game:spectator', () => {
  showPhase('spectator');
});

socket.on('game:timerStart', (duration) => {
  timerDisplay.textContent = duration;
  timerDisplay.classList.remove('urgent');
});

socket.on('game:timer', (remaining) => {
  timerDisplay.textContent = remaining;
  if (remaining <= 5) {
    timerDisplay.classList.add('urgent');
  }
});

socket.on('game:timeUp', () => {
  if (!hasSubmitted) {
    submitDrawing();
  }
});

socket.on('game:done', () => {
  if (!hasSubmitted) {
    submitDrawing();
  }
  // projectionPopup or donePhase will show
});

socket.on('game:reset', () => {
  myRole = null;
  myTeamId = null;
  hasSubmitted = false;
  if (gameCanvas) {
    gameCanvas.destroy();
    gameCanvas = null;
  }
  // Clear canvas container
  document.getElementById('game-canvas-container').innerHTML = '';

  showPhase('lobby');
  joinBtn.disabled = false;
  pseudoInput.disabled = false;
  waitingSection.classList.remove('visible');
  rulesPopup.classList.remove('visible');
  projectionPopup.classList.remove('visible');
  timerDisplay.textContent = '30';
  timerDisplay.classList.remove('urgent');
});

socket.on('game:error', (msg) => {
  console.warn('Game error:', msg);
});

// === UTILS ===
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

console.log('Game.js loaded');
