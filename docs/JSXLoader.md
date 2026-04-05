# JSXLoader

Node.js ESM loader registration for JSX files. Registers `JSXHook` via `node:module.register()` so that `.jsx` imports are transformed to plain JS before Node evaluates them.

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

---

### Requirements

- Node 20+ (`node:module.register()` and `--import` flag)
- `esbuild` (runtime dependency of ctg-react-test)
