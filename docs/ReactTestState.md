# ReactTestState

Mutable state object for React test pipelines. Extends `CTGTestState` from `ctg-js-test` with React testing surface fields populated by `start()` when it mounts the component.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| screen | OBJECT\|NULL | Container-scoped RTL queries via `within(container)` |
| user | OBJECT\|NULL | user-event instance for interactions |
| container | HTMLElement\|NULL | Rendered container element |
| rerender | FUNCTION\|NULL | RTL rerender function |
| data | OBJECT | Mutable data bag for step-produced values |
| subject | * | The JSX element passed to `start()` (inherited) |
| results | [OBJECT] | Accumulated step results (inherited) |
| config | OBJECT | Pipeline config (inherited) |
| name | STRING | Pipeline name (inherited) |
| actual | * | Assert handoff field (inherited) |
| skipTargets | OBJECT | Skip directive map (inherited) |

All React fields default to null except `data` which defaults to empty object.

---

### CONSTRUCTOR :: {subject:*, config:OBJECT, name:STRING}? -> reactTestState

Creates state with React-specific fields.

```javascript
const state = new ReactTestState({ subject: null, config: {}, name: "test" });
```

---

### reactTestState.toHTML :: VOID -> STRING

Returns the rendered HTML string from the mounted component's container. Returns empty string if container is null.

```javascript
const html = state.toHTML();
```

---

### reactTestState.status :: VOID -> INT

Aggregate status from results. Error > fail > recovered > skip > pass. Inherited from `CTGTestState`.

```javascript
const failed = state.status === CTGTestResult.STATUS.FAIL;
```
