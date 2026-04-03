# CTGReactTest

Composable pipeline-based test class for React. Extends `CTGTest` from `ctg-js-test` with React-specific step types and an overridden `start()` that delegates to execution formatters.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _name | STRING | Pipeline name (inherited) |
| _steps | [ctgTestStep] | Step definitions including React types (inherited) |
| _skips | [OBJECT] | Skip directives (inherited) |

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| STEP_TYPES | Set | All valid step types: stage, assert, assert-any, chain, render, interact, snapshot, renderHook |
| VALID_CONFIG_KEYS | [STRING] | Inherited keys + snapshotFilePath, snapshotFileUrl, updateSnapshots, maxSnapshotBytes |

---

### CTGReactTest.init :: STRING -> ctgReactTest

Creates a new React test pipeline. Uses late-bound construction.

```javascript
const test = CTGReactTest.init("my component test");
```

---

### ctgReactTest.render :: STRING, JSX|(() -> JSX), OBJECT? -> this

Renders a React element and wraps the result as a `ReactContext` subject. Accepts a JSX element directly or a function returning JSX (lazy evaluation). Options: `{ wrapper?, user? }`. Chainable.

```javascript
test.render("mount", React.createElement(MyComponent, { prop: "value" }));
```

---

### ctgReactTest.interact :: STRING, (* -> *|PROMISE(*)) -> this

Convenience stage for user interactions. Receives `ReactContext`, must return it. Validates that `ctx.user` is not null (throws `INVALID_STEP` if `@testing-library/user-event` is not installed). Chainable.

```javascript
test.interact("click submit", async (ctx) => {
    await ctx.user.click(ctx.screen.getByText("Submit"));
    return ctx;
});
```

---

### ctgReactTest.renderHook :: STRING, (() -> *), OBJECT? -> this

Renders a hook in isolation. The hook return value is stored as `ctx.data.result` (a ref — `result.current` reflects latest value after rerenders). Options: `{ wrapper? }`. Chainable.

```javascript
test.renderHook("mount", () => useCounter(0));
// Later: ctx.data.result.current.count
```

---

### ctgReactTest.snapshot :: STRING, ((ReactContext) -> *)?, OBJECT? -> this

Snapshot assert. The extraction function defaults to `(ctx) => ctx.container.innerHTML`. Options: `{ sanitize? }` for redacting sensitive content before storage. Chainable.

```javascript
test.snapshot("rendered html");
test.snapshot("text only", (ctx) => ctx.container.textContent);
test.snapshot("safe", null, { sanitize: (html) => html.replace(/token/g, "REDACTED") });
```

---

### ctgReactTest.start :: *, OBJECT? -> PROMISE(STRING|OBJECT|VOID)

Executes the pipeline. Runs validation first (config, steps, skips). If an execution formatter is configured, delegates to it. Otherwise runs standalone with cleanup in `finally`.

```javascript
// Standalone
const report = await test.start(null, { output: "return-json" });

// With formatter
const formatter = new CTGVitestFormatter();
await test.start(null, { formatter });
const report = formatter.getReport();
```

---

### Inherited Methods

All methods from `CTGTest`: `stage`, `assert`, `assertAny`, `chain`, `skip`, `compare`. See ctg-js-test documentation.

---

### CTGReactTest._compareSnapshot :: STRING, STRING, *, OBJECT? -> {match: BOOL, stored?: *}

Static. Reads stored snapshot by file path and step path, compares with actual value. Writes on first run. Options: `{ maxSnapshotBytes?, updateSnapshots? }`.

---

### CTGReactTest._updateSnapshot :: STRING, STRING, * -> VOID

Static. Writes a snapshot value to file, overwriting any existing value for that key.
