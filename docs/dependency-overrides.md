# Why three wallet SDKs are overridden to an empty package

`@creit.tech/stellar-wallets-kit` declares `@hot-wallet/sdk`,
`@trezor/connect-web`, and `@trezor/connect-plugin-stellar` as hard
dependencies so that apps which opt into the HOT or Trezor wallet modules have
them available. This app never opts in: `defaultModules()` does not include
those modules, `SUPPORTED_WALLETS` is freighter/albedo/xbull/hana only, and
nothing in `app/` imports them.

Those three packages were also the only paths to `elliptic <= 6.6.1`
(GHSA advisory, no patched release exists) and its 22 downstream audit
findings — the whole @trezor/_, @near-js/_, secp256k1, crypto-browserify tree.

The `overrides` block in package.json replaces all three with
`npm:empty-npm-package@1.0.0` (328 bytes, no dependencies, no install
scripts, pinned exact and integrity-locked in package-lock.json), which
removes the vulnerable code from the install entirely - about 340 packages.

## If you want to enable the HOT or Trezor wallet later

1. Delete the three `npm:empty-npm-package` overrides from `package.json`.
2. `rm -rf node_modules package-lock.json && npm install`.
3. Import the module explicitly (e.g. `TrezorModule`) and add it to the kit
   module list in `app/context/WalletContext.tsx` — accepting that this
   reintroduces the unfixed `elliptic` advisories.
