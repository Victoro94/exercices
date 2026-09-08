# Portail de dépôt de pièces

Socle de projet pour l'exercice DIV Protocol.

## Architecture

- `backend/` : API NestJS, PostgreSQL via Prisma, authentification avocat et logique métier.
- `frontend/` : application React/Vite avec Chakra UI v3.
- `infra/` : Docker Compose, MinIO, Nginx, Prometheus, Grafana et Certbot.
- `ai-logs/` : exports caviardés des échanges IA relatifs à l'exercice.

## Modules backend

| Module | Responsabilité |
| --- | --- |
| `auth` | Connexion avocat, JWT et protection des routes privées. |
| `requests` | Création et suivi des demandes de dépôt. |
| `public-deposit` | Déverrouillage PIN, session publique courte et progression. |
| `storage` | Intégration MinIO/S3 et URLs d'upload pré-signées. |
| `metrics` | Métriques Prometheus et signaux opérationnels. |
| `prisma` | Modèle de données, migrations et seed. |

## Flux principal

1. L'avocat crée une demande, un token public, un PIN hashé et une date d'expiration.
2. Le client ouvre le lien et déverrouille l'accès avec le PIN.
3. Le frontend reçoit une URL MinIO pré-signée et envoie le fichier directement au stockage objet.
4. L'API enregistre le document puis recalcule le statut de la demande.

## États de demande

- `PENDING` : lien valide, dépôt incomplet.
- `COMPLETE` : nombre de pièces attendu atteint.
- `EXPIRED` : date d'expiration dépassée.

## Installation one-click

```bash
./install.sh
```

Crée `.env` (secrets générés), build + démarre toute la stack, applique migrations
et seed, vérifie le login démo, puis affiche les URLs : front `:8080`, Grafana
`:3001`, Prometheus `:9090`, Alertmanager `:9093`, MinIO `:9001`.

Compte démo : `avocat@example.test` / `ChangeMe123!`, demande seedée PIN `1234`.

## Observabilité

4 alertes Prometheus (`infra/prometheus/alert.rules.yml`), choisies parce que
chacune déclenche une action : `BackendDown` (rollback/restart), `PinBruteForce`
(lockout + audit), `UploadFailuresHigh` (MinIO/CORS), `HttpErrorsHigh` (rollback).
Dashboard Grafana provisionné + Alertmanager qui relaie vers un sink local en dev
(à remplacer par Slack/PagerDuty en prod).

## CI/CD

- `.github/workflows/exo2-ci.yml` : à chaque push/PR, tests Jest backend (51 tests), tests Vitest frontend (13 tests), builds, validation du compose.
- `.github/workflows/exo2-docker.yml` : sur `main`, build + push des images `ghcr.io/victoro94/portail-depot-backend` et `...-frontend` (`latest` + `sha-...`). Zéro secret requis (auth via `GITHUB_TOKEN`).
- Déploiement serveur : `docker pull` des images + compose local (config seule, aucun code source sur la machine).

Les implémentations, tests, conteneurs et procédures d'installation seront ajoutés dans les étapes suivantes.
