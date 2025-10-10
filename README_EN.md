# 🎨 Picturævox — Real‑time Collaborative Drawing

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.6.1-blue.svg)](https://socket.io/)
[![Konva.js](https://img.shields.io/badge/Konva.js-9.2.0-orange.svg)](https://konvajs.org/)
[![License](https://img.shields.io/badge/License-PolyForm%20NC%201.0.0-lightgrey.svg)](LICENSE)

Lightweight, real‑time collaborative drawing app. Three interfaces (public, studio, admin) synchronized via Socket.IO with Konva.js rendering.

---

## ✨ Key Features

- **Public (`/`)** — brush, eraser, undo; pan to explore the canvas; mobile‑first.
- **Studio (`/atelier`)** — color palette; shapes (lines, rects, circles, arrows...); zoom/pan; eyedropper; **PNG export**; animated brushes (sparkles, neon, watercolor, electric, fire, petals).
- **Admin (`/admin`)** — **moderation** (global clear, reset effects, global undo); minimap; dark/light background; hideable UI.

---

## 🚀 Quick Start

**Requirements**: Node.js ≥ 18, npm ≥ 9

```bash
npm install
npm run dev   # dev mode
# or
npm start     # production
```

Environment variables (optional):
```bash
PORT=3000
NODE_ENV=production
```

---

## 🌐 Routes

| Route      | Role    | Description                 |
|------------|---------|-----------------------------|
| `/`        | Public  | Simplified interface        |
| `/atelier` | Studio  | Advanced tools + PNG export |
| `/admin`   | Admin   | Control & moderation        |
| `/health`  | API     | Deployment health check     |

---

## ☁️ Deployment

- **Railway‑ready** (port via `process.env.PORT`), health endpoint: `/health`.
- Consider a minimal Docker image (Node 18‑alpine).

---

## 📄 License & Trademark

- Code is licensed under **PolyForm Noncommercial 1.0.0** — **no commercial use by third parties** without written permission. See [LICENSE](./LICENSE).
- **Picturævox™** is a trademark of **Elisalien**. See `TRADEMARKS.md`.
- Live performances/installations/moderation services are offered separately.

**Contact**: elisa@neon-live.fr

---

**Built for creative collaboration.** 🎨
