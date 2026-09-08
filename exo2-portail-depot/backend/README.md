# Backend

API NestJS organisée par domaines métier : authentification, demandes de dépôt, accès public, stockage objet et métriques.

## REST

| Méthode | Route | Accès |
| --- | --- | --- |
| `POST` | `/api/auth/login` | public, retourne JWT avocat 8h |
| `POST` | `/api/requests` | JWT avocat |
| `GET` | `/api/requests` | JWT avocat, statuts recalculés |
| `GET` | `/api/requests/:id` | JWT avocat, détail + documents |
| `PATCH` | `/api/requests/:id` | JWT avocat, modifie titre/pièces/expiration, recalcule le statut |
| `GET` | `/api/requests/:id/files` | JWT avocat, pièces déposées (ownership vérifiée) |
| `GET` | `/api/requests/:id/files/:fileId/download` | JWT avocat, URL presignée |
| `DELETE` | `/api/requests/:id` | JWT avocat |
| `GET` | `/api/public/:token` | anonyme, meta sans pinHash |
| `POST` | `/api/public/:token/unlock` | anonyme, rate-limit 5/min, retourne session 15min |
| `POST` | `/api/public/:token/files/presign` | session publique, retourne URL MinIO presignée 5min |
| `POST` | `/api/public/:token/files/:id/complete` | session publique, vérifie objet puis passe READY |
| `GET` | `/api/public/:token/files` | session publique, fichiers déjà déposés |
| `DELETE` | `/api/public/:token/files/:id` | session publique, supprime S3 + ligne, recalcule statut |
| `GET` | `/api/public/:token/files/:id/download` | session publique, URL presignée de re-téléchargement |
| `GET` | `/api/health` | public |
| `GET` | `/api/metrics` | Prometheus |

Upload direct browser -> MinIO en PUT presigné, jamais sur disque API.
Statuts : `PENDING` / `COMPLETE` (>= expectedDocs) / `EXPIRED` (now > expiresAt, prime sur COMPLETE).
Lockout PIN : 5 échecs -> 15min.

## Dev

```bash
npm install
cp .env.example .env   # obligatoire, sinon DATABASE_URL manquante (P1012)
npx prisma generate
npm test               # Jest : 87 tests — logique, services mockés, HTTP par code (tests/http : auth, requests, public)
npm run build
npm run start:dev      # nécessite Postgres + MinIO joignables (voir .env)
```
