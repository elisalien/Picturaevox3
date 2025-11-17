// public/brushManager.js - Système repensé avec effets magiques et fade-out progressif
class BrushManager {
  constructor(layer, socket = null) {
    this.layer = layer;
    this.socket = socket;
    this.activeEffects = new Map();
    this.activeStrokes = new Map(); // Track active drawing strokes
    this.lastEmit = 0;
    this.throttleTime = 150; // Optimisé pour mobile
    this.particlePool = new Map(); // Pool de particules réutilisables

    // État du dessin (pour fade-out)
    this.isDrawing = false;
    this.currentStrokeId = null;

    // Nettoyage automatique optimisé
    this.cleanupInterval = setInterval(() => this.cleanup(), 20000);

    console.log('✨ Magic BrushManager initialized with smooth fade-out system');
  }

  // Démarre un nouveau trait (appelé au début du dessin)
  startStroke(type) {
    this.isDrawing = true;
    this.currentStrokeId = `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.activeStrokes.set(this.currentStrokeId, {
      type,
      startTime: Date.now(),
      effects: []
    });
    return this.currentStrokeId;
  }

  // Termine un trait (appelé à la fin du dessin)
  endStroke(strokeId = null) {
    const id = strokeId || this.currentStrokeId;
    this.isDrawing = false;

    if (id && this.activeStrokes.has(id)) {
      const stroke = this.activeStrokes.get(id);
      // Marquer tous les effets pour fade-out
      stroke.effects.forEach(effectId => {
        const effect = this.activeEffects.get(effectId);
        if (effect) {
          effect.fadeOut = true;
          effect.fadeStartTime = Date.now();
        }
      });
      // Cleanup stroke après fade complete
      setTimeout(() => this.activeStrokes.delete(id), 3000);
    }

    if (id === this.currentStrokeId) {
      this.currentStrokeId = null;
    }
  }

  // Méthode publique pour créer et émettre un effet
  createAndEmitEffect(type, x, y, color, size) {
    const now = Date.now();
    if (now - this.lastEmit < this.throttleTime) return;

    // Démarrer un stroke si pas encore fait
    if (!this.isDrawing) {
      this.startStroke(type);
    }

    // 1. Créer les tracés permanents localement
    const permanentTraces = this.createPermanentTraceData(type, x, y, color, size);
    this.renderPermanentTraces(permanentTraces);

    // 2. Créer l'effet temporaire localement
    this.createLocalEffect(type, x, y, color, size);

    // 3. Émettre via socket si disponible (avec tracés permanents)
    if (this.socket) {
      this.socket.emit('brushEffect', {
        type, x, y, color, size,
        timestamp: now,
        permanentTraces: permanentTraces
      });
    }

    this.lastEmit = now;
  }

  // Méthode pour recevoir les effets réseau
  createNetworkEffect(data) {
    // 1. Si des tracés permanents sont inclus, les créer
    if (data.permanentTraces && data.permanentTraces.length > 0) {
      this.renderPermanentTraces(data.permanentTraces);
    }
    
    // 2. Créer l'effet temporaire animé
    this.createLocalEffect(data.type, data.x, data.y, data.color, data.size);
  }

  // Création d'effet local unifié avec système de fade-out
  createLocalEffect(type, x, y, color, size) {
    const effectId = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Ajouter l'effet au stroke actif
    if (this.currentStrokeId && this.activeStrokes.has(this.currentStrokeId)) {
      this.activeStrokes.get(this.currentStrokeId).effects.push(effectId);
    }

    // Créer l'effet temporaire animé avec nouveaux effets magiques
    switch(type) {
      case 'sparkles':
        this.createMagicSparkles(x, y, color, size, effectId);
        break;
      case 'neon':
        this.createCosmicGlow(x, y, color, size, effectId);
        break;
      case 'watercolor':
        this.createWaterRipples(x, y, color, size, effectId);
        break;
      case 'electric':
        this.createLightningFlow(x, y, color, size, effectId);
        break;
      case 'fire':
        this.createMysticFlames(x, y, color, size, effectId);
        break;
      case 'petals':
        this.createFloatingPetals(x, y, color, size, effectId);
        break;
    }
  }

  // === NOUVEAU : CRÉATION DES DONNÉES DE TRACÉS PERMANENTS ===
  
  createPermanentTraceData(type, x, y, color, size) {
    const traces = [];
    
    switch(type) {
      case 'sparkles':
        traces.push(...this.generateSparklesTraceData(x, y, color, size));
        break;
      case 'neon':
        traces.push(...this.generateNeonTraceData(x, y, color, size));
        break;
      case 'watercolor':
        traces.push(...this.generateWatercolorTraceData(x, y, color, size));
        break;
      case 'electric':
        traces.push(...this.generateElectricTraceData(x, y, color, size));
        break;
      case 'fire':
        traces.push(...this.generateFireTraceData(x, y, color, size));
        break;
      case 'petals':
        traces.push(...this.generatePetalsTraceData(x, y, color, size));
        break;
    }
    
    return traces;
  }

  // Rendu des tracés permanents à partir des données
  renderPermanentTraces(tracesData) {
    tracesData.forEach(traceData => {
      let element;
      
      switch(traceData.shapeType) {
        case 'Star':
          element = new Konva.Star(traceData.attrs);
          break;
        case 'Circle':
          element = new Konva.Circle(traceData.attrs);
          break;
        case 'Line':
          element = new Konva.Line(traceData.attrs);
          break;
        case 'Ellipse':
          element = new Konva.Ellipse(traceData.attrs);
          break;
      }
      
      if (element) {
        element.isPermanentTrace = true;
        this.layer.add(element);
      }
    });
    
    this.layer.batchDraw();
  }

  // === GÉNÉRATION DES DONNÉES DE TRACÉS (pour sauvegarde serveur) ===
  
  generateSparklesTraceData(x, y, color, size) {
    const traces = [];
    const particleCount = 1; // Réduit pour optimisation mobile

    for (let i = 0; i < particleCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 1.2;
      const offsetY = (Math.random() - 0.5) * size * 1.2;
      const starSize = 1.5 + Math.random() * 1.5;

      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Star',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          numPoints: 4,
          innerRadius: starSize * 0.35,
          outerRadius: starSize,
          fill: color,
          opacity: 0.25 + Math.random() * 0.15,
          rotation: Math.random() * 360
        }
      });
    }

    return traces;
  }

  generateNeonTraceData(x, y, color, size) {
    const traces = [];
    const dotCount = 2; // Réduit pour optimisation mobile

    for (let i = 0; i < dotCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 0.8;
      const offsetY = (Math.random() - 0.5) * size * 0.8;
      const dotSize = 1 + Math.random() * 1.2;

      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Circle',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          radius: dotSize,
          fill: color,
          opacity: 0.35 + Math.random() * 0.25,
          shadowColor: color,
          shadowBlur: 2,
          shadowOpacity: 0.25
        }
      });
    }

    return traces;
  }

  generateWatercolorTraceData(x, y, color, size) {
    const traces = [];
    const blobCount = 1; // Réduit pour optimisation mobile

    for (let i = 0; i < blobCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 0.6;
      const offsetY = (Math.random() - 0.5) * size * 0.6;
      const blobSize = size * (0.4 + Math.random() * 0.3);

      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Circle',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          radius: blobSize,
          fill: color,
          opacity: 0.12 + Math.random() * 0.12,
          scaleX: 0.7 + Math.random() * 0.6,
          scaleY: 0.5 + Math.random() * 0.5
        }
      });
    }

    return traces;
  }

  generateElectricTraceData(x, y, color, size) {
    const traces = [];
    const lineCount = 1;

    for (let i = 0; i < lineCount; i++) {
      const points = [];
      const segments = 2; // Réduit pour optimisation mobile
      let currentX = x;
      let currentY = y;

      points.push(currentX, currentY);

      for (let j = 0; j < segments; j++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = size * (0.4 + Math.random() * 0.3);
        currentX += Math.cos(angle) * distance;
        currentY += Math.sin(angle) * distance;
        points.push(currentX, currentY);
      }

      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Line',
        attrs: {
          points: points,
          stroke: color,
          strokeWidth: 0.6 + Math.random() * 0.5,
          opacity: 0.2 + Math.random() * 0.15,
          lineCap: 'round',
          lineJoin: 'round'
        }
      });
    }

    return traces;
  }

  generateFireTraceData(x, y, color, size) {
    const traces = [];
    const flameCount = 1; // Réduit pour optimisation mobile

    for (let i = 0; i < flameCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 0.5;
      const offsetY = (Math.random() - 0.5) * size * 0.3;
      const flameSize = size * (0.25 + Math.random() * 0.25);

      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Ellipse',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          radiusX: flameSize * 0.65,
          radiusY: flameSize,
          fill: color,
          opacity: 0.18 + Math.random() * 0.12,
          rotation: Math.random() * 40 - 20
        }
      });
    }

    return traces;
  }

  generatePetalsTraceData(x, y, color, size) {
    const traces = [];
    const petalCount = 1; // Réduit pour optimisation mobile

    for (let i = 0; i < petalCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 0.8;
      const offsetY = (Math.random() - 0.5) * size * 0.8;
      const petalSize = size * (0.3 + Math.random() * 0.25);

      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Ellipse',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          radiusX: petalSize,
          radiusY: petalSize * 0.55,
          fill: color,
          opacity: 0.18 + Math.random() * 0.15,
          rotation: Math.random() * 360,
          scaleX: 0.7 + Math.random() * 0.5,
          scaleY: 0.5 + Math.random() * 0.6
        }
      });
    }

    return traces;
  }

  generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  createPermanentTrace(type, x, y, color, size) {
    const traceElements = [];
    
    switch(type) {
      case 'sparkles':
        traceElements.push(...this.createSparklesTrace(x, y, color, size));
        break;
      case 'neon':
        traceElements.push(...this.createNeonTrace(x, y, color, size));
        break;
      case 'watercolor':
        traceElements.push(...this.createWatercolorTrace(x, y, color, size));
        break;
      case 'electric':
        traceElements.push(...this.createElectricTrace(x, y, color, size));
        break;
      case 'fire':
        traceElements.push(...this.createFireTrace(x, y, color, size));
        break;
      case 'petals':
        traceElements.push(...this.createPetalsTrace(x, y, color, size));
        break;
    }
    
    // Ajouter tous les éléments permanents à la layer
    traceElements.forEach(element => {
      this.layer.add(element);
    });
  }

  // Tracé permanent pour Sparkles - Petites étoiles subtiles
  createSparklesTrace(x, y, color, size) {
    const traces = [];
    const particleCount = 2;
    
    for (let i = 0; i < particleCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 1.5;
      const offsetY = (Math.random() - 0.5) * size * 1.5;
      const starSize = 1 + Math.random() * 2;
      
      const trace = new Konva.Star({
        x: x + offsetX,
        y: y + offsetY,
        numPoints: 4,
        innerRadius: starSize * 0.3,
        outerRadius: starSize,
        fill: color,
        opacity: 0.3 + Math.random() * 0.2,
        rotation: Math.random() * 360,
        isPermanentTrace: true
      });
      
      traces.push(trace);
    }
    
    return traces;
  }

  // Tracé permanent pour Neon - Dots lumineux
  createNeonTrace(x, y, color, size) {
    const traces = [];
    const dotCount = 3;
    
    for (let i = 0; i < dotCount; i++) {
      const offsetX = (Math.random() - 0.5) * size;
      const offsetY = (Math.random() - 0.5) * size;
      const dotSize = 0.8 + Math.random() * 1.5;
      
      const trace = new Konva.Circle({
        x: x + offsetX,
        y: y + offsetY,
        radius: dotSize,
        fill: color,
        opacity: 0.4 + Math.random() * 0.3,
        shadowColor: color,
        shadowBlur: 3,
        shadowOpacity: 0.3,
        isPermanentTrace: true
      });
      
      traces.push(trace);
    }
    
    return traces;
  }

  // Tracé permanent pour Watercolor - Taches légères
  createWatercolorTrace(x, y, color, size) {
    const traces = [];
    const blobCount = 2;
    
    for (let i = 0; i < blobCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 0.8;
      const offsetY = (Math.random() - 0.5) * size * 0.8;
      const blobSize = size * (0.3 + Math.random() * 0.4);
      
      const trace = new Konva.Circle({
        x: x + offsetX,
        y: y + offsetY,
        radius: blobSize,
        fill: color,
        opacity: 0.15 + Math.random() * 0.15,
        scaleX: 0.6 + Math.random() * 0.8,
        scaleY: 0.4 + Math.random() * 0.6,
        isPermanentTrace: true
      });
      
      traces.push(trace);
    }
    
    return traces;
  }

  // Tracé permanent pour Electric - Lignes zigzag subtiles
  createElectricTrace(x, y, color, size) {
    const traces = [];
    const lineCount = 1;
    
    for (let i = 0; i < lineCount; i++) {
      const points = [];
      const segments = 3;
      let currentX = x;
      let currentY = y;
      
      points.push(currentX, currentY);
      
      for (let j = 0; j < segments; j++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = size * (0.3 + Math.random() * 0.4);
        currentX += Math.cos(angle) * distance;
        currentY += Math.sin(angle) * distance;
        points.push(currentX, currentY);
      }
      
      const trace = new Konva.Line({
        points: points,
        stroke: color,
        strokeWidth: 0.8 + Math.random() * 0.7,
        opacity: 0.25 + Math.random() * 0.2,
        lineCap: 'round',
        lineJoin: 'round',
        isPermanentTrace: true
      });
      
      traces.push(trace);
    }
    
    return traces;
  }

  // Tracé permanent pour Fire - Formes flame subtiles
  createFireTrace(x, y, color, size) {
    const traces = [];
    const flameCount = 2;
    
    for (let i = 0; i < flameCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 0.6;
      const offsetY = (Math.random() - 0.5) * size * 0.4;
      const flameSize = size * (0.2 + Math.random() * 0.3);
      
      const trace = new Konva.Ellipse({
        x: x + offsetX,
        y: y + offsetY,
        radiusX: flameSize * 0.6,
        radiusY: flameSize,
        fill: color,
        opacity: 0.2 + Math.random() * 0.15,
        rotation: Math.random() * 45 - 22.5,
        isPermanentTrace: true
      });
      
      traces.push(trace);
    }
    
    return traces;
  }

  // Tracé permanent pour Petals - Pétales légers
  createPetalsTrace(x, y, color, size) {
    const traces = [];
    const petalCount = 2;
    
    for (let i = 0; i < petalCount; i++) {
      const offsetX = (Math.random() - 0.5) * size;
      const offsetY = (Math.random() - 0.5) * size;
      const petalSize = size * (0.25 + Math.random() * 0.3);
      
      const trace = new Konva.Ellipse({
        x: x + offsetX,
        y: y + offsetY,
        radiusX: petalSize,
        radiusY: petalSize * 0.5,
        fill: color,
        opacity: 0.2 + Math.random() * 0.2,
        rotation: Math.random() * 360,
        scaleX: 0.6 + Math.random() * 0.6,
        scaleY: 0.4 + Math.random() * 0.8,
        isPermanentTrace: true
      });
      
      traces.push(trace);
    }
    
    return traces;
  }

  // === NOUVEAUX EFFETS TEMPORAIRES MAGIQUES ===

  // ✨ Magic Sparkles - Étoiles scintillantes avec turbulence
  createMagicSparkles(x, y, color, size, effectId) {
    const elements = [];
    const particles = 3; // Réduit pour optimisation
    const duration = 2000; // Plus long pour fade-out progressif

    for (let i = 0; i < particles; i++) {
      const angle = (Math.PI * 2 * i) / particles + Math.random() * 0.5;
      const distance = size * (0.8 + Math.random() * 1.5);
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      const sparkleSize = 3 + Math.random() * 5;

      const sparkle = new Konva.Star({
        x: x + offsetX,
        y: y + offsetY,
        numPoints: 5,
        innerRadius: sparkleSize * 0.4,
        outerRadius: sparkleSize,
        fill: color,
        rotation: Math.random() * 360,
        opacity: 0.95,
        shadowColor: color,
        shadowBlur: 8,
        shadowOpacity: 0.6,
        effectId,
        isTemporaryEffect: true
      });

      this.layer.add(sparkle);
      elements.push(sparkle);

      this.animateMagicSparkle(sparkle, duration, i, effectId);
    }

    this.trackEffect(effectId, elements, duration);
  }

  // 🌌 Cosmic Glow - Lueur cosmique pulsante
  createCosmicGlow(x, y, color, size, effectId) {
    const elements = [];
    const particles = 3;
    const duration = 2200;

    for (let i = 0; i < particles; i++) {
      const angle = (Math.PI * 2 * i) / particles;
      const distance = size * (0.5 + Math.random() * 1.2);
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      const particleSize = 4 + Math.random() * 6;

      const particle = new Konva.Circle({
        x: x + offsetX,
        y: y + offsetY,
        radius: particleSize,
        fill: color,
        opacity: 0.85,
        shadowColor: color,
        shadowBlur: 20,
        shadowOpacity: 0.9,
        effectId,
        isTemporaryEffect: true
      });

      this.layer.add(particle);
      elements.push(particle);

      this.animateCosmicGlow(particle, duration, i, effectId);
    }

    this.trackEffect(effectId, elements, duration);
  }

  // 💧 Water Ripples - Ondulations d'eau avec displacement
  createWaterRipples(x, y, color, size, effectId) {
    const elements = [];
    const ripples = 4;
    const duration = 2500;

    for (let i = 0; i < ripples; i++) {
      const delay = i * 150; // Ondulations en cascade
      const rippleSize = size * (0.3 + Math.random() * 0.4);

      const ripple = new Konva.Circle({
        x: x,
        y: y,
        radius: rippleSize,
        stroke: color,
        strokeWidth: 2,
        opacity: 0.7,
        effectId,
        isTemporaryEffect: true,
        delay: delay
      });

      this.layer.add(ripple);
      elements.push(ripple);

      setTimeout(() => {
        this.animateWaterRipple(ripple, duration, i, effectId);
      }, delay);
    }

    this.trackEffect(effectId, elements, duration + ripples * 150);
  }

  // ⚡ Lightning Flow - Flux électrique fluide
  createLightningFlow(x, y, color, size, effectId) {
    const elements = [];
    const bolts = 2;
    const duration = 1800;

    for (let i = 0; i < bolts; i++) {
      const points = this.generateFluidElectricPath(x, y, size, 5);

      const bolt = new Konva.Line({
        points,
        stroke: color,
        strokeWidth: 1.5 + Math.random() * 2.5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        shadowColor: color,
        shadowBlur: 18,
        shadowOpacity: 0.9,
        effectId,
        originalPoints: [...points],
        animationOffset: Math.random() * Math.PI * 2,
        isTemporaryEffect: true
      });

      this.layer.add(bolt);
      elements.push(bolt);

      this.animateLightningFlow(bolt, duration, i, effectId);
    }

    this.trackEffect(effectId, elements, duration);
  }

  // 🔥 Mystic Flames - Flammes mystiques dansantes
  createMysticFlames(x, y, color, size, effectId) {
    const elements = [];
    const flames = 3;
    const duration = 2000;

    for (let i = 0; i < flames; i++) {
      const angle = (Math.PI * 2 * i) / flames + Math.random() * 0.3;
      const distance = size * (0.3 + Math.random() * 0.8);
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;

      const flame = new Konva.Ellipse({
        x: x + offsetX,
        y: y + offsetY,
        radiusX: 6 + Math.random() * 7,
        radiusY: 12 + Math.random() * 10,
        fill: color,
        opacity: 0.75,
        shadowColor: color,
        shadowBlur: 20,
        shadowOpacity: 0.8,
        effectId,
        isTemporaryEffect: true
      });

      this.layer.add(flame);
      elements.push(flame);

      this.animateMysticFlame(flame, duration, i, effectId);
    }

    this.trackEffect(effectId, elements, duration);
  }

  // 🌸 Floating Petals - Pétales flottants avec turbulence
  createFloatingPetals(x, y, color, size, effectId) {
    const elements = [];
    const count = 4;
    const duration = 3000; // Plus long pour un effet gracieux

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const distance = size * (0.5 + Math.random() * 1.5);
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      const petalSize = size * (0.6 + Math.random() * 0.7);

      const petal = new Konva.Ellipse({
        x: x + offsetX,
        y: y + offsetY,
        radiusX: petalSize,
        radiusY: petalSize * 0.55,
        fill: color,
        opacity: 0.8,
        rotation: Math.random() * 360,
        shadowColor: color,
        shadowBlur: 6,
        shadowOpacity: 0.4,
        effectId,
        isTemporaryEffect: true,
        // Propriétés pour l'animation
        initialAngle: angle,
        spiralRadius: distance
      });

      this.layer.add(petal);
      elements.push(petal);

      this.animateFloatingPetal(petal, duration, i, x, y, effectId);
    }

    this.trackEffect(effectId, elements, duration);
  }

  // === NOUVELLES ANIMATIONS AVEC FADE-OUT PROGRESSIF ===

  // Animation Magic Sparkle avec fade-out
  animateMagicSparkle(sparkle, duration, index, effectId) {
    const animation = new Konva.Animation((frame) => {
      const effect = this.activeEffects.get(effectId);
      if (!effect) {
        sparkle.destroy();
        animation.stop();
        return;
      }

      const progress = frame.time / duration;

      // Système de fade-out progressif
      let baseOpacity = 0.95;
      if (effect.fadeOut) {
        const fadeProgress = (Date.now() - effect.fadeStartTime) / 1500; // 1.5s fade
        baseOpacity *= Math.max(0, 1 - fadeProgress);
      }

      // Animation de scintillement avec turbulence
      const twinkle = 0.85 + Math.sin(frame.time * 0.008 + index * 1.2) * 0.15;
      const scale = 0.8 + Math.sin(frame.time * 0.006 + index * 0.8) * 0.4;
      const rotation = sparkle.rotation() + 2.5;

      // Mouvement de turbulence léger
      const turbX = Math.sin(frame.time * 0.004 + index) * 2;
      const turbY = Math.cos(frame.time * 0.005 + index) * 2;

      const opacity = baseOpacity * twinkle * (1 - progress * 0.3);

      sparkle
        .scaleX(scale)
        .scaleY(scale)
        .rotation(rotation)
        .opacity(opacity)
        .x(sparkle.x() + turbX * 0.1)
        .y(sparkle.y() + turbY * 0.1);

      if (opacity <= 0.05 || progress >= 1) {
        sparkle.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  // Animation Cosmic Glow avec fade-out
  animateCosmicGlow(particle, duration, index, effectId) {
    const initialX = particle.x();
    const initialY = particle.y();

    const animation = new Konva.Animation((frame) => {
      const effect = this.activeEffects.get(effectId);
      if (!effect) {
        particle.destroy();
        animation.stop();
        return;
      }

      const progress = frame.time / duration;

      // Système de fade-out progressif
      let baseOpacity = 0.85;
      if (effect.fadeOut) {
        const fadeProgress = (Date.now() - effect.fadeStartTime) / 1800;
        baseOpacity *= Math.max(0, 1 - fadeProgress);
      }

      // Pulsation cosmique
      const glow = 15 + Math.sin(frame.time * 0.01 + index * 0.9) * 12;
      const pulse = 1 + Math.sin(frame.time * 0.007 + index * 0.7) * 0.6;

      // Mouvement orbital léger
      const orbit = frame.time * 0.0003;
      const orbitRadius = 3;
      const orbitX = Math.cos(orbit + index * 2) * orbitRadius;
      const orbitY = Math.sin(orbit + index * 2) * orbitRadius;

      const opacity = baseOpacity * (1 - progress * 0.2);

      particle
        .shadowBlur(glow)
        .opacity(opacity)
        .scaleX(pulse)
        .scaleY(pulse)
        .x(initialX + orbitX)
        .y(initialY + orbitY);

      if (opacity <= 0.05 || progress >= 1) {
        particle.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  // Animation Water Ripple avec fade-out
  animateWaterRipple(ripple, duration, index, effectId) {
    const initialRadius = ripple.radius();

    const animation = new Konva.Animation((frame) => {
      const effect = this.activeEffects.get(effectId);
      if (!effect) {
        ripple.destroy();
        animation.stop();
        return;
      }

      const progress = frame.time / duration;

      // Système de fade-out progressif
      let baseOpacity = 0.7;
      if (effect.fadeOut) {
        const fadeProgress = (Date.now() - effect.fadeStartTime) / 2000;
        baseOpacity *= Math.max(0, 1 - fadeProgress);
      }

      // Expansion fluide des ondulations
      const expansion = 1 + progress * 4.5;
      const waveOpacity = baseOpacity * (1 - progress);

      // Variation de l'épaisseur du trait
      const strokeWidth = 2 - progress * 1.5;

      ripple
        .radius(initialRadius * expansion)
        .opacity(waveOpacity)
        .strokeWidth(Math.max(0.5, strokeWidth));

      if (waveOpacity <= 0.05 || progress >= 1) {
        ripple.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  // Animation Lightning Flow avec fade-out
  animateLightningFlow(bolt, duration, index, effectId) {
    const originalPoints = bolt.originalPoints;
    const animationOffset = bolt.animationOffset;

    const animation = new Konva.Animation((frame) => {
      const effect = this.activeEffects.get(effectId);
      if (!effect) {
        bolt.destroy();
        animation.stop();
        return;
      }

      const progress = frame.time / duration;

      // Système de fade-out progressif
      let baseOpacity = 0.85;
      if (effect.fadeOut) {
        const fadeProgress = (Date.now() - effect.fadeStartTime) / 1600;
        baseOpacity *= Math.max(0, 1 - fadeProgress);
      }

      // Scintillement électrique fluide
      const flicker = 0.6 + Math.sin(frame.time * 0.05 + index * 1.8) * 0.4;
      const glow = 12 + Math.sin(frame.time * 0.035 + index * 1.2) * 10;

      // Déformation fluide du tracé électrique
      const deformedPoints = [];
      for (let i = 0; i < originalPoints.length; i += 2) {
        const x = originalPoints[i];
        const y = originalPoints[i + 1];
        const deformX = Math.sin(frame.time * 0.008 + animationOffset + i * 0.15) * 4;
        const deformY = Math.cos(frame.time * 0.01 + animationOffset + i * 0.15) * 3;
        deformedPoints.push(x + deformX, y + deformY);
      }

      const opacity = baseOpacity * flicker * (1 - progress * 0.25);

      bolt
        .points(deformedPoints)
        .opacity(opacity)
        .shadowBlur(glow);

      if (opacity <= 0.05 || progress >= 1) {
        bolt.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  // Animation Mystic Flame avec fade-out
  animateMysticFlame(flame, duration, index, effectId) {
    const initialY = flame.y();
    const initialX = flame.x();

    const animation = new Konva.Animation((frame) => {
      const effect = this.activeEffects.get(effectId);
      if (!effect) {
        flame.destroy();
        animation.stop();
        return;
      }

      const progress = frame.time / duration;

      // Système de fade-out progressif
      let baseOpacity = 0.75;
      if (effect.fadeOut) {
        const fadeProgress = (Date.now() - effect.fadeStartTime) / 1700;
        baseOpacity *= Math.max(0, 1 - fadeProgress);
      }

      // Danse des flammes
      const flicker = 0.85 + Math.sin(frame.time * 0.018 + index * 0.9) * 0.25;
      const dance = 0.9 + Math.sin(frame.time * 0.015 + index * 0.6) * 0.3;

      // Montée et balancement
      const rise = initialY - (frame.time * 0.025);
      const sway = Math.sin(frame.time * 0.012 + index * 1.2) * 4;

      const opacity = baseOpacity * (1 - progress * 0.35);

      flame
        .scaleX(flicker * dance)
        .scaleY(flicker * dance * 1.3)
        .y(rise)
        .x(initialX + sway)
        .opacity(opacity);

      if (opacity <= 0.05 || progress >= 1) {
        flame.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  // Animation Floating Petal avec fade-out et turbulence
  animateFloatingPetal(petal, duration, index, centerX, centerY, effectId) {
    const initialAngle = petal.initialAngle;
    const spiralRadius = petal.spiralRadius;

    const animation = new Konva.Animation((frame) => {
      const effect = this.activeEffects.get(effectId);
      if (!effect) {
        petal.destroy();
        animation.stop();
        return;
      }

      const progress = frame.time / duration;

      // Système de fade-out progressif
      let baseOpacity = 0.8;
      if (effect.fadeOut) {
        const fadeProgress = (Date.now() - effect.fadeStartTime) / 2200;
        baseOpacity *= Math.max(0, 1 - fadeProgress);
      }

      // Mouvement en spirale avec turbulence
      const spiral = initialAngle + (frame.time * 0.0008);
      const radiusExpand = spiralRadius * (1 + progress * 1.5);

      // Turbulence pour mouvement organique
      const turbX = Math.sin(frame.time * 0.005 + index * 1.5) * 8;
      const turbY = Math.cos(frame.time * 0.004 + index * 1.3) * 6;

      // Nouvelle position
      const newX = centerX + Math.cos(spiral) * radiusExpand + turbX;
      const newY = centerY + Math.sin(spiral) * radiusExpand + turbY;

      // Rotation et flutter (battement)
      const rotation = frame.time * 0.15;
      const flutter = 0.75 + Math.sin(frame.time * 0.01 + index * 0.8) * 0.35;

      const opacity = baseOpacity * (1 - progress * 0.3);

      petal
        .x(newX)
        .y(newY)
        .rotation(rotation)
        .scaleX(flutter)
        .scaleY(flutter * 0.65)
        .opacity(opacity);

      if (opacity <= 0.05 || progress >= 1) {
        petal.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  // === UTILITAIRES OPTIMISÉS ===

  // Génération de chemin électrique fluide
  generateFluidElectricPath(startX, startY, size, segments) {
    const points = [startX, startY];
    let currentX = startX, currentY = startY;

    for (let i = 0; i < segments; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = (Math.random() * size * 1.5) + (size * 0.5);
      const nextX = currentX + Math.cos(angle) * distance;
      const nextY = currentY + Math.sin(angle) * distance;

      // Points de contrôle pour une courbe plus fluide
      const midX = (currentX + nextX) / 2 + (Math.random() - 0.5) * size * 0.4;
      const midY = (currentY + nextY) / 2 + (Math.random() - 0.5) * size * 0.4;

      points.push(midX, midY, nextX, nextY);
      currentX = nextX;
      currentY = nextY;
    }

    return points;
  }

  // Ancienne fonction pour compatibilité
  generateElectricPath(startX, startY, size, segments) {
    return this.generateFluidElectricPath(startX, startY, size, segments);
  }

  trackEffect(effectId, elements, duration) {
    this.activeEffects.set(effectId, {
      elements,
      timestamp: Date.now(),
      duration,
      fadeOut: false, // Initialement pas de fade-out
      fadeStartTime: null
    });

    // Cleanup automatique après durée + temps de fade
    setTimeout(() => this.removeEffect(effectId), duration + 3000);
    this.layer.batchDraw();
  }

  removeEffect(effectId) {
    const effect = this.activeEffects.get(effectId);
    if (effect) {
      effect.elements.forEach(el => { 
        // ✅ CORRECTION : Konva utilise isDestroyed comme propriété, pas méthode
        if (el && !el.isDestroyed) {
          el.destroy();
        }
      });
      this.activeEffects.delete(effectId);
    }
  }

  cleanup() {
    const now = Date.now();
    const expired = [];
    
    this.activeEffects.forEach((effect, effectId) => {
      if (now - effect.timestamp > effect.duration + 5000) {
        expired.push(effectId);
      }
    });
    
    expired.forEach(id => this.removeEffect(id));
    
    if (expired.length > 0) {
      console.log(`🧹 BrushManager cleanup: removed ${expired.length} expired effects`);
      this.layer.batchDraw();
    }
  }

  // Nettoyage complet des effets (garde les tracés permanents)
  clearAllEffects() {
    // Ne supprimer que les effets temporaires
    this.activeEffects.forEach((effect, effectId) => {
      this.removeEffect(effectId);
    });
    this.activeEffects.clear();
    
    // ✅ CORRECTION : Konva getChildren() retourne directement un array-like
    const allChildren = this.layer.getChildren();
    const childrenToRemove = [];
    
    // Collecter les enfants à supprimer
    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i];
      if (child.isTemporaryEffect) {
        childrenToRemove.push(child);
      }
    }
    
    // Supprimer les enfants collectés
    childrenToRemove.forEach(child => {
      if (child && !child.isDestroyed) {
        child.destroy();
      }
    });
    
    this.layer.batchDraw();
    console.log(`🧹 BrushManager: All temporary effects cleared, permanent traces kept (${childrenToRemove.length} effects removed)`);
  }

  // Suppression complète incluant les tracés (pour clear canvas)
  clearEverything() {
    console.log('🧹 BrushManager: clearEverything() called');
    
    // Clear les effets temporaires d'abord
    this.clearAllEffects();
    
    // ✅ CORRECTION : Konva getChildren() retourne directement un array-like
    const allChildren = this.layer.getChildren();
    const permanentTraces = [];
    const temporaryEffects = [];
    
    // Collecter les enfants par type
    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i];
      if (child.isPermanentTrace) {
        permanentTraces.push(child);
      } else if (child.isTemporaryEffect) {
        temporaryEffects.push(child);
      }
    }
    
    console.log(`🧹 BrushManager: Found ${permanentTraces.length} permanent traces and ${temporaryEffects.length} temporary effects to clear`);
    
    // Supprimer tous les éléments collectés
    [...permanentTraces, ...temporaryEffects].forEach(child => {
      if (child && !child.isDestroyed) {
        child.destroy();
      }
    });
    
    this.layer.batchDraw();
    console.log(`🧹 BrushManager: clearEverything() complete - cleared ${permanentTraces.length + temporaryEffects.length} total elements`);
  }

  cleanupUserEffects(socketId) {
    // Simplifié - on nettoie tout car pas de tracking par user
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearEverything();
  }
}