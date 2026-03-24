// server.js V4 - Avec Redis, validation, sécurité améliorée
require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const http = require('http').Server(app);
const Redis = require('ioredis');

// Configuration CORS sécurisée
let allowedOrigins = process.env.ALLOWED_ORIGINS ?
  process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) :
  ['http://localhost:3000', 'http://127.0.0.1:3000'];

// ✅ FIX: Auto-détecter et autoriser le domaine Railway/Render
if (process.env.RAILWAY_STATIC_URL) {
  allowedOrigins.push(`https://${process.env.RAILWAY_STATIC_URL}`);
}
if (process.env.RENDER_EXTERNAL_URL) {
  allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
}

// ✅ FIX: Autoriser le domaine actuel en production
const currentDomain = process.env.PUBLIC_URL || process.env.DOMAIN;
if (currentDomain && !allowedOrigins.includes(currentDomain)) {
  allowedOrigins.push(currentDomain);
}

console.log('🔒 CORS allowed origins:', allowedOrigins);

const io = require('socket.io')(http, {
  cors: {
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origin (comme les apps mobiles, Postman, etc.)
      if (!origin) return callback(null, true);

      // ✅ FIX: En développement, autoriser toutes les origines
      if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      // Vérifier si l'origine est autorisée
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        console.warn(`   Allowed origins:`, allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 10000,
  pingInterval: 5000,
  perMessageDeflate: {
    threshold: 1024
  }
});

// Configuration Redis
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

if (redis) {
  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });
  redis.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });
} else {
  console.log('⚠️ Redis not configured, using in-memory storage only');
}

// In-memory store for shapes
const shapes = {};
// Historique des actions
const actionHistory = [];
const MAX_HISTORY = 10; // Augmenté de 2 à 10
const MAX_HISTORY_REDIS = 50; // Historique étendu dans Redis

// Optimisations performance
const MAX_SHAPES = 1000; // Augmenté de 500 à 1000
const CLEANUP_INTERVAL = 60000;
const SHAPE_TTL = 600000; // Augmenté de 5 min à 10 min

// === ADMIN STATE ===
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
  }
};

// === CADAVRE EXQUIS GAME STATE ===
const gameState = {
  status: 'waiting', // waiting | playing | revealing
  players: new Map(),
  teams: [],
  timer: null,
  timerValue: 0,
  drawings: new Map(),
  lastResults: null,
  finalizeTimeout: null,
  settings: { turnDuration: 30 }
};

// Galerie persistante des résultats de jeu
const gameGallery = [];

// === TELEPHONE GRIBOUILLIS STATE ===
const telephoneState = {
  status: 'stopped', // stopped | playing | revealing
  chains: [], // array of chains, each chain = [{type: 'word'|'drawing', content, author}]
  players: new Map(),
  currentRound: 0,
  timer: null,
  timerValue: 0,
  settings: { roundDuration: 30 }
};

// === DESSINE-DEVINE STATE ===
const devineState = {
  status: 'stopped', // stopped | playing | revealing
  currentDrawer: null,
  currentWord: null,
  players: new Map(),
  scores: new Map(),
  timer: null,
  timerValue: 0,
  round: 0,
  settings: { roundDuration: 60 },
  wordList: [
    'chat', 'maison', 'soleil', 'arbre', 'voiture', 'fusee', 'robot', 'pizza',
    'dragon', 'guitare', 'montagne', 'bateau', 'avion', 'fleur', 'etoile',
    'ballon', 'chapeau', 'poisson', 'fantome', 'parapluie', 'licorne',
    'dinosaure', 'gateau', 'train', 'papillon', 'nuage', 'arc-en-ciel',
    'bonhomme de neige', 'chateau', 'sirene', 'hibou', 'cactus', 'igloo'
  ]
};

// === LE GRAND THEME STATE ===
const themeState = {
  status: 'stopped', // stopped | playing | revealing
  currentTheme: '',
  players: new Map(),
  drawings: new Map(),
  timer: null,
  timerValue: 0,
  settings: { drawDuration: 120 }
};

function getGamePlayerList() {
  return Array.from(gameState.players.values()).map(p => ({ pseudo: p.pseudo, socketId: p.socketId }));
}

function getGameTeamCount(playerCount) {
  return Math.floor(playerCount / 3);
}

function finalizeGame() {
  if (gameState.status === 'revealing') return;
  gameState.status = 'revealing';

  const results = gameState.teams.map(team => ({
    teamId: team.id,
    head: gameState.drawings.get(`${team.id}_head`) || null,
    torso: gameState.drawings.get(`${team.id}_torso`) || null,
    legs: gameState.drawings.get(`${team.id}_legs`) || null,
    members: team.members.map(m => ({ pseudo: m.pseudo, role: m.role }))
  }));

  gameState.lastResults = results;

  // Ajouter à la galerie persistante
  gameGallery.push({
    timestamp: Date.now(),
    teams: results
  });

  io.to('game-room').emit('game:done');
  io.to('gamemaster-room').emit('game:revealing', results);
  io.to('gamemaster-room').emit('game:galleryUpdate', gameGallery);
  io.to('exquiscadavre-room').emit('game:reveal', results);

  console.log(`🎭 Game finalized: ${results.length} teams, ${gameState.drawings.size} drawings, gallery: ${gameGallery.length} rounds`);
}

