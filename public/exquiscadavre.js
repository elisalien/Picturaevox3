// exquiscadavre.js — Reveal page for Cadavre Exquis
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

const waitingState = document.getElementById('waiting-state');
const container = document.getElementById('characters-container');

// Join reveal room
socket.emit('exquiscadavre:join');

socket.on('game:reveal', (results) => {
  waitingState.style.display = 'none';
  container.innerHTML = '';
  revealCharacters(results);
});

socket.on('game:reset', () => {
  waitingState.style.display = '';
  container.innerHTML = '';
});

function revealCharacters(teams) {
  teams.forEach((team, teamIndex) => {
    const card = document.createElement('div');
    card.className = 'character-card';

    const title = document.createElement('h3');
    title.textContent = `Personnage ${teamIndex + 1}`;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'character-body';

    // Head
    const headPart = createPart(team.head, 'head');
    body.appendChild(headPart);

    // Torso
    const torsoPart = createPart(team.torso, 'torso');
    body.appendChild(torsoPart);

    // Legs
    const legsPart = createPart(team.legs, 'legs');
    body.appendChild(legsPart);

    card.appendChild(body);

    // Credits
    const credits = document.createElement('div');
    credits.className = 'character-credits';
    team.members.forEach(m => {
      const tag = document.createElement('span');
      tag.className = 'credit-tag ' + m.role;
      tag.textContent = `${escapeHtml(m.pseudo)} (${roleLabel(m.role)})`;
      credits.appendChild(tag);
    });
    card.appendChild(credits);

    container.appendChild(card);

    // Staggered reveal animation
    const cardDelay = teamIndex * 800;

    setTimeout(() => {
      card.classList.add('visible');
    }, cardDelay);

    // Reveal parts one by one
    setTimeout(() => {
      headPart.classList.add('revealed');
    }, cardDelay + 300);

    setTimeout(() => {
      torsoPart.classList.add('revealed');
    }, cardDelay + 600);

    setTimeout(() => {
      legsPart.classList.add('revealed');
    }, cardDelay + 900);

    // Start rig animations after all parts revealed
    setTimeout(() => {
      body.classList.add('animated');
    }, cardDelay + 1400);
  });
}

function createPart(imageData, partName) {
  const part = document.createElement('div');
  part.className = `character-part part-${partName}`;

  if (imageData) {
    const img = document.createElement('img');
    img.src = imageData;
    img.alt = partName;
    img.draggable = false;
    part.appendChild(img);
  } else {
    const missing = document.createElement('div');
    missing.className = 'missing-part';
    missing.textContent = `(${roleLabel(partName)} manquant)`;
    part.appendChild(missing);
  }

  return part;
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

console.log('Exquiscadavre.js loaded');
