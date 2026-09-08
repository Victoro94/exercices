#!/usr/bin/env bash
# Renouvellement automatique : à mettre en cron sur le serveur.
#   0 3 * * * /chemin/exo2-portail-depot/infra/renew.sh >> /var/log/portail-renew.log 2>&1
# Renouvelle si <30j d'expiration, recharge nginx pour prendre en compte le cert.
set -euo pipefail

INFRA="$(cd "$(dirname "$0")" && pwd)"
cd "$INFRA"

docker run --rm \
  -v portail-certs:/etc/letsencrypt \
  -v portail-web:/var/www/certbot \
  certbot/certbot:v2.11.0 renew --webroot -w /var/www/certbot --non-interactive

docker compose -f docker-compose.prod.yml exec -T frontend nginx -s reload
echo "$(date -u +%FT%TZ) renew OK"
