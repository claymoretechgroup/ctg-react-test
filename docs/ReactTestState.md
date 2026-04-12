# ReactTestState

Mutable state object for React test pipelines. Extends `CTGTestState` from `ctg-js-test` with React testing surface fields populated by `CTGReactTest.start()` during the mount phase.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| label | STRING | Pipeline label (inherited) |
| subject | * | The JSX element passed to `start()` (inherited) |
| computed | * | Last computed value from an assert callback (inherited) |
| results | [ctgTestResult] | Accumulated step results (inherited) |
| status | INT | Aggregate status from results (inherited getter) |
| screen | OBJECT\|NULL | Container-scoped RTL queries via `within(container)` |
| user | OBJECT\|NULL | user-event instance for interactions |
| container | HTMLElement\|NULL | Rendered container element |
| rerender | FUNCTION\|NULL | RTL rerender function |
| data | OBJECT | Mutable data bag for step-produced values |

All React-specific fields default to `null` except `data` which defaults to `{}`.

---

### CONSTRUCTOR :: {subject: *, label: STRING}? -> reactTestState

Creates state with React-specific fields defaulting to null.

```javascript
const state = new ReactTestState({ subject: jsx, label: "test" });
```

---

### ReactTestState.init :: STRING, * -> reactTestState

Static factory. Creates a new React test state with the given label and subject.

```javascript
const state = ReactTestState.init("counter", <Counter />);
```

---

### reactTestState.toHTML :: VOID -> STRING

Returns the rendered HTML string from the mounted component's container (`container.innerHTML`). Throws `INVALID_OPERATION` if the container is null — either the component was never mounted or cleanup has already run.

```javascript
const html = state.toHTML();
```
