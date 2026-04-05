# ReactTestState

Mutable state object for React test pipelines. Extends `CTGTestState` from `ctg-js-test` with React testing surface fields populated by the render or renderHook step.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| screen | OBJECT\|NULL | Container-scoped RTL queries via `within(container)` |
| user | OBJECT\|NULL | user-event instance for interactions |
| container | HTMLElement\|NULL | Rendered container element |
| rerender | FUNCTION\|NULL | RTL rerender function |
| data | OBJECT | Mutable data bag for step-produced values (e.g., hook results) |
| subject | * | Threaded subject value (inherited) |
| results | [OBJECT] | Accumulated step results (inherited) |
| config | OBJECT | Pipeline config (inherited) |
| name | STRING | Pipeline name (inherited) |
| actual | * | Assert handoff field (inherited) |
| skipTargets | OBJECT | Skip directive map (inherited) |

All React fields default to null except `data` which defaults to empty object. Fields are populated by the render or renderHook step.

---

### CONSTRUCTOR :: {subject:*, config:OBJECT, name:STRING}? -> reactTestState

Creates state with React-specific fields.

```javascript
const state = new ReactTestState({ subject: null, config: {}, name: "test" });
```

---

### reactTestState.status :: VOID -> INT

Aggregate status from results. Error > fail > recovered > skip > pass. Inherited from `CTGTestState`.

```javascript
const failed = state.status === CTGTestResult.STATUS.FAIL;
```
