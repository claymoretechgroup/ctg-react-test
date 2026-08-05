# JSXHook

ESM loader hook that transforms `.jsx`, `.tsx`, and `.ts` imports via esbuild. Registered by `JSXLoader` — not used directly.

When Node loads a file with one of those extensions, this hook intercepts the load, reads the source, transforms it through `esbuild.transformSync` with `format: "esm"` and `jsx: "automatic"`, and returns the transformed source as an ES module. The esbuild loader is chosen by extension:

| Extension | esbuild loader |
|---|---|
| `.jsx` | `jsx` |
| `.tsx` | `tsx` |
| `.ts` | `ts` |

---

### load :: STRING, OBJECT, FUNCTION -> OBJECT

Intercepts loads for the extensions above. Everything else delegates to the next loader unchanged.

The `jsx: "automatic"` option uses the React 17+ JSX transform — components do not need `import React from "react"`.

---

### Why TypeScript is handled here

Node can strip type annotations from `.ts` natively, so handling `.ts` may look redundant. It is not:

- **Node's type stripping cannot transform JSX.** Annotations are erasable — deleting `: string` leaves valid JavaScript. JSX is not: `<span>{x}</span>` has to be rewritten into a function call. So `.tsx` fails with `ERR_UNKNOWN_FILE_EXTENSION` whatever the Node version.
- **Type stripping only exists from Node 22.18**, above this package's stated Node 20 minimum. Without `.ts` handled here, a plain TypeScript module imported by a test would fail on the supported floor.

Handling all three keeps the loader self-sufficient rather than dependent on the Node version.

---

### Dependencies

- `esbuild` — used for `transformSync`
