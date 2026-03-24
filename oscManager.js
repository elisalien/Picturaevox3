// oscManager.js — Picturaevox 3.5 — OSC bridge to TouchDesigner & Ableton
// Sends drawing data + game events via UDP OSC
// NOTE: OSC uses UDP — only works when server runs locally (not on Railway/Render/Heroku)

let Client;
try {
  Client = require('node-osc').Client;
} catch (err) {
  // node-osc not available — OSC will be disabled
  Client = null;
}

class OSCManager {
  constructor() {
    this.enabled = false;
    this.available = !!Client;
    this.isCloud = !!(process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_ENVIRONMENT ||
                      process.env.RENDER_EXTERNAL_URL || process.env.HEROKU_APP_NAME ||
                      process.env.FLY_APP_NAME);

    if (this.isCloud) {
      console.log('[OSC] Cloud environment detected — OSC disabled (UDP not supported on PaaS)');
    }
    if (!this.available) {
      console.log('[OSC] node-osc not installed — OSC unavailable');
    }

    this.targets = {
      touchdesigner: { enabled: false, host: '127.0.0.1', port: 7000, client: null },
      ableton:       { enabled: false, host: '127.0.0.1', port: 9000, client: null }
    };

    // Throttle settings (ms)
    this.throttle = {
      drawing: 30,   // ~33fps for smooth visuals in TD
      brush: 50,
      texture: 80
    };
    this.lastSent = {};
  }

  // === CONFIG ===

  configure(config) {
    if (!config) return;

    // Block OSC on cloud platforms
    if (this.isCloud) {
      this.enabled = false;
      console.log('[OSC] Ignored config — cloud environment (UDP not available)');
      return;
    }

    if (!this.available) {
      this.enabled = false;
      console.log('[OSC] Ignored config — node-osc not installed');
      return;
    }

    if (typeof config.enabled === 'boolean') {
      this.enabled = config.enabled;
    }

    ['touchdesigner', 'ableton'].forEach(target => {
      if (config[target]) {
        const t = this.targets[target];
        if (typeof config[target].enabled === 'boolean') t.enabled = config[target].enabled;
        if (config[target].host) t.host = config[target].host;
        if (config[target].port) t.port = parseInt(config[target].port, 10);

        // Reconnect if settings changed
        this._reconnect(target);
      }
    });

    console.log(`[OSC] Config updated — enabled: ${this.enabled}`);
    this._logTargets();
  }

  getConfig() {
    return {
      enabled: this.enabled,
      available: this.available && !this.isCloud,
      isCloud: this.isCloud,
      touchdesigner: {
        enabled: this.targets.touchdesigner.enabled,
        host: this.targets.touchdesigner.host,
        port: this.targets.touchdesigner.port
      },
      ableton: {
        enabled: this.targets.ableton.enabled,
        host: this.targets.ableton.host,
        port: this.targets.ableton.port
      }
    };
  }

  // === CONNECTION ===

  _reconnect(targetName) {
    const t = this.targets[targetName];

    // Close existing
    if (t.client) {
      try { t.client.close(); } catch (e) {}
      t.client = null;
    }

    if (t.enabled && this.enabled && Client && !this.isCloud) {
      try {
        t.client = new Client(t.host, t.port);
        console.log(`[OSC] ${targetName} connected → ${t.host}:${t.port}`);
      } catch (err) {
        console.error(`[OSC] Failed to connect ${targetName}:`, err.message);
        t.client = null;
      }
    }
  }

  _logTargets() {
    Object.entries(this.targets).forEach(([name, t]) => {
      const status = t.enabled && this.enabled ? `ON → ${t.host}:${t.port}` : 'OFF';
      console.log(`[OSC]   ${name}: ${status}`);
    });
  }

  // === SEND ===

  _send(address, ...args) {
    if (!this.enabled) return;

    Object.entries(this.targets).forEach(([name, t]) => {
      if (t.enabled && t.client) {
        try {
          t.client.send(address, ...args);
        } catch (err) {
          // Silent fail for UDP — don't crash server
        }
      }
    });
  }

  _sendTo(targetName, address, ...args) {
    if (!this.enabled) return;
    const t = this.targets[targetName];
    if (t && t.enabled && t.client) {
      try {
        t.client.send(address, ...args);
      } catch (err) {}
    }
  }

  _throttled(key, interval, fn) {
    const now = Date.now();
    if (this.lastSent[key] && (now - this.lastSent[key]) < interval) return;
    this.lastSent[key] = now;
    fn();
  }

  // =============================================
  // DRAWING DATA (primarily for TouchDesigner)
  // =============================================

  // Live brush position — /picturaevox/draw/pos x y
  sendDrawPos(x, y, color, size, pressure) {
    this._throttled('drawPos', this.throttle.drawing, () => {
      // Normalize color to RGB floats
      const rgb = this._hexToRgb(color);

      // Main position message
      this._send('/picturaevox/draw/pos', x, y);

      // Brush properties
      this._send('/picturaevox/draw/brush', size, pressure || 1.0, rgb.r, rgb.g, rgb.b);

      // Combined for easy TD mapping
      this._send('/picturaevox/draw', x, y, size, rgb.r, rgb.g, rgb.b, pressure || 1.0);
    });
  }