function resetGame() {
  gameState.status = 'waiting';
  gameState.teams = [];
  gameState.drawings.clear();
  gameState.lastResults = null;
  if (gameState.timer) {
    clearInterval(gameState.timer);
    gameState.timer = null;
  }
  if (gameState.finalizeTimeout) {
    clearTimeout(gameState.finalizeTimeout);
    gameState.finalizeTimeout = null;
  }
  gameState.timerValue = 0;
  // Don't clear players — they stay in the lobby
  console.log('🔄 Game reset');
}

// === FONCTIONS DE VALIDATION ===

function isValidHexColor(color) {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

function isValidPoints(points, maxLength = 1000) {
  if (!Array.isArray(points)) return false;
  if (points.length === 0 || points.length % 2 !== 0) return false;
  if (points.length > maxLength) return false;
  return points.every(p => typeof p === 'number' && !isNaN(p) && isFinite(p));
}

function isValidSize(size, min = 1, max = 50) {
  return typeof size === 'number' && size >= min && size <= max && !isNaN(size);
}

function validateDrawData(data) {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid data format' };
  if (!data.id || typeof data.id !== 'string') return { valid: false, error: 'Invalid ID' };
  if (data.id.length > 100) return { valid: false, error: 'ID too long' };

  // Valider "stroke" (utilisé par les clients) ou "color" (rétrocompatibilité)
  if (data.stroke && !isValidHexColor(data.stroke)) {
    return { valid: false, error: 'Invalid stroke color format' };
  }

  if (data.color && !isValidHexColor(data.color)) {
    return { valid: false, error: 'Invalid color format' };
  }

  if (data.points && !isValidPoints(data.points)) {
    return { valid: false, error: 'Invalid points array' };
  }

  // Valider "strokeWidth" (utilisé par les clients) ou "width"/"size" (rétrocompatibilité)
  if (data.strokeWidth && !isValidSize(data.strokeWidth)) {
    return { valid: false, error: 'Invalid strokeWidth' };
  }

  if (data.width && !isValidSize(data.width)) {
    return { valid: false, error: 'Invalid width' };
  }

  if (data.size && !isValidSize(data.size)) {
    return { valid: false, error: 'Invalid size' };
  }

  return { valid: true };
}

// === FONCTIONS REDIS POUR PERSISTANCE ===

async function saveShapeToRedis(shape) {
  if (!redis) return;

  try {
    await redis.hset('shapes', shape.id, JSON.stringify(shape));
    await redis.zadd('shapes:timeline', shape.timestamp, shape.id);
    console.log(`💾 Shape ${shape.id} saved to Redis`);
  } catch (error) {
    console.error('❌ Error saving shape to Redis:', error);
  }
}

async function loadShapesFromRedis() {
  if (!redis) return;

  try {
    const shapeIds = await redis.hkeys('shapes');
    let loadedCount = 0;

    for (const id of shapeIds) {
      const shapeData = await redis.hget('shapes', id);
      if (shapeData) {
        shapes[id] = JSON.parse(shapeData);
        loadedCount++;
      }
    }

    console.log(`✅ Loaded ${loadedCount} shapes from Redis`);
  } catch (error) {
    console.error('❌ Error loading shapes from Redis:', error);
  }
}

async function deleteShapeFromRedis(id) {
  if (!redis) return;

  try {
    await redis.hdel('shapes', id);
    await redis.zrem('shapes:timeline', id);
    console.log(`🗑️ Shape ${id} deleted from Redis`);
  } catch (error) {
    console.error('❌ Error deleting shape from Redis:', error);
  }
}

async function clearAllShapesFromRedis() {
  if (!redis) return;

  try {
    await redis.del('shapes');
    await redis.del('shapes:timeline');
    console.log('🗑️ All shapes cleared from Redis');
  } catch (error) {
    console.error('❌ Error clearing Redis:', error);
  }
}

async function saveActionToRedisHistory(action) {
  if (!redis) return;

  try {
    await redis.lpush('history:actions', JSON.stringify(action));
    await redis.ltrim('history:actions', 0, MAX_HISTORY_REDIS - 1);
  } catch (error) {
    console.error('❌ Error saving action to Redis history:', error);
  }
}

// Ajouter timestamp aux formes
function addTimestampToShape(shapeData) {
  return {
    ...shapeData,
    timestamp: Date.now()
  };
}

// Nettoyage automatique des anciennes formes
function cleanupOldShapes() {
  const now = Date.now();
  const shapeIds = Object.keys(shapes);
  
  if (shapeIds.length > MAX_SHAPES) {
    const sortedShapes = shapeIds
      .map(id => ({ id, timestamp: shapes[id].timestamp || 0 }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const toDelete = sortedShapes.slice(0, shapeIds.length - MAX_SHAPES);
    toDelete.forEach(({ id }) => {
      delete shapes[id];
    });
    
    console.log(`🧹 Cleaned up ${toDelete.length} old shapes`);
  }
  
  const expired = shapeIds.filter(id => {
    const shape = shapes[id];
    return shape.timestamp && (now - shape.timestamp) > SHAPE_TTL;
  });
  
  expired.forEach(id => delete shapes[id]);
  
  if (expired.length > 0) {
    console.log(`🧹 Removed ${expired.length} expired shapes`);
  }
}

setInterval(cleanupOldShapes, CLEANUP_INTERVAL);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/chantilly', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/output', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'output.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  const connectedClients = io.engine.clientsCount;
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    clients: connectedClients,
    shapes: Object.keys(shapes).length
  });
});

