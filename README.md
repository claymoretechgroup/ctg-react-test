# ctg-react-test

`ctg-react-test` is a composable, pipeline-based test framework for React applications. It extends `ctg-js-test` with React-specific step types for rendering components, simulating user interactions, testing hooks, and capturing snapshots. Pipelines are declarative definitions that separate what to test from how to execute it — the same pipeline runs standalone or through a Vitest execution formatter.

**Key Features:**

* **Pipeline model**: Tests are ordered sequences of render, interact, assert, and snapshot steps on a threaded ReactContext subject
* **Extends ctg-js-test**: Inherits the full pipeline engine — stage, assert, assertAny, chain, skip, compare, five-status reporting
* **React-native steps**: `render`, `interact`, `renderHook`, `snapshot` built for @testing-library/react
* **Composable**: Chain reusable pipeline fragments for accessibility checks, form flows, or provider wrappers
* **Vitest integration**: Execution formatter runs pipelines with accurate five-status reporting via `getReport()`
* **Standalone mode**: Runs without Vitest using jsdom — zero runner lock-in

## Install

```
npm install ctg-react-test
```

Peer dependencies: `react`, `react-dom`, `@testing-library/react`. Optional: `@testing-library/user-event`, `vitest`.

## Examples

### Render and Assert

Render a component and assert on the DOM:

```javascript
import CTGReactTest from "ctg-react-test";
import React from "react";

await CTGReactTest.init("greeting")
    .render("mount", React.createElement(Greeting, { name: "World" }))
    .assert("has heading", (ctx) => ctx.screen.getByText("Hello, World!") !== null, true)
    .start(null);
```

### User Interaction

Simulate clicks, typing, and form submission:

```javascript
await CTGReactTest.init("counter")
    .render("mount", React.createElement(Counter, { initial: 0 }))
    .interact("click increment", async (ctx) => {
        await ctx.user.click(ctx.screen.getByText("Increment"));
        return ctx;
    })
    .assert("count is 1", (ctx) => ctx.screen.getByTestId("count").textContent, "1")
    .start(null);
```

### Hook Testing

Render a hook in isolation and assert on its return value:

```javascript
await CTGReactTest.init("useCounter")
    .renderHook("mount", () => useCounter(0))
    .assert("initial count", (ctx) => ctx.data.result.current.count, 0)
    .start(null);
```

### Snapshot Testing

Capture rendered HTML and compare against stored snapshots:

```javascript
await CTGReactTest.init("greeting snapshot")
    .render("mount", React.createElement(Greeting, { name: "Snapshot" }))
    .snapshot("greeting html")
    .start(null, { snapshotFilePath: fileURLToPath(import.meta.url) });
```

### Composable Fragments

Define reusable pipeline pieces and chain them:

```javascript
const hasAccessibleForm = CTGReactTest.init("accessible form")
    .assert("has form role", (ctx) => ctx.screen.getByRole("form") !== null, true);

await CTGReactTest.init("login")
    .render("mount", React.createElement(LoginForm))
    .chain("accessibility", hasAccessibleForm)
    .interact("fill and submit", async (ctx) => {
        await ctx.user.type(ctx.screen.getByLabelText("Username"), "alice");
        await ctx.user.click(ctx.screen.getByText("Submit"));
        return ctx;
    })
    .assert("shows welcome", (ctx) => ctx.screen.getByText("Welcome, alice!") !== null, true)
    .start(null);
```

### Vitest Formatter

Run pipelines through the execution formatter for five-status reporting:

```javascript
import { CTGReactTest, CTGVitestFormatter } from "ctg-react-test";

const formatter = new CTGVitestFormatter();
await CTGReactTest.init("my test")
    .render("mount", React.createElement(MyComponent))
    .assert("renders", (ctx) => ctx.container.innerHTML.length > 0, true)
    .start(null, { formatter });

const report = formatter.getReport();
// { status: "pass", passed: 1, failed: 0, ... }
```

### Snapshot Sanitization

Prevent secrets from being committed in snapshot files:

```javascript
await CTGReactTest.init("redacted")
    .render("mount", React.createElement(Dashboard, { token: secret }))
    .snapshot("safe snapshot", null, {
        sanitize: (html) => html.replace(/token=[^"]+/g, "token=REDACTED")
    })
    .start(null, { snapshotFilePath: fileURLToPath(import.meta.url) });
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `output` | string | `"console"` | Output mode (inherited from ctg-js-test) |
| `haltOnFailure` | boolean | `true` | Stop pipeline on first fail or error |
| `strict` | boolean | `true` | Strict deep equality comparison |
| `timeout` | number | `5000` | Per-step timeout in ms (0 = disabled) |
| `formatter` | instance | `null` | Execution formatter (e.g., `new CTGVitestFormatter()`) |
| `snapshotFilePath` | string | `null` | Explicit snapshot file path (recommended for CI) |
| `snapshotFileUrl` | string | `null` | `import.meta.url` for snapshot path resolution |
| `updateSnapshots` | boolean | `false` | Overwrite existing snapshots |
| `maxSnapshotBytes` | number | `null` | Maximum snapshot value size |

## Notice

`ctg-react-test` is under active development. The core pipeline API and standalone mode are stable. Vitest formatter runs in-process for v1.0.0; native describe/it registration is planned for a future version. Playwright integration is deferred to v2.
