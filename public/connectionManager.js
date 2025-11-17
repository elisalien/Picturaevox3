// public/connectionManager.js - Gestion robuste de la connexion avec support mobile amélioré
class ConnectionManager {
  constructor(socket) {
    this.socket = socket;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.actionQueue = [];
    this.maxQueueSize = 100;
    this.connectionTimeout = 10000; // 10s
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
    this.flushActionQueue();

    // Si on se reconnecte après une déconnexion récente sur mobile
    if (this.wasDisconnectedRecently && this.isMobile) {
      this.showMobileReconnectedNotification();
      this.wasDisconnectedRecently = false;
    }
  }

  handleDisconnect(reason) {
    console.warn('⚠️ Disconnected:', reason);
    this.isConnected = false;
    this.lastDisconnectTime = Date.now();
    this.wasDisconnectedRecently = true;
    this.updateConnectionStatus('disconnected', reason);

    // Message différent selon le type d'appareil
    if (this.isMobile) {
      this.showMobileDisconnectionAlert(reason);
    } else {
      // Afficher popup classique si déconnexion inattendue
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.showReconnectionPopup();
      }
    }
  }

  showMobileDisconnectionAlert(reason) {
    const isCritical = reason === 'io server disconnect' || reason === 'transport close';

    if (isCritical) {
      this.showReconnectionPopup(false, true);
    } else {
      // Notification légère pour les déconnexions temporaires
      this.showToastNotification('📱 Connexion perdue', 'Tentative de reconnexion...', 'warning');
    }
  }

  showMobileReconnectedNotification() {
    this.showToastNotification('✅ Reconnecté', 'Vous êtes de nouveau en ligne', 'success');
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
    console.error('❌ Connection error:', error);
    this.updateConnectionStatus('error');
  }

  handleReconnectAttempt(attempt) {
    console.log(`🔄 Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`);
    this.reconnectAttempts = attempt;
    this.updateConnectionStatus('reconnecting', `Tentative ${attempt}`);
  }

  handleReconnect() {
    console.log('✅ Reconnected successfully');
    this.updateConnectionStatus('connected');
    this.hideReconnectionPopup();
    this.flushActionQueue();
  }

  handleReconnectFailed() {
    console.error('❌ Reconnection failed after max attempts');
    this.updateConnectionStatus('failed');
    this.showReconnectionPopup(true);
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
      return this.queueAction(eventName, data) !== null;
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
`;
document.head.appendChild(connectionStyles);