io.on('connection', socket => {
  const connectedClients = io.engine.clientsCount;
  console.log(`👤 USER CONNECTED: ${socket.id} (Total: ${connectedClients} clients)`);

  // Send existing shapes to this client (INCLUDING permanent traces)
  socket.emit('initShapes', Object.values(shapes));

  // 🏓 Ping/Pong pour mesurer latence
  socket.on('ping', (clientTimestamp) => {
    const serverTimestamp = Date.now();
    const latency = serverTimestamp - clientTimestamp;
    socket.emit('pong', latency);
  });

  // Broadcast streaming drawing data
  socket.on('drawing', data => {
    socket.broadcast.emit('drawing', data);
  });

  // Broadcast texture brush data
  socket.on('texture', data => {
    if (!socket.lastTextureTime || Date.now() - socket.lastTextureTime > 100) {
      socket.broadcast.emit('texture', data);
      socket.lastTextureTime = Date.now();
    }
  });

  // Gestion des brush effects avec sauvegarde des tracés permanents
  socket.on('brushEffect', async (data) => {
    const now = Date.now();
    const throttleTime = data.interface === 'admin' ? 100 :
                        data.interface === 'atelier' ? 150 : 250;

    if (!socket.lastBrushEffect || (now - socket.lastBrushEffect) >= throttleTime) {
      // ✅ Sauvegarder les tracés permanents
      if (data.permanentTraces && data.permanentTraces.length > 0) {
        for (const trace of data.permanentTraces) {
          const traceWithTimestamp = addTimestampToShape({
            ...trace,
            id: trace.id || generateTraceId(),
            type: 'permanentTrace'
          });
          shapes[traceWithTimestamp.id] = traceWithTimestamp;

          // Sauvegarder dans Redis
          await saveShapeToRedis(traceWithTimestamp);
        }

        console.log(`💾 Saved ${data.permanentTraces.length} permanent traces from ${data.type} brush`);
      }

      socket.broadcast.emit('brushEffect', {
        ...data,
        socketId: socket.id,
        serverTimestamp: now
      });
      socket.lastBrushEffect = now;
    }
  });

  socket.on('cleanupUserEffects', ({ userId }) => {
    socket.broadcast.emit('cleanupUserEffects', { 
      socketId: socket.id, 
      userId 
    });
  });

  // Création de formes prédéfinies
  socket.on('shapeCreate', async (data) => {
    // Validation des données
    const validation = validateDrawData(data);
    if (!validation.valid) {
      console.warn(`⚠️ Invalid shape data from ${socket.id}: ${validation.error}`);
      socket.emit('error', { message: validation.error });
      return;
    }

    const shapeWithTimestamp = addTimestampToShape(data);
    shapes[data.id] = shapeWithTimestamp;

    // Sauvegarder dans Redis
    await saveShapeToRedis(shapeWithTimestamp);

    socket.broadcast.emit('shapeCreate', data);
  });

  // Final draw event
  socket.on('draw', async (data) => {
    // Validation des données
    const validation = validateDrawData(data);
    if (!validation.valid) {
      console.warn(`⚠️ Invalid draw data from ${socket.id}: ${validation.error}`);
      socket.emit('error', { message: validation.error });
      return;
    }

    const optimizedData = {
      ...data,
      points: data.points && data.points.length > 400 ? simplifyPoints(data.points, 200) : data.points
    };

    const shapeWithTimestamp = addTimestampToShape(optimizedData);

    // Ajouter à l'historique
    await addToHistory({
      type: 'draw',
      action: 'add',
      data: shapeWithTimestamp
    });

    shapes[data.id] = shapeWithTimestamp;

    // Sauvegarder dans Redis
    await saveShapeToRedis(shapeWithTimestamp);

    socket.broadcast.emit('draw', optimizedData);
  });

  // Shape deletion (incluant tracés permanents)
  socket.on('deleteShape', async ({ id }) => {
    console.log('🧽 Delete shape command:', id);

    const deletedShape = shapes[id];
    if (deletedShape) {
      await addToHistory({
        type: 'delete',
        action: 'remove',
        data: deletedShape
      });
    }

    delete shapes[id];

    // Supprimer de Redis
    await deleteShapeFromRedis(id);

    io.emit('deleteShape', { id });

    console.log(`🧽 Shape ${id} deleted globally (type: ${deletedShape?.type || 'normal'})`);
  });

  // Clear canvas - ✅ AVEC LOGS DEBUG DÉTAILLÉS
  socket.on('clearCanvas', async () => {
    const shapesCount = Object.keys(shapes).length;
    const connectedClients = io.engine.clientsCount;

    console.log(`🧼 CLEAR CANVAS REQUEST:`);
    console.log(`   - Shapes in store: ${shapesCount}`);
    console.log(`   - Connected clients: ${connectedClients}`);
    console.log(`   - Request from socket: ${socket.id}`);

    // Sauvegarder toutes les formes pour undo (incluant tracés permanents)
    const allShapes = { ...shapes };
    await addToHistory({
      type: 'clear',
      action: 'removeAll',
      data: allShapes
    });

    // ✅ Vider TOUT le store shapes (incluant tracés permanents)
    const shapeIds = Object.keys(shapes);
    shapeIds.forEach(id => {
      delete shapes[id];
    });

    // Vider Redis
    await clearAllShapesFromRedis();

    console.log(`🧼 BROADCASTING clearCanvas to ALL ${connectedClients} clients...`);

    // ✅ Envoyer à TOUS les clients (y compris admin)
    io.emit('clearCanvas');

    const shapesAfter = Object.keys(shapes).length;
    console.log(`🧼 CLEAR COMPLETE:`);
    console.log(`   - Shapes cleared: ${shapeIds.length}`);
    console.log(`   - Shapes remaining: ${shapesAfter}`);
    console.log(`   - Broadcast sent to ${connectedClients} clients`);
  });

  // Undo action
  socket.on('undo', async () => {
    if (actionHistory.length > 0) {
      const lastAction = actionHistory.pop();

      console.log(`↶ Undo action performed: ${lastAction.type} (${actionHistory.length} actions remaining)`);

      switch (lastAction.type) {
        case 'draw':
          delete shapes[lastAction.data.id];
          await deleteShapeFromRedis(lastAction.data.id);
          io.emit('deleteShape', { id: lastAction.data.id });
          break;

        case 'delete':
          shapes[lastAction.data.id] = lastAction.data;
          await saveShapeToRedis(lastAction.data);
          io.emit('draw', lastAction.data);
          break;

        case 'clear':
          Object.assign(shapes, lastAction.data);
          // Sauvegarder toutes les shapes restaurées
          for (const shape of Object.values(lastAction.data)) {
            await saveShapeToRedis(shape);
          }
          io.emit('restoreShapes', Object.values(lastAction.data));
          break;
      }
    } else {
      console.log('↶ Undo requested but no actions in history');
    }
  });

  // ✅ Reset des brush effects globalement
  socket.on('adminResetBrushEffects', () => {
    console.log('👑 Admin command: Reset all brush effects globally');
    io.emit('adminResetBrushEffects');
  });

  // === GAME MODE AVAILABILITY ===

  socket.on('game:getAvailableModes', () => {
    socket.emit('game:availableModes', adminState.games);
  });

  // === CADAVRE EXQUIS GAME EVENTS ===

  socket.on('game:join', ({ pseudo }) => {
    gameState.players.set(socket.id, { pseudo, socketId: socket.id });
    socket.join('game-room');
    const playerList = getGamePlayerList();
    io.to('game-room').emit('game:playerList', playerList);
    io.to('gamemaster-room').emit('game:playerList', playerList);
    io.to('gamemaster-room').emit('game:teamCount', getGameTeamCount(playerList.length));
    console.log(`🎮 Player joined game: ${pseudo} (${gameState.players.size} players)`);
  });

  socket.on('gamemaster:join', () => {
    socket.join('gamemaster-room');
    const playerList = getGamePlayerList();
    socket.emit('game:playerList', playerList);
    socket.emit('game:teamCount', getGameTeamCount(playerList.length));
    socket.emit('game:status', gameState.status);
    socket.emit('game:gallery', gameGallery);
    if (gameState.status === 'playing') {
      socket.emit('game:timer', gameState.timerValue);
    }
    if (gameState.status === 'revealing' && gameState.lastResults) {
      socket.emit('game:revealing', gameState.lastResults);
    }
    console.log('👑 Gamemaster connected');
  });

  socket.on('exquiscadavre:join', () => {
    socket.join('exquiscadavre-room');
    // Envoyer toute la galerie pour afficher les anciennes parties
    if (gameGallery.length > 0) {
      socket.emit('game:gallery', gameGallery);
    }
    console.log('🎭 Exquiscadavre viewer connected');
  });

  socket.on('game:start', () => {
    if (gameState.status !== 'waiting') return;
    const players = Array.from(gameState.players.values());
    if (players.length < 3) {
      socket.emit('game:error', 'Il faut au moins 3 joueurs');
      return;
    }

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const roles = ['head', 'torso', 'legs'];
    const teams = [];

    for (let i = 0; i + 2 < shuffled.length; i += 3) {
      teams.push({
        id: teams.length,
        members: [
          { ...shuffled[i], role: roles[0] },
          { ...shuffled[i + 1], role: roles[1] },
          { ...shuffled[i + 2], role: roles[2] }
        ]
      });
    }

    // Spectators = players not in any team
    const teamPlayerIds = new Set(teams.flatMap(t => t.members.map(m => m.socketId)));

    gameState.teams = teams;
    gameState.status = 'playing';
    gameState.drawings.clear();

    // Notify each player of their role
    teams.forEach(team => {
      team.members.forEach(member => {
        io.to(member.socketId).emit('game:assigned', {
          role: member.role,
          teamId: team.id,
          totalTeams: teams.length
        });
      });
    });

    // Notify spectators
    gameState.players.forEach((player, socketId) => {
      if (!teamPlayerIds.has(socketId)) {
        io.to(socketId).emit('game:spectator');
      }
    });

    io.to('gamemaster-room').emit('game:started', {
      teams: teams.map(t => ({
        id: t.id,
        members: t.members.map(m => ({ pseudo: m.pseudo, role: m.role }))
      })),
      totalTeams: teams.length
    });

    // Start timer
    gameState.timerValue = gameState.settings.turnDuration;
    io.to('game-room').emit('game:timerStart', gameState.timerValue);
    io.to('gamemaster-room').emit('game:timerStart', gameState.timerValue);

    gameState.timer = setInterval(() => {
      gameState.timerValue--;
      io.to('game-room').emit('game:timer', gameState.timerValue);
      io.to('gamemaster-room').emit('game:timer', gameState.timerValue);

      if (gameState.timerValue <= 0) {
        clearInterval(gameState.timer);
        gameState.timer = null;
        io.to('game-room').emit('game:timeUp');
        // Grace period: 3s pour que les clients exportent et envoient leurs dessins
        gameState.finalizeTimeout = setTimeout(() => {
          gameState.finalizeTimeout = null;
          finalizeGame();
        }, 3000);
      }
    }, 1000);

    console.log(`🎮 Game started: ${teams.length} teams, ${players.length} players`);
  });

  socket.on('game:submitDrawing', ({ imageData, role, teamId }) => {
    const key = `${teamId}_${role}`;
    if (gameState.drawings.has(key)) return; // Already submitted
    gameState.drawings.set(key, imageData);
    console.log(`🎨 Drawing received: team ${teamId}, ${role} (${gameState.drawings.size}/${gameState.teams.length * 3})`);

    // Check if all drawings collected
    if (gameState.drawings.size >= gameState.teams.length * 3) {
      if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
      }
      if (gameState.finalizeTimeout) {
        clearTimeout(gameState.finalizeTimeout);
        gameState.finalizeTimeout = null;
      }
      finalizeGame();
    }
  });

  socket.on('game:reset', () => {
    resetGame();
    io.to('game-room').emit('game:reset');
    io.to('gamemaster-room').emit('game:reset');
    io.to('exquiscadavre-room').emit('game:reset');
  });

  socket.on('game:clearGallery', () => {
    gameGallery.length = 0;
    io.to('gamemaster-room').emit('game:gallery', gameGallery);
    console.log('🗑️ Game gallery cleared');
  });

  // === ADMIN EVENTS ===

  socket.on('admin:join', () => {
    socket.join('admin-room');
    socket.join('gamemaster-room'); // Also receive game events
    const connectedPlayers = io.engine.clientsCount;
    socket.emit('admin:state', {
      games: adminState.games,
      outputLayout: adminState.outputLayout,
      connectedPlayers
    });
    console.log('Admin panel connected');
  });

  socket.on('admin:enableGame', ({ game, enabled }) => {
    if (adminState.games[game]) {
      adminState.games[game].enabled = enabled;
      if (!enabled) {
        adminState.games[game].status = 'stopped';
      }
      io.to('admin-room').emit('admin:gamesUpdate', adminState.games);
      console.log(`Admin: ${game} ${enabled ? 'enabled' : 'disabled'}`);
    }
  });

  socket.on('admin:outputLayout', ({ layout }) => {
    Object.assign(adminState.outputLayout, layout);
    io.to('output-room').emit('output:layout', adminState.outputLayout);
    console.log('Admin: output layout updated', adminState.outputLayout);
  });

  socket.on('admin:resetAll', () => {
    // Reset all game states
    Object.keys(adminState.games).forEach(game => {
      adminState.games[game].enabled = false;
      adminState.games[game].status = 'stopped';
      adminState.games[game].players = 0;
    });
    resetGame();
    telephoneState.status = 'stopped';
    telephoneState.chains = [];
    telephoneState.players.clear();
    devineState.status = 'stopped';
    devineState.players.clear();
    devineState.scores.clear();
    themeState.status = 'stopped';
    themeState.players.clear();
    themeState.drawings.clear();
    io.to('admin-room').emit('admin:gamesUpdate', adminState.games);
    console.log('Admin: full reset');
  });

  // === OUTPUT (PROJECTION) EVENTS ===

  socket.on('output:join', () => {
    socket.join('output-room');
    socket.emit('output:layout', adminState.outputLayout);
    // Send latest game results if any
    if (gameGallery.length > 0) {
      socket.emit('game:gallery', gameGallery);
    }
    if (gameState.lastResults) {
      socket.emit('game:reveal', gameState.lastResults);
    }
    console.log('Output screen connected');
  });

  // === TELEPHONE GRIBOUILLIS EVENTS ===

  socket.on('telephone:join', ({ pseudo }) => {
    telephoneState.players.set(socket.id, { pseudo, socketId: socket.id });
    socket.join('telephone-room');
    adminState.games.telephone.players = telephoneState.players.size;
    io.to('admin-room').emit('telephone:update', {
      status: telephoneState.status,
      players: telephoneState.players.size
    });
    console.log(`Telephone: ${pseudo} joined (${telephoneState.players.size} players)`);
  });

  socket.on('telephone:start', () => {
    if (!adminState.games.telephone.enabled) return;
    const players = Array.from(telephoneState.players.values());
    if (players.length < 2) return;

    telephoneState.status = 'playing';
    telephoneState.currentRound = 0;
    telephoneState.chains = players.map(p => [{
      type: 'word',
      content: '',
      author: p.pseudo,
      socketId: p.socketId
    }]);

    adminState.games.telephone.status = 'playing';
    io.to('admin-room').emit('telephone:update', { status: 'playing', players: players.length });

    // Ask each player to write a word/phrase
    players.forEach(p => {
      io.to(p.socketId).emit('telephone:prompt', {
        type: 'word',
        round: 0,
        message: 'Ecris un mot ou une phrase que les autres vont dessiner !'
      });
    });

    // Start timer
    telephoneState.timerValue = telephoneState.settings.roundDuration;
    io.to('telephone-room').emit('telephone:timerStart', telephoneState.timerValue);
    telephoneState.timer = setInterval(() => {
      telephoneState.timerValue--;
      io.to('telephone-room').emit('telephone:timer', telephoneState.timerValue);
      if (telephoneState.timerValue <= 0) {
        clearInterval(telephoneState.timer);
        telephoneState.timer = null;
        io.to('telephone-room').emit('telephone:timeUp');
      }
    }, 1000);

    console.log(`Telephone started: ${players.length} players`);
  });

  socket.on('telephone:submit', ({ content, round }) => {
    // Find which chain this player is working on
    const playerIndex = Array.from(telephoneState.players.keys()).indexOf(socket.id);
    if (playerIndex < 0) return;

    const chainIndex = (playerIndex + round) % telephoneState.chains.length;
    const chain = telephoneState.chains[chainIndex];
    if (!chain) return;

    const player = telephoneState.players.get(socket.id);
    chain.push({
      type: round % 2 === 0 ? 'word' : 'drawing',
      content,
      author: player ? player.pseudo : 'unknown',
      socketId: socket.id
    });

    // Check if all submissions for this round are in
    const expectedSubmissions = telephoneState.players.size * (round + 1) + telephoneState.players.size;
    const totalSubmissions = telephoneState.chains.reduce((sum, c) => sum + c.length, 0);

    if (totalSubmissions >= expectedSubmissions) {
      telephoneState.currentRound++;
      if (telephoneState.currentRound >= telephoneState.players.size - 1) {
        // Game over - reveal chains
        telephoneState.status = 'revealing';
        adminState.games.telephone.status = 'revealing';
        io.to('telephone-room').emit('telephone:reveal', telephoneState.chains);
        io.to('output-room').emit('telephone:reveal', telephoneState.chains);
        io.to('admin-room').emit('telephone:update', { status: 'revealing' });
      } else {
        // Next round
        startTelephoneRound(telephoneState.currentRound);
      }
    }
  });

  socket.on('telephone:reset', () => {
    if (telephoneState.timer) { clearInterval(telephoneState.timer); telephoneState.timer = null; }
    telephoneState.status = 'stopped';
    telephoneState.chains = [];
    telephoneState.currentRound = 0;
    adminState.games.telephone.status = 'stopped';
    io.to('telephone-room').emit('telephone:reset');
    io.to('admin-room').emit('telephone:update', { status: 'stopped' });
    console.log('Telephone reset');
  });

  // === DESSINE-DEVINE EVENTS ===

  socket.on('devine:join', ({ pseudo }) => {
    devineState.players.set(socket.id, { pseudo, socketId: socket.id });
    devineState.scores.set(socket.id, 0);
    socket.join('devine-room');
    adminState.games.devine.players = devineState.players.size;
    io.to('admin-room').emit('devine:update', {
      status: devineState.status,
      players: devineState.players.size
    });

    // Send current scores
    socket.emit('devine:scores', Object.fromEntries(
      Array.from(devineState.scores.entries()).map(([id, score]) => {
        const p = devineState.players.get(id);
        return [id, { pseudo: p ? p.pseudo : '?', score }];
      })
    ));
    console.log(`Devine: ${pseudo} joined (${devineState.players.size} players)`);
  });

  socket.on('devine:start', () => {
    if (!adminState.games.devine.enabled) return;
    if (devineState.players.size < 2) return;
    devineState.round = 0;
    startDevineRound();
  });

  socket.on('devine:drawing', (data) => {
    // Broadcast live drawing to guessers
    if (devineState.status === 'playing' && socket.id === devineState.currentDrawer) {
      socket.broadcast.to('devine-room').emit('devine:drawing', data);
      io.to('output-room').emit('devine:drawing', data);
    }
  });

  socket.on('devine:guess', ({ guess }) => {
    if (devineState.status !== 'playing') return;
    if (socket.id === devineState.currentDrawer) return;
    if (!devineState.currentWord) return;

    const player = devineState.players.get(socket.id);
    const pseudo = player ? player.pseudo : '?';

    // Check guess using Levenshtein
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedWord = devineState.currentWord.toLowerCase().trim();
    const distance = levenshteinDistance(normalizedGuess, normalizedWord);

    if (distance === 0) {
      // Correct!
      const guesserScore = (devineState.scores.get(socket.id) || 0) + 10;
      const drawerScore = (devineState.scores.get(devineState.currentDrawer) || 0) + 5;
      devineState.scores.set(socket.id, guesserScore);
      devineState.scores.set(devineState.currentDrawer, drawerScore);

      io.to('devine-room').emit('devine:correct', { pseudo, word: devineState.currentWord });
      io.to('output-room').emit('devine:correct', { pseudo, word: devineState.currentWord });
      broadcastDevineScores();

      // Start next round after a short delay
      if (devineState.timer) { clearInterval(devineState.timer); devineState.timer = null; }
      setTimeout(() => startDevineRound(), 3000);
    } else if (distance <= 2) {
      // Close
      io.to(socket.id).emit('devine:close', { guess });
      io.to('devine-room').emit('devine:chatMessage', { pseudo, message: guess, close: true });
    } else {
      // Wrong
      io.to('devine-room').emit('devine:chatMessage', { pseudo, message: guess, close: false });
    }
  });

  socket.on('devine:reset', () => {
    if (devineState.timer) { clearInterval(devineState.timer); devineState.timer = null; }
    devineState.status = 'stopped';
    devineState.currentDrawer = null;
    devineState.currentWord = null;
    devineState.scores.clear();
    devineState.round = 0;
    adminState.games.devine.status = 'stopped';
    io.to('devine-room').emit('devine:reset');
    io.to('admin-room').emit('devine:update', { status: 'stopped' });
    console.log('Devine reset');
  });

  // === LE GRAND THEME EVENTS ===

  socket.on('theme:join', ({ pseudo }) => {
    themeState.players.set(socket.id, { pseudo, socketId: socket.id });
    socket.join('theme-room');
    adminState.games.theme.players = themeState.players.size;
    io.to('admin-room').emit('theme:update', {
      status: themeState.status,
      players: themeState.players.size
    });
    if (themeState.status === 'playing') {
      socket.emit('theme:started', { theme: themeState.currentTheme, timeRemaining: themeState.timerValue });
    }
    console.log(`Theme: ${pseudo} joined (${themeState.players.size} players)`);
  });

  socket.on('theme:start', ({ theme }) => {
    if (!adminState.games.theme.enabled) return;
    themeState.currentTheme = theme || 'Theme libre';
    themeState.status = 'playing';
    themeState.drawings.clear();

    adminState.games.theme.status = 'playing';
    io.to('theme-room').emit('theme:started', { theme: themeState.currentTheme, timeRemaining: themeState.settings.drawDuration });
    io.to('admin-room').emit('theme:update', { status: 'playing' });
    io.to('output-room').emit('theme:started', { theme: themeState.currentTheme });

    // Timer
    themeState.timerValue = themeState.settings.drawDuration;
    io.to('theme-room').emit('theme:timerStart', themeState.timerValue);
    themeState.timer = setInterval(() => {
      themeState.timerValue--;
      io.to('theme-room').emit('theme:timer', themeState.timerValue);
      if (themeState.timerValue <= 0) {
        clearInterval(themeState.timer);
        themeState.timer = null;
        io.to('theme-room').emit('theme:timeUp');
        // Collect and reveal
        setTimeout(() => revealThemeDrawings(), 3000);
      }
    }, 1000);

    console.log(`Theme started: "${themeState.currentTheme}" (${themeState.players.size} players)`);
  });

  socket.on('theme:submitDrawing', ({ imageData }) => {
    const player = themeState.players.get(socket.id);
    if (!player) return;
    themeState.drawings.set(socket.id, { imageData, pseudo: player.pseudo });
    console.log(`Theme: drawing from ${player.pseudo} (${themeState.drawings.size}/${themeState.players.size})`);

    if (themeState.drawings.size >= themeState.players.size) {
      if (themeState.timer) { clearInterval(themeState.timer); themeState.timer = null; }
      revealThemeDrawings();
    }
  });

  socket.on('theme:reset', () => {
    if (themeState.timer) { clearInterval(themeState.timer); themeState.timer = null; }
    themeState.status = 'stopped';
    themeState.drawings.clear();
    themeState.currentTheme = '';
    adminState.games.theme.status = 'stopped';
    io.to('theme-room').emit('theme:reset');
    io.to('admin-room').emit('theme:update', { status: 'stopped' });
    console.log('Theme reset');
  });

  // === END GAME EVENTS ===

  socket.on('disconnect', (reason) => {
    const remainingClients = io.engine.clientsCount;
    console.log(`USER DISCONNECTED: ${socket.id} (Reason: ${reason}, Remaining: ${remainingClients})`);
    socket.broadcast.emit('cleanupUserEffects', { socketId: socket.id });

    // Remove from cadavre exquis
    if (gameState.players.has(socket.id)) {
      gameState.players.delete(socket.id);
      const playerList = getGamePlayerList();
      io.to('game-room').emit('game:playerList', playerList);
      io.to('gamemaster-room').emit('game:playerList', playerList);
      io.to('gamemaster-room').emit('game:teamCount', getGameTeamCount(playerList.length));
    }

    // Remove from telephone
    if (telephoneState.players.has(socket.id)) {
      telephoneState.players.delete(socket.id);
      adminState.games.telephone.players = telephoneState.players.size;
      io.to('admin-room').emit('telephone:update', { players: telephoneState.players.size });
    }

    // Remove from devine
    if (devineState.players.has(socket.id)) {
      devineState.players.delete(socket.id);
      adminState.games.devine.players = devineState.players.size;
      io.to('admin-room').emit('devine:update', { players: devineState.players.size });
    }

    // Remove from theme
    if (themeState.players.has(socket.id)) {
      themeState.players.delete(socket.id);
      adminState.games.theme.players = themeState.players.size;
      io.to('admin-room').emit('theme:update', { players: themeState.players.size });
    }

    // Update admin player count
    setTimeout(() => {
      io.to('admin-room').emit('admin:state', { connectedPlayers: io.engine.clientsCount });
    }, 100);
  });
});

