# escrow-frontend/Dockerfile
#
# Requires output: "export" in next.config.ts.

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
# No defaults for the network pair: a mainnet build that forgot them would
# otherwise silently ship a testnet-wired bundle.
ARG NEXT_PUBLIC_SOROBAN_RPC_URL
ARG NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_CONTRACT_ID=$NEXT_PUBLIC_CONTRACT_ID \
    NEXT_PUBLIC_SOROBAN_RPC_URL=$NEXT_PUBLIC_SOROBAN_RPC_URL \
    NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE=$NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE

# Reject a plain-HTTP remote backend (mixed content on the HTTPS site).
# Empty is allowed: the app uses same-origin relative /api (nginx proxies it).
# Local http:// loopback URLs are allowed for local docker/dev builds.
RUN case "$NEXT_PUBLIC_BACKEND_URL" in \
      ""|https://*|http://localhost|http://localhost:*|http://localhost/*|http://127.0.0.1|http://127.0.0.1:*|http://127.0.0.1/*|http://\[::1\]|http://\[::1\]:*|http://\[::1\]/*) ;; \
      *) echo "ERROR: NEXT_PUBLIC_BACKEND_URL must start with https:// (got \"$NEXT_PUBLIC_BACKEND_URL\"). Use https://, a localhost URL for local dev, or leave it empty to use same-origin /api." && exit 1 ;; \
    esac
RUN test -n "$NEXT_PUBLIC_CONTRACT_ID" \
      || (echo "ERROR: NEXT_PUBLIC_CONTRACT_ID must be set at build time" && exit 1)
RUN test -n "$NEXT_PUBLIC_SOROBAN_RPC_URL" \
      || (echo "ERROR: NEXT_PUBLIC_SOROBAN_RPC_URL must be set at build time" && exit 1)
RUN test -n "$NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE" \
      || (echo "ERROR: NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE must be set at build time" && exit 1)
# The passphrase must be a known network, and the RPC host must agree with it.
RUN case "$NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE" in \
      "Test SDF Network ; September 2015") \
        echo "$NEXT_PUBLIC_SOROBAN_RPC_URL" | grep -q testnet \
          || (echo "ERROR: testnet passphrase but RPC URL is not a testnet host" && exit 1) ;; \
      "Public Global Stellar Network ; September 2015") \
        ! echo "$NEXT_PUBLIC_SOROBAN_RPC_URL" | grep -q testnet \
          || (echo "ERROR: public passphrase but RPC URL is a testnet host" && exit 1) ;; \
      *) echo "ERROR: unknown NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE" && exit 1 ;; \
    esac

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
