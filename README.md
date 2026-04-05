# ctg-react-test

`ctg-react-test` is a composable, pipeline-based test framework for React components, extending `ctg-js-test`. The component is the subject — passed to `start()`, which mounts it implicitly. Pipeline steps dispatch events and verify rendered output. Cleanup runs automatically. Ships with a JSX loader so test files and components can be written as `.jsx`.

**Key Features:**

* **Component is the subject**: Pass JSX to `start()`, the pipeline tests that component
* **Caller-owned reporting**: Pipeline returns state, caller formats and delivers results
* **Extends ctg-js-test**: Inherits stage, assert, assertAny, chain, skip, five-status reporting
* **JSX support**: Ships an esbuild-based ESM loader for `.jsx` files
* **Static snapshot utilities**: Compare component trees outside the pipeline
* **Automatic cleanup**: RTL cleanup runs after pipeline completes

## Install

```
npm install claymoretechgroup/ctg-react-test
```

Peer dependencies: `react`, `react-dom`, `@testing-library/react`. Optional: `@testing-library/user-event`.

Minimum Node.js version: 20.

## Examples

### Interact and Assert

Mount a component, dispatch events, verify the rendered output:

```jsx
import CTGReactTest from "ctg-react-test";
import { Counter } from "../src/Counter.jsx";

const state = await CTGReactTest.init("counter")
    .interact("click increment", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
    })
    .assertComponent("count is 1", (screen) =>
        screen.getByTestId("count").textContent, "1")
    .start(<Counter initial={0} />);
```

Run with the JSX loader:

```
node --import ctg-react-test/jsx-loader tests/CounterTest.jsx
```

### Verify Rendered HTML

Compare the component's rendered HTML against a known string:

```jsx
const state = await CTGReactTest.init("greeting")
    .assertComponentIs("matches", "<h1>Hello, World!</h1>")
    .start(<Greeting name="World" />);
```

### Staged Comparison

Compare two pipelines that take different interaction paths:

```jsx
const expected = await CTGReactTest.init("expected state")
    .interact("setup", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
        await user.click(screen.getByText("Increment"));
    })
    .start(<Counter initial={0} />, { autoCleanup: false });

const state = await CTGReactTest.init("counter test")
    .interact("different path", async ({screen, user}) => {
        // some other interaction sequence
    })
    .assertComponentIs("same result", expected)
    .start(<Counter initial={0} />);
```

### Form Interaction

Test form submission with user-event:

```jsx
import { LoginForm } from "../src/LoginForm.jsx";

const state = await CTGReactTest.init("login")
    .interact("fill and submit", async ({screen, user}) => {
        await user.type(screen.getByLabelText("Username"), "alice");
        await user.click(screen.getByText("Submit"));
    })
    .assertComponent("welcome shown", (screen) =>
        screen.getByText("Welcome, alice!") !== null, true)
    .start(<LoginForm />);
```

### Composable Fragments

Define reusable pipeline pieces and chain them:

```jsx
const verifyCount = CTGReactTest.init("verify count")
    .assertComponent("count visible", (screen) =>
        screen.getByTestId("count") !== null, true);

const state = await CTGReactTest.init("counter with verify")
    .interact("click", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
    })
    .chain("verify", verifyCount)
    .assertComponent("count is 1", (screen) =>
        screen.getByTestId("count").textContent, "1")
    .start(<Counter initial={0} />);
```

### Structural Snapshot Comparison

Compare component trees outside the pipeline:

```jsx
const match = await CTGReactTest.compareSnapshot(
    <Counter initial={0} />,
    <Counter initial={0} />
); // true

const diffs = await CTGReactTest.diffSnapshot(
    <Counter initial={0} />,
    <Counter initial={1} />
); // [{ path: "...", expected: "0", actual: "1" }]
```

### Wrapper Config

Wrap the component in providers:

```jsx
function ThemeProvider({children}) {
    return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>;
}

const state = await CTGReactTest.init("themed")
    .assertComponent("has theme", (screen) =>
        screen.getByTestId("theme").textContent, "dark")
    .start(<MyComponent />, { wrapper: ThemeProvider });
```

### Caller-Owned Reporting

The pipeline returns `ReactTestState`. The caller formats and delivers:

```jsx
import CTGTestConsoleFormatter from "ctg-js-test/formatter/console";
import CTGTestResult from "ctg-js-test/result";

const state = await CTGReactTest.init("example")
    .assertComponent("check", (screen) =>
        screen.getByRole("heading").textContent, "Hello!")
    .start(<Greeting name="" />);

process.stdout.write(CTGTestConsoleFormatter.format(state) + "\n");

const S = CTGTestResult.STATUS;
const failed = state.status === S.FAIL || state.status === S.ERROR;
process.exit(failed ? 1 : 0);
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `haltOnFailure` | boolean | `true` | Stop pipeline on first fail or error |
| `timeout` | number | `5000` | Per-step timeout in ms (0 = disabled) |
| `wrapper` | function | `null` | React component to wrap the rendered element |
| `autoCleanup` | boolean | `true` | Run RTL cleanup after pipeline completes |

## Considerations

### Hook Testing

Direct hook testing (renderHook, result.current) is not supported. Hooks are tested through the components that use them — if a hook drives a state change, the component renders the result, and `assertComponent` verifies it. For hooks that don't produce visible output, write a thin test component that renders the hook's return values. Alternatively, use `ctg-js-test` directly for value-based hook testing with stage/assert.

### Error Handling

React-specific steps (interact, assertComponent, assertComponentIs) do not accept error handlers. This is a departure from ctg-js-test's stage/assert semantics where an optional error handler enables recovery. In React testing, a missing element or a failed interaction is a test failure, not something to recover from. The inherited steps (stage, assert, assertAny) retain their error handlers.

### Snapshot Comparison

`toSnapshot`, `diffSnapshot`, and `compareSnapshot` are static methods that compare fresh, isolated renders of JSX elements via react-test-renderer. They do not reflect internal state from interactions — they compare component structure for given props. For comparing post-interaction state, use `assertComponentIs` with a staged pipeline or HTML string.

## Notice

`ctg-react-test` is under active development. The core pipeline API is stable.
