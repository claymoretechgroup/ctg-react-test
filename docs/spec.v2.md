# CTG React Test v2 — Specification

**Status:** Draft
**Depends on:** ctg-js-test v2.1.0
**Minimum Node:** 20

---

## Motivation

v1 of CTGReactTest was built against ctg-js-test v1. It extends CTGTest and
overrides `_executeSteps`, `_validateStepDefinitions`, and `start()` with
React-specific switch statements, step type sets, and result construction.
ctg-js-test v2 eliminates all of these patterns in favor of polymorphic steps,
CTGTestState, and caller-owned reporting.

v2 of CTGReactTest aligns with the v2 pipeline model:

1. **Polymorphic steps** — render, interact, snapshot, renderHook become step
   subclasses with their own execute/validate. No switch statements in the
   pipeline.
2. **ReactTestState extends CTGTestState** — the React testing surface (screen,
   user, container, rerender) lives on state, not on a subject wrapper.
   ReactContext is eliminated.
3. **Caller-owned reporting** — start() returns state. No `_deliver`, no
   `output`/`formatter` config, no `_results` push.
4. **Cleanup as caller concern** — RTL cleanup moves out of start() and into
   the test suite script or a dedicated cleanup step.

---

## 1. ReactTestState

Extends CTGTestState. Carries the React testing surface populated by the
render step.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| screen | OBJECT\|NULL | Container-scoped RTL queries via `within(container)` |
| user | OBJECT\|NULL | user-event instance for interactions |
| container | HTMLElement\|NULL | Rendered container element |
| rerender | FUNCTION\|NULL | RTL rerender function |
| data | OBJECT | Mutable data bag for step-produced values (e.g., hook results) |

All fields default to null except data which defaults to empty object.
Fields are populated by the render or renderHook step.

### Constructor

```javascript
// :: {subject:*, config:OBJECT, name:STRING}? -> reactTestState
constructor(opts = {}) {
    super(opts);
    this.screen = null;
    this.user = null;
    this.container = null;
    this.rerender = null;
    this.data = {};
}
```

### Replaces

- **ReactContext** — eliminated. ReactTestState is both the state and the
  testing surface. There is no separate subject wrapper.

---

## 2. Step Types

Four step subclasses extending CTGTestStep. Each implements execute(state)
and validate(). The pipeline (CTGReactTest) provides builder methods that
construct these steps.

### RenderStep

Renders a React element and populates ReactTestState fields.

```javascript
.render("mount component", <MyComponent />)
.render("mount with wrapper", <MyComponent />, { wrapper: ThemeProvider })
```

**execute(state):**
1. Check DOM globals (document, window, HTMLElement) — throw INVALID_STEP
   with message `"DOM environment required — install jsdom or use Vitest
   with jsdom/happy-dom environment"` if missing
2. Evaluate element (if function, call it; otherwise use directly)
3. Call `@testing-library/react.render(element, { wrapper })`
4. Populate `state.screen` (via `within(container)` for container-scoped
   queries), `state.container`, `state.rerender`
5. Attempt to set up `state.user` via `@testing-library/user-event` — if
   not installed, `state.user` is set to null (not an error; user-event is
   optional). Interaction steps will throw INVALID_STEP if user is null.
6. Return state

**expectedOutcome:** null (render is a transform, not an assertion)

**validate:** Name must be non-empty. Element (fn field) can be JSX or a
function — no callable check required.

### InteractStep

Executes a user interaction callback against state.

```javascript
.interact("click button", async (state) => {
    await state.user.click(state.screen.getByRole("button"));
    return state;
})
```

**execute(state):**
1. Validate that state.user is not null — throw INVALID_STEP with message:
   `"user-event is required for interact() — install @testing-library/user-event"`
2. Call the callback with state
3. Callback must return ReactTestState (same contract as stage)
4. Return state

**Error handling:** Same semantics as stage. If the callback throws and an
errorHandler is provided, the handler receives the error. The handler's
return value is not used to replace state — interact errors set
`state._lastStepStatus` to `CTGTestResult.STATUS.ERROR` or
`CTGTestResult.STATUS.RECOVERED`. The pipeline records the result
accordingly.

**expectedOutcome:** null (interact is a transform)

**validate:** fn must be a function. Name must be non-empty.

### SnapshotStep

Renders the component via `react-test-renderer` and compares the serialized
component tree against a stored JSON baseline.

**Important distinction:** The render step uses `@testing-library/react` for
DOM-based rendering — this is for interaction and behavioral testing (clicking
buttons, querying text, asserting DOM state). The snapshot step uses
`react-test-renderer` independently — this is for structural testing (has the
component tree changed?). These are different renderers serving different
purposes. They do not share state.

