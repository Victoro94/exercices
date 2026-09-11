#!/usr/bin/env bash
# Recharge la prod SANS réémettre de certificat (à l'inverse de certbot-init.sh).
# Fait : validation compose, up -d, nginx -t, nginx -s reload, healthchecks.
# Usage :
#   ./infra/reload-prod.sh                # recharge à images figées
#   ./infra/reload-prod.sh --pull always  # + tire les dernières images GHCR
set -euo pipefail

INFRA="$(cd "$(dirname "$0")" && pwd)"
cd "$INFRA"

# Charger le .env racine AVANT tout appel compose (comme certbot-init.sh) :
# compose cherche sinon un .env dans infra/ et les ${VAR:?...} échouent.
if [ ! -f ../.env ]; then
  echo "ERREUR: ../.env introuvable (lancer depuis la racine du repo)."
  exit 1
fi
set -a
# shellcheck disable=SC1091
source ../.env
set +a

COMPOSE=(docker compose -f docker-compose.prod.yml)

echo "==> 1/5 validation compose (interpolations SUBDOMAIN/ports/secrets)"
"${COMPOSE[@]}" config -q
echo "    compose OK."

echo "==> 2/6 demarrage dependances (sans certonly)"
# shellcheck disable=SC2068
"${COMPOSE[@]}" up -d $@ postgres minio backend prometheus alertmanager alert-sink grafana

echo "==> 3/6 demarrage frontend (upstreams DNS prets)"
"${COMPOSE[@]}" up -d frontend

echo "attente frontend running (30s max)"
for i in $(seq 1 30); do
  CID=$("${COMPOSE[@]}" ps -q frontend 2>/dev/null || true)
  if [ -n "$CID" ] && [ "$(docker inspect -f '{{.State.Running}}' "$CID" 2>/dev/null || echo false)" = "true" ]; then
    echo "    frontend running."
    break
  fi
  sleep 2
  if [ "$i" = 30 ]; then
    echo "ERREUR: frontend non demarre. Logs :"
    "${COMPOSE[@]}" logs frontend --tail=60 || true
    exit 1
  fi
done

echo "==> 4/6 test nginx"
if ! "${COMPOSE[@]}" exec -T frontend nginx -t; then
  echo "ERREUR nginx -t. Logs :"
  "${COMPOSE[@]}" logs frontend --tail=60 || true
  exit 1
fi

echo "==> 5/6 reload nginx (sans coupure)"
if ! "${COMPOSE[@]}" exec -T frontend nginx -s reload; then
  echo "ERREUR nginx reload. Logs :"
  "${COMPOSE[@]}" logs frontend --tail=60 || true
  exit 1
fi

echo "==> 6/6 sante"
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
