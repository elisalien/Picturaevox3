# 🚂 Déploiement Picturaevox3 sur Railway

Guide complet pour déployer votre application de dessin collaboratif sur Railway.

---

## 📋 Prérequis

- Compte Railway (gratuit) : https://railway.app
- Compte Redis Cloud (optionnel mais recommandé) : https://redis.com/try-free/
- Compte GitHub avec le repo Picturaevox3

---

## 🚀 Déploiement Rapide

### Étape 1 : Créer un Projet Railway

1. Connectez-vous sur https://railway.app
2. Cliquez sur **"New Project"**
3. Sélectionnez **"Deploy from GitHub repo"**
4. Choisissez le repository **Picturaevox3**
5. Railway détectera automatiquement Node.js

### Étape 2 : Configuration des Variables d'Environnement

Dans l'onglet **Variables** de votre projet Railway, ajoutez :

#### Variables Obligatoires

```bash
# Port (Railway l'assigne automatiquement)
PORT=${{RAILWAY_PUBLIC_PORT}}

# Environnement
NODE_ENV=production
```

#### Variables Recommandées (Redis)

Pour activer la persistance des dessins, ajoutez un service Redis :

**Option A : Redis Railway (Recommandé)**
1. Dans votre projet Railway, cliquez **"New"** → **"Database"** → **"Add Redis"**
2. Railway créera automatiquement la variable `REDIS_URL`

**Option B : Redis Cloud Externe**
1. Créez un compte sur https://redis.com/try-free/
2. Créez une base de données (free tier : 30MB)
3. Copiez l'URL de connexion
4. Ajoutez dans Railway :

```bash
REDIS_URL=redis://default:votrepassword@redis-xxxxx.cloud.redislabs.com:12345
```

#### Variables Optionnelles (Sécurité)

```bash
# CORS - Ajoutez vos domaines autorisés
ALLOWED_ORIGINS=https://votre-app.railway.app,https://www.votre-domaine.com

# Si vous avez un domaine personnalisé
ALLOWED_ORIGINS=https://picturaevox.com,https://www.picturaevox.com
```

### Étape 3 : Configuration Réseau

1. Dans **Settings** → **Networking**
2. Railway génère automatiquement un domaine : `votre-app.up.railway.app`
3. **Important** : Notez ce domaine pour la configuration CORS

### Étape 4 : Déploiement

Railway déploie automatiquement à chaque push sur `main` !

```bash
# Sur votre machine locale
git push origin main
```

Railway :
- ✅ Installe les dépendances (`npm install`)
- ✅ Démarre le serveur (`npm start`)
- ✅ Configure le port automatiquement
- ✅ Active le healthcheck sur `/health`

---

## 🔧 Configuration Avancée

### Domaine Personnalisé

1. Dans **Settings** → **Domains**
2. Cliquez **"Custom Domain"**
3. Ajoutez votre domaine : `picturaevox.com`
4. Configurez les DNS selon les instructions Railway :
   ```
   Type: CNAME
   Name: @
   Value: votre-app.up.railway.app
   ```

5. **Mettez à jour CORS** :
   ```bash
   ALLOWED_ORIGINS=https://picturaevox.com,https://www.picturaevox.com
   ```

### Redis avec Persistance Complète

Configuration recommandée pour production :

```bash
# Railway Redis (auto-configuré)
REDIS_URL=${{REDIS.REDIS_URL}}

# Ou Redis Cloud
REDIS_URL=redis://default:password@endpoint:port
```

### Monitoring et Logs

1. **Logs en temps réel** :
   - Onglet **"Deployments"** → Cliquez sur le déploiement actif
   - Les logs s'affichent en temps réel

2. **Healthcheck** :
   - Railway ping automatiquement `/health` toutes les 30s
   - Si le serveur ne répond pas, Railway redémarre automatiquement

3. **Métriques** :
   - CPU, RAM, Network visibles dans **"Metrics"**

---

## 📊 Variables d'Environnement Complètes

Voici toutes les variables disponibles :

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| `PORT` | ✅ | ${{RAILWAY_PUBLIC_PORT}} | Port Railway (auto) |
| `NODE_ENV` | ✅ | production | Environnement |
| `REDIS_URL` | ⭐ | - | URL Redis pour persistance |
| `ALLOWED_ORIGINS` | 🔒 | localhost | Domaines CORS autorisés |

**Légende** :
- ✅ Obligatoire
- ⭐ Recommandé (active la persistance)
- 🔒 Sécurité (pour production)

---

## 🎯 Exemple de Configuration Complète

### Configuration Minimale (Sans Redis)

```bash
PORT=${{RAILWAY_PUBLIC_PORT}}
NODE_ENV=production
ALLOWED_ORIGINS=https://votre-app.up.railway.app
```

**Fonctionnalités** :
- ✅ Dessin collaboratif en temps réel
- ✅ Tous les effets de pinceau
- ✅ Alertes mobiles intelligentes
- ❌ Persistance (dessins perdus au redémarrage)

### Configuration Complète (Avec Redis)

```bash
PORT=${{RAILWAY_PUBLIC_PORT}}
NODE_ENV=production
REDIS_URL=${{REDIS.REDIS_URL}}
ALLOWED_ORIGINS=https://picturaevox.com,https://votre-app.up.railway.app
```

**Fonctionnalités** :
- ✅ Dessin collaboratif en temps réel
- ✅ Tous les effets de pinceau
- ✅ Alertes mobiles intelligentes
- ✅ **Persistance permanente des dessins**
- ✅ Historique étendu (50 actions)
- ✅ Survie aux redémarrages

