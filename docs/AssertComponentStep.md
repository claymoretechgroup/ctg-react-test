# AssertComponentStep

Pipeline step that queries the rendered DOM via `screen` and compares the result to an expected value. Extends `CTGTestStep` from `ctg-js-test`. No error handler — if the query throws, the pipeline records an ERROR result.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _type | STRING | Always `"assert"` |
| _name | STRING | Step name |
| _fn | FUNCTION | Query callback receiving screen |
| _expected | * | Expected value for comparison |

---

### CONSTRUCTOR :: STRING, (screen -> *), * -> assertComponentStep

Creates an assertComponent step with a name, query callback, and expected value.

```jsx
new AssertComponentStep("count is 1", (screen) =>
    screen.getByTestId("count").textContent, "1");
```

---

### assertComponentStep.expectedOutcome :: VOID -> OBJECT

Returns `{ type: "value", expected: this._expected }` for pipeline comparison.

---

### assertComponentStep.execute :: reactTestState -> PROMISE(reactTestState)

Calls the callback with `state.screen` and sets `state.actual` to the return value for pipeline comparison. If the callback throws, sets `state._lastStepStatus` to ERROR.

NOTE: Handler mutates state as a side effect to store the result of the handler for the pipeline to compare against in order to support async operations.

---

### assertComponentStep.validate :: VOID -> VOID

Validates that name is non-empty, fn is callable, and expected is not a function. Throws `CTGTestError` on failure.
