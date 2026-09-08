#!/usr/bin/env bash
# Premier certificat Let's Encrypt (serveur partagé).
# 1. Monte nginx en HTTP seul (challenges ACME).
# 2. Obtient le certificat (--cert-name portail, nom fixe attendu par nginx.prod.conf).
# 3. Redémarre la stack complète en TLS.
# Itère avec LE_STAGING=1 jusqu'à ce que ça passe, puis LE_STAGING=0.
# Requiert dans .env : SUBDOMAIN, LE_EMAIL, HTTP_PORT (+ LE_STAGING).
set -euo pipefail

INFRA="$(cd "$(dirname "$0")" && pwd)"
cd "$INFRA"

set -a
# shellcheck disable=SC1091
source ../.env
set +a

: "${SUBDOMAIN:?SUBDOMAIN manquant dans .env}"
: "${LE_EMAIL:?LE_EMAIL manquant dans .env}"
: "${HTTP_PORT:?HTTP_PORT manquant dans .env}"

STAGING_FLAG=()
if [ "${LE_STAGING:-1}" = 1 ]; then
  echo "==> mode STAGING (essais illimités, certificat non reconnu)."
  STAGING_FLAG=(--staging)
else
  echo "==> mode PRODUCTION (quotas LE limités, ne lancer que si le staging passe)."
fi

echo "==> 1/3 nginx bootstrap (HTTP seul)"
docker compose -f docker-compose.prod.yml -f docker-compose.bootstrap.yml up -d frontend
sleep 5

echo "==> 2/3 certbot certonly (webroot)"
docker run --rm \
  -v portail-certs:/etc/letsencrypt \
  -v portail-web:/var/www/certbot \
  certbot/certbot:v2.11.0 certonly --webroot \
  -w /var/www/certbot \
  -d "$SUBDOMAIN" \
  --cert-name portail \
  --email "$LE_EMAIL" --agree-tos --non-interactive \
  "${STAGING_FLAG[@]}"

echo "==> 3/3 bascule TLS complète"
docker compose -f docker-compose.prod.yml -f docker-compose.bootstrap.yml down
docker compose -f docker-compose.prod.yml up -d --pull always

echo
echo "Vérifie : https://$SUBDOMAIN (attends ~30s le boot backend)"
echo "Puis : curl -sv https://$SUBDOMAIN/api/health -o /dev/null"