// === HELPER FUNCTIONS FOR GAME MODES ===

function startTelephoneRound(round) {
  const players = Array.from(telephoneState.players.values());
  const isDrawRound = round % 2 !== 0;

  players.forEach((player, idx) => {
    const chainIndex = (idx + round) % telephoneState.chains.length;
    const chain = telephoneState.chains[chainIndex];
    const lastEntry = chain[chain.length - 1];

    io.to(player.socketId).emit('telephone:prompt', {
      type: isDrawRound ? 'drawing' : 'word',
      round,
      content: lastEntry.content,
      message: isDrawRound
        ? 'Dessine ce que tu lis !'
        : 'Decris ce que tu vois !'
    });
  });

  telephoneState.timerValue = telephoneState.settings.roundDuration;
  io.to('telephone-room').emit('telephone:timerStart', telephoneState.timerValue);
  if (telephoneState.timer) clearInterval(telephoneState.timer);
  telephoneState.timer = setInterval(() => {
    telephoneState.timerValue--;
    io.to('telephone-room').emit('telephone:timer', telephoneState.timerValue);
    if (telephoneState.timerValue <= 0) {
      clearInterval(telephoneState.timer);
      telephoneState.timer = null;
      io.to('telephone-room').emit('telephone:timeUp');
    }
  }, 1000);
}

