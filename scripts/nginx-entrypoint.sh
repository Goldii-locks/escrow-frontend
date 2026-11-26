#!/bin/sh
# nginx entrypoint (#811): template the CSP connect-src origins from the same
# RPC/Horizon/explorer URLs used for the build. 'self' and the wallet kit's
# origins are always included; adding a new wallet provider must be accompanied
# by a docs/csp-origins.md update.
set -eu

origin() {
  # scheme://host[:port] from a URL, ignoring path/query
  printf '%s' "$1" | sed -nE 's#^([a-zA-Z][a-zA-Z0-9+.-]*://[^/]+).*#\1#p'
}

rpc=$(origin "${NEXT_PUBLIC_SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}")
horizon=$(origin "${NEXT_PUBLIC_HORIZON_URL:-https://horizon-testnet.stellar.org}")
explorer=$(origin "${NEXT_PUBLIC_EXPLORER_URL:-https://stellar.expert}")

# Wallet kit origins: WalletConnect relay + verify, LOBSTR and Albedo popups.
wallet_origins="wss://relay.walletconnect.com https://verify.walletconnect.com https://lobstr.co https://albedo.link"

CSP_CONNECT_ORIGINS="'self' $rpc $horizon $explorer $wallet_origins"
export CSP_CONNECT_ORIGINS

envsubst '$CSP_CONNECT_ORIGINS' \
  < /etc/nginx/templates/csp-origins.conf.template \
  > /etc/nginx/csp-origins.conf

exec "$@"
