# 🎨 Picturævox — Dessin collaboratif en temps réel

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.6.1-blue.svg)](https://socket.io/)
[![Konva.js](https://img.shields.io/badge/Konva.js-9.2.0-orange.svg)](https://konvajs.org/)
[![License](https://img.shields.io/badge/License-PolyForm%20NC%201.0.0-lightgrey.svg)](LICENSE)

Application de dessin collaboratif simple à déployer : trois interfaces (publique, atelier, admin), synchronisées en temps réel via Socket.IO et rendu Konva.js.

---

## ✨ Fonctionnalités clés

- **Public (`/index`)** : brush + gomme + undo, pan pour explorer la toile, mobile‑first.
- **Atelier (`/atelier`)** : palette couleurs, formes (lignes, rectangles, cercles, flèches, etc.), zoom/pan avancés, pipette, **export PNG**, brosses animées (sparkles, neon, watercolor, electric, fire, petals).
- **Admin (`/admin`)** : **modération** (clear global, reset effets, undo global), minimap, fond noir/blanc, UI masquable.

---

## 🚀 Démarrage rapide

**Prérequis** : Node.js ≥ 18, npm ≥ 9

```bash
npm install
npm run dev   # mode dev
# ou
npm start     # production
```

Variables d’environnement (optionnel) :
```bash
PORT=3000
NODE_ENV=production
```

---

## 🌐 Routes

| Route      | Rôle        | Description                       |
|------------|-------------|-----------------------------------|
| `/`        | Public      | Interface simplifiée              |
| `/atelier` | Atelier     | Outils avancés + export PNG       |
| `/admin`   | Admin       | Contrôle & modération             |
| `/health`  | API         | Health check (déploiement)        |

---

## ☁️ Déploiement

- Compatible **Railway** (port via `process.env.PORT`), endpoint de santé : `/health`.
- Dockerfile minimal possible (Node 18‑alpine).

---

## 📄 Licence & Marque

- Code sous **PolyForm Noncommercial 1.0.0** — **aucun usage commercial par des tiers** sans accord écrit. Voir le fichier [LICENSE](./LICENSE).
- Le nom **Picturævox™** est une marque d’**Elisalien**. Voir `TRADEMARKS.md`.  
- Prestations (installations, modération, performances) proposées séparément.

**Contact** : elisa@neon-live.fr

---

**Fait pour la collaboration créative.** 🎨
"# Picturaevox3" 
