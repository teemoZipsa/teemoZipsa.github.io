# Vendored browser dependencies

These files are pinned so fonts, PDF/QR processing, and AI inference do not
execute code or download assets from a third-party CDN at runtime.

## Fonts

- `Pretendard` 1.3.9: OFL-1.1, 2,057,688-byte Korean/Latin variable WOFF2.
  Upstream npm integrity:
  `sha512-PaQAADyLY5v4kYFwkpSJHbSSYIkiriY/1xXw75TKoZ9UQQqeU+tvP05yTdZAWibiIYoo8ZKtRv8PM7w0IaywSw==`.
  `PretendardVariable.woff2` SHA-256:
  `9599F12FD42FC0BCE1CD50B47A0C022E108D7AA64DD0D1BB0ED44F3282D900B4`.
- `@fontsource-variable/inter` 5.2.8: OFL-1.1, split into the upstream
  48,256-byte Latin and 85,068-byte Latin Extended variable WOFF2 files.
  Upstream npm integrity:
  `sha512-kOfP2D+ykbcX/P3IFnokOhVRNoTozo5/JxhAIVYLpea/UBmCQ/YWPBfWIDuBImXX/15KH+eKh4xpEUyS2sQQGQ==`.
  The respective SHA-256 values are
  `3100E775E8616CD2611BEECFA23A4263D7037586789B43F035236A2E6FBD4C62` and
  `34B9C504CAB7A73E37B746343A449132E56CF7B5481AF2CB81DC74DCFF25C956`.

The unmodified OFL license files are stored beside the font files. The shared
theme uses `font-display: swap`; font failure therefore falls back to the
system font without blocking page content.

## PDF libraries

- `pdf-lib` 1.17.1: MIT, 525,099-byte browser bundle. Upstream npm integrity:
  `sha512-V/mpyJAoTsN4cnP31vc0wfNA1+p20evqqnap0KLoRUN0Yk/p3wN52DOEsL4oBFcLdb76hlpKPtzJIgo67j/XLw==`.
- `pdfjs-dist` 4.2.67: Apache-2.0, 336,617-byte browser module and
  1,339,625-byte module worker. This is the first upstream release that fixes
  CVE-2024-4367/GHSA-wgrm-67xf-hhpq; the viewer also explicitly sets
  `isEvalSupported: false` as defense in depth. Upstream npm integrity:
  `sha512-rJmuBDFpD7cqC8WIkQUEClyB4UAH05K4AsyewToMTp2gSy3Rrx8c1ydAVqlJlGv3yZSOrhEERQU/4ScQQFlLHA==`.

The unmodified upstream license files are stored beside each bundle.

Vendored SHA-256 values: `pdf-lib.min.js`
`0F9A5CAD07941F0826586C94E089D89B918C46E5C17CF2D5A3C6F666E3BC694F`,
`pdf.min.mjs` `C3CAAE2CF1FE9D6E25588D0D239D02454422778ED5897314981496A4656EAB82`,
and `pdf.worker.min.mjs`
`EE61DE6DD3EFFD826B7083739409E50BAE43C2E41A896F27EA8DD2D77E2F349B`.

## QR library

- `qrcode-generator` 1.4.4: MIT, 56,694-byte browser bundle. It is self-hosted
  and pre-cached by the service worker, so QR generation no longer depends on
  jsDelivr. Upstream npm integrity:
  `sha512-HM7yY8O2ilqhmULxGMpcHSF1EhJJ9yBj8gvDEuZ6M+KGJ0YY2hKpnXvRD+hZPLrDVck3ExIGhmPtSdcjC+guuw==`.
- `qrcode.js` SHA-256:
  `18AE399F81182BC9DE916E9C77B195DF20CC58D6F2D55A62B085A299F1BF1780`.

## IMG.LY background removal

- `@imgly/background-removal` 1.5.5: AGPL-3.0, bundled locally from the
  published npm module with esbuild 0.25.8. The readable ESM bundle is
  1,909,018 bytes after the local CSP compatibility rebuild described below.
  The package records Git commit
  `c9f7e5cad4c6cb7ecb20585509f1f2a727fb3e7a`. Upstream npm integrity:
  `sha512-tULjwGmuPTUCWVQsP2KpSOEv7/mNGQhULM3WEe+eap1nmobGkQp3Gwj3gmVK7mw/b9FSzoM5nD4pJdvffYmr5A==`.