---

## 🧪 Tester le Déploiement

### 1. Vérifier le Health Check

```bash
curl https://votre-app.up.railway.app/health
```

**Réponse attendue** :
```json
{
  "status": "OK",
  "timestamp": "2025-11-14T12:00:00.000Z",
  "clients": 0,
  "shapes": 42
}
```

### 2. Tester les Pages

- **Public** : https://votre-app.up.railway.app/
- **Atelier** : https://votre-app.up.railway.app/atelier
- **Admin** : https://votre-app.up.railway.app/chantilly

### 3. Tester la Persistance Redis

1. Dessinez quelque chose
2. Dans Railway, cliquez **"Restart"**
3. Rechargez la page
4. ✅ Les dessins sont toujours là !

---

## 🐛 Dépannage

### Problème : "Application failed to respond"

**Solution** :
```bash
# Vérifiez que PORT est bien configuré
PORT=${{RAILWAY_PUBLIC_PORT}}

# Vérifiez les logs
# Railway → Deployments → Voir les logs
```

### Problème : Erreur CORS

**Symptôme** : Console navigateur affiche "CORS policy"

**Solution** :
```bash
# Ajoutez votre domaine Railway dans ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://votre-app.up.railway.app

# Si vous avez plusieurs domaines
ALLOWED_ORIGINS=https://app1.railway.app,https://app2.com
```

### Problème : Redis Connection Failed

**Solution** :
```bash
# Vérifiez que REDIS_URL est correcte
# Railway Redis : REDIS_URL=${{REDIS.REDIS_URL}}
# Redis Cloud : Vérifiez username/password/host/port

# Sans Redis, l'app fonctionne quand même
# (mais sans persistance)
```

### Problème : Dessins disparaissent au redémarrage

**Cause** : Redis non configuré

**Solution** :
1. Ajoutez un service Redis dans Railway
2. Configurez `REDIS_URL=${{REDIS.REDIS_URL}}`
3. Redéployez

---

## 📈 Mise à l'Échelle

Railway permet de scaler facilement :

### Vertical Scaling (Plus de RAM/CPU)

1. **Settings** → **Resources**
2. Augmentez les limites selon vos besoins
3. Prix : À partir de $5/mois

### Horizontal Scaling

Pour gérer plus d'utilisateurs simultanés :

1. Activez **Redis** (obligatoire pour scaling horizontal)
2. Railway peut auto-scaler les instances
3. WebSockets sont supportés nativement

**Capacités estimées** :
- 1 instance : ~100 utilisateurs simultanés
- 2 instances : ~200 utilisateurs simultanés
- Avec Redis : scalabilité illimitée

---

## 🔐 Sécurité en Production

### Checklist de Sécurité

- [x] `NODE_ENV=production`
- [x] `ALLOWED_ORIGINS` configuré avec vos vrais domaines
- [x] HTTPS activé (automatique sur Railway)
- [x] Redis avec mot de passe (si externe)
- [ ] Rate limiting (à implémenter si besoin)
- [ ] Authentification (optionnel selon usage)

### Recommandations

```bash
# En production, TOUJOURS définir ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://votre-domaine.com

# Ne JAMAIS utiliser
ALLOWED_ORIGINS=*  # ❌ DANGEREUX
```

---

## 💰 Coûts Railway

### Plan Gratuit
- ✅ $5 de crédit gratuit/mois
- ✅ Suffisant pour des tests
- ✅ Sleeps après 20 min d'inactivité

### Plan Hobby ($5/mois)
- ✅ Pas de sleep
- ✅ 500 heures d'exécution
- ✅ Parfait pour production légère

### Plan Pro ($20/mois)
- ✅ Tout illimité
- ✅ Support prioritaire
- ✅ Scaling automatique

**Coût Redis** :
- Railway Redis : ~$5-10/mois selon usage
- Redis Cloud Free : 30MB gratuit (suffisant pour démarrer)

---

## 🔄 CI/CD Automatique

Railway déploie automatiquement à chaque push sur `main` :

```bash
# Workflow typique
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main

# Railway détecte le push
# → Build automatique
# → Tests (si configurés)
# → Déploiement automatique
# → Healthcheck
# → ✅ En ligne !
```

---

## 📚 Ressources

- **Railway Docs** : https://docs.railway.app
- **Redis Cloud** : https://redis.com/try-free/
- **Support Railway** : https://railway.app/discord
- **Status Railway** : https://status.railway.app

---

## ✅ Checklist Post-Déploiement

Avant de partager votre app :

- [ ] Healthcheck répond correctement (`/health`)
- [ ] Les 3 pages fonctionnent (public, atelier, admin)
- [ ] Le dessin collaboratif fonctionne
- [ ] Les indicateurs de connexion s'affichent
- [ ] Redis configuré (si persistance souhaitée)
- [ ] CORS configuré avec vos vrais domaines
- [ ] Tests sur mobile (alertes de déconnexion)
- [ ] Domaine personnalisé configuré (optionnel)

---

## 🎉 Succès !

Votre application Picturaevox3 est maintenant déployée sur Railway !

**URLs à partager** :
- Public : `https://votre-app.up.railway.app/`
- Atelier : `https://votre-app.up.railway.app/atelier`
- Admin : `https://votre-app.up.railway.app/chantilly`

**Profitez de votre outil de dessin collaboratif en temps réel !** 🎨✨

---

**Version** : 4.0.0
**Dernière mise à jour** : Novembre 2025
**Auteur** : Elisalien
