# JSXHook

ESM loader hook that makes the imports a React component file actually contains loadable by Node: JSX, TypeScript, CSS Modules, and `?raw` text assets. Registered by `JSXLoader` — not used directly.

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

### CSS imports

A stylesheet has no runtime meaning under Node, but the import must still resolve or no component with styles can be tested at all.

| Import | Resolves to |
|---|---|
| `*.module.css` | a proxy whose every property returns its own key, so `styles.root` is `"root"` |
| any other `.css` | an empty object |

Real bundlers hash CSS Module class names, so nothing may depend on the value and tests must never assert on a class name.

### ?raw imports

`import svg from "./icon.svg?raw"` resolves to the file's text as the default export, mirroring the convention bundlers use for importing an asset's contents as a string. Applies to any extension.

### Dependencies

- `esbuild` — used for `transformSync`
