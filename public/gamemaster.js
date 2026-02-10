// gamemaster.js — Cadavre Exquis admin control
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

const playerCountEl = document.getElementById('player-count-gm');
const teamCountEl = document.getElementById('team-count-gm');
const gameStatus = document.getElementById('game-status');
const timerSection = document.getElementById('timer-section');
const gmTimer = document.getElementById('gm-timer');
const launchBtn = document.getElementById('launch-btn');
const resetBtn = document.getElementById('reset-btn');
const playerListGm = document.getElementById('player-list-gm');
const teamsSection = document.getElementById('teams-section');
const teamsList = document.getElementById('teams-list');

let currentStatus = 'waiting';

// Join as gamemaster
socket.emit('gamemaster:join');

// === LAUNCH ===
launchBtn.addEventListener('click', () => {
  socket.emit('game:start');
  launchBtn.disabled = true;
});

resetBtn.addEventListener('click', () => {
  socket.emit('game:reset');
});

// === SOCKET EVENTS ===

socket.on('game:playerList', (players) => {
  playerCountEl.textContent = players.length;
  playerListGm.innerHTML = players.map(p =>
    `<span class="player-tag-gm">${escapeHtml(p.pseudo)}</span>`
  ).join('');

  if (currentStatus === 'waiting') {
    launchBtn.disabled = players.length < 3;
    if (players.length < 3) {
      gameStatus.textContent = `En attente de joueurs... (${players.length}/3 min)`;
    } else {
      gameStatus.textContent = `Pret a lancer !`;
    }
  }
});

socket.on('game:teamCount', (count) => {
  teamCountEl.textContent = count;
});

socket.on('game:status', (status) => {
  currentStatus = status;
  updateStatusUI();
});

socket.on('game:started', ({ teams, totalTeams }) => {
  currentStatus = 'playing';
  teamCountEl.textContent = totalTeams;
  updateStatusUI();

  // Show teams
  teamsSection.classList.add('visible');
  teamsList.innerHTML = teams.map(t => `
    <div class="team-row">
      <span class="team-label">Equipe ${t.id + 1}</span>
      <div class="team-members">
        ${t.members.map(m => `<span class="member-tag ${m.role}">${escapeHtml(m.pseudo)} (${roleLabel(m.role)})</span>`).join('')}
      </div>
    </div>
  `).join('');
});

socket.on('game:timerStart', (duration) => {
  timerSection.classList.add('visible');
  gmTimer.textContent = duration;
  gmTimer.classList.remove('urgent');
});

socket.on('game:timer', (remaining) => {
  gmTimer.textContent = remaining;
  if (remaining <= 5) gmTimer.classList.add('urgent');
});

socket.on('game:revealing', (results) => {
  currentStatus = 'revealing';
  updateStatusUI();
  timerSection.classList.remove('visible');
});

socket.on('game:reset', () => {
  currentStatus = 'waiting';
  updateStatusUI();
  timerSection.classList.remove('visible');
  teamsSection.classList.remove('visible');
  teamsList.innerHTML = '';
  gmTimer.textContent = '30';
  gmTimer.classList.remove('urgent');
});

socket.on('game:error', (msg) => {
  gameStatus.textContent = msg;
  gameStatus.className = 'gm-status waiting';
});

// === UI HELPERS ===

function updateStatusUI() {
  gameStatus.className = 'gm-status ' + currentStatus;
  launchBtn.style.display = currentStatus === 'waiting' ? '' : 'none';
  resetBtn.style.display = currentStatus === 'waiting' ? 'none' : '';

  switch (currentStatus) {
    case 'waiting':
      gameStatus.textContent = 'En attente de joueurs...';
      launchBtn.disabled = false;
      break;
    case 'playing':
      gameStatus.textContent = 'Partie en cours...';
      break;
    case 'revealing':
      gameStatus.textContent = 'Revelation des personnages !';
      break;
  }
}

function roleLabel(role) {
  switch (role) {
    case 'head': return 'Tete';
    case 'torso': return 'Corps';
    case 'legs': return 'Jambes';
    default: return role;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

console.log('Gamemaster.js loaded');
