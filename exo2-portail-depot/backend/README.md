# Backend

API NestJS organisée par domaines métier : authentification, demandes de dépôt, accès public, stockage objet et métriques.

## REST

| Méthode | Route | Accès |
| --- | --- | --- |
| `POST` | `/api/auth/login` | public, retourne JWT avocat 8h |
| `POST` | `/api/requests` | JWT avocat |
| `GET` | `/api/requests` | JWT avocat, statuts recalculés |
| `GET` | `/api/requests/:id` | JWT avocat |
| `DELETE` | `/api/requests/:id` | JWT avocat |
| `GET` | `/api/public/:token` | anonyme, meta sans pinHash |
| `POST` | `/api/public/:token/unlock` | anonyme, rate-limit 5/min, retourne session 15min |
| `POST` | `/api/public/:token/files/presign` | session publique, retourne URL MinIO presignée 5min |
| `POST` | `/api/public/:token/files/:id/complete` | session publique, vérifie objet puis passe READY |
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
npm test
npm run build
npm run start:dev      # nécessite Postgres + MinIO joignables (voir .env)
```
