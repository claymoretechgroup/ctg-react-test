# CTGReactTest

Composable pipeline-based test class for React components. Extends `CTGTest` from `ctg-js-test`. The component is the subject — passed to `start()`, mounted implicitly via `@testing-library/react`. Pipeline steps interact with and assert against the rendered component. Cleanup runs automatically after the pipeline completes.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _label | STRING | Pipeline label (inherited) |
| _operations | [OBJECT] | Ordered operation definitions (inherited) |

---

### CONSTRUCTOR :: STRING -> ctgReactTest

Creates a new React test pipeline with the given label.

```jsx
const test = new CTGReactTest("counter test");
```

---

### CTGReactTest.init :: STRING -> ctgReactTest

Static factory. Creates a new React test pipeline with the given label.

```jsx
const test = CTGReactTest.init("counter test");
```

---

### ctgReactTest.label :: VOID -> STRING

Getter. Returns the pipeline label. Inherited from `CTGTest`.

```jsx
const name = test.label; // "counter test"
```

---

### ctgReactTest.interact :: STRING, ({screen: OBJECT, user: OBJECT} -> VOID) -> SELF

Adds an interact operation. The callback receives `{screen, user}` — the testing-library query surface and user-event instance — and returns void. Interactions are side effects (clicking, typing). Delegates internally to `stage`. Throws `INVALID_OPERATION` if the callback is not a function or if user-event is not installed. Chainable.

```jsx
test.interact("click increment", async ({screen, user}) => {
    await user.click(screen.getByText("Increment"));
});
```

---

### ctgReactTest.assertComponent :: STRING, (OBJECT -> *), * | ctgTestPredicate -> SELF

Adds an assertComponent operation. The callback receives `screen` and returns a computed value from the rendered output. The expected value is auto-wrapped in `CTGTestPredicates.equals()` if it is not already a `CTGTestPredicate` instance. Throws `INVALID_OPERATION` if the callback is not a function. Chainable.

```jsx
test.assertComponent("count is 1", (screen) =>
    screen.getByTestId("count").textContent, "1");
```

---

### ctgReactTest.assertComponentIs :: STRING, STRING | reactTestState -> SELF

Adds an assertComponentIs operation. Compares the current component's rendered HTML (`container.innerHTML`) against a STRING or a `ReactTestState` instance (calls `toHTML()` automatically). No callback — the comparison target is the entire rendered output. Throws `INVALID_OPERATION` if the container is null at execution time or if expected is not a STRING or `ReactTestState`. Chainable.

```jsx
test.assertComponentIs("matches markup", "<h1>Hello, World!</h1>");
```

---

### ctgReactTest.start :: JSX | reactTestState, OBJECT? -> PROMISE(reactTestState)

Executes the pipeline. If JSX is passed, wraps it in `ReactTestState` and mounts via `@testing-library/react.render()`. If a `ReactTestState` is passed (already mounted), skips mounting. Strips React-specific config keys (`wrapper`, `autoCleanup`) before delegating to the base pipeline. Runs RTL cleanup after all steps complete unless `autoCleanup: false`. Returns `ReactTestState` with accumulated results.

Config options:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `wrapper` | FUNCTION | `null` | React component to wrap the rendered element |
| `autoCleanup` | BOOL | `true` | Run RTL cleanup after pipeline completes |
| `haltOnFailure` | BOOL | `true` | Stop pipeline on first fail or error (inherited) |
| `timeout` | INT | `5000` | Per-step timeout in ms (inherited) |

```jsx
const state = await test.start(<Counter initial={0} />);
```

---

### CTGReactTest.toSnapshot :: JSX -> PROMISE(OBJECT)

Static. Renders JSX through `react-test-renderer` and returns the JSON tree. Fresh, isolated render — no internal state.

```jsx
const tree = await CTGReactTest.toSnapshot(<Counter initial={0} />);
```

---

### CTGReactTest.diffSnapshot :: JSX, JSX -> PROMISE([OBJECT])

Static. Renders both JSX elements and returns an array of structural differences. Each entry has `{path, expected, actual}`. Returns empty array if trees match. Compares type, props (deep-strict), and children recursively.

```jsx
const diffs = await CTGReactTest.diffSnapshot(
    <Counter initial={0} />,
    <Counter initial={1} />
);
```

---

### CTGReactTest.compareSnapshot :: JSX, JSX -> PROMISE(BOOL)

Static. Convenience over `diffSnapshot`. Returns `true` if no structural differences exist between the two rendered trees.

```jsx
const match = await CTGReactTest.compareSnapshot(
    <Counter initial={0} />,
    <Counter initial={0} />
); // true
```

---

### Inherited Methods

All methods from `CTGTest`: `stage`, `assert`, `chain`, `skip`. See ctg-js-test documentation.
