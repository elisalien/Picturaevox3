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
const gallerySection = document.getElementById('gallery-section');
const galleryGrid = document.getElementById('gallery-grid');
const downloadGalleryBtn = document.getElementById('download-gallery-btn');
const clearGalleryBtn = document.getElementById('clear-gallery-btn');

let currentStatus = 'waiting';
let gallery = [];

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

downloadGalleryBtn.addEventListener('click', () => {
  downloadAllCharacters();
});

clearGalleryBtn.addEventListener('click', () => {
  if (confirm('Vider toute la galerie ?')) {
    socket.emit('game:clearGallery');
  }
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

socket.on('game:gallery', (data) => {
  gallery = data || [];
  renderGallery();
});

socket.on('game:galleryUpdate', (data) => {
  gallery = data || [];
  renderGallery();
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

// === GALLERY ===

function renderGallery() {
  if (gallery.length === 0) {
    gallerySection.classList.remove('visible');
    return;
  }

  gallerySection.classList.add('visible');
  galleryGrid.innerHTML = '';

  gallery.forEach((round, roundIndex) => {
    const roundLabel = document.createElement('div');
    roundLabel.className = 'gallery-round-label';
    const date = new Date(round.timestamp);
    roundLabel.textContent = `Manche ${roundIndex + 1} — ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    galleryGrid.appendChild(roundLabel);

    const roundGrid = document.createElement('div');
    roundGrid.style.display = 'flex';
    roundGrid.style.flexWrap = 'wrap';
    roundGrid.style.gap = '12px';
    roundGrid.style.marginBottom = '8px';

    round.teams.forEach((team, teamIdx) => {
      const card = document.createElement('div');
      card.className = 'gallery-character';

      const label = document.createElement('div');
      label.className = 'gallery-label';
      label.textContent = `Personnage ${teamIdx + 1}`;
      card.appendChild(label);

      const body = document.createElement('div');
      body.className = 'gallery-body';

      ['head', 'torso', 'legs'].forEach(part => {
        if (team[part]) {
          const img = document.createElement('img');
          img.src = team[part];
          img.alt = part;
          img.draggable = false;
          body.appendChild(img);
        } else {
          const missing = document.createElement('div');
          missing.className = 'gallery-missing';
          missing.textContent = `(${roleLabel(part)})`;
          body.appendChild(missing);
        }
      });

      card.appendChild(body);
      roundGrid.appendChild(card);
    });

    galleryGrid.appendChild(roundGrid);
  });
}

// === DOWNLOAD ===

function downloadAllCharacters() {
  if (gallery.length === 0) return;

  let charIndex = 0;
  gallery.forEach((round, roundIdx) => {
    round.teams.forEach((team, teamIdx) => {
      charIndex++;
      stitchAndDownload(team, `cadavre_exquis_${roundIdx + 1}_personnage_${teamIdx + 1}`);
    });
  });
}

function stitchAndDownload(team, filename) {
  const parts = ['head', 'torso', 'legs'];
  const images = [];
  let loaded = 0;
  let hasAny = false;

  parts.forEach((part, idx) => {
    if (team[part]) {
      hasAny = true;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        images[idx] = img;
        loaded++;
        if (loaded === parts.filter(p => team[p]).length) {
          assembleAndDownload(images, filename);
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === parts.filter(p => team[p]).length) {
          assembleAndDownload(images, filename);
        }
      };
      img.src = team[part];
    }
  });

  if (!hasAny) return;
}

function assembleAndDownload(images, filename) {
  // Find dimensions from first available image
  const validImages = images.filter(Boolean);
  if (validImages.length === 0) return;

  const w = validImages[0].naturalWidth;
  const partH = validImages[0].naturalHeight;
  const totalH = partH * 3;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, totalH);

  // Draw each part
  images.forEach((img, idx) => {
    if (img) {
      ctx.drawImage(img, 0, idx * partH, w, partH);
    }
  });

  // Download
  const link = document.createElement('a');
  link.download = filename + '.png';
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