```javascript
.assertSnapshot("component tree", <MyComponent prop="value" />)
.assertSnapshot("with options", <MyComponent />, {
    baselinePath: "./snapshots/my-component.snap.json"
})
```

**execute(state):**
1. Import `react-test-renderer` — throw INVALID_STEP if not installed
2. Render the element via `renderer.create(element).toJSON()` — produces
   a plain JSON object representing the component tree
3. Resolve the baseline file path (see Baseline Persistence below)
4. Load the stored baseline from the file using the snapshot key
5. Set `state.actual` to the current tree
6. Set `this._resolvedExpected` to the baseline value (used by
   expectedOutcome getter)
7. Handle first-run and update-mode cases:
   - **No baseline + createBaselines true (default):** write the current
     tree as the baseline. Set `this._resolvedExpected` to the current tree
     (pipeline comparison will pass)
   - **No baseline + createBaselines false:** set `this._resolvedExpected`
     to a sentinel value that will never match (pipeline comparison will
     fail with a "no baseline" message)
   - **updateSnapshots true:** overwrite the baseline. Set
     `this._resolvedExpected` to the current tree (pipeline comparison
     will pass)
8. Return state

**expectedOutcome:** `{ type: "value", expected: this._resolvedExpected }`

The step dynamically resolves the expected value during execute. The
`expectedOutcome` getter reads `this._resolvedExpected` which is set during
execution. Before execution, `expectedOutcome` returns null. After execution,
it returns the resolved baseline for pipeline comparison.

NOTE: This means expectedOutcome is execution-dependent, unlike other step
types where it is fixed at construction. This is an acceptable deviation
because snapshot baselines are file-backed and cannot be known until the
step reads the file.

**validate:** Name must be non-empty. Element must be provided (JSX or
function returning JSX).

### Baseline Persistence

Snapshot baselines are stored as JSON files. One file per pipeline, one
key per step.

**File path resolution (precedence):**
1. `opts.baselinePath` on the step — explicit path
2. `config.snapshotFilePath` — pipeline-level config
3. `config.snapshotFileUrl` — resolved via `fileURLToPath`, then
   `__snapshots__/{pipelineName}.snap.json` relative to that file's
   directory
4. If none provided: throw INVALID_CONFIG with message
   `"snapshotFilePath or snapshotFileUrl required for assertSnapshot"`

There is no implicit fallback. The caller must provide a path or URL
so the library can deterministically resolve the baseline location.

**Key format:** `{pipelineName} > {stepName}` — sanitized for filesystem
safety by escaping path separators, control characters, and null bytes.
Uses the same escape-based sanitization as v1 (backslash escaping, not
slug-based) to prevent key collisions between distinct names.

**File schema:**
```json
{
    "pipeline name > step name": { "type": "div", "props": {}, "children": [...] },
    "pipeline name > other step": { "type": "span", "props": {}, "children": null }
}
```

Keys are sanitized step paths. Values are the `react-test-renderer` JSON
tree output. Files are written atomically (write to temp, rename).

**Missing dependency:** If `react-test-renderer` is not installed, the step
throws INVALID_STEP with message `"react-test-renderer is required for
assertSnapshot() — install react-test-renderer"`.

**Peer dependency:** `react-test-renderer` is a peer dependency — projects
that don't use snapshot testing don't pay the install cost.

### RenderHookStep

Renders a React hook in isolation and populates state with the hook result.

```javascript
.renderHook("use counter", () => useCounter(0))
```

**execute(state):**
1. Check DOM globals (document, window, HTMLElement) — throw INVALID_STEP
   with message `"DOM environment required — install jsdom or use Vitest
   with jsdom/happy-dom environment"` if missing
