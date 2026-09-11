# Infrastructure

Stack complète via `docker-compose.yml` :
- `postgres`, `minio`, `backend` (migrate + seed au boot), `frontend` (nginx, proxy `/api`).
- Observabilité : `prometheus` (scrape `/api/metrics`, règles `prometheus/alert.rules.yml`),
  `alertmanager` (relaye vers `alert-sink` en dev), `grafana` (datasource + dashboard provisionnés).

```bash
./install.sh   # one-click depuis la racine : .env, build, up, vérifs, URLs
# ou à la main :
cd infra
cp ../.env.example ../.env   # renseigne les secrets
docker compose up --build
# Front : http://localhost:8080
# API via front : http://localhost:8080/api/health
# Backend direct : http://localhost:3000/api/health
# MinIO console : http://localhost:9001
# Prometheus : http://localhost:9090 (/alerts pour voir les alertes)
# Alertmanager : http://localhost:9093
# Grafana : http://localhost:3001 (admin / GF_SECURITY_ADMIN_PASSWORD)
```

Le `command` du backend fait `migrate deploy + seed + node dist/main` pour avoir
directement le compte démo (`avocat@example.test` / `ChangeMe123!`, PIN `1234`).

## Déploiement HTTPS (serveur partagé)

Pré-requis reçus par email : compte, sous-domaine, plage de 100 ports.
Sur le serveur, seule la **config** vit (jamais de code source) :

```bash
# 1. Config seule + login GHCR (images privées)
git clone <repo> && cd exo2-portail-depot
cp .env.example .env   # renseigner SUBDOMAIN, LE_EMAIL, HTTP_PORT (1er port),
                       # HTTPS_PORT (2e port), secrets, IMAGE_TAG
echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin

# 2. Certificat : staging d'abord (illimité), prod ensuite (quotas LE)
LE_STAGING=1 ./infra/certbot-init.sh   # vérifie http://$SUBDOMAIN
LE_STAGING=0 ./infra/certbot-init.sh   # passe en prod une fois que ça répond

# 3. Renouvellement auto (cron)
# 0 3 * * * /chemin/exo2-portail-depot/infra/renew.sh >> /var/log/portail-renew.log 2>&1
```

Détails : `nginx.prod.conf` termine TLS (cert `--cert-name portail`, HSTS,
`client_max_body_size 25m`), proxy `/api` vers le backend, sert le front, et
expose le bucket MinIO en path-style sous le même domaine (les URLs presignées
restent valides : host = domaine, chemin préservé). Les ports publiés sont
bindés `127.0.0.1` dans ta plage : seul le proxy frontal voit ton nginx.
Monitoring exposé sous le même domaine (sans tunnel) : `/grafana/`,
`/prometheus/`, `/alertmanager/`, `/minio-console/`, protégés par basic-auth
commune (`monitoring.htpasswd`, user `admin`) + logins natifs Grafana
(`admin`/`GF_SECURITY_ADMIN_PASSWORD`) et MinIO console. Redéploiement :
`docker compose -f infra/docker-compose.prod.yml up -d --pull always` puis
`exec frontend nginx -s reload`.
