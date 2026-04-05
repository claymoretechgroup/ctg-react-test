# AssertComponentIsStep

Pipeline step that compares the current component's rendered HTML against a STRING or a ReactTestState instance. Extends `CTGTestStep` from `ctg-js-test`. If a ReactTestState is passed, `toHTML()` is called on it automatically. No error handler.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _type | STRING | Always `"assert"` |
| _name | STRING | Step name |
| _expected | STRING\|reactTestState | Expected HTML or state to compare against |
| _resolvedExpected | STRING | Resolved HTML string (set during execution) |

---

### CONSTRUCTOR :: STRING, STRING|reactTestState -> assertComponentIsStep

Creates an assertComponentIs step with a name and expected value.

```jsx
new AssertComponentIsStep("matches markup", "<h1>Hello</h1>");
new AssertComponentIsStep("same result", expectedState);
```

---

### assertComponentIsStep.expectedOutcome :: VOID -> OBJECT|NULL

Returns `{ type: "value", expected: this._resolvedExpected }` after execution. Returns null before execution since the expected value may need `toHTML()` resolution.

---

### assertComponentIsStep.execute :: reactTestState -> PROMISE(reactTestState)

Gets the current component's HTML via `state.container.innerHTML`. If the expected value is a ReactTestState, calls `toHTML()` on it. Sets `state.actual` to the current HTML and resolves the expected value for pipeline comparison.

---

### assertComponentIsStep.validate :: VOID -> VOID

Validates that name is non-empty and expected is provided. Throws `CTGTestError(INVALID_STEP)` on failure.
