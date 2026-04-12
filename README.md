# ctg-react-test

`ctg-react-test` is a composable, pipeline-based test framework for React components, extending `ctg-js-test`. The component is the subject — passed to `start()`, which mounts it via `@testing-library/react`. Pipeline steps interact with the component and assert against its rendered output. The caller owns reporting: the pipeline returns state, the caller formats and delivers results.

**Key Features:**

* **Component as subject**: Pass JSX to `start()`, the pipeline mounts and tests that component
* **Three React operations**: `interact` dispatches events, `assertComponent` computes and compares, `assertComponentIs` compares rendered HTML directly
* **Predicate-based assertions**: Expected values auto-wrap in `equals()`; pass a `CTGTestPredicate` for custom comparisons
* **Composable chains**: Define reusable pipeline fragments and compose them with `chain`
* **Caller-owned reporting**: Pipeline returns `ReactTestState`, caller decides how to format and deliver
* **Automatic cleanup**: RTL cleanup runs after the pipeline completes unless disabled

## Install

```
npm install claymoretechgroup/ctg-react-test
```

Peer dependencies: `react`, `react-dom`, `@testing-library/react`. Optional: `@testing-library/user-event`.

Minimum Node.js version: 20.

## Examples

### Basic Assertion

Mount a component and verify rendered text:

```jsx
import CTGReactTest from "ctg-react-test";
import { Greeting } from "../src/Greeting.jsx";

const state = await CTGReactTest.init("greeting")
    .assertComponent("says hello", (screen) =>
        screen.getByRole("heading").textContent, "Hello, World!")
    .start(<Greeting name="World" />);
```

### Interaction

Dispatch events and verify the result:

```jsx
import { Counter } from "../src/Counter.jsx";

const state = await CTGReactTest.init("counter")
    .interact("click increment", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
    })
    .assertComponent("count is 1", (screen) =>
        screen.getByTestId("count").textContent, "1")
    .start(<Counter initial={0} />);
```

### Composing Pipelines

Define reusable verification fragments and chain them:

```jsx
const verifyVisible = CTGReactTest.init("verify count visible")
    .assertComponent("count exists", (screen) =>
        screen.getByTestId("count") !== null, true);

const state = await CTGReactTest.init("counter with verify")
    .interact("click", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
    })
    .chain("verify", verifyVisible)
    .assertComponent("count is 1", (screen) =>
        screen.getByTestId("count").textContent, "1")
    .start(<Counter initial={0} />);
```

### HTML Comparison

Compare the component's rendered HTML against a known string:

```jsx
const state = await CTGReactTest.init("greeting markup")
    .assertComponentIs("matches", "<h1>Hello, World!</h1>")
    .start(<Greeting name="World" />);
```

### Staged Comparison

Compare two pipelines that take different interaction paths. Disable auto-cleanup on the expected pipeline so its container survives for comparison:

```jsx
const expected = await CTGReactTest.init("expected state")
    .interact("setup", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
        await user.click(screen.getByText("Increment"));
    })
    .start(<Counter initial={0} />, { autoCleanup: false });

const state = await CTGReactTest.init("actual state")
    .interact("different path", async ({screen, user}) => {
        await user.type(screen.getByTestId("input"), "2");
        await user.click(screen.getByText("Set"));
    })
    .assertComponentIs("same result", expected)
    .start(<Counter initial={0} />);
```

### Custom Predicates

Use `CTGTestPredicates` for comparisons beyond equality:

```jsx
import CTGTestPredicates from "ctg-js-test/predicates";

const state = await CTGReactTest.init("search results")
    .interact("search", async ({screen, user}) => {
        await user.type(screen.getByRole("searchbox"), "react");
        await user.click(screen.getByText("Search"));
    })
    .assertComponent("has results", (screen) =>
        screen.getAllByRole("listitem").length,
        CTGTestPredicates.greaterThan(0))
    .assertComponent("contains term", (screen) =>
        screen.getByTestId("results").textContent,
        CTGTestPredicates.contains("react"))
    .start(<SearchPage />);
```

### Caller-Owned Reporting

The pipeline returns `ReactTestState`. The caller formats and delivers:

```jsx
import CTGTestConsoleFormatter from "ctg-js-test/formatter/console";
import CTGTestResult from "ctg-js-test/result";

const state = await CTGReactTest.init("example")
    .assertComponent("check heading", (screen) =>
        screen.getByRole("heading").textContent, "Hello!")
    .start(<Greeting name="" />);

process.stdout.write(CTGTestConsoleFormatter.format(state) + "\n");

const S = CTGTestResult.STATUS;
const failed = state.status === S.FAIL || state.status === S.ERROR;
process.exit(failed ? 1 : 0);
```

Run with the JSX loader:

```
node --import ctg-react-test/jsx-loader tests/GreetingTest.jsx
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `wrapper` | FUNCTION | `null` | React component to wrap the rendered element |
| `autoCleanup` | BOOL | `true` | Run RTL cleanup after pipeline completes |
| `haltOnFailure` | BOOL | `true` | Stop pipeline on first fail or error |
| `timeout` | INT | `5000` | Per-step timeout in ms (0 = disabled) |

## Notice

`ctg-react-test` is under active development. The core pipeline API is stable but utilities and configuration options may change.
