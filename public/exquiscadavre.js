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

let roundCount = 0;

// Join reveal room
socket.emit('exquiscadavre:join');

// Full gallery on initial load — render all past rounds without animation
socket.on('game:gallery', (gallery) => {
  if (!gallery || gallery.length === 0) return;
  waitingState.style.display = 'none';

  // Render all rounds from gallery
  gallery.forEach((round, idx) => {
    roundCount++;
    addRoundToPage(round.teams, roundCount, false);
  });
});

// New round results — append with animation
socket.on('game:reveal', (results) => {
  waitingState.style.display = 'none';
  roundCount++;
  addRoundToPage(results, roundCount, true);

  // Scroll to the new round
  setTimeout(() => {
    const lastSeparator = container.querySelector('.round-separator:last-of-type');
    if (lastSeparator) {
      lastSeparator.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 200);
});

// Reset: don't clear old drawings, just show waiting again for next round
socket.on('game:reset', () => {
  // Keep all existing characters on the page
});

function addRoundToPage(teams, roundNum, animate) {
  // Round separator
  const separator = document.createElement('div');
  separator.className = 'round-separator';
  separator.innerHTML = `<span>Manche ${roundNum}</span>`;
  container.appendChild(separator);

  // Characters row for this round
  const roundRow = document.createElement('div');
  roundRow.className = 'round-row';

  teams.forEach((team, teamIndex) => {
    const card = document.createElement('div');
    card.className = 'character-card';
    if (!animate) card.classList.add('visible'); // No animation for old results

    const title = document.createElement('h3');
    title.textContent = `Personnage ${teamIndex + 1}`;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'character-body';

    const headPart = createPart(team.head, 'head', !animate);
    body.appendChild(headPart);

    const torsoPart = createPart(team.torso, 'torso', !animate);
    body.appendChild(torsoPart);

    const legsPart = createPart(team.legs, 'legs', !animate);
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

    roundRow.appendChild(card);

    if (animate) {
      const cardDelay = teamIndex * 800;

      setTimeout(() => {
        card.classList.add('visible');
      }, cardDelay);

      setTimeout(() => {
        headPart.classList.add('revealed');
      }, cardDelay + 300);

      setTimeout(() => {
        torsoPart.classList.add('revealed');
      }, cardDelay + 600);

      setTimeout(() => {
        legsPart.classList.add('revealed');
      }, cardDelay + 900);

      setTimeout(() => {
        body.classList.add('animated');
      }, cardDelay + 1400);
    } else {
      // Old results: show animated rig directly
      body.classList.add('animated');
    }
  });

  container.appendChild(roundRow);
}

function createPart(imageData, partName, showImmediately) {
  const part = document.createElement('div');
  part.className = `character-part part-${partName}`;
  if (showImmediately) part.classList.add('revealed');

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
