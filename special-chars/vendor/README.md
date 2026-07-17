# Vendored browser dependencies

These files are pinned so PDF processing and AI inference do not execute code or
download models from a third-party CDN at runtime.

## PDF libraries

- `pdf-lib` 1.17.1: MIT, 525,099-byte browser bundle. Upstream npm integrity:
  `sha512-V/mpyJAoTsN4cnP31vc0wfNA1+p20evqqnap0KLoRUN0Yk/p3wN52DOEsL4oBFcLdb76hlpKPtzJIgo67j/XLw==`.
- `pdfjs-dist` 3.11.174: Apache-2.0, 320,004-byte browser bundle and
  1,087,212-byte worker. Upstream npm integrity:
  `sha512-TdTZPf1trZ8/UFu5Cx/GXB7GZM30LT+wWUNfsi6Bq8ePLnb+woNKtDymI2mxZYBpMbonNFqKmiz684DIfnd8dA==`.

The unmodified upstream license files are stored beside each bundle.

Vendored SHA-256 values: `pdf-lib.min.js`
`0F9A5CAD07941F0826586C94E089D89B918C46E5C17CF2D5A3C6F666E3BC694F`,
`pdf.min.js` `5B5799E6F8C680663207AC5B42EE14EED2A406FA7AF48F50C154F0C0B1566946`,
and `pdf.worker.min.js`
`FEABDF309770ED24BBA31A5467836CDC8CF639C705AF27D52B585B041BB8527B`.

## IMG.LY background removal

- `@imgly/background-removal` 1.5.5: AGPL-3.0, bundled locally from the
  published npm module with esbuild 0.25.8. The readable ESM bundle is
  1,913,209 bytes. The package records Git commit
  `c9f7e5cad4c6cb7ecb20585509f1f2a727fb3e7a`. Upstream npm integrity:
  `sha512-tULjwGmuPTUCWVQsP2KpSOEv7/mNGQhULM3WEe+eap1nmobGkQp3Gwj3gmVK7mw/b9FSzoM5nD4pJdvffYmr5A==`.
- `background-removal.bundle.js.map` is a 4,830,568-byte source map with
  embedded source content for all 268 bundled inputs, including the 11 IMG.LY
  source files, so the deployed bundle remains inspectable and modifiable.
- The bundle SHA-256 is
  `D0F0537B3A7090EBC4D3290BD66A67D061B49E191CFF50E5BF29F0F26B6E5BCE`;
  the source-map SHA-256 is
  `2A52AA25E8F626048C10D025B1A8BB1FC6AFFD44121FF537DBED564CB0E81C20`.
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

Bundle command:

```powershell
npm install --save-exact @imgly/background-removal@1.5.5 onnxruntime-web@1.18.0 zod@3.25.76 ndarray@1.0.19 iota-array@1.0.0 is-buffer@1.1.6 esbuild@0.25.8
npx esbuild node_modules/@imgly/background-removal/dist/index.mjs --bundle --format=esm --platform=browser --target=es2020 --outfile=background-removal.bundle.js --legal-comments=eof --sourcemap=external
```

Upstream source: <https://github.com/imgly/background-removal-js/tree/c9f7e5cad4c6cb7ecb20585509f1f2a727fb3e7a>
