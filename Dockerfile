# escrow-frontend/Dockerfile
#
# Requires output: "export" in next.config.ts (see DECISIONS.md).
# If the export attempt fails, use Dockerfile.node instead — same build
# stage, Node runtime rather than nginx.

# ---- build ----
# Node 24 to match the frontend's existing CI (backend is on 20; the
# mismatch is fine across repos, but pin it here so builds are reproducible).
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
# --ignore-scripts mirrors the existing CI step. The frontend has no
# native modules needing a postinstall (that's the backend's better-sqlite3).
RUN npm ci --ignore-scripts

COPY . .

# NEXT_PUBLIC_* are inlined into the bundle at build time. They cannot be
# changed by setting env vars on the running container — one image per
# environment, and a contract redeploy means a rebuild, not a restart.
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_CONTRACT_ID
ARG NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
ARG NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_CONTRACT_ID=$NEXT_PUBLIC_CONTRACT_ID \
    NEXT_PUBLIC_SOROBAN_RPC_URL=$NEXT_PUBLIC_SOROBAN_RPC_URL \
    NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE=$NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE

# Fail loudly rather than shipping a bundle pointing at localhost:3001.
# The || fallback in app/lib/transactions.ts makes an unset value silent,
# so catch it here where it's still cheap to catch.
RUN test -n "$NEXT_PUBLIC_BACKEND_URL" \
      || (echo "ERROR: NEXT_PUBLIC_BACKEND_URL must be set at build time" && exit 1)
RUN test -n "$NEXT_PUBLIC_CONTRACT_ID" \
      || (echo "ERROR: NEXT_PUBLIC_CONTRACT_ID must be set at build time" && exit 1)

RUN npm run build

# With output: "export", next build writes out/. Assert it, so a config
# regression surfaces here instead of as an empty nginx root.
RUN test -d /app/out || (echo "ERROR: out/ missing — is output:'export' set in next.config.ts?" && exit 1)

# ---- serve ----
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/out /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
