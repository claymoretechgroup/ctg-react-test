# JSXHook

ESM loader hook that transforms `.jsx` imports via esbuild. Registered by `JSXLoader` — not used directly.

When Node loads a `.jsx` file, this hook intercepts the load, reads the source, transforms it through `esbuild.transformSync` with `loader: "jsx"`, `format: "esm"`, `jsx: "automatic"`, and returns the transformed source as an ES module.

---

### load :: STRING, OBJECT, FUNCTION -> OBJECT

Intercepts `.jsx` file loads. For non-`.jsx` files, delegates to the next loader unchanged.

The `jsx: "automatic"` option uses the React 17+ JSX transform — components do not need `import React from "react"`.

---

### Dependencies

- `esbuild` — used for `transformSync`