function startDevineRound() {
  const players = Array.from(devineState.players.keys());
  if (players.length < 2) return;

  devineState.round++;
  const drawerIndex = (devineState.round - 1) % players.length;
  devineState.currentDrawer = players[drawerIndex];
  devineState.currentWord = devineState.wordList[Math.floor(Math.random() * devineState.wordList.length)];
  devineState.status = 'playing';
  adminState.games.devine.status = 'playing';

  const drawerPlayer = devineState.players.get(devineState.currentDrawer);
  const drawerPseudo = drawerPlayer ? drawerPlayer.pseudo : '?';

  // Notify drawer
  io.to(devineState.currentDrawer).emit('devine:youDraw', {
    word: devineState.currentWord,
    round: devineState.round
  });

  // Notify guessers
  players.forEach(id => {
    if (id !== devineState.currentDrawer) {
      io.to(id).emit('devine:guessMode', {
        drawer: drawerPseudo,
        round: devineState.round
      });
    }
  });

  io.to('output-room').emit('devine:roundStart', { drawer: drawerPseudo, round: devineState.round });
  io.to('admin-room').emit('devine:update', { status: 'playing' });

  // Timer
  devineState.timerValue = devineState.settings.roundDuration;
  io.to('devine-room').emit('devine:timerStart', devineState.timerValue);
  if (devineState.timer) clearInterval(devineState.timer);
  devineState.timer = setInterval(() => {
    devineState.timerValue--;
    io.to('devine-room').emit('devine:timer', devineState.timerValue);
    if (devineState.timerValue <= 0) {
      clearInterval(devineState.timer);
      devineState.timer = null;
      io.to('devine-room').emit('devine:timeUp', { word: devineState.currentWord });
      io.to('output-room').emit('devine:timeUp', { word: devineState.currentWord });
      setTimeout(() => startDevineRound(), 3000);
    }
  }, 1000);

  console.log(`Devine round ${devineState.round}: ${drawerPseudo} draws "${devineState.currentWord}"`);
}

