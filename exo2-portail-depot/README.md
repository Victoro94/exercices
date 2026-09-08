# Portail de dépôt de pièces

Portail avocat/client remplaçant les pièces jointes par mail : l'avocat crée
une demande et envoie un lien public expirable protégé par PIN, le client
dépose ses pièces sans compte, le dashboard suit les statuts.

## Architecture et choix justifiés

- `backend/` : API REST **NestJS**, découpée par domaine métier (`auth`,
  `requests`, `public-deposit`, `storage`, `metrics`, `prisma`). REST plutôt
  que tRPC/GraphQL : ressources stables, clients interchangeables, cache et
  debug simples.
- `frontend/` : React/Vite + **Chakra UI v3**, tokens DIV exacts (voir
  `src/theme.ts` + `src/styles.css`), light only.
- `infra/` : Docker Compose (Postgres, MinIO, backend, frontend nginx),
  Prometheus + Alertmanager + Grafana provisionnés, nginx TLS + Certbot pour
  la prod.
- `ai-logs/` : exports caviardés des échanges IA relatifs à l'exercice.
- `install.sh` : one-click (pull GHCR, `.env`, up, migrations, seed, vérifs, URLs).

Séparation et sécurité : `/api/auth` + `/api/requests` exigent un JWT avocat
(8h) ; `/api/public/:token` est anonyme via lien + PIN bcrypt, avec session
publique courte (JWT 15min scopé à un seul token), rate-limit 5/min sur
`unlock` et lockout 15min après 5 échecs. Les fichiers transitent en PUT
direct browser → MinIO (URL presignée 5min signée sur le host public) :
**rien n'est écrit sur le disque de l'API**. Validation stricte des DTO,
CORS fermé, secrets en `.env` uniquement (jamais committés).

## Modules backend

| Module | Responsabilité |
| --- | --- |
| `auth` | Connexion avocat, JWT et protection des routes privées. |
| `requests` | Création, modification, suivi des demandes (CRUD avocat). |
| `public-deposit` | Déverrouillage PIN, session publique courte, presign/complete/list/delete/download. |
| `storage` | Intégration MinIO/S3, URLs presignées, CORS bucket. |
| `metrics` | Métriques Prometheus et signaux opérationnels. |
| `prisma` | Modèle de données, migrations et seed. |

## Modèle de données

- `User` : `email` unique, `passwordHash` bcrypt.
- `DepositRequest` : `title`, `token` public unique (10 hex), `pinHash`,
  `expectedDocs`, `status` (`PENDING`/`COMPLETE`/`EXPIRED`), `expiresAt`,
  `failedAttempts` + `lockedUntil` (lockout), `userId`.
- `Document` : `requestId`, `filename`, `mime`, `size`, `s3Key` unique,
  `status` (`PENDING`/`READY`). Seuls les `READY` comptent et sont listés.
- `AuditLog` : `requestId`, `ipHash` (sha256 tronqué), `action`
  (`UNLOCK_OK`/`UNLOCK_FAIL`/`UPLOAD_OK`/`DELETE_OK`).

## Flux principal

1. L'avocat crée une demande, un token public, un PIN hashé et une date d'expiration.
2. Le client ouvre le lien et déverrouille l'accès avec le PIN (session 15min).
3. Le frontend reçoit une URL MinIO pré-signée et envoie le fichier directement au stockage objet.
4. L'API enregistre le document puis recalcule le statut de la demande.
5. Client et avocat peuvent re-télécharger (URLs presignées GET) ; le client
   peut supprimer ses pièces (S3 + ligne DB, statut recalculé).

## États de demande

- `PENDING` : lien valide, dépôt incomplet.
- `COMPLETE` : nombre de pièces attendu atteint.
- `EXPIRED` : date d'expiration dépassée (prime sur `COMPLETE`).

Le statut est recalculé à chaque lecture, persisté en cas de dérive, rebalayé
par cron toutes les 5min, et recalculé après chaque mutation (dépôt,
suppression, modification de la demande).

## Installation one-click

```bash
./install.sh                                  # pull GHCR + stack complète + URLs
GHCR_TOKEN=... IMAGE_TAG=sha-... ./install.sh # autre tag (CI pousse latest + sha)
```

Tire `ghcr.io/victoro94/portail-depot-{backend,frontend}` (login GHCR requis,
images privées), crée `.env` si absent, démarre la stack, applique migrations
et seed, vérifie le login démo, puis affiche les URLs.

Compte démo : `avocat@example.test` / `ChangeMe123!`, demande seedée PIN `1234`.
URLs affichées en fin d'install : front `:8080`, Grafana `:3001`, Prometheus
`:9090`, Alertmanager `:9093`, MinIO `:9001`.

Déploiement prod (serveur partagé, HTTPS Let's Encrypt) : voir
`infra/README.md`. URL HTTPS du sous-domaine : à compléter après déploiement.

## Stratégie de tests

- Backend, `npm test` — **87 tests Jest** (`backend/tests/`, miroir de `src/`) :
  logique pure (statuts, expiration, PIN, lockout), services sur mocks
  (auth, demandes, dépôt public, stockage, guard de session), et HTTP par
  code via supertest sur app complète (`tests/http/` : auth, requests,
  public — 200/201/400/401/403/404/429, DB fake en mémoire, S3 mocké).
- Frontend, `npm test` — **34 tests Vitest** (`frontend/tests/`) : composants
  (badges, cartes, lignes de fichier, zone de dépôt, états vides), pages
  (dashboard, dépôt public : PIN, restauration session, suppression) et
  client API (URLs, méthodes, headers d'auth).
- Non couverts (assumés) : cron en conditions réelles, PUT binaire réel vers
  MinIO (testé à la main), parcours navigateur E2E (Playwright).

## Observabilité

4 alertes Prometheus (`infra/prometheus/alert.rules.yml`), choisies parce que
chacune déclenche une action : `BackendDown` (rollback/restart), `PinBruteForce`
(lockout + audit), `UploadFailuresHigh` (MinIO/CORS), `HttpErrorsHigh` (rollback).
Métriques : trafic par route, 5xx, PIN (échecs, lockouts, connexions clients
anonymes `public_unlock_ok_total`), échecs d'upload par cause, latence p95.
Dashboard Grafana provisionné + Alertmanager qui relaie vers un sink local en dev
(à remplacer par Slack/PagerDuty en prod).

## CI/CD

- `.github/workflows/exo2-ci.yml` : à chaque push/PR, tests Jest backend (87 tests), tests Vitest frontend (34 tests), builds, validation du compose.
- `.github/workflows/exo2-docker.yml` : sur `main`, build + push des images `ghcr.io/victoro94/portail-depot-backend` et `...-frontend` (`latest` + `sha-...`). Zéro secret requis (auth via `GITHUB_TOKEN`).
- Déploiement serveur : `docker pull` des images + compose local (config seule, aucun code source sur la machine).

## Limites connues

- Pas d'antivirus sur les fichiers (vérification mime + taille + 20 Mo max uniquement).
- Pas de refresh temps réel côté avocat (bouton Actualiser manuel).
- Monitoring prod interne uniquement (tunnel SSH), pas de notification Slack/PagerDuty câblée.
- Un seul bucket MinIO exposé en path-style sous le domaine prod (`MINIO_BUCKET` doit correspondre au `location` nginx).
