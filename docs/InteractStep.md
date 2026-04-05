# InteractStep

Pipeline step that dispatches user events to the mounted component. Extends `CTGTestStep` from `ctg-js-test`. The callback receives the testing-library surface `{screen, user}` and returns VOID. No error handler — if the callback throws, the pipeline records an ERROR result.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _type | STRING | Always `"interact"` |
| _name | STRING | Step name |
| _fn | FUNCTION | Interaction callback |

---

### CONSTRUCTOR :: STRING, ({screen, user} -> VOID) -> interactStep

Creates an interact step with a name and callback.

```jsx
new InteractStep("click button", async ({screen, user}) => {
    await user.click(screen.getByText("Submit"));
});
```

---

### interactStep.execute :: reactTestState -> PROMISE(reactTestState)

Validates that `state.user` is available, then calls the callback with `{screen: state.screen, user: state.user}`. The callback's return value is ignored. If the callback throws, sets `state._lastStepStatus` to ERROR.

---

### interactStep.validate :: VOID -> VOID

Validates that name is non-empty and fn is callable. Throws `CTGTestError(INVALID_STEP)` on failure.
