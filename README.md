# ctg-react-test

`ctg-react-test` is a composable, pipeline-based test framework for React components, extending `ctg-js-test`. The component is the subject — passed to `start()`, which mounts it via `@testing-library/react`. Pipeline steps interact with the component and assert against its rendered output. The caller owns reporting: the pipeline returns state, the caller formats and delivers results.

**Key Features:**

* **Component as subject**: Pass JSX to `start()`, the pipeline mounts and tests that component
* **Three React operations**: `interact` dispatches events, `assertComponent` computes and compares, `assertComponentIs` compares rendered HTML directly
* **Predicate-based assertions**: Expected values auto-wrap in `equals()`; pass a `CTGTestPredicate` for custom comparisons
* **Composable chains**: Define reusable pipeline fragments and compose them with `chain`
* **Caller-owned reporting**: Pipeline returns `ReactTestState`, caller decides how to format and deliver
* **Automatic cleanup**: RTL cleanup runs after the pipeline completes unless disabled
* **Loads real component source**: The bundled loader handles `.jsx`, `.tsx`, `.ts`, CSS Modules, and `?raw` assets, so tests import components from source with no build step
* **Base utilities included**: Re-exports predicates, results, errors, state, and formatters from `ctg-js-test`

## Install

```
npm install claymoretechgroup/ctg-react-test
```

Peer dependencies: `react`, `react-dom`, `@testing-library/react`. Optional: `@testing-library/user-event`.

Minimum Node.js version: 20.

`ctg-js-test` is installed as an internal dependency and its common utilities are re-exported from `ctg-react-test`; user code should not need to import `ctg-js-test` directly for React test predicates, results, errors, state, or formatters.

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
import { CTGReactTest, CTGTestPredicates } from "ctg-react-test";

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
import {
    CTGReactTest,
    CTGTestConsoleFormatter,
    CTGTestResult
} from "ctg-react-test";

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

### TypeScript Components

The bundled loader transforms `.jsx`, `.tsx`, and `.ts`, so a test imports a TypeScript component directly from source — no build step, and the test file itself may be either extension:

```jsx
// tests/Button.test.jsx
import CTGReactTest from "ctg-react-test";
import { Button } from "../src/components/Button/Button.tsx";

const state = await CTGReactTest.init("renders label")
    .assertComponent("label text", (screen) =>
        screen.getByRole("button").textContent, "Save")
    .start(<Button>Save</Button>);
```

Run it the same way:

```
node --import ctg-react-test/jsx-loader tests/Button.test.jsx
```

Two things worth knowing:

**This transforms, it does not typecheck.** esbuild strips types without verifying them, so a type error will not fail the test run. Run `tsc --noEmit` separately.

**The framework ships type declarations.** TypeScript tests can import `ctg-react-test` directly under `strict`; component props in JSX are still checked against the component's own types.

### DOM Environment

`start()` mounts through `@testing-library/react`, which needs a DOM. The framework does not provide one — supply it either by running under Vitest with `environment: "jsdom"`, or by installing globals before the first mount:

```js
// tests/setup.js — import this before anything mounts
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true
});

// navigator is getter-only on Node 22, so define rather than assign
const install = (key, value) =>
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });

install("window", dom.window);
install("document", dom.window.document);
install("navigator", dom.window.navigator);
for (const key of Object.getOwnPropertyNames(dom.window)) {
    if (!(key in globalThis)) install(key, dom.window[key]);
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
```

`@testing-library/react` is imported lazily at mount time, so the DOM only has to exist before the first `start()` — not before the framework is imported.

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `wrapper` | FUNCTION | `null` | React component to wrap the rendered element |
| `autoCleanup` | BOOL | `true` | Run RTL cleanup after pipeline completes |
| `haltOnFailure` | BOOL | `true` | Stop pipeline on first fail or error |
| `timeout` | INT | `5000` | Per-step timeout in ms (0 = disabled) |

## Notice

`ctg-react-test` is under active development. The core pipeline API is stable but utilities and configuration options may change.