function broadcastDevineScores() {
  const scores = Object.fromEntries(
    Array.from(devineState.scores.entries()).map(([id, score]) => {
      const p = devineState.players.get(id);
      return [id, { pseudo: p ? p.pseudo : '?', score }];
    })
  );
  io.to('devine-room').emit('devine:scores', scores);
  io.to('output-room').emit('devine:scores', scores);
}

function revealThemeDrawings() {
  themeState.status = 'revealing';
  adminState.games.theme.status = 'revealing';

  const results = Array.from(themeState.drawings.entries()).map(([socketId, data]) => ({
    pseudo: data.pseudo,
    imageData: data.imageData
  }));

  io.to('theme-room').emit('theme:reveal', { theme: themeState.currentTheme, drawings: results });
  io.to('output-room').emit('theme:reveal', { theme: themeState.currentTheme, drawings: results });
  io.to('admin-room').emit('theme:update', { status: 'revealing' });

  console.log(`Theme revealed: ${results.length} drawings for "${themeState.currentTheme}"`);
}

// Levenshtein distance (server-side for devine)
function levenshteinDistance(a, b) {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Fonction pour générer un ID de tracé permanent
function generateTraceId() {
  return 'trace_' + Date.now() + '_' + Math.round(Math.random() * 100000);
}

// Fonction pour simplifier les points - Algorithme Douglas-Peucker amélioré
function simplifyPoints(points, maxPoints = 200) {
  if (points.length <= maxPoints * 2) return points;

  // Algorithme Douglas-Peucker
  return douglasPeucker(points, 2.0);
}

// Implémentation Douglas-Peucker
function douglasPeucker(points, tolerance) {
  if (points.length <= 4) return points;

  const pointObjects = [];
  for (let i = 0; i < points.length; i += 2) {
    pointObjects.push({ x: points[i], y: points[i + 1] });
  }

  const simplified = simplifyDouglasPeucker(pointObjects, tolerance);

  const result = [];
  for (const pt of simplified) {
    result.push(pt.x, pt.y);
  }

  return result;
}

function simplifyDouglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyDouglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyDouglasPeucker(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  } else {
    return [first, last];
  }
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) +
      Math.pow(point.y - lineStart.y, 2)
    );
  }

  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  const denominator = Math.sqrt(dx * dx + dy * dy);

  return numerator / denominator;
}