- `background-removal.bundle.js.map` is the corresponding 4,816,646-byte
  source map for the deployed bundle. All 266 mapped inputs have embedded
  `sourcesContent`, including the 11 IMG.LY source files and the exact local
  `ndarray-csp.cjs` replacement. Source identifiers use stable `npm/`,
  `csp-safe-ndarray:`, `nodejs-ignore:`, or `proxy-worker:` names rather than a
  builder's temporary absolute path.
- The bundle SHA-256 is
  `8653F52CBEE8BF9831E984BFCB8B3B697BFA23595D08BF2103CC8B49CED1B09C`;
  the source-map SHA-256 is
  `DF5706323B15E1F5110081BD7CFF23AFB0D578A0183B0F939BA995DF9BAE0C3B`.
- The self-hosted data is the official 1.5.5 data package, reduced only to the
  44,348,940-byte `isnet_quint8` model and four CPU WASM variants totaling
  40,879,802 bytes. The original 299,555,170-byte package archive had SHA-256
  `DB508F8F7F0FC742BC0801B677596430FA3028069DDC8162936231012F6FA86B`.
- IMG.LY's data package identifies ONNX Runtime Web and the ISNET model as MIT.
  The original AGPL license and both third-party-license manifests are stored
  beside the code and data.
- The exact bundle dependency versions are ONNX Runtime Web 1.18.0, zod
  3.25.76, ndarray 1.0.19, iota-array 1.0.0, is-buffer 1.1.6, and the Lodash
  4.17.21 code embedded by the upstream package. These are MIT-licensed; their
  license texts are retained under `imgly-background-removal/1.5.5/licenses/`.
- `ndarray` 1.0.19 normally creates specialized views with `new Function()`.
  The checked-in `ndarray-csp.cjs` replacement implements the required view
  operations without string evaluation, allowing the page to keep
  `unsafe-eval` out of `script-src`. `build.mjs` aliases the npm import to that
  source and emits both deployed artifacts; `CSP-PATCH.md` explains the
  compatibility boundary. Their respective SHA-256 values are
  `5CFBCCE4A73BABE5679A5B438EC8FEEFAD991FCB25466A9666F79A8A23159901`,
  `5A8711861C5501691F16368FDE67338B9E3F2C0B94FC478DFDA6069532DF1FAC`,
  and `63388E7BDD1C11DB0CC4CD5B2AEE213BC36236D9C5AE06181516C353F4CC87B5`.

### Version and advisory rationale

The deployed 1.5.5 code/model/WASM set remains pinned because it is an
85-megabyte, browser-tested compatibility unit. The current 1.7.0 package
still declares `lodash-es ^4.17.21`, so a code-only upgrade does not by itself
close the Lodash advisory records and would require rebuilding and retesting
the worker plus model/data paths. In the deployed IMG.LY source, Lodash is
imported only for `memoize`; there is no call to `_.template`, dynamic Lodash
method-path lookup, or attacker-controlled module loading, so the known
template/import advisories have no demonstrated reachable path here. This is
a documented reachability assessment, not a claim that the embedded package
has no advisories. The vendor audit reports these acknowledged records and
fails on any new, unacknowledged advisory; a 1.7.x migration should be done as
a separately browser-tested bundle/data update.

Reproducible bundle procedure (run in a disposable empty build directory; the
script writes the two artifacts into this vendor directory):

```powershell
npm init -y
npm install --save-exact @imgly/background-removal@1.5.5 onnxruntime-web@1.18.0 zod@3.25.76 ndarray@1.0.19 iota-array@1.0.0 is-buffer@1.1.6 lodash-es@4.17.21 esbuild@0.25.8
node C:\path\to\repo\special-chars\vendor\imgly-background-removal\1.5.5\build.mjs
```

After rebuilding, run `npm run audit:vendor:integrity` from the repository
root to compare every pin and source-map input, then run
`npm run audit:background-inference`. The latter performs a real 64×64 PNG
inference under the deployed CSP in both Chromium and Firefox and rejects
third-party resource requests; it is intentionally opt-in because each engine
exercises roughly 56.9MB of its active model/WASM path (the complete pinned
compatibility unit is about 85MB). Windows Playwright WebKit remained at the
model-loading stage for eight minutes, so real Safari inference remains a
separate Apple-hardware verification boundary rather than a passing automated
claim.

The service worker's vendor cache is immutable cache-first. This CSP rebuild
keeps the upstream `1.5.5` URL, so `VENDOR_CACHE_NAME` was advanced to v2 to
evict the pre-patch bundle for existing visitors. Any future byte change at an
already deployed vendor URL must advance that cache generation as part of the
same change.

Upstream source: <https://github.com/imgly/background-removal-js/tree/c9f7e5cad4c6cb7ecb20585509f1f2a727fb3e7a>
