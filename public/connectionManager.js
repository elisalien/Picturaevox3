// public/connectionManager.js - Gestion robuste de la connexion avec support mobile amélioré
class ConnectionManager {
  constructor(socket) {
    this.socket = socket;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.actionQueue = [];
    this.maxQueueSize = 100;
    this.connectionTimeout = 30000; // 30s (hotspot-friendly)
    this.pingInterval = null;
    this.lastPingTime = Date.now();
    this.latency = 0;
    this.isMobile = this.detectMobile();
    this.lastDisconnectTime = null;
    this.wasDisconnectedRecently = false;

    this.init();
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }

  init() {
    // Événements Socket.IO
    this.socket.on('connect', () => this.handleConnect());
    this.socket.on('disconnect', (reason) => this.handleDisconnect(reason));
    this.socket.on('connect_error', (error) => this.handleConnectionError(error));
    this.socket.on('reconnect_attempt', (attempt) => this.handleReconnectAttempt(attempt));
    this.socket.on('reconnect', () => this.handleReconnect());
    this.socket.on('reconnect_failed', () => this.handleReconnectFailed());
    
    // Ping pour mesurer latence
    this.socket.on('pong', (latency) => {
      this.latency = latency;
      this.updateLatencyDisplay();
    });
    
    // Démarrer le monitoring
    this.startPingMonitoring();
  }

  handleConnect() {
    console.log('✅ Connected to server');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.updateConnectionStatus('connected');
    this.hideDisconnectBanner();
    this.hideReconnectionPopup();
    this.flushActionQueue();

    if (this.wasDisconnectedRecently) {
      this.showToastNotification('Reconnecte', 'Vous etes de nouveau en ligne', 'success');
      this.wasDisconnectedRecently = false;
    }
  }

  handleDisconnect(reason) {
    console.warn('⚠️ Disconnected:', reason);
    this.isConnected = false;
    this.lastDisconnectTime = Date.now();
    this.wasDisconnectedRecently = true;
    this.updateConnectionStatus('disconnected', reason);

    // Always show the disconnect banner immediately
    this.showDisconnectBanner();
  }

  showMobileReconnectedNotification() {
    this.showToastNotification('Reconnecte', 'Vous etes de nouveau en ligne', 'success');
  }

  // === FULL-SCREEN DISCONNECT BANNER ===
  showDisconnectBanner() {
    this.hideDisconnectBanner();

    const banner = document.createElement('div');
    banner.id = 'disconnect-banner';
    banner.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: bannerFadeIn 0.25s ease-out;
      pointer-events: auto;
    `;

    banner.innerHTML = `
      <div style="
        background: rgba(20, 20, 30, 0.95);
        border: 2px solid #FF5252;
        border-radius: 16px;
        padding: 32px 40px;
        text-align: center;
        max-width: 360px;
        width: 85%;
        box-shadow: 0 0 40px rgba(255, 82, 82, 0.2);
      ">
        <div style="font-size: 48px; margin-bottom: 12px;">&#x26A0;&#xFE0F;</div>
        <h2 style="color: #FF5252; margin: 0 0 8px; font-size: 20px; font-weight: 700;">
          Connexion perdue
        </h2>
        <p style="color: rgba(255,255,255,0.6); margin: 0 0 6px; font-size: 14px;">
          Vos traits ne sont pas envoyes.
        </p>
        <p id="disconnect-banner-status" style="color: #FFC107; margin: 0 0 20px; font-size: 13px;">
          Reconnexion en cours...
        </p>
        <div id="disconnect-banner-spinner" style="margin: 0 auto 16px;">
          <div style="
            width: 36px; height: 36px; margin: 0 auto;
            border: 3px solid rgba(255,82,82,0.2);
            border-top: 3px solid #FF5252;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          "></div>
        </div>
        <button id="disconnect-banner-reload" style="
          padding: 10px 24px;
          background: #FF5252;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        ">Actualiser la page</button>
        <p id="disconnect-banner-queue" style="color: rgba(255,255,255,0.3); margin: 12px 0 0; font-size: 11px;"></p>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('disconnect-banner-reload').addEventListener('click', () => {
      window.location.reload();
    });

    this.updateDisconnectBannerQueue();
  }

  updateDisconnectBannerQueue() {
    const el = document.getElementById('disconnect-banner-queue');
    if (el && this.actionQueue.length > 0) {
      el.textContent = this.actionQueue.length + ' action(s) en attente';
    }
  }

  updateDisconnectBannerStatus(text) {
    const el = document.getElementById('disconnect-banner-status');
    if (el) el.textContent = text;
  }

