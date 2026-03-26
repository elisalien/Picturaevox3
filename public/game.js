// game.js — Picturaevox 3.5 — Multi-mode player logic
const socket = io({
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 10000,
  reconnectionAttempts: 20,
  timeout: 20000,
  transports: ['polling', 'websocket'],
  forceNew: false
});
window.socket = socket;

let gameCanvas = null;
let guessCanvas = null;
let currentMode = null; // cadavre | telephone | devine | theme
let myRole = null;
let myTeamId = null;
let hasSubmitted = false;
let telephoneRound = 0;

// === DOM ELEMENTS ===
const modeSelectPhase = document.getElementById('mode-select-phase');
const lobbyPhase = document.getElementById('lobby-phase');
const drawPhase = document.getElementById('draw-phase');
const guessPhase = document.getElementById('guess-phase');
const wordPromptPhase = document.getElementById('word-prompt-phase');
const donePhase = document.getElementById('done-phase');
const spectatorPhase = document.getElementById('spectator-phase');
const revealPhase = document.getElementById('reveal-phase');

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
const submitBtn = document.getElementById('submit-btn');
const replayBtn = document.getElementById('replay-btn');
const wordChoicePhase = document.getElementById('word-choice-phase');
const devineWaitingPhase = document.getElementById('devine-waiting-phase');
const devineWinPhase = document.getElementById('devine-win-phase');
const eraserBtn = document.getElementById('eraser-btn');
const undoBtn = document.getElementById('undo-btn');
const gameSizeSlider = document.getElementById('game-size-slider');

// === PHASE MANAGEMENT ===
function hideAll() {
  [modeSelectPhase, lobbyPhase, drawPhase, guessPhase, wordPromptPhase,
   donePhase, spectatorPhase, revealPhase, wordChoicePhase, devineWaitingPhase, devineWinPhase].forEach(el => {
    if (el) {
      el.style.display = 'none';
      el.classList.remove('visible');
    }
  });
}

function showPhase(phase) {
  hideAll();
  const el = document.getElementById(phase + '-phase');
  if (el) {
    el.style.display = '';
    el.classList.add('visible');
  }
}

function showModeSelect() {
  hideAll();
  modeSelectPhase.style.display = '';
}

// === MODE SELECT ===
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    if (card.classList.contains('disabled')) return;
    currentMode = card.dataset.mode;
    enterLobby(currentMode);
  });
});

function updateModeAvailability(games) {
  ['cadavre', 'telephone', 'devine', 'theme'].forEach(mode => {
    const card = document.getElementById('mode-' + mode);
    const badge = document.getElementById('badge-' + mode);
    if (!card || !badge) return;

    const enabled = games && games[mode] && games[mode].enabled;
    card.classList.toggle('disabled', !enabled);
    badge.textContent = enabled ? 'OUVERT' : 'FERME';
    badge.className = 'mode-badge ' + (enabled ? 'open' : 'closed');
  });
}

// Ask server for available games
socket.on('connect', () => {
  socket.emit('game:getAvailableModes');
});

socket.on('game:availableModes', (games) => {
  updateModeAvailability(games);
});

// Also listen for admin updates
socket.on('admin:gamesUpdate', (games) => {
  updateModeAvailability(games);
});

// === LOBBY ===
const modeLabels = {
  cadavre: { title: 'Cadavre Exquis', subtitle: 'Dessine un personnage en equipe' },
  telephone: { title: 'Telephone Gribouillis', subtitle: 'Le telephone arabe du dessin' },
  devine: { title: 'Dessine-Devine', subtitle: 'Dessine et devine les mots' },
  theme: { title: 'Le Grand Theme', subtitle: 'Dessine sur un theme impose' }
};

function enterLobby(mode) {
  const labels = modeLabels[mode] || { title: 'Jeu', subtitle: '' };
  document.getElementById('lobby-title').textContent = labels.title;
  document.getElementById('lobby-subtitle').textContent = labels.subtitle;
  showPhase('lobby');
  joinBtn.disabled = false;
  pseudoInput.disabled = false;
  waitingSection.classList.remove('visible');
}

