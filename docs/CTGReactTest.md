# CTGReactTest

Composable pipeline-based test class for React components. Extends `CTGTest` from `ctg-js-test`. The component is the subject — passed to `start()`, which mounts it implicitly. Pipeline steps verify the component through interactions and assertions. Cleanup runs automatically after the pipeline completes.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _name | STRING | Pipeline name (inherited) |
| _steps | [ctgTestStep] | Step definitions (inherited) |

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| VALID_CONFIG_KEYS | [STRING] | Inherited keys + wrapper, autoCleanup |

---

### CTGReactTest.init :: STRING -> ctgReactTest

Creates a new React test pipeline.

```jsx
const test = CTGReactTest.init("counter test");
```

---

### ctgReactTest.interact :: STRING, ({screen, user} -> VOID) -> SELF

Adds an interact step. The callback receives the testing-library surface for finding elements and dispatching events. VOID return — interactions are side effects. No error handler. Chainable.

```jsx
test.interact("click increment", async ({screen, user}) => {
    await user.click(screen.getByText("Increment"));
});
```

---

### ctgReactTest.assertComponent :: STRING, (screen -> *), * -> SELF

Adds an assertComponent step. The callback receives `screen` and computes an actual value from the rendered output. The pipeline compares it to the expected value. No error handler. Chainable.

```jsx
test.assertComponent("count is 1", (screen) =>
    screen.getByTestId("count").textContent, "1");
```

---

### ctgReactTest.assertComponentIs :: STRING, STRING|reactTestState -> SELF

Adds an assertComponentIs step. Compares the current component's rendered HTML against a STRING or a ReactTestState instance (calls `toHTML()` automatically). No error handler. Chainable.

```jsx
test.assertComponentIs("matches markup", "<h1>Hello, World!</h1>");
test.assertComponentIs("same result", expectedState);
```

---

### ctgReactTest.chain :: STRING, ctgTest -> SELF

Overrides `CTGTest.chain` to share the testing surface (screen, user, container, rerender) with the inner pipeline. The inner pipeline runs against the same mounted component. Chainable.

```jsx
const verifyCount = CTGReactTest.init("verify")
    .assertComponent("count visible", (screen) =>
        screen.getByTestId("count") !== null, true);

test.chain("verify", verifyCount);
```

---

### ctgReactTest.start :: JSX|reactTestState, OBJECT? -> PROMISE(reactTestState)

Executes the pipeline. If JSX is passed, wraps in ReactTestState and mounts via `@testing-library/react.render()`. If ReactTestState (from chain), skips mounting. Runs cleanup automatically after all steps complete unless `autoCleanup: false`. Returns ReactTestState.

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

Static. Renders both JSX elements and returns an array of structural differences. Each entry has `{path, expected, actual}`. Returns empty array if trees match.

```jsx
const diffs = await CTGReactTest.diffSnapshot(
    <Counter initial={0} />,
    <Counter initial={1} />
);
```

---

### CTGReactTest.compareSnapshot :: JSX, JSX -> PROMISE(BOOL)

Static. Convenience over `diffSnapshot`. Returns true if no differences.

```jsx
const match = await CTGReactTest.compareSnapshot(
    <Counter initial={0} />,
    <Counter initial={0} />
);
```

---

### Inherited Methods

All methods from `CTGTest`: `stage`, `assert`, `assertAny`, `skip`, `compare`. See ctg-js-test documentation.
