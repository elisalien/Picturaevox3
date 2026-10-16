# 🎨 Picturævox — Dessin collaboratif en temps réel

> Installation interactive de dessin collaboratif avec modes de jeu : le public dessine sur une toile partagée depuis son téléphone, synchronisée en temps réel.

![Platform](https://img.shields.io/badge/platform-Web%20%2F%20Node.js%2018%2B-informational) ![Socket.io](https://img.shields.io/badge/Socket.io-4.6.1-blue) ![Konva.js](https://img.shields.io/badge/Konva.js-9.2.0-orange) ![License](https://img.shields.io/badge/license-PolyForm%20NC%201.0.0-lightgrey)

English version: [README_EN.md](README_EN.md)

## À propos

Picturævox (v3.5) est une application web de dessin collaboratif simple à déployer : les participant·es rejoignent une toile commune depuis leur navigateur (mobile‑first), un poste admin modère et pilote les jeux, et une page de sortie affiche le résultat en grand (projection, flux vidéo). Le rendu repose sur Konva.js, la synchronisation sur Socket.IO.

## Fonctionnalités

- **Toile publique (`/`)** : pinceau, spray, brosses animées (paillettes, aquarelle, néon, feu), gomme, déplacement, annuler (Ctrl+Z), zoom ; tutoriel intégré ; lien vers les jeux.
- **Jeux (`/game`)** : quatre modes activables depuis l'admin, avec la toile partagée visible derrière le lobby :
  - **Cadavre Exquis** — dessine un morceau de personnage en équipe
  - **Téléphone Gribouillis** — dessine, décris, dessine… le téléphone arabe du dessin
  - **Dessine-Devine** — un joueur dessine, les autres devinent le mot
  - **Le Grand Thème** — dessine librement sur un thème imposé
- **Admin** : modération (clear global, reset des effets, undo global), activation des jeux, mise en page de la sortie, mode démo par thèmes, configuration OSC et du flux vidéo, QR code.
- **Sortie (`/output`)** : affichage plein écran de la toile et/ou des jeux, selon la mise en page choisie dans l'admin.
- **Flux MJPEG (`/stream.mjpeg`)** : flux vidéo de la sortie, consommable par OBS, VLC, Resolume…
- **Pont OSC** vers TouchDesigner et Ableton Live (tracés, effets, événements de jeu) — local uniquement, désactivé automatiquement sur les PaaS cloud.
- **Persistance Redis optionnelle** : les dessins survivent aux redémarrages ; sans Redis, stockage en mémoire.

## Installation

**Prérequis** : Node.js ≥ 18, npm ≥ 9 (Redis optionnel)

```bash
npm install
npm run dev   # mode dev (nodemon)
# ou
npm start     # production
```

Copier [`.env.example`](.env.example) en `.env` pour configurer l'application (toutes les variables sont optionnelles) :

| Variable | Rôle |
| --- | --- |
| `PORT` | Port du serveur (ex. `3000`) |
| `NODE_ENV` | `development` ou `production` |
| `REDIS_URL` | URL Redis pour la persistance ; sans elle, stockage en mémoire uniquement |
| `ALLOWED_ORIGINS` | Origines CORS autorisées en production (séparées par des virgules) |
| `PUBLIC_URL` / `DOMAIN` | Domaine public à autoriser (Railway/Render sont auto-détectés) |
| `OSC_ENABLED`, `OSC_TD_*`, `OSC_ABLETON_*` | Envoi OSC vers TouchDesigner (port 7000 par défaut) et Ableton Live (port 9000 par défaut) |

### Déploiement

- Compatible **Railway** (port via `process.env.PORT`), endpoint de santé : `/health`. Guides détaillés : [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md) et [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md).
- L'OSC utilise UDP : il ne fonctionne que lorsque le serveur tourne en local (pas sur Railway/Render/Heroku).

## Utilisation

### Routes

| Route | Rôle | Description |
| --- | --- | --- |
| `/` | Public | Toile collaborative |
| `/game` | Jeux | Choix du mode de jeu et lobby |
| `/output` | Sortie | Affichage plein écran (projection) |
| `/stream.mjpeg` | Flux | Flux MJPEG de la sortie |
| `/health` | API | Health check (déploiement) |

L'interface d'administration est servie par `public/admin.html` (route définie dans `server.js`).

### OSC

Les messages sortants utilisent le préfixe `/picturaevox/…` (par ex. `/picturaevox/draw`, `/picturaevox/effect`, `/picturaevox/canvas/clear`, `/picturaevox/game/start`, `/picturaevox/timer`) ; Ableton reçoit en plus des déclencheurs `/picturaevox/trigger/…`. Voir [`oscManager.js`](oscManager.js) pour la liste complète.

## Structure du projet

```
.
├── server.js            # Serveur Express + Socket.IO : toile, jeux, admin, Redis, flux MJPEG
├── oscManager.js        # Pont OSC vers TouchDesigner & Ableton Live
├── data/devineWords.json# Mots du jeu Dessine-Devine
├── public/
│   ├── index.html, app.js, brushManager.js, connectionManager.js, utils.js  # Toile publique
│   ├── game.html, game.js, gameCanvas.js, sharedCanvasLobby.js              # Jeux
│   ├── admin.html, admin.js                                                 # Administration
│   ├── output.html                                                          # Sortie / projection
│   └── vendor/qrcode.min.js
├── .env.example
└── *.md                 # Docs : déploiement, changelog, correctifs
```

Documentation complémentaire : [CHANGELOG_IMPROVEMENTS.md](CHANGELOG_IMPROVEMENTS.md) · [BUGFIX_SHARED_CANVAS.md](BUGFIX_SHARED_CANVAS.md) · [CORS_FIX_SUMMARY.md](CORS_FIX_SUMMARY.md)

## Stack technique

Node.js, Express, Socket.IO, Konva.js, Redis (ioredis), node-osc, msgpack-lite, qrcode, dotenv.

## Crédits & licence

- Auteur : Elisalien
- Code sous **PolyForm Noncommercial 1.0.0** (déclaré dans `package.json`) — **aucun usage commercial par des tiers** sans accord écrit. Voir [LICENSE.md](LICENSE.md).
- Le nom **Picturævox™** est une marque d'**Elisalien**. Voir [TRADEMARKS.md](TRADEMARKS.md) (contact pour les autorisations).
- Prestations (installations, modération, performances) proposées séparément.

---

<p align="center">
  Fait par <a href="https://github.com/elisalien">Élisalien</a> ·
  <a href="https://gitlab.com/elisalien/catalog">Catalogue des shaders, sources & logiciels</a>
</p>