joinBtn.addEventListener('click', () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo || !currentMode) return;

  switch (currentMode) {
    case 'cadavre':
      socket.emit('game:join', { pseudo });
      break;
    case 'telephone':
      socket.emit('telephone:join', { pseudo });
      break;
    case 'devine':
      socket.emit('devine:join', { pseudo });
      break;
    case 'theme':
      socket.emit('theme:join', { pseudo });
      break;
  }

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
    if (gameCanvas) gameCanvas.setColor(dot.dataset.color);
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

submitBtn.addEventListener('click', () => submitDrawing());

replayBtn.addEventListener('click', () => {
  if (currentMode === 'cadavre') socket.emit('game:reset');
  else showModeSelect();
});

rulesOkBtn.addEventListener('click', () => {
  rulesPopup.classList.remove('visible');
});

// === SUBMIT DRAWING ===
function submitDrawing() {
  if (hasSubmitted || !gameCanvas) return;
  hasSubmitted = true;

  const imageData = gameCanvas.exportImage();

  switch (currentMode) {
    case 'cadavre':
      socket.emit('game:submitDrawing', { imageData, role: myRole, teamId: myTeamId });
      break;
    case 'telephone':
      socket.emit('telephone:submit', { content: imageData, round: telephoneRound });
      break;
    case 'theme':
      socket.emit('theme:submitDrawing', { imageData });
      break;
  }

  showPhase('done');
}

// === CREATE GAME CANVAS ===
function createDrawCanvas(options) {
  if (gameCanvas) gameCanvas.destroy();
  document.getElementById('game-canvas-container').innerHTML = '';
  gameCanvas = new GameCanvas('game-canvas-container', options);

  // Reset toolbar
  document.querySelectorAll('.draw-toolbar .color-dot').forEach((d, i) => {
    d.classList.toggle('active', i === 0);
  });
  gameSizeSlider.value = 4;
  eraserBtn.classList.remove('active');
  hasSubmitted = false;
}

// =============================================
// CADAVRE EXQUIS EVENTS
// =============================================

const roleLabels = {
  head: { fr: 'Tete', desc: 'la <strong>tete</strong>' },
  torso: { fr: 'Corps', desc: 'le <strong>corps</strong>' },
  legs: { fr: 'Jambes', desc: 'les <strong>jambes</strong>' }
};

socket.on('game:playerList', (players) => {
  if (currentMode !== 'cadavre') return;
  playerCount.textContent = players.length;
  playerList.innerHTML = players.map(p => `<span class="player-tag">${escapeHtml(p.pseudo)}</span>`).join('');
});

socket.on('game:assigned', ({ role, teamId }) => {
  myRole = role;
  myTeamId = teamId;

  const roleInfo = roleLabels[role] || { fr: role, desc: role };
  roleBadge.textContent = roleInfo.fr;
  rulesText.innerHTML = `Tu dessines ${roleInfo.desc} du personnage.<br>Les reperes t'aident a aligner ton dessin.`;

  showPhase('draw');
  rulesPopup.classList.add('visible');
  createDrawCanvas({ role, mode: 'cadavre' });
});

socket.on('game:spectator', () => showPhase('spectator'));

socket.on('game:timerStart', (duration) => {
  timerDisplay.textContent = duration;
  timerDisplay.classList.remove('urgent');
});

socket.on('game:timer', (remaining) => {
  timerDisplay.textContent = remaining;
  if (remaining <= 5) timerDisplay.classList.add('urgent');
});

socket.on('game:timeUp', () => {
  if (!hasSubmitted && currentMode === 'cadavre') submitDrawing();
});

socket.on('game:done', () => {
  if (!hasSubmitted && currentMode === 'cadavre') submitDrawing();
  // Ne pas rester sur done-phase : afficher un message temporaire
  // Le serveur enverra game:reset dans ~5s pour revenir au lobby
  if (currentMode === 'cadavre') {
    const doneTitle = document.getElementById('done-title');
    const doneText = document.getElementById('done-text');
    if (doneTitle) doneTitle.textContent = 'Dessin envoye !';
    if (doneText) doneText.textContent = 'Regarde la projection... Retour a la toile dans quelques secondes.';
  }
});

