// public/brushManager.js - Système unifié avec tracés permanents
class BrushManager {
  constructor(layer, socket = null) {
    this.layer = layer;
    this.socket = socket;
    this.activeEffects = new Map();
    this.lastEmit = 0;
    this.throttleTime = 200;
    
    // Nettoyage automatique toutes les 30 secondes
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    
    console.log('✅ Unified BrushManager with permanent traces initialized');
  }

  // Méthode publique pour créer et émettre un effet
  createAndEmitEffect(type, x, y, color, size) {
    const now = Date.now();
    if (now - this.lastEmit < this.throttleTime) return;
    
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
        permanentTraces: permanentTraces // ✅ ENVOYER AU SERVEUR
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

  // Création d'effet local unifié (SEULEMENT temporaire maintenant)
  createLocalEffect(type, x, y, color, size) {
    const effectId = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Créer SEULEMENT l'effet temporaire animé
    switch(type) {
      case 'sparkles': 
        this.createSparkles(x, y, color, size, effectId); 
        break;
      case 'neon': 
        this.createNeon(x, y, color, size, effectId); 
        break;
      case 'watercolor': 
        this.createWatercolor(x, y, color, size, effectId); 
        break;
      case 'electric': 
        this.createElectric(x, y, color, size, effectId); 
        break;
      case 'fire': 
        this.createFire(x, y, color, size, effectId); 
        break;
      case 'petals': 
        this.createPetals(x, y, color, size, effectId); 
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
    const particleCount = 2;
    
    for (let i = 0; i < particleCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 1.5;
      const offsetY = (Math.random() - 0.5) * size * 1.5;
      const starSize = 1 + Math.random() * 2;
      
      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Star',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          numPoints: 4,
          innerRadius: starSize * 0.3,
          outerRadius: starSize,
          fill: color,
          opacity: 0.3 + Math.random() * 0.2,
          rotation: Math.random() * 360
        }
      });
    }
    
