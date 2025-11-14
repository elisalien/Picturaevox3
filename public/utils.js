// public/utils.js - Utilitaires partagés optimisés
// Auteur: Elisalien - Picturaevox3
// Exposé globalement via window pour compatibilité avec l'architecture existante

(function(window) {
  'use strict';

  // Note: Ces utilitaires sont optionnels
  // Les fichiers existants (app.js, atelier.js, admin.js) ont déjà leurs propres
  // implémentations de ces fonctions et continueront de fonctionner

  // Disponibilité des algorithmes de lissage avancés pour usage futur
  // Les fichiers peuvent choisir d'utiliser ces fonctions ou leurs versions locales

  /**
   * Algorithme Douglas-Peucker pour simplifier les lignes
   * @param {Array<number>} points - Array [x1, y1, x2, y2, ...]
   * @param {number} tolerance - Tolérance de simplification
   * @returns {Array<number>} Points simplifiés
   */
  window.douglasPeucker = function(points, tolerance) {
    if (!tolerance) tolerance = 2.0;
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
  };

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

  /**
   * Lissage Catmull-Rom pour courbes fluides
   * @param {Array<number>} points - Points [x1, y1, x2, y2, ...]
   * @param {number} tension - Tension (0-1, défaut: 0.5)
   * @returns {Array<number>} Points lissés
   */
  window.catmullRomSmoothing = function(points, tension) {
    if (!tension) tension = 0.5;
    if (points.length < 8) return points;

    const smoothed = [];
    const numSegments = 10;

    smoothed.push(points[0], points[1]);

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

    smoothed.push(points[points.length - 2], points[points.length - 1]);

    return smoothed;
  };

  /**
   * Détecte si l'appareil est mobile
   * @returns {boolean} True si mobile
   */
  window.isMobileDevice = function() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  };

  /**
   * Valide une couleur hexadécimale
   * @param {string} color - Couleur à valider
   * @returns {boolean} True si valide
   */
  window.isValidHexColor = function(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  /**
   * Valide un tableau de points
   * @param {Array<number>} points - Points à valider
   * @param {number} maxLength - Longueur maximale
   * @returns {boolean} True si valide
   */
  window.isValidPoints = function(points, maxLength) {
    if (!maxLength) maxLength = 1000;
    if (!Array.isArray(points)) return false;
    if (points.length === 0 || points.length % 2 !== 0) return false;
    if (points.length > maxLength) return false;

    return points.every(function(p) {
      return typeof p === 'number' && !isNaN(p) && isFinite(p);
    });
  };

  console.log('✅ Utils.js loaded - Advanced smoothing algorithms available');

})(window);
