# CTGReactTest

Composable pipeline-based test class for React. Extends `CTGTest` from `ctg-js-test` with React-specific step types: render, interact, assertSnapshot, renderHook. The pipeline returns `ReactTestState` — the caller owns formatting, collection, delivery, and cleanup.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _name | STRING | Pipeline name (inherited) |
| _steps | [ctgTestStep] | Step definitions including React types (inherited) |

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| VALID_CONFIG_KEYS | [STRING] | Inherited keys + snapshotFilePath, snapshotFileUrl, updateSnapshots, createBaselines, maxSnapshotBytes |

---

### CTGReactTest.init :: STRING -> ctgReactTest

Creates a new React test pipeline.

```jsx
const test = CTGReactTest.init("my component test");
```

---

### ctgReactTest.render :: STRING, JSX|(VOID -> JSX), OBJECT? -> this

Renders a React element and populates `ReactTestState` fields (screen, user, container, rerender). Accepts a JSX element directly or a function returning JSX. Options: `{ wrapper }`. Chainable.

```jsx
test.render("mount", <MyComponent prop="value" />);
```

---

### ctgReactTest.interact :: STRING, (reactTestState -> reactTestState), (Error -> *)? -> this

Executes a user interaction callback against state. Requires `state.user` (user-event). The callback must return `ReactTestState`. Chainable.

```jsx
test.interact("click submit", async (state) => {
    await state.user.click(state.screen.getByText("Submit"));
    return state;
});
```

---

### ctgReactTest.assertSnapshot :: STRING, JSX|(VOID -> JSX), OBJECT? -> this

Renders a component via `react-test-renderer` and compares the serialized component tree against a stored JSON baseline. Requires `snapshotFilePath` or `snapshotFileUrl` in config. Chainable.

```jsx
test.assertSnapshot("component tree", <MyComponent prop="value" />);
```

---

### ctgReactTest.renderHook :: STRING, (VOID -> *), OBJECT? -> this

Renders a hook in isolation and populates `state.data.result` with the hook return value (a ref — `result.current` reflects latest value after rerenders). Options: `{ wrapper }`. Chainable.

```jsx
test.renderHook("mount", () => useCounter(0));
```

---

### ctgReactTest.chain :: STRING, ctgTest -> this

Overrides `CTGTest.chain` to preserve React testing state across chained pipelines. The inner pipeline receives a separate `ReactTestState` instance with shared React field references (screen, container, user, rerender, data). Chainable.

```jsx
const verifyGreeting = CTGReactTest.init("verify")
    .assert("has text", (state) =>
        state.container.innerHTML.includes("Hello"), true);

test.chain("verify", verifyGreeting);
```

---

### ctgReactTest.start :: reactTestState|*, OBJECT? -> PROMISE(reactTestState)

Executes the pipeline. Wraps raw values in `ReactTestState`. Validates config and steps synchronously, then runs steps async. Returns `ReactTestState`. The caller owns cleanup and formatting.

```jsx
const state = await test.start(null);
```

---

### Inherited Methods

All methods from `CTGTest`: `stage`, `assert`, `assertAny`, `skip`, `compare`. See ctg-js-test documentation.