2. Call `@testing-library/react.renderHook(hookFn, { wrapper })`
3. RTL's renderHook returns `{ result, rerender, unmount }` — not the
   same shape as render(). Field mapping:
   - `state.screen` — set to `within(document.body)`. This is intentionally
     global-document-based, unlike render's `within(container)`. Hooks don't
     produce a dedicated container — the wrapper renders into document.body.
     This carries the same global binding risk as `rtl.screen` but is
     acceptable because hook tests rarely chain with component tests or
     run interleaved with render cleanup.
   - `state.container` — set to `document.body` (hooks don't render
     visible DOM, but the wrapper may)
   - `state.rerender` — set to hookResult.rerender (re-runs the hook)
   - `state.user` — set to null (hooks don't have user interactions)
   - `state.data.result` — set to hookResult.result (a ref object;
     `result.current` holds the hook's return value and updates on
     rerender)
4. Return state

**expectedOutcome:** null (renderHook is a transform)

**validate:** fn must be a function (the hook function). Name must be
non-empty.

---

## 3. CTGReactTest

Extends CTGTest. Adds builder methods for React-specific step types. Adds
React-specific config keys for snapshot management.

### Builder Methods

```javascript
// :: STRING, JSX|(VOID -> JSX), OBJECT? -> this
.render(name, element, opts)

// :: STRING, (reactTestState -> reactTestState), (Error -> *)? -> this
.interact(name, fn, errorHandler)

// :: STRING, JSX|(VOID -> JSX), OBJECT? -> this
.assertSnapshot(name, element, opts)

// :: STRING, (VOID -> *), OBJECT? -> this
.renderHook(name, hookFn, opts)
```

Inherited from CTGTest: stage, assert, assertAny, skip.

### Chain Override (ReactChainStep)

CTGReactTest overrides the chain step to preserve React testing state
across chained pipelines.

**Problem:** CTGTest's ChainStep passes `state.subject` to the inner
pipeline. For React tests, the testing surface (screen, container, user,
rerender) lives on state fields, not on subject. The inner pipeline would
get a fresh ReactTestState with null React fields.

**Solution:** ReactChainStep clones the outer state into a new
ReactTestState, copying all React fields. The inner pipeline receives a
separate state instance that shares the same rendered component references
but has its own results array and name.

```javascript
const verifyGreeting = CTGReactTest.init("verify greeting")
    .assert("has greeting", (state) =>
        state.container.innerHTML.includes("Hello"), true);

CTGReactTest.init("my test")
    .render("mount", React.createElement(Greeting, { name: "World" }))
    .chain("verify", verifyGreeting)  // inner pipeline sees screen/container
    .start(null);
```

**Clone semantics:**
- The inner pipeline gets a **new ReactTestState instance** — its own
  results array, name, and config
- React fields (screen, container, user, rerender, data) are **shared
  references** — both pipelines see the same rendered component
- The outer pipeline's results and name are **not affected** by the
  inner pipeline's execution
- If the inner pipeline re-renders, the shared container reference
  changes — this is intentional and correct (the component changed)

**execute(state):**
1. Clone outer state into a new ReactTestState with shared React fields
2. Run the inner pipeline with the cloned state
3. Update outer state.subject from inner state.subject
4. Set state._chainResult with inner results and status
5. Return outer state

### Config

Inherits CTGTest config (haltOnFailure, timeout) plus:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `snapshotFilePath` | STRING\|NULL | `null` | Explicit path for snapshot file |
| `snapshotFileUrl` | STRING\|NULL | `null` | import.meta.url for snapshot resolution |
| `updateSnapshots` | BOOL | `false` | Overwrite existing baselines |
| `createBaselines` | BOOL | `true` | Create missing baselines on first run. Set to false in CI. |
| `maxSnapshotBytes` | INT\|NULL | `null` | Max byte size of serialized snapshot value. Throws INVALID_STEP if exceeded. Measured as `Buffer.byteLength(JSON.stringify(value))` before writing. |

### start()

Overrides CTGTest.start() to:
1. Wrap the subject in ReactTestState (not CTGTestState)
2. Delegate to super.start() for step sequencing
3. Return ReactTestState

Cleanup (RTL cleanup) is not performed by start(). The test suite script
handles cleanup, either after each pipeline or at the end of the suite.

### Callback Signatures

v2 callbacks receive ReactTestState:

```javascript
// interact and stage callbacks receive state directly
.interact("click", async (state) => {
    await state.user.click(state.screen.getByRole("button"));
    return state;
})

// assert callbacks read from state directly
.assert("title visible", (state) =>
    state.screen.getByRole("heading").textContent, "Hello")
```

---

## 4. Cleanup

v1 runs RTL cleanup in a finally block inside start(). v2 moves cleanup to
the caller.

```javascript
import { cleanup } from "@testing-library/react";

let state;
try {
    state = await CTGReactTest.init("my test")
        .render("mount", <MyComponent />)
        .assert("check", (state) => state.screen.getByText("Hello") !== null, true)
        .start(null, config);
} finally {
    cleanup();
}

process.stdout.write(CTGTestConsoleFormatter.format(state) + "\n");
collector.push({ name: state.name, status: state.status });
```

Cleanup must be in a `finally` block to prevent DOM state leaking on errors.
This is consistent with the v2 principle that the pipeline returns state and
the caller handles everything else, including lifecycle management.

---

## 5. Two Renderers

CTGReactTest uses two different React renderers for different purposes.
This is an intentional design decision, not a limitation.

### @testing-library/react (RTL)

Used by the **render step**. Produces a real DOM in jsdom. Populates
state.screen, state.user, state.container, state.rerender. This is the
renderer for behavioral testing — interacting with components, querying
the DOM, asserting on visible output.

`state.screen` uses RTL's `within(container)` for container-scoped queries
rather than the global `rtl.screen`. The global screen is bound to
`document.body` and is reset by `cleanup()` between tests — after cleanup,
global screen queries throw a binding error. Container-scoped queries avoid
this binding error because they reference the specific render container, not
the global document.

NOTE: After `cleanup()`, the rendered component is unmounted. Container-scoped
queries will not find nodes that were removed by unmounting. Querying state
from a prior pipeline after cleanup is undefined behavior — always run
assertions before cleanup.

### react-test-renderer

Used by the **assertSnapshot step**. Produces a serializable JSON tree
representing the component structure. This is the renderer for structural
testing — capturing what the component *is* (element types, props, children)
rather than what the browser *shows* (DOM nodes, HTML attributes).

These renderers do not share state. A render step and an assertSnapshot step
in the same pipeline render the component independently. This is correct —
they test different things.

### Peer Dependencies

| Dependency | Required By | Optional |
|-----------|------------|---------|
| `@testing-library/react` | render, interact, renderHook | No — required |
| `@testing-library/user-event` | interact (state.user) | Yes |
| `react-test-renderer` | assertSnapshot | Yes |

---

## 6. JSX Support

Test files and components under test are written as `.jsx` files. Node.js
cannot execute JSX natively, so the framework ships a lightweight ESM loader
hook that transforms `.jsx` imports via `esbuild` at load time.

### Loader Architecture

Two files in the package:

- **`JSXLoader.js`** — entry point for `--import`. Registers the hook
  via `node:module.register()`.
- **`JSXHook.js`** — ESM loader hook. Intercepts `.jsx` file loads,
  transforms source via `esbuild.transformSync` with `loader: "jsx"`,
  `format: "esm"`, `jsx: "automatic"`.

### Usage

```
node --import ctg-react-test/jsx-loader tests/SelfTest.js
```

Or in package.json:

```json
{
    "scripts": {
        "test": "node --import ctg-react-test/jsx-loader tests/SelfTest.js"
    }
}
```

### JSX Transform Mode

Uses `jsx: "automatic"` (React 17+ JSX transform). Components do not
need `import React from "react"` — the transform injects the JSX runtime
import automatically.

### Dependencies

`esbuild` is a runtime dependency — it is required by the loader hook
at import time. It installs as a single package plus a platform-specific
binary (2 packages total).

### Minimum Node Version

Node 20+ is required. The `node:module.register()` API and `--import`
flag are not available in earlier versions.

---

## 7. Open Questions

### CTGVitestFormatter

v1's CTGVitestFormatter is an "execution formatter" — it wraps the pipeline
and integrates with Vitest's test runner. v2 has no execution formatters.

Options:
- **Defer** — leave CTGVitestFormatter as v1 code, revisit when Vitest
  integration is needed
- **Adapt** — rewrite as a utility that takes ReactTestState and integrates
  with Vitest's test lifecycle
- **Drop** — remove if standalone execution via SelfTest scripts is
  sufficient

### CTGBrowserTest Separation

CTGBrowserTest will be extracted into its own package (`ctg-js-browser-test`
or similar). Browser testing via Playwright has no meaningful overlap with
React component testing via RTL:

- Different renderers (real browser vs jsdom)
- Different state models (BrowserContext vs ReactTestState)
- Different step types (navigate/mock vs render/interact)
- Different dependencies (playwright/pixelmatch vs react/RTL)

Browser testing is not React-specific — it applies to any web application.
Keeping it in ctg-react-test forces unnecessary peer dependencies on React
test consumers. Extraction is deferred until after CTGReactTest v2 is stable.

### CTGVitestFormatter Deprecation

CTGVitestFormatter is deprecated. Vitest is a test runner, not a report
format. There is no output format to produce for Vitest the way JUnit XML
is produced for CI tools. Vitest integration is a usage pattern — run
pipelines inside Vitest test files and map results to Vitest assertions.
This is documented as an example, not a framework class.

All ctg-js-test formatters (console, JSON) work with ReactTestState
because it extends CTGTestState. No React-specific formatters are needed.

### Removed

- **ReactContext** — replaced by ReactTestState
- **snapshot step (v1)** — replaced by assertSnapshot using react-test-renderer
- **v1 snapshot infrastructure** — `_compareSnapshot`, `_resolveSnapshotFilePath`,
  `_sanitizeSnapshotKey`, `_resolveSnapshotPaths`, `_updateSnapshot`,
  `_atomicWrite` static methods on CTGReactTest. Replaced by step-level
  baseline management using JSON file I/O
- **static STEP_TYPES** — polymorphic steps, no type sets
- **_validateStepDefinitions override** — steps validate themselves
- **_executeSteps override** — pipeline sequencer handles all steps
- **_results push** — caller-owned collection
- **_deliver** — caller-owned formatting
- **output/formatter config** — caller-owned delivery
- **collector/publishResult config** — removed from ctg-js-test v2
