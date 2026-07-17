# CSP-safe ndarray constructor patch

The upstream `ndarray` 1.0.19 dependency builds dimension-specific view
constructors with `new Function()`. That requires the broad `unsafe-eval` CSP
permission before IMG.LY even begins inference.

`ndarray-csp.cjs` is the maintained replacement source. `build.mjs` aliases
the upstream `ndarray` import to that file while rebuilding IMG.LY, so both the
bundle and its external source map correspond to the deployed code. The
replacement implements the ndarray view surface used by IMG.LY (`index`,
`get`, `set`, `hi`, `lo`, `step`, `transpose`, `pick`, `size`, and `order`)
without evaluating strings.

The patch exists so the background-removal pages can keep
`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` without adding
`unsafe-eval`. Run the real small-image inference regression after any bundle,
ndarray, or IMG.LY version change.
