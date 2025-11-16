# 🚀 Déploiement sur Railway

Guide pour déployer Picturaevox3 sur Railway.

---

## 📋 Prérequis

- Compte Railway (https://railway.app)
- Repository GitHub connecté
- (Optionnel) Redis pour la persistance

---

## ⚙️ Configuration Rapide

### 1. Déploiement Initial

1. Créer un nouveau projet sur Railway
2. Connecter votre repository GitHub
3. Railway détectera automatiquement `package.json` et utilisera `npm start`

### 2. Variables d'Environnement

**OBLIGATOIRES** :
```bash
NODE_ENV=production
```

**OPTIONNELLES** :
```bash
# Redis (recommandé pour la persistance)
REDIS_URL=redis://default:password@host:port

# CORS personnalisé (si vous utilisez un domaine personnalisé)
ALLOWED_ORIGINS=https://mondomaine.com,https://www.mondomaine.com
```

**AUTO-DÉTECTÉES** (pas besoin de les définir) :
- `PORT` - Railway le définit automatiquement
- `RAILWAY_STATIC_URL` - Votre domaine Railway (ex: la-pente.up.railway.app)

---

## 🔒 Configuration CORS Automatique

Le serveur détecte automatiquement et autorise :

1. **En développement** (`NODE_ENV=development`) :
   - ✅ Toutes les origines autorisées
   - Pour le développement local

2. **En production** :
   - ✅ Domaine Railway auto-détecté via `RAILWAY_STATIC_URL`
   - ✅ Domaine Render auto-détecté via `RENDER_EXTERNAL_URL`
   - ✅ Domaine personnalisé via `PUBLIC_URL` ou `DOMAIN`
   - ✅ Origines listées dans `ALLOWED_ORIGINS`

### Logs de Débogage

Le serveur affiche au démarrage :
```
🔒 CORS allowed origins: ['https://la-pente.up.railway.app', ...]
```

Si une connexion est bloquée, vous verrez :
```
⚠️ CORS blocked origin: https://domaine-non-autorise.com
   Allowed origins: ['https://la-pente.up.railway.app']
```

---

## 🔧 Configuration Avancée

### Utiliser un Domaine Personnalisé

1. **Configurer le domaine dans Railway** :
   - Settings → Domains → Add Domain
   - Suivre les instructions DNS

2. **Ajouter le domaine aux origines autorisées** :
```bash
# Dans Railway Variables
ALLOWED_ORIGINS=https://mondomaine.com,https://www.mondomaine.com
```

Ou définir :
```bash
PUBLIC_URL=https://mondomaine.com
```

### Activer Redis

1. **Ajouter Redis dans Railway** :
   - New → Database → Redis
   - Railway créera automatiquement `REDIS_URL`

2. **Vérifier la connexion** :
   - Logs devraient afficher : `✅ Redis connected`

---

## 🐛 Résolution de Problèmes

### Erreur : "websocket error" / "NS_ERROR_WEBSOCKET_CONNECTION_REFUSED"

**Cause** : CORS bloque la connexion

**Solution** :
1. Vérifier les logs Railway pour voir :
   ```
   🔒 CORS allowed origins: [...]
   ```
2. S'assurer que votre domaine Railway est listé
3. Vérifier que `NODE_ENV` est correctement défini

### Erreur : "Access denied" sur /health

**Cause** : CORS trop restrictif

**Solution** :
1. Vérifier `ALLOWED_ORIGINS` dans Railway Variables
2. Ajouter le domaine Railway :
   ```bash
   ALLOWED_ORIGINS=https://la-pente.up.railway.app
   ```

### Les dessins ne persistent pas après redémarrage

**Cause** : Redis n'est pas configuré

**Solution** :
1. Ajouter un service Redis dans Railway
2. Vérifier que `REDIS_URL` est défini
3. Vérifier les logs : `✅ Redis connected`

---

## 📊 Monitoring

### Endpoints de Santé

```bash
# Vérifier que le serveur fonctionne
curl https://votre-app.up.railway.app/health

# Réponse attendue :
{
  "status": "OK",
  "timestamp": "2025-11-16T20:38:05.427Z",
  "clients": 0,
  "shapes": 123
}
```

### Logs à Surveiller

**Démarrage réussi** :
```
✅ Server running on port 3000
🔒 CORS allowed origins: ['https://la-pente.up.railway.app']
✅ Redis connected (si configuré)
🎨 Picturaevox3 ready! X shapes loaded.
```

**Connexion client** :
```
👤 USER CONNECTED: abc123 (Total: 2 clients)
```

**Problème CORS** :
```
⚠️ CORS blocked origin: https://domaine.com
```

---

## 🔐 Sécurité

### Recommandations de Production

1. **Toujours définir `NODE_ENV=production`**
   - Désactive le mode permissif CORS
   - Active les optimisations

2. **Utiliser HTTPS uniquement**
   - Railway fournit HTTPS par défaut
   - Ne jamais utiliser HTTP en production

3. **Limiter les origines CORS**
   - Lister uniquement vos domaines dans `ALLOWED_ORIGINS`
   - Ne pas utiliser `*` wildcard

4. **Utiliser Redis avec mot de passe**
   - Railway configure automatiquement un mot de passe
   - Ne jamais exposer `REDIS_URL` publiquement

---

## 📝 Checklist de Déploiement

- [ ] Repository connecté à Railway
- [ ] `NODE_ENV=production` défini dans Variables
- [ ] (Optionnel) Redis ajouté et connecté
- [ ] Domaine Railway auto-détecté dans les logs
- [ ] Endpoint `/health` retourne 200 OK
- [ ] WebSocket se connecte sans erreur CORS
- [ ] Dessins synchronisés entre plusieurs clients
- [ ] (Si Redis) Dessins persistent après redémarrage

---

## 🆘 Support

Si vous rencontrez des problèmes :

1. **Vérifier les logs Railway** :
   - Onglet "Deployments" → Cliquer sur le dernier déploiement → "View Logs"

2. **Vérifier les variables d'environnement** :
   - Onglet "Variables"
   - S'assurer que `NODE_ENV=production` est défini

3. **Tester l'endpoint de santé** :
   ```bash
   curl https://votre-app.up.railway.app/health
   ```

4. **Vérifier la console navigateur** :
   - Ouvrir DevTools (F12)
   - Chercher les erreurs WebSocket/CORS

---

**Dernière mise à jour** : 16 Novembre 2025
**Version serveur** : V4 avec auto-détection CORS Railway/Render
