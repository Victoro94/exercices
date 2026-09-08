#!/usr/bin/env bash
# Installation one-click depuis le registre : aucun build, les images
# backend/frontend sont tirées de GHCR (mêmes images que la prod).
# Fait tout : .env, pull, démarrage stack, migrations, seed, vérifs, URLs.
# Usage :
#   IMAGE_TAG=latest ./install.sh            # images déjà poussées par la CI
#   GHCR_TOKEN=... IMAGE_TAG=sha-abc123 ./install.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

TAG="${IMAGE_TAG:-latest}"

echo "==> 1/5 prérequis"
command -v docker >/dev/null || { echo "ERREUR: Docker introuvable."; exit 1; }
docker compose version >/dev/null || { echo "ERREUR: plugin docker compose introuvable."; exit 1; }
if ! docker info >/dev/null 2>&1; then
  echo "ERREUR: pas d'accès au daemon Docker (/var/run/docker.sock)."
  echo "  Soit tu relances avec sudo :  sudo ./install.sh"
  echo "  Soit tu ajoutes ton user au groupe docker :"
  echo "    sudo usermod -aG docker \"\$USER\" && newgrp docker"
  exit 1
fi
command -v curl >/dev/null || { echo "ERREUR: curl introuvable."; exit 1; }
command -v openssl >/dev/null || { echo "ERREUR: openssl introuvable."; exit 1; }

echo "==> 2/5 configuration (.env)"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
  sed -i "s/^GF_SECURITY_ADMIN_PASSWORD=.*/GF_SECURITY_ADMIN_PASSWORD=$(openssl rand -hex 12)/" .env
  echo "    .env créé avec secrets générés."
else
  echo "    .env existant conservé."
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> 3/5 login GHCR (images privées)"
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-victoro94}" --password-stdin
else
  echo "    GHCR_TOKEN non défini : je suppose un 'docker login ghcr.io' déjà fait."
  echo "    (sinon : export GHCR_TOKEN=<token read:packages> ou docker login ghcr.io)"
fi

echo "==> 4/5 pull ghcr.io/victoro94/portail-depot-{backend,frontend}:$TAG + démarrage"
export IMAGE_TAG="$TAG"
docker compose -f infra/docker-compose.yml pull backend frontend
docker compose -f infra/docker-compose.yml up -d

echo "==> 5/5 attente du backend (migrations + seed automatiques à son démarrage)"
for _ in $(seq 1 60); do
  if curl -sf http://localhost:3000/api/health >/dev/null; then
    echo "    backend OK."
    break
  fi
  sleep 2
  if [ "$_" = 60 ]; then
    echo "ERREUR: backend injoignable après 120s. Voir : docker compose -f infra/docker-compose.yml logs backend"
    exit 1
  fi
done

echo "==> 6/6 vérifications"
LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${DEMO_LAWYER_EMAIL:-avocat@example.test}\",\"password\":\"${DEMO_LAWYER_PASSWORD:-ChangeMe123!}\"}")
if [ "$LOGIN_CODE" = 200 ]; then
  echo "    compte démo OK (login 200)."
else
  echo "ERREUR: login démo -> HTTP $LOGIN_CODE (seed incomplet ?)."
  exit 1
fi
curl -sf http://localhost:9090/-/healthy >/dev/null && echo "    prometheus OK." || echo "    ATTENTION: prometheus pas encore prêt."
curl -sf http://localhost:3001/api/health >/dev/null && echo "    grafana OK." || echo "    ATTENTION: grafana pas encore prêt (redémarre parfois au 1er boot)."

echo
echo "=============================================="
echo " Installation terminée (images GHCR:$TAG, aucun build)."
echo "  Front (portail) : http://localhost:8080"
echo "  API health      : http://localhost:8080/api/health"
echo "  Compte démo     : ${DEMO_LAWYER_EMAIL:-avocat@example.test} / ${DEMO_LAWYER_PASSWORD:-ChangeMe123!} (PIN seed : 1234)"
echo "  Grafana         : http://localhost:3001 (admin / mot de passe dans .env GF_SECURITY_ADMIN_PASSWORD)"
echo "  Prometheus      : http://localhost:9090 (alertes : /alerts)"
echo "  Alertmanager    : http://localhost:9093"
echo "  MinIO console   : http://localhost:9001"
echo "=============================================="
