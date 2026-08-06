# JSXLoader

Node.js ESM loader registration. Registers `JSXHook` via `node:module.register()` so that the imports a React component contains — JSX, TypeScript, CSS Modules, and `?raw` text assets — resolve before Node evaluates them.

This is the entry point for `--import`. It does not transform files itself — it registers `JSXHook` as the loader hook.

---

### Usage

From the command line:

```
node --import ctg-react-test/jsx-loader tests/SelfTest.js
```

In package.json:

```json
{
    "scripts": {
        "test": "node --import ctg-react-test/jsx-loader tests/SelfTest.js"
    }
}
```

The entry file itself may be `.js`, `.jsx`, `.tsx`, or `.ts` — the hook is registered before the entry is evaluated.

---

### TypeScript components

A test written in `.jsx` can import a component written in `.tsx`, and vice versa. Both are transformed by the same hook, so no build step is needed between source and test:

```
tests/Button.test.jsx   imports   src/components/Button/Button.tsx
```

Note that this transforms, it does not typecheck — esbuild strips types without verifying them. Run `tsc --noEmit` separately for that.

### Styles and assets

Component source is not limited to code. A component that imports a CSS Module or a `?raw` asset is loadable too:

```
import styles from "./Button.module.css";   // styles.root === "root"
import svg from "./icons/undo.svg?raw";     // the file's text
```

Without this, testing any component that has styles would require running the suite through a bundler.

---

### Requirements

- Node 20+ (`node:module.register()` and `--import` flag)
- `esbuild` (runtime dependency of ctg-react-test)