  hideDisconnectBanner() {
    const banner = document.getElementById('disconnect-banner');
    if (banner) {
      banner.style.animation = 'bannerFadeOut 0.2s ease-in';
      setTimeout(() => banner.remove(), 200);
    }
  }

  showToastNotification(title, message, type = 'info') {
    // Supprimer les anciennes notifications
    const oldToasts = document.querySelectorAll('.connection-toast');
    oldToasts.forEach(toast => toast.remove());

    const colors = {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      info: '#2196F3'
    };

    const toast = document.createElement('div');
    toast.className = 'connection-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type]};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10001;
      font-size: 14px;
      font-weight: 500;
      animation: toastSlideIn 0.3s ease-out;
      max-width: 90%;
      text-align: center;
    `;

    toast.innerHTML = `
      <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">${title}</div>
      <div style="font-size: 13px; opacity: 0.95;">${message}</div>
    `;

    document.body.appendChild(toast);

    // Auto-hide après 3 secondes
    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  handleConnectionError(error) {
    console.error('❌ Connection error:', error?.message || error);
    console.log('🔍 Debug: transport =', this.socket.io?.engine?.transport?.name || 'none');
    console.log('🔍 Debug: server URL =', window.location.origin);
    this.updateConnectionStatus('error');
  }

  handleReconnectAttempt(attempt) {
    console.log(`🔄 Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`);
    this.reconnectAttempts = attempt;
    this.updateConnectionStatus('reconnecting', `Tentative ${attempt}`);
    this.updateDisconnectBannerStatus(`Tentative de reconnexion ${attempt}/${this.maxReconnectAttempts}...`);
  }

  handleReconnect() {
    console.log('✅ Reconnected successfully');
    this.updateConnectionStatus('connected');
    this.hideDisconnectBanner();
    this.hideReconnectionPopup();
    this.flushActionQueue();
  }

  handleReconnectFailed() {
    console.error('❌ Reconnection failed after max attempts');
    this.updateConnectionStatus('failed');
    this.updateDisconnectBannerStatus('Impossible de se reconnecter. Actualisez la page.');
    // Hide spinner on failure
    const spinner = document.getElementById('disconnect-banner-spinner');
    if (spinner) spinner.style.display = 'none';
  }

  // Queue d'actions pour réseau faible
  queueAction(eventName, data) {
    if (!this.isConnected) {
      if (this.actionQueue.length < this.maxQueueSize) {
        this.actionQueue.push({ eventName, data, timestamp: Date.now() });
        console.log(`📦 Action queued: ${eventName} (${this.actionQueue.length} in queue)`);
        return true;
      } else {
        console.warn('⚠️ Action queue full, dropping oldest action');
        this.actionQueue.shift();
        this.actionQueue.push({ eventName, data, timestamp: Date.now() });
        return false;
      }
    }
    return null; // Pas besoin de queue, connecté
  }

  flushActionQueue() {
    if (this.actionQueue.length === 0) return;
    
    console.log(`📤 Flushing ${this.actionQueue.length} queued actions`);
    const queue = [...this.actionQueue];
    this.actionQueue = [];
    
    queue.forEach(({ eventName, data }) => {
      this.socket.emit(eventName, data);
    });
  }

  // Émission avec gestion de queue automatique
  emit(eventName, data) {
    if (this.isConnected) {
      this.socket.emit(eventName, data);
      return true;
    } else {
      const result = this.queueAction(eventName, data) !== null;
      this.updateDisconnectBannerQueue();
      return result;
    }
  }

  // Monitoring de la connexion
  startPingMonitoring() {
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        const now = Date.now();
        this.socket.emit('ping', now);
        
        // Timeout detection
        if (now - this.lastPingTime > this.connectionTimeout) {
          console.warn('⚠️ Connection timeout detected');
          this.updateConnectionStatus('timeout');
        }
        this.lastPingTime = now;
      }
    }, 5000); // Ping toutes les 5s
  }

  // Interface utilisateur
  updateConnectionStatus(status, message = '') {
    const indicator = document.getElementById('connection-indicator');
    if (!indicator) return;
    
    const statusConfig = {
      connected: { color: '#4CAF50', icon: '●', text: 'Connecté' },
      disconnected: { color: '#FF9800', icon: '●', text: 'Déconnecté' },
      reconnecting: { color: '#FFC107', icon: '◐', text: 'Reconnexion...' },
      error: { color: '#F44336', icon: '●', text: 'Erreur' },
      timeout: { color: '#FF5722', icon: '●', text: 'Timeout' },
      failed: { color: '#D32F2F', icon: '✕', text: 'Échec' }
    };
    
    const config = statusConfig[status] || statusConfig.disconnected;
    
    indicator.style.color = config.color;
    indicator.innerHTML = `
      <span style="font-size: 20px; margin-right: 4px;">${config.icon}</span>
      <span style="font-size: 11px;">${config.text}${message ? ' ' + message : ''}</span>
    `;
    
    // Animation pour reconnecting
    if (status === 'reconnecting') {
      indicator.style.animation = 'pulse 1.5s ease-in-out infinite';
    } else {
      indicator.style.animation = 'none';
    }
  }

  updateLatencyDisplay() {
    const latencyDisplay = document.getElementById('latency-display');
    if (!latencyDisplay) return;
    
    const latencyColor = this.latency < 100 ? '#4CAF50' : 
                        this.latency < 300 ? '#FFC107' : '#F44336';
    
    latencyDisplay.style.color = latencyColor;
    latencyDisplay.textContent = `${this.latency}ms`;
  }

  showReconnectionPopup(isFailed = false, isMobilePopup = false) {
    // Supprimer popup existante
    this.hideReconnectionPopup();

    const popup = document.createElement('div');
    popup.id = 'reconnection-popup';

    // Style adapté pour mobile
    const mobileStyle = isMobilePopup ? `
      width: 90%;
      max-width: 400px;
      padding: 20px 24px;
    ` : `
      padding: 24px 32px;
    `;

    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: white;
      ${mobileStyle}
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      z-index: 10000;
      text-align: center;
      border: 2px solid ${isFailed ? '#F44336' : '#FFC107'};
      backdrop-filter: blur(10px);
      animation: popupAppear 0.3s ease-out;
    `;

    const mobileText = isMobilePopup ? `
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #FFC107;">
        📱 Vérifiez votre connexion internet
      </p>
    ` : '';

    popup.innerHTML = `
      <div style="font-size: ${isMobilePopup ? '40px' : '48px'}; margin-bottom: 16px;">
        ${isFailed ? '⚠️' : '🔌'}
      </div>
      <h2 style="margin: 0 0 12px 0; font-size: ${isMobilePopup ? '18px' : '20px'};">
        ${isFailed ? 'Connexion perdue' : 'Reconnexion en cours...'}
      </h2>
      ${mobileText}
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #ccc;">
        ${isFailed
          ? 'Impossible de se reconnecter au serveur.'
          : 'Tentative de reconnexion automatique...'}
      </p>
      ${isFailed ? `
        <button id="reload-btn" style="
          padding: 12px 24px;
          background: #6b5bff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          width: ${isMobilePopup ? '100%' : 'auto'};
        ">
          Actualiser la page
        </button>
      ` : `
        <div style="margin-top: 16px;">
          <div style="
            width: 40px;
            height: 40px;
            margin: 0 auto;
            border: 4px solid rgba(107, 91, 255, 0.3);
            border-top: 4px solid #6b5bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
        </div>
        <button id="reload-btn" style="
          margin-top: 20px;
          padding: 12px 24px;
          background: #6b5bff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          width: ${isMobilePopup ? '100%' : 'auto'};
        ">
          Actualiser la page
        </button>
      `}
      ${this.actionQueue.length > 0 ? `
        <p style="margin: 16px 0 0 0; font-size: 12px; color: #FFC107;">
          📦 ${this.actionQueue.length} action(s) en attente
        </p>
      ` : ''}
    `;

    document.body.appendChild(popup);

    // Attacher l'événement au bouton de rafraîchissement (présent dans les deux cas maintenant)
    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => window.location.reload());

      if (!isMobilePopup) {
        reloadBtn.addEventListener('mouseenter', function() {
          this.style.background = '#8575ff';
          this.style.transform = 'scale(1.05)';
        });
        reloadBtn.addEventListener('mouseleave', function() {
          this.style.background = '#6b5bff';
          this.style.transform = 'scale(1)';
        });
      }
    }
  }

  hideReconnectionPopup() {
    const popup = document.getElementById('reconnection-popup');
    if (popup) {
      popup.style.animation = 'popupDisappear 0.2s ease-in';
      setTimeout(() => popup.remove(), 200);
    }
  }

  destroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }
}

// Styles CSS pour animations
const connectionStyles = document.createElement('style');
connectionStyles.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes popupAppear {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
    100% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes popupDisappear {
    0% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
  }

  @keyframes toastSlideIn {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    100% {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes toastSlideOut {
    0% {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
  }

  .connection-toast {
    pointer-events: auto;
    touch-action: none;
  }

  @keyframes bannerFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes bannerFadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(connectionStyles);