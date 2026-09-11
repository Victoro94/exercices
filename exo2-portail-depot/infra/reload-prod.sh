#!/usr/bin/env bash
# Recharge la prod SANS réémettre de certificat (à l'inverse de certbot-init.sh).
# Fait : validation compose, up -d, nginx -t, nginx -s reload, healthchecks.
# Usage :
#   ./infra/reload-prod.sh                # recharge à images figées
#   ./infra/reload-prod.sh --pull always  # + tire les dernières images GHCR
set -euo pipefail

INFRA="$(cd "$(dirname "$0")" && pwd)"
cd "$INFRA"

COMPOSE=(docker compose -f docker-compose.prod.yml)

echo "==> 1/5 validation compose (interpolations SUBDOMAIN/ports/secrets)"
"${COMPOSE[@]}" config -q
echo "    compose OK."

echo "==> 2/5 demarrage stack (sans certonly)"
# shellcheck disable=SC2068
"${COMPOSE[@]}" up -d $@

echo "==> 3/5 test nginx"
"${COMPOSE[@]}" exec -T frontend nginx -t

echo "==> 4/5 reload nginx (sans coupure)"
"${COMPOSE[@]}" exec -T frontend nginx -s reload

echo "==> 5/5 sante"
set -a
# shellcheck disable=SC1091
source ../.env
set +a
: "${SUBDOMAIN:?SUBDOMAIN manquant dans .env}"
: "${HTTP_PORT:?HTTP_PORT manquant dans .env}"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${HTTP_PORT}/" || true)
if [ "$CODE" = 301 ]; then
  echo "    http loopback OK (301 -> https)."
else
  echo "    ATTENTION: http loopback -> $CODE (attendu 301)."
fi
if curl -skf "https://${SUBDOMAIN}/api/health" >/dev/null; then
  echo "    api OK (https://$SUBDOMAIN/api/health)."
else
  echo "ERREUR: API HS."
  exit 1
fi
for p in grafana prometheus alertmanager minio-console; do
  CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://${SUBDOMAIN}/${p}/" || true)
  case "$CODE" in
    401|302|200) echo "    /${p}/ OK (HTTP $CODE)." ;;
    *) echo "    ATTENTION: /${p}/ -> HTTP $CODE." ;;
  esac
done
"${COMPOSE[@]}" ps
echo "Reload prod OK (aucun certificat reemis)."
