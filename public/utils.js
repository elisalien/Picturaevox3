// public/utils.js - Utilitaires partagés optimisés
// Auteur: Elisalien - Picturaevox3

// === UTILITAIRES GÉNÉRAUX ===

/**
 * Throttle une fonction pour limiter sa fréquence d'exécution
 * @param {Function} func - Fonction à throttler
 * @param {number} wait - Temps d'attente minimum en ms
 * @returns {Function} Fonction throttlée
 */
export function throttle(func, wait) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      func.apply(this, args);
    }
  };
}

/**
 * Génère un ID unique pour les shapes
 * @returns {string} ID unique
 */
export function generateId() {
  return 'shape_' + Date.now() + '_' + Math.round(Math.random() * 100000);
}

/**
 * Récupère la pression du stylet ou retourne 1 pour doigt/souris
 * @param {Event} evt - Événement Konva
 * @returns {number} Pression entre 0.1 et 1
 */
export function getPressure(evt) {
  if (evt.originalEvent?.pressure !== undefined) {
    return Math.max(0.1, evt.originalEvent.pressure);
  }
  return 1;
}

/**
 * Calcule la taille du trait en fonction de la pression
 * @param {number} pressure - Pression du stylet
 * @param {number} currentSize - Taille de base
 * @returns {number} Taille calculée
 */
export function getPressureSize(pressure, currentSize) {
  const minSize = Math.max(1, currentSize * 0.3);
  const maxSize = currentSize * 1.5;
  return minSize + (maxSize - minSize) * pressure;
}

/**
 * Convertit les coordonnées écran en coordonnées scène
 * @param {Object} stage - Stage Konva
 * @param {Object} pointer - Pointeur {x, y}
 * @returns {Object} Coordonnées {x, y} dans la scène
 */
export function getScenePos(stage, pointer) {
  return {
    x: (pointer.x - stage.x()) / stage.scaleX(),
    y: (pointer.y - stage.y()) / stage.scaleY()
  };
}

// === ALGORITHMES DE LISSAGE ET SIMPLIFICATION ===

/**
 * Algorithme Douglas-Peucker pour simplifier les lignes
 * Conserve les points importants et élimine les redondances
 * @param {Array<number>} points - Array de coordonnées [x1, y1, x2, y2, ...]
 * @param {number} tolerance - Tolérance de simplification (plus élevé = plus simplifié)
 * @returns {Array<number>} Points simplifiés
 */
export function douglasPeucker(points, tolerance = 2.0) {
  if (points.length <= 4) return points; // Moins de 2 points, on garde tout

  // Convertir en array d'objets {x, y}
  const pointObjects = [];
  for (let i = 0; i < points.length; i += 2) {
    pointObjects.push({ x: points[i], y: points[i + 1] });
  }

  const simplified = simplifyDouglasPeucker(pointObjects, tolerance);

  // Reconvertir en array plat
  const result = [];
  for (const pt of simplified) {
    result.push(pt.x, pt.y);
  }

  return result;
}

/**
 * Implémentation récursive de Douglas-Peucker
 * @private
 */
function simplifyDouglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;

  // Trouver le point le plus éloigné de la ligne entre premier et dernier
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

  // Si la distance max est supérieure à la tolérance, diviser récursivement
  if (maxDistance > tolerance) {
    const left = simplifyDouglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyDouglasPeucker(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  } else {
    // Sinon, garder seulement les extrémités
    return [first, last];
  }
}

/**
 * Calcule la distance perpendiculaire d'un point à une ligne
 * @private
 */
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

/**
 * Lissage Catmull-Rom pour des courbes fluides
 * Idéal pour le rendu de traits au stylet ou au doigt
 * @param {Array<number>} points - Points [x1, y1, x2, y2, ...]
 * @param {number} tension - Tension de la courbe (0 = lissage max, 1 = anguleux)
 * @returns {Array<number>} Points lissés
 */
export function catmullRomSmoothing(points, tension = 0.5) {
  if (points.length < 8) return points; // Besoin d'au moins 4 points

  const smoothed = [];
  const numSegments = 10; // Points par segment

  // Garder le premier point
  smoothed.push(points[0], points[1]);

  // Lisser chaque segment
  for (let i = 0; i < points.length - 6; i += 2) {
    const p0x = i === 0 ? points[i] : points[i - 2];
    const p0y = i === 0 ? points[i + 1] : points[i - 1];
    const p1x = points[i];
    const p1y = points[i + 1];
    const p2x = points[i + 2];
    const p2y = points[i + 3];
    const p3x = i + 4 >= points.length ? points[i + 2] : points[i + 4];
    const p3y = i + 4 >= points.length ? points[i + 3] : points[i + 5];

    for (let t = 0; t <= numSegments; t++) {
      const tt = t / numSegments;
      const tt2 = tt * tt;
      const tt3 = tt2 * tt;

      const q = [
        2 * p1x,
        -p0x + p2x,
        2 * p0x - 5 * p1x + 4 * p2x - p3x,
        -p0x + 3 * p1x - 3 * p2x + p3x
      ];

      const r = [
        2 * p1y,
        -p0y + p2y,
        2 * p0y - 5 * p1y + 4 * p2y - p3y,
        -p0y + 3 * p1y - 3 * p2y + p3y
      ];

      const x = tension * (q[0] + q[1] * tt + q[2] * tt2 + q[3] * tt3);
      const y = tension * (r[0] + r[1] * tt + r[2] * tt2 + r[3] * tt3);

      smoothed.push(x, y);
    }
  }

  // Garder le dernier point
  smoothed.push(points[points.length - 2], points[points.length - 1]);

  return smoothed;
}

