# ReactContext

Value object wrapping a `@testing-library/react` render result. This is the subject threaded through React test pipelines. Created by `render()` and `renderHook()` steps.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _screen | OBJECT | @testing-library/react screen queries (getByRole, getByText, etc.) |
| _user | OBJECT\|NULL | @testing-library/user-event instance, or null if not installed |
| _container | HTMLElement | Root DOM container element |
| _rerender | (JSX -> VOID) | Re-render function for updating props |
| _data | OBJECT | Mutable test data bag for passing values between stages |

---

### CONSTRUCTOR :: OBJECT -> reactContext

Creates a ReactContext from a render result. Fields: `{ screen, user, container, rerender, data? }`. Data defaults to `{}`.

```javascript
const ctx = new ReactContext({
    screen: rtl.screen,
    user: userEvent.setup(),
    container: renderResult.container,
    rerender: renderResult.rerender
});
```

---

### reactContext.get :: STRING -> *

Shorthand for `this.data[key]`. Returns `undefined` if key not set.

```javascript
ctx.get("userId"); // undefined
```

---

### reactContext.set :: STRING, * -> this

Shorthand for `this.data[key] = value`. Chainable.

```javascript
ctx.set("userId", 42).set("role", "admin");
```