  // Stroke start/end
  sendDrawStart(id, color, size) {
    const rgb = this._hexToRgb(color);
    this._send('/picturaevox/draw/start', 1);
    this._send('/picturaevox/draw/color', rgb.r, rgb.g, rgb.b);
    this._send('/picturaevox/draw/size', size);
  }

  sendDrawEnd(id) {
    this._send('/picturaevox/draw/start', 0);
    this._send('/picturaevox/draw/end', 1);
  }

  // Brush effects (sparkles, neon, fire, etc.)
  sendBrushEffect(type, x, y, color, size) {
    this._throttled('brushEffect', this.throttle.brush, () => {
      const rgb = this._hexToRgb(color);
      this._send('/picturaevox/effect', type, x, y, size, rgb.r, rgb.g, rgb.b);

      // Effect-specific for TD
      this._sendTo('touchdesigner', `/picturaevox/effect/${type}`, x, y, size);
    });
  }

  // Texture brush
  sendTexture(x, y, color, size) {
    this._throttled('texture', this.throttle.texture, () => {
      const rgb = this._hexToRgb(color);
      this._send('/picturaevox/texture', x, y, size, rgb.r, rgb.g, rgb.b);
    });
  }

  // Canvas clear
  sendCanvasClear() {
    this._send('/picturaevox/canvas/clear', 1);
  }

  // Player count
  sendPlayerCount(count) {
    this._send('/picturaevox/players', count);
  }

  // =============================================
  // GAME EVENTS (for both TD and Ableton)
  // =============================================

  // Generic game state change
  sendGameState(game, status) {
    this._send('/picturaevox/game/state', game, status);
    this._send(`/picturaevox/game/${game}/status`, status);

    // Ableton-friendly: send as MIDI-like triggers
    const statusMap = { stopped: 0, waiting: 1, playing: 2, revealing: 3 };
    this._sendTo('ableton', `/picturaevox/game/${game}`, statusMap[status] || 0);
  }

  // Game start — good for triggering clips/scenes
  sendGameStart(game) {
    this._send('/picturaevox/game/start', game);
    this._sendTo('ableton', '/picturaevox/trigger/start', 1);
  }

  // Game end / reveal
  sendGameReveal(game) {
    this._send('/picturaevox/game/reveal', game);
    this._sendTo('ableton', '/picturaevox/trigger/reveal', 1);
  }

  // Timer — useful for Ableton tempo sync or TD animations
  sendTimer(game, remaining, total) {
    const progress = total > 0 ? remaining / total : 0;
    this._send('/picturaevox/timer', remaining, progress);
    this._send(`/picturaevox/game/${game}/timer`, remaining, progress);
  }

  // Score update (Dessine-Devine)
  sendScore(pseudo, score) {
    this._send('/picturaevox/score', pseudo, score);
  }

  // Correct guess — trigger for Ableton sound effect
  sendCorrectGuess(pseudo, word) {
    this._send('/picturaevox/devine/correct', 1);
    this._sendTo('ableton', '/picturaevox/trigger/correct', 1);
  }

  // Theme announced
  sendTheme(theme) {
    this._send('/picturaevox/theme', theme);
  }

  // Drawing submitted
  sendDrawingSubmitted(game, pseudo) {
    this._send('/picturaevox/submitted', game, pseudo);
    this._sendTo('ableton', '/picturaevox/trigger/submit', 1);
  }

  // Player joined/left game
  sendPlayerJoined(game, pseudo, totalPlayers) {
    this._send(`/picturaevox/game/${game}/players`, totalPlayers);
    this._send('/picturaevox/player/join', pseudo);
  }

  sendPlayerLeft(game, totalPlayers) {
    this._send(`/picturaevox/game/${game}/players`, totalPlayers);
  }

  // Reset
  sendReset(game) {
    this._send('/picturaevox/game/reset', game);
    this._sendTo('ableton', '/picturaevox/trigger/reset', 1);
  }

  sendFullReset() {
    this._send('/picturaevox/reset', 1);
    this._sendTo('ableton', '/picturaevox/trigger/fullreset', 1);
  }

  // =============================================
  // UTILITIES
  // =============================================

  _hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 1.0, g: 1.0, b: 1.0 };
    hex = hex.replace('#', '');
    if (hex.length !== 6) return { r: 1.0, g: 1.0, b: 1.0 };
    return {
      r: parseInt(hex.substring(0, 2), 16) / 255,
      g: parseInt(hex.substring(2, 4), 16) / 255,
      b: parseInt(hex.substring(4, 6), 16) / 255
    };
  }

  destroy() {
    Object.values(this.targets).forEach(t => {
      if (t.client) {
        try { t.client.close(); } catch (e) {}
        t.client = null;
      }
    });
    console.log('[OSC] All connections closed');
  }
}

module.exports = OSCManager;
