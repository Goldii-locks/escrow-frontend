#!/usr/bin/env bash
# Serves out/ with the production nginx.conf routing rules for the smoke
# suite. TLS, the HTTP->HTTPS redirect server and the backend hostname are
# stripped so the config runs standalone; every location block is unchanged.
set -euo pipefail
cd "$(dirname "$0")/.."

conf=e2e/.nginx.generated.conf
awk '
  /^server \{/ { srv++ }
  srv == 1 { if (/^\}/) srv++; next }   # drop the port-80 redirect server
  /ssl_/ { next }
  { sub(/listen 443 ssl;/, "listen 80;"); sub(/server backend:3001;/, "server 127.0.0.1:3001;"); print }
' nginx.conf > "$conf"

docker rm -f escrow-smoke >/dev/null 2>&1 || true
docker run -d --name escrow-smoke -p 8080:80 \
  -v "$PWD/out:/usr/share/nginx/html:ro" \
  -v "$PWD/$conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine >/dev/null

for _ in $(seq 1 30); do
  curl -sf http://127.0.0.1:8080/healthz >/dev/null && exit 0
  sleep 1
done
docker logs escrow-smoke
exit 1