socket.on('game:reset', () => {
  myRole = null;
  myTeamId = null;
  hasSubmitted = false;
  if (gameCanvas) { gameCanvas.destroy(); gameCanvas = null; }
  document.getElementById('game-canvas-container').innerHTML = '';

  if (currentMode === 'cadavre') {
    enterLobby('cadavre');
    timerDisplay.textContent = '30';
    timerDisplay.classList.remove('urgent');
    rulesPopup.classList.remove('visible');
  }
});

// =============================================
// TELEPHONE GRIBOUILLIS EVENTS
// =============================================

socket.on('telephone:prompt', ({ type, round, content, message }) => {
  telephoneRound = round;
  hasSubmitted = false;

  if (type === 'word') {
    // Show word input
    document.getElementById('word-prompt-title').textContent = message || 'Ecris une phrase';
    if (content) {
      // Describe a drawing
      document.getElementById('word-prompt-desc').innerHTML = '<img src="' + content + '" style="max-width:200px;border-radius:8px;margin-bottom:10px;display:block;margin:0 auto 10px;"><br>Decris ce dessin en une phrase !';
    } else {
      document.getElementById('word-prompt-desc').textContent = 'Les autres joueurs vont dessiner ta phrase !';
    }
    document.getElementById('word-input').value = '';
    showPhase('word-prompt');
  } else {
    // Draw phase
    roleBadge.textContent = 'Dessine !';
    rulesText.innerHTML = 'Dessine ce que tu lis : <strong>' + escapeHtml(content) + '</strong>';
    showPhase('draw');
    rulesPopup.classList.add('visible');
    createDrawCanvas({ mode: 'telephone' });
  }
});

document.getElementById('word-submit-btn').addEventListener('click', () => {
  const word = document.getElementById('word-input').value.trim();
  if (!word) return;
  socket.emit('telephone:submit', { content: word, round: telephoneRound });
  hasSubmitted = true;
  showPhase('done');
  document.getElementById('done-title').textContent = 'Envoye !';
  document.getElementById('done-text').textContent = 'En attente des autres joueurs...';
});

document.getElementById('word-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('word-submit-btn').click();
});

socket.on('telephone:timerStart', (duration) => {
  document.getElementById('word-timer-display').textContent = duration;
  timerDisplay.textContent = duration;
});

socket.on('telephone:timer', (remaining) => {
  document.getElementById('word-timer-display').textContent = remaining;
  timerDisplay.textContent = remaining;
  if (remaining <= 5) {
    timerDisplay.classList.add('urgent');
    document.getElementById('word-timer-display').classList.add('urgent');
  }
});

socket.on('telephone:timeUp', () => {
  if (!hasSubmitted && currentMode === 'telephone') {
    // Auto-submit whatever they have
    if (drawPhase.classList.contains('visible')) {
      submitDrawing();
    } else {
      const word = document.getElementById('word-input').value.trim() || '...';
      socket.emit('telephone:submit', { content: word, round: telephoneRound });
      hasSubmitted = true;
      showPhase('done');
    }
  }
});