// Fonction d'historique avec sauvegarde Redis
async function addToHistory(action) {
  actionHistory.push(action);

  if (actionHistory.length > MAX_HISTORY) {
    actionHistory.shift();
  }

  // Sauvegarder aussi dans Redis pour historique persistant
  await saveActionToRedisHistory(action);

  console.log(`📝 Action added to history: ${action.type} (${actionHistory.length}/${MAX_HISTORY})`);
}

const PORT = process.env.PORT || 3000;

// Démarrage du serveur avec chargement des données
http.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Undo history: ${MAX_HISTORY} actions in memory, ${MAX_HISTORY_REDIS} in Redis`);
  console.log(`🏓 Ping/Pong monitoring enabled`);
  const effectiveEnv = process.env.NODE_ENV || 'development';
  console.log(`🔒 CORS security: ${effectiveEnv === 'development' ? 'Development mode' : 'Production mode'}`);
  console.log(`📊 Max shapes: ${MAX_SHAPES}, TTL: ${SHAPE_TTL / 1000}s`);

  // Charger les shapes depuis Redis au démarrage
  if (redis) {
    console.log('📥 Loading shapes from Redis...');
    await loadShapesFromRedis();
  }

  console.log(`🎨 Picturaevox3 ready! ${Object.keys(shapes).length} shapes loaded.`);
});