    return traces;
  }

  generateNeonTraceData(x, y, color, size) {
    const traces = [];
    const dotCount = 3;
    
    for (let i = 0; i < dotCount; i++) {
      const offsetX = (Math.random() - 0.5) * size;
      const offsetY = (Math.random() - 0.5) * size;
      const dotSize = 0.8 + Math.random() * 1.5;
      
      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Circle',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          radius: dotSize,
          fill: color,
          opacity: 0.4 + Math.random() * 0.3,
          shadowColor: color,
          shadowBlur: 3,
          shadowOpacity: 0.3
        }
      });
    }
    
    return traces;
  }

  generateWatercolorTraceData(x, y, color, size) {
    const traces = [];
    const blobCount = 2;
    
    for (let i = 0; i < blobCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 0.8;
      const offsetY = (Math.random() - 0.5) * size * 0.8;
      const blobSize = size * (0.3 + Math.random() * 0.4);
      
      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Circle',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          radius: blobSize,
          fill: color,
          opacity: 0.15 + Math.random() * 0.15,
          scaleX: 0.6 + Math.random() * 0.8,
          scaleY: 0.4 + Math.random() * 0.6
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
      
      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Line',
        attrs: {
          points: points,
          stroke: color,
          strokeWidth: 0.8 + Math.random() * 0.7,
          opacity: 0.25 + Math.random() * 0.2,
          lineCap: 'round',
          lineJoin: 'round'
        }
      });
    }
    
    return traces;
  }

  generateFireTraceData(x, y, color, size) {
    const traces = [];
    const flameCount = 2;
    
    for (let i = 0; i < flameCount; i++) {
      const offsetX = (Math.random() - 0.5) * size * 0.6;
      const offsetY = (Math.random() - 0.5) * size * 0.4;
      const flameSize = size * (0.2 + Math.random() * 0.3);
      
      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Ellipse',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          radiusX: flameSize * 0.6,
          radiusY: flameSize,
          fill: color,
          opacity: 0.2 + Math.random() * 0.15,
          rotation: Math.random() * 45 - 22.5
        }
      });
    }
    
    return traces;
  }

  generatePetalsTraceData(x, y, color, size) {
    const traces = [];
    const petalCount = 2;
    
    for (let i = 0; i < petalCount; i++) {
      const offsetX = (Math.random() - 0.5) * size;
      const offsetY = (Math.random() - 0.5) * size;
      const petalSize = size * (0.25 + Math.random() * 0.3);
      
      traces.push({
        id: this.generateTraceId(),
        shapeType: 'Ellipse',
        attrs: {
          x: x + offsetX,
          y: y + offsetY,
          radiusX: petalSize,
          radiusY: petalSize * 0.5,
          fill: color,
          opacity: 0.2 + Math.random() * 0.2,
          rotation: Math.random() * 360,
          scaleX: 0.6 + Math.random() * 0.6,
          scaleY: 0.4 + Math.random() * 0.8
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

  // === EFFETS TEMPORAIRES ANIMÉS (inchangés) ===
  
  createSparkles(x, y, color, size, effectId) {
    const elements = [];
    const particles = 4;
    const duration = 1200;
    
    for (let i = 0; i < particles; i++) {
      const offsetX = (Math.random() - 0.5) * size * 3;
      const offsetY = (Math.random() - 0.5) * size * 3;
      const sparkleSize = 2 + Math.random() * 6;
      
      const sparkle = new Konva.Star({
        x: x + offsetX, 
        y: y + offsetY,
        numPoints: 4, 
        innerRadius: sparkleSize * 0.4, 
        outerRadius: sparkleSize,
        fill: color, 
        rotation: Math.random() * 360,
        opacity: 1.0,
        effectId,
        isTemporaryEffect: true
      });
      
      this.layer.add(sparkle);
      elements.push(sparkle);
      
      this.animateSparkle(sparkle, duration, i);
    }
    
    this.trackEffect(effectId, elements, duration);
  }

  createNeon(x, y, color, size, effectId) {
    const elements = [];
    const particles = 4;
    const duration = 1400;
    
    for (let i = 0; i < particles; i++) {
      const offsetX = (Math.random() - 0.5) * size * 2.5;
      const offsetY = (Math.random() - 0.5) * size * 2.5;
      const particleSize = 3 + Math.random() * 5;
      
      const particle = new Konva.Circle({
        x: x + offsetX, 
        y: y + offsetY, 
        radius: particleSize, 
        fill: color,
        opacity: 0.9,
        shadowColor: color, 
        shadowBlur: 15, 
        shadowOpacity: 0.8,
        effectId,
        isTemporaryEffect: true
      });
      
      this.layer.add(particle);
      elements.push(particle);
      
      this.animateNeon(particle, duration, i);
    }
    
    this.trackEffect(effectId, elements, duration);
  }

  createWatercolor(x, y, color, size, effectId) {
    const elements = [];
    const drops = 3;
    const duration = 1500;
    
    for (let i = 0; i < drops; i++) {
      const offsetX = (Math.random() - 0.5) * size * 2;
      const offsetY = (Math.random() - 0.5) * size * 2;
      const dropSize = size * (0.6 + Math.random() * 0.8);
      
      const drop = new Konva.Circle({
        x: x + offsetX, 
        y: y + offsetY, 
        radius: dropSize, 
        fill: color,
        opacity: 0.5,
        scaleX: 0.8 + Math.random() * 0.6, 
        scaleY: 0.6 + Math.random() * 0.6,
        effectId,
        isTemporaryEffect: true
      });
      
      this.layer.add(drop);
      elements.push(drop);
      
      this.animateWatercolor(drop, duration, i);
    }
    
    this.trackEffect(effectId, elements, duration);
  }

  createElectric(x, y, color, size, effectId) {
    const elements = [];
    const bolts = 2;
    const duration = 1100;
    
    for (let i = 0; i < bolts; i++) {
      const points = this.generateElectricPath(x, y, size, 4);
      
      const bolt = new Konva.Line({
        points, 
        stroke: color,
        strokeWidth: 2.5 + Math.random() * 4,
        opacity: 0.9,
        lineCap: 'round', 
        lineJoin: 'round',
        shadowColor: color, 
        shadowBlur: 15, 
        shadowOpacity: 0.8,
        effectId,
        originalPoints: [...points], 
        animationOffset: Math.random() * Math.PI * 2,
        isTemporaryEffect: true
      });
      
      this.layer.add(bolt);
      elements.push(bolt);
      
      this.animateElectric(bolt, duration, i);
    }
    
    this.trackEffect(effectId, elements, duration);
  }

  createFire(x, y, color, size, effectId) {
    const elements = [];
    const flames = 4;
    const duration = 1200;
    
    for (let i = 0; i < flames; i++) {
      const offsetX = (Math.random() - 0.5) * size * 2;
      const offsetY = (Math.random() - 0.5) * size * 1.2;
      
      const flame = new Konva.Ellipse({
        x: x + offsetX, 
        y: y + offsetY,
        radiusX: 5 + Math.random() * 6,
        radiusY: 10 + Math.random() * 8,
        fill: color, 
        opacity: 0.8,
        shadowColor: '#FF4500', 
        shadowBlur: 16, 
        shadowOpacity: 0.7,
        effectId,
        isTemporaryEffect: true
      });
      
      this.layer.add(flame);
      elements.push(flame);
      
      this.animateFire(flame, duration, i);
    }
    
    this.trackEffect(effectId, elements, duration);
  }

  createPetals(x, y, color, size, effectId) {
    const elements = [];
    const count = 3;
    const duration = 2200;
    
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * size * 2.5;
      const offsetY = (Math.random() - 0.5) * size * 2.5;
      const petalSize = size * (0.5 + Math.random() * 0.6);
      
      const petal = new Konva.Ellipse({
        x: x + offsetX, 
        y: y + offsetY,
        radiusX: petalSize, 
        radiusY: petalSize * 0.6, 
        fill: color,
        opacity: 0.8 + Math.random() * 0.2,
        rotation: Math.random() * 360,
        scaleX: 0.8 + Math.random() * 0.6, 
        scaleY: 0.6 + Math.random() * 0.6,
        effectId,
        isTemporaryEffect: true
      });
      
      this.layer.add(petal);
      elements.push(petal);
      
      this.animatePetals(petal, duration, i, size);
    }
    
    this.trackEffect(effectId, elements, duration);
  }

  // === ANIMATIONS (inchangées) ===

  animateSparkle(sparkle, duration, index) {
    const animation = new Konva.Animation((frame) => {
      const progress = frame.time / duration;
      const scale = 0.9 + Math.sin(frame.time * 0.01 + index * 0.6) * 0.6;
      const rotation = sparkle.rotation() + 3;
      const opacity = Math.max(0, 1.0 - progress * 0.8);
      
      sparkle.scaleX(scale).scaleY(scale).rotation(rotation).opacity(opacity);
      
      if (progress >= 1 || opacity <= 0) {
        sparkle.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  animateNeon(particle, duration, index) {
    const animation = new Konva.Animation((frame) => {
      const progress = frame.time / duration;
      const glow = 12 + Math.sin(frame.time * 0.012 + index * 0.8) * 10;
      const opacity = Math.max(0, 0.9 - progress * 0.6);
      const pulse = 1 + Math.sin(frame.time * 0.008 + index) * 0.5;
      
      particle.shadowBlur(glow).opacity(opacity).scaleX(pulse).scaleY(pulse);
      
      if (progress >= 1 || opacity <= 0) {
        particle.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  animateWatercolor(drop, duration, index) {
    const animation = new Konva.Animation((frame) => {
      const progress = frame.time / duration;
      const expansion = 1 + progress * 2.8;
      const opacity = Math.max(0, 0.5 - progress * 0.25);
      
      drop.scaleX(expansion).scaleY(expansion).opacity(opacity);
      
      if (progress >= 1 || opacity <= 0) {
        drop.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  animateElectric(bolt, duration, index) {
    const originalPoints = bolt.originalPoints;
    const animationOffset = bolt.animationOffset;
    
    const animation = new Konva.Animation((frame) => {
      const progress = frame.time / duration;
      const flicker = 0.5 + Math.sin(frame.time * 0.06 + index * 2) * 0.5;
      const glow = 10 + Math.sin(frame.time * 0.04 + index) * 8;
      const opacity = Math.max(0, 0.9 - progress * 0.6);
      
      const deformedPoints = [];
      for (let i = 0; i < originalPoints.length; i += 2) {
        const x = originalPoints[i];
        const y = originalPoints[i + 1];
        const deformX = Math.sin(frame.time * 0.01 + animationOffset + i * 0.1) * 3;
        const deformY = Math.cos(frame.time * 0.012 + animationOffset + i * 0.1) * 2;
        deformedPoints.push(x + deformX, y + deformY);
      }
      
      bolt.points(deformedPoints);
      bolt.opacity(flicker * opacity).shadowBlur(glow);
      
      if (progress >= 1 || opacity <= 0) {
        bolt.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  animateFire(flame, duration, index) {
    const animation = new Konva.Animation((frame) => {
      const progress = frame.time / duration;
      const flicker = 0.9 + Math.sin(frame.time * 0.02 + index * 0.7) * 0.3;
      const rise = flame.y() - 1.8;
      const sway = Math.sin(frame.time * 0.015 + index) * 3;
      const opacity = Math.max(0, 0.8 - progress * 0.5);
      
      flame.scaleX(flicker).scaleY(flicker * 1.4).y(rise).x(flame.x() + sway * 0.15).opacity(opacity);
      
      if (progress >= 1 || opacity <= 0) {
        flame.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  animatePetals(petal, duration, index, size) {
    const animation = new Konva.Animation((frame) => {
      const progress = frame.time / duration;
      const rotation = petal.rotation() + 2;
      const fall = petal.y() + 2;
      const sway = Math.sin(frame.time * 0.012 + index) * 3;
      const opacity = Math.max(0, petal.opacity() - progress * 0.2);
      const flutter = 0.8 + Math.sin(frame.time * 0.015 + index) * 0.3;
      
      petal.rotation(rotation).y(fall).x(petal.x() + sway * 0.08)
           .opacity(opacity).scaleX(flutter).scaleY(flutter * 0.7);
      
      if (progress >= 1 || opacity <= 0) {
        petal.destroy();
        animation.stop();
      }
    }, this.layer);
    animation.start();
  }

  // === UTILITAIRES (inchangés) ===

  generateElectricPath(startX, startY, size, segments) {
    const points = [startX, startY];
    let currentX = startX, currentY = startY;
    
    for (let i = 0; i < segments; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = (Math.random() * size * 1.2) + (size * 0.4);
      const nextX = currentX + Math.cos(angle) * distance;
      const nextY = currentY + Math.sin(angle) * distance;
      
      const midX = (currentX + nextX) / 2 + (Math.random() - 0.5) * size * 0.3;
      const midY = (currentY + nextY) / 2 + (Math.random() - 0.5) * size * 0.3;
      
      points.push(midX, midY, nextX, nextY);
      currentX = nextX;
      currentY = nextY;
    }
    
    return points;
  }

  trackEffect(effectId, elements, duration) {
    this.activeEffects.set(effectId, { 
      elements, 
      timestamp: Date.now(), 
      duration 
    });
    
    setTimeout(() => this.removeEffect(effectId), duration + 2000);
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