socket.on('telephone:reveal', (chains) => {
  const revealContent = document.getElementById('reveal-content');
  document.getElementById('reveal-title').textContent = 'Telephone Gribouillis - Resultats';

  let html = '';
  chains.forEach((chain, i) => {
    html += `<div class="chain-card"><h3 style="color:#6b5bff;margin:0 0 8px;">Chaine ${i + 1}</h3>`;
    chain.forEach(step => {
      html += `<div class="chain-step">`;
      html += `<div class="step-author">${escapeHtml(step.author)}</div>`;
      if (step.type === 'drawing' && step.content) {
        html += `<img src="${step.content}" alt="dessin" />`;
      } else {
        html += `<div class="step-content">${escapeHtml(step.content)}</div>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  });

  revealContent.innerHTML = html;
  showPhase('reveal');
});

socket.on('telephone:reset', () => {
  telephoneRound = 0;
  hasSubmitted = false;
  if (gameCanvas) { gameCanvas.destroy(); gameCanvas = null; }
  if (currentMode === 'telephone') showModeSelect();
});

// =============================================
// DESSINE-DEVINE EVENTS
// =============================================

let devineTargetScore = 5;
let devineChooseTimer = null;

socket.on('devine:settings', ({ targetScore }) => {
  devineTargetScore = targetScore || 5;
});

// Word choice phase — drawer picks from 3 words
socket.on('devine:chooseWord', ({ words, round, duration }) => {
  showPhase('word-choice');

  const grid = document.getElementById('word-choice-grid');
  grid.innerHTML = '';

  words.forEach(word => {
    const card = document.createElement('div');
    card.className = 'word-choice-card';
    card.textContent = word;
    card.addEventListener('click', () => {
      socket.emit('devine:chooseWord', { word });
      // Disable further clicks
      grid.querySelectorAll('.word-choice-card').forEach(c => {
        c.style.pointerEvents = 'none';
        c.style.opacity = c === card ? '1' : '0.3';
      });
      card.style.borderColor = '#6b5bff';
      card.style.background = 'rgba(107, 91, 255, 0.2)';
    });
    grid.appendChild(card);
  });

  // Countdown for choosing
  let remaining = duration || 15;
  const timerEl = document.getElementById('word-choice-timer');
  timerEl.textContent = remaining + 's';
  if (devineChooseTimer) clearInterval(devineChooseTimer);
  devineChooseTimer = setInterval(() => {
    remaining--;
    timerEl.textContent = remaining + 's';
    if (remaining <= 0) clearInterval(devineChooseTimer);
  }, 1000);
});

// Waiting phase for guessers while drawer chooses
socket.on('devine:waiting', ({ drawer, round }) => {
  document.getElementById('devine-waiting-title').textContent = drawer + ' choisit son mot...';
  showPhase('devine-waiting');
});

// Drawer starts drawing after choosing
socket.on('devine:youDraw', ({ word, round }) => {
  if (devineChooseTimer) { clearInterval(devineChooseTimer); devineChooseTimer = null; }

  roleBadge.textContent = 'Dessine !';
  rulesText.innerHTML = `Dessine : <strong>${escapeHtml(word)}</strong><br>Les autres doivent deviner !`;

  showPhase('draw');
  submitBtn.style.display = 'none';
  rulesPopup.classList.add('visible');

  createDrawCanvas({
    mode: 'devine',
    onDraw: (data) => {
      socket.emit('devine:drawing', data);
    }
  });
});

socket.on('devine:guessMode', ({ drawer, round }) => {
  document.getElementById('guess-drawer-badge').textContent = drawer + ' dessine...';
  document.getElementById('guess-input').value = '';
  document.getElementById('chat-messages').innerHTML = '';

  showPhase('guess');

  if (guessCanvas) guessCanvas.destroy();
  document.getElementById('guess-canvas-container').innerHTML = '';
  guessCanvas = new GameCanvas('guess-canvas-container', { mode: 'devine', readOnly: true });
});

socket.on('devine:drawing', (data) => {
  if (guessCanvas) guessCanvas.renderDrawData(data);
});

document.getElementById('guess-send-btn').addEventListener('click', () => {
  const guess = document.getElementById('guess-input').value.trim();
  if (!guess) return;
  socket.emit('devine:guess', { guess });
  document.getElementById('guess-input').value = '';
});

document.getElementById('guess-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('guess-send-btn').click();
});

socket.on('devine:chatMessage', ({ pseudo, message, close }) => {
  const chat = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'chat-msg' + (close ? ' close' : '');
  msg.textContent = pseudo + ': ' + message + (close ? ' (presque !)' : '');
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
});

socket.on('devine:correct', ({ pseudo, word, first }) => {
  const chat = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'chat-msg correct';
  msg.textContent = pseudo + ' a trouve' + (first ? ' en premier' : '') + ' ! Le mot etait : ' + word;
  if (first) msg.style.fontWeight = '700';
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
});

socket.on('devine:close', ({ guess }) => {
  // Hint to this player only
});

function renderDevineScores(scores, containerId) {
  const scoreboard = document.getElementById(containerId);
  if (!scoreboard) return;
  const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
  let html = sorted.map(s =>
    `<span class="score-tag">${escapeHtml(s.pseudo)} <span class="score-val">${s.score}</span></span>`
  ).join('');
  html += `<div class="target-score-indicator">Objectif : <strong>${devineTargetScore} pts</strong></div>`;
  scoreboard.innerHTML = html;
}

socket.on('devine:scores', (scores) => {
  renderDevineScores(scores, 'scoreboard');
  renderDevineScores(scores, 'devine-waiting-scoreboard');
});

socket.on('devine:timerStart', (duration) => {
  timerDisplay.textContent = duration;
  timerDisplay.classList.remove('urgent');
  document.getElementById('guess-timer-display').textContent = duration;
  document.getElementById('guess-timer-display').classList.remove('urgent');
});

socket.on('devine:timer', (remaining) => {
  timerDisplay.textContent = remaining;
  document.getElementById('guess-timer-display').textContent = remaining;
  if (remaining <= 10) {
    timerDisplay.classList.add('urgent');
    document.getElementById('guess-timer-display').classList.add('urgent');
  }
});

socket.on('devine:timeUp', ({ word }) => {
  const chat = document.getElementById('chat-messages');
  if (chat) {
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.style.color = '#FF5252';
    msg.textContent = 'Temps ecoule ! Le mot etait : ' + word;
    chat.appendChild(msg);
  }
});

socket.on('devine:gameWon', ({ pseudo, score, targetScore }) => {
  showPhase('devine-win');
  document.getElementById('devine-win-title').textContent = pseudo + ' a gagne !';
  document.getElementById('devine-win-text').textContent = score + '/' + targetScore + ' points';
});

document.getElementById('devine-replay-btn').addEventListener('click', () => {
  showModeSelect();
});

socket.on('devine:reset', () => {
  if (devineChooseTimer) { clearInterval(devineChooseTimer); devineChooseTimer = null; }
  if (guessCanvas) { guessCanvas.destroy(); guessCanvas = null; }
  if (gameCanvas) { gameCanvas.destroy(); gameCanvas = null; }
  if (currentMode === 'devine') showModeSelect();
});

// =============================================
// LE GRAND THEME EVENTS
// =============================================

socket.on('theme:started', ({ theme, timeRemaining }) => {
  roleBadge.textContent = theme;
  rulesText.innerHTML = `Le theme est : <strong>${escapeHtml(theme)}</strong><br>Dessine ce qui t'inspire !`;

  showPhase('draw');
  submitBtn.style.display = '';
  rulesPopup.classList.add('visible');
  createDrawCanvas({ mode: 'theme' });

  timerDisplay.textContent = timeRemaining || 120;
  timerDisplay.classList.remove('urgent');
});

socket.on('theme:timerStart', (duration) => {
  timerDisplay.textContent = duration;
  timerDisplay.classList.remove('urgent');
});

socket.on('theme:timer', (remaining) => {
  timerDisplay.textContent = remaining;
  if (remaining <= 10) timerDisplay.classList.add('urgent');
});

socket.on('theme:timeUp', () => {
  if (!hasSubmitted && currentMode === 'theme') submitDrawing();
});

socket.on('theme:reveal', ({ theme, drawings }) => {
  document.getElementById('reveal-title').textContent = 'Le Grand Theme : ' + theme;
  const revealContent = document.getElementById('reveal-content');

  let html = '<div class="theme-gallery">';
  drawings.forEach(d => {
    html += `<div class="theme-gallery-item">
      <img src="${d.imageData}" alt="dessin" />
      <div class="artist">${escapeHtml(d.pseudo)}</div>
    </div>`;
  });
  html += '</div>';

  revealContent.innerHTML = html;
  showPhase('reveal');
});

socket.on('theme:reset', () => {
  if (gameCanvas) { gameCanvas.destroy(); gameCanvas = null; }
  if (currentMode === 'theme') showModeSelect();
});

// =============================================
// GAME MODE AVAILABILITY (periodic check)
// =============================================

// Request available modes periodically when on mode select
setInterval(() => {
  if (modeSelectPhase.style.display !== 'none') {
    socket.emit('game:getAvailableModes');
  }
}, 3000);

// === UTILS ===
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initial state
showModeSelect();
console.log('Game.js v3.5 loaded');
