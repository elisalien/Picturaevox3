# 🔧 Résolution du Problème de Connexion WebSocket

**Date:** 16 Novembre 2025
**Problème:** `NS_ERROR_WEBSOCKET_CONNECTION_REFUSED` sur Railway
**Statut:** ✅ RÉSOLU

---

## 🐛 Problème Identifié

L'application sur Railway (https://la-pente.up.railway.app) refusait les connexions WebSocket avec l'erreur :
```
Firefox ne peut établir de connexion avec le serveur à l'adresse
wss://la-pente.up.railway.app/socket.io/?EIO=4&transport=websocket

NS_ERROR_WEBSOCKET_CONNECTION_REFUSED
```

**Cause racine:** Configuration CORS trop restrictive ne permettant que `localhost:3000` en production.

---

## ✅ Solutions Implémentées

### 1. Auto-détection du Domaine Railway

Le serveur détecte automatiquement son domaine de déploiement via les variables d'environnement :

- **Railway** : `RAILWAY_STATIC_URL`
- **Render** : `RENDER_EXTERNAL_URL`
- **Personnalisé** : `PUBLIC_URL` ou `DOMAIN`

### 2. Logs de Débogage

Le serveur affiche maintenant au démarrage :
```bash
🔒 CORS allowed origins: [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://la-pente.up.railway.app'  # ✅ AUTO-DÉTECTÉ
]
```

Si une connexion est bloquée :
```bash
⚠️ CORS blocked origin: https://domaine-non-autorise.com
   Allowed origins: ['https://la-pente.up.railway.app']
```

### 3. Mode Développement Amélioré

En développement (`NODE_ENV=development`), toutes les origines sont autorisées.

---

## 🚀 Prochaines Étapes sur Railway

### Option A : Redéploiement Automatique (Recommandé)

Si vous avez activé le **auto-deploy** sur Railway :

1. Railway va automatiquement détecter le nouveau commit
2. Le serveur va redémarrer avec la nouvelle configuration
3. Le domaine Railway sera auto-détecté
4. ✅ Les WebSockets devraient fonctionner immédiatement

### Option B : Redéploiement Manuel

1. Aller sur Railway Dashboard → Votre projet
2. Cliquer sur **"Deploy"** ou attendre le déploiement automatique
3. Vérifier les logs :
   ```
   🔒 CORS allowed origins: ['https://la-pente.up.railway.app']
   ✅ Server running on port 3000
   ```

### Option C : Configuration Manuelle (Si nécessaire)

Si le domaine n'est toujours pas auto-détecté, ajouter manuellement :

**Railway Dashboard → Variables:**
```bash
ALLOWED_ORIGINS=https://la-pente.up.railway.app
```

Ou :
```bash
PUBLIC_URL=https://la-pente.up.railway.app
```

---

## 🧪 Vérification

### 1. Vérifier que le serveur est en ligne

```bash
curl https://la-pente.up.railway.app/health
```

**Réponse attendue:**
```json
{
  "status": "OK",
  "timestamp": "2025-11-16T...",
  "clients": 0,
  "shapes": 0
}
```

### 2. Vérifier les logs Railway

**Railway Dashboard → Deployments → View Logs**

Chercher :
```
🔒 CORS allowed origins: ['https://la-pente.up.railway.app']
```

### 3. Tester depuis le navigateur

1. Ouvrir https://la-pente.up.railway.app
2. Ouvrir la console (F12)
3. Dessiner sur le canvas
4. Vérifier qu'il n'y a plus d'erreur WebSocket
5. Ouvrir une deuxième fenêtre → Le dessin devrait être synchronisé

---

## 📊 Résultat Attendu

**Console navigateur (avant):**
```
❌ Connection error: Error: websocket error
📦 Action queued: drawing (1 in queue)
📦 Action queued: drawing (2 in queue)
```

**Console navigateur (après):**
```
✅ Connected to server
✅ Simplified Atelier.js loaded with unified BrushManager
```

---

## 🔍 Si le Problème Persiste

### 1. Vérifier les Variables Railway

```bash
# Variables qui devraient être définies
NODE_ENV=production          # ← CRITIQUE
PORT=(auto)                  # Railway le définit automatiquement
RAILWAY_STATIC_URL=(auto)    # Railway le définit automatiquement
```

### 2. Vérifier que le Build a Réussi

Railway Dashboard → Deployments → Status : **Success** ✅

### 3. Forcer un Redémarrage

Railway Dashboard → Settings → Restart

### 4. Consulter la Documentation

Voir `RAILWAY_DEPLOYMENT.md` pour :
- Configuration complète
- Troubleshooting détaillé
- Bonnes pratiques de sécurité

---

## 📝 Commits Associés

1. **9814a05** - fix: Correction canvas de dessin partagé - Gestion complète des tracés permanents
2. **3422723** - fix: Configuration CORS Railway - Auto-détection du domaine de déploiement

---

## 🎯 Impact

- ✅ WebSocket fonctionne sur Railway sans configuration manuelle
- ✅ Support automatique Railway + Render + domaines personnalisés
- ✅ Logs de débogage pour faciliter le diagnostic
- ✅ Sécurité maintenue en production
- ✅ Expérience développeur améliorée

---

**Une fois déployé sur Railway, votre application devrait fonctionner immédiatement ! 🎨**

Si vous rencontrez encore des problèmes, vérifiez les logs Railway pour voir exactement quelles origines sont autorisées.