/**
 * Lissage par moyenne mobile pour réduire le bruit
 * Excellent pour les traits au doigt sur mobile
 * @param {Array<number>} points - Points [x1, y1, x2, y2, ...]
 * @param {number} windowSize - Taille de la fenêtre de moyenne
 * @returns {Array<number>} Points lissés
 */
export function movingAverageSmoothing(points, windowSize = 3) {
  if (points.length < windowSize * 2) return points;

  const smoothed = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < points.length; i += 2) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    // Calculer la moyenne dans la fenêtre
    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j * 2;
      if (idx >= 0 && idx < points.length - 1) {
        sumX += points[idx];
        sumY += points[idx + 1];
        count++;
      }
    }

    smoothed.push(sumX / count, sumY / count);
  }

  return smoothed;
}

/**
 * Algorithme hybride pour optimisation optimale selon le contexte
 * Combine simplification et lissage
 * @param {Array<number>} points - Points bruts
 * @param {Object} options - Options de traitement
 * @returns {Array<number>} Points optimisés
 */
export function optimizePoints(points, options = {}) {
  const {
    simplifyTolerance = 2.0,
    smoothingType = 'catmullRom', // 'catmullRom', 'movingAverage', 'none'
    smoothingIntensity = 0.5,
    maxPoints = 200
  } = options;

  let optimized = points;

  // 1. Simplification si trop de points
  if (points.length > maxPoints * 2) {
    optimized = douglasPeucker(optimized, simplifyTolerance);
  }

  // 2. Lissage selon le type
  if (smoothingType === 'catmullRom' && optimized.length >= 8) {
    optimized = catmullRomSmoothing(optimized, smoothingIntensity);
  } else if (smoothingType === 'movingAverage' && optimized.length >= 6) {
    const windowSize = Math.max(3, Math.floor(5 * smoothingIntensity));
    optimized = movingAverageSmoothing(optimized, windowSize);
  }

  // 3. Simplification finale si encore trop de points
  if (optimized.length > maxPoints * 2) {
    optimized = douglasPeucker(optimized, simplifyTolerance * 1.5);
  }

  return optimized;
}

/**
 * Détecte si l'appareil est mobile
 * @returns {boolean} True si mobile
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

/**
 * Détecte le type d'input (stylet, doigt, souris)
 * @param {Event} evt - Événement
 * @returns {string} Type d'input: 'pen', 'touch', 'mouse'
 */
export function getInputType(evt) {
  const e = evt.originalEvent || evt;

  if (e.pointerType) {
    return e.pointerType; // 'pen', 'touch', 'mouse'
  }

  if (e.touches) {
    return 'touch';
  }

  return 'mouse';
}

/**
 * Calcule la vélocité du trait pour ajuster le rendu
 * @param {Array<number>} recentPoints - Points récents [x1, y1, x2, y2, ...]
 * @returns {number} Vélocité (pixels par ms)
 */
export function calculateVelocity(recentPoints) {
  if (recentPoints.length < 4) return 0;

  let totalDistance = 0;
  for (let i = 2; i < recentPoints.length; i += 2) {
    const dx = recentPoints[i] - recentPoints[i - 2];
    const dy = recentPoints[i + 1] - recentPoints[i - 1];
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }

  return totalDistance / (recentPoints.length / 2);
}

/**
 * Valide une couleur hexadécimale
 * @param {string} color - Couleur à valider
 * @returns {boolean} True si valide
 */
export function isValidHexColor(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Valide un tableau de points
 * @param {Array<number>} points - Points à valider
 * @param {number} maxLength - Longueur maximale
 * @returns {boolean} True si valide
 */
export function isValidPoints(points, maxLength = 1000) {
  if (!Array.isArray(points)) return false;
  if (points.length === 0 || points.length % 2 !== 0) return false;
  if (points.length > maxLength) return false;

  return points.every(p => typeof p === 'number' && !isNaN(p) && isFinite(p));
}

/**
 * Valide une taille de trait
 * @param {number} size - Taille à valider
 * @param {number} min - Taille minimale
 * @param {number} max - Taille maximale
 * @returns {boolean} True si valide
 */
export function isValidSize(size, min = 1, max = 50) {
  return typeof size === 'number' && size >= min && size <= max && !isNaN(size);
}
