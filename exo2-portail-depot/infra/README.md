# Infrastructure

Stack locale de test : `docker-compose.yml` (postgres + minio + backend + frontend nginx qui proxy `/api`).
La partie prod (Prometheus, Grafana, TLS Let's Encrypt) arrivera ensuite.

```bash
cd infra
cp ../.env.example ../.env   # renseigne les secrets
docker compose up --build
# Front : http://localhost:8080
# API via front : http://localhost:8080/api/health
# Backend direct : http://localhost:3000/api/health
# MinIO console : http://localhost:9001
```

Le `command` du backend fait `migrate deploy + seed + node dist/main` pour avoir
directement le compte démo (`avocat@example.test` / `ChangeMe123!`, PIN `1234`).
