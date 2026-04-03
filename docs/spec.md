# CTG React Test — Implementation Spec

**Source:** `js/ctg-react-test/docs/ctg-react-test-requirements.md`
**Language:** JavaScript (ESM, Node.js)
**Code Style:** `ctg-project-proc/code-styles/js-code-style.md`

---

## Requirements Doc Divergences

This spec intentionally diverges from the requirements document in the following areas:

### JavaScript, Not TypeScript

**Requirements doc says:** TypeScript >= 5.0, type signatures in TS syntax.

**This spec says:** Plain JavaScript with ESM, consistent with `ctg-js-test` and
`ctg-js-api-client`. The CTG code style guide is JS-first. Type contracts are
documented via HM-style signatures in comments, not TypeScript interfaces. This
keeps the dependency chain simple and avoids a build step.

### Single Package, Not Monorepo

**Requirements doc says:** `packages/core`, `packages/react`, `packages/vitest-formatter`,
`packages/playwright-formatter`, `packages/formatters`.

**This spec says:** Single package. The core engine is `ctg-js-test` (imported as a
dependency). `ctg-react-test` adds the React layer and formatters in one package.
This avoids monorepo tooling complexity and matches the flat structure of all other
CTG JS projects. Peer dependencies isolate optional integrations (Vitest, Playwright).

### Extends ctg-js-test, Does Not Re-Port

**Requirements doc says:** "Port the ctg-php-test pipeline model faithfully to TypeScript."

**This spec says:** The core pipeline engine already exists as `ctg-js-test` (v1.0.0,
shipped). `ctg-react-test` extends `CTGTest` via `class CTGReactTest extends CTGTest`.
No re-implementation of the core engine. All core behavior (stage, assert, assertAny,
chain, skip, start, compare, error handling, result model) is inherited.

### Strict Comparison Uses util.isDeepStrictEqual

**Requirements doc says:** `Object.is()` for strict comparison.

**This spec says:** `util.isDeepStrictEqual` via the inherited `compare()` method from
`ctg-js-test`. This is already implemented and tested. `Object.is()` is too shallow
for deep object comparison. Subclasses can override `compare()` for custom matching.

### Playwright Deferred to v2

**Requirements doc says:** PlaywrightFormatter, PlaywrightContext, navigate, screenshotAssert
as part of the initial framework.

**This spec says:** Playwright integration is deferred. v1.0.0 covers the React/Vitest
tier (unit, component, snapshot). Playwright adds significant complexity (browser
management, screenshot baselines, network interception) that warrants its own spec
after the React layer is proven. The architecture supports it — `CTGReactTest` can be
extended again for Playwright — but it is not in this spec.

### Open Questions Resolved

The requirements doc lists 7 open questions. Resolutions for v1.0.0:

1. **Hook testing:** Use `renderHook()` convenience stage. Hooks are common enough to
   warrant a dedicated step rather than requiring a wrapper component.
2. **Parallel execution:** All steps remain strictly sequential. Vitest parallelism is
   at the file level, not the step level. Pipeline semantics require sequential subject
   threading.
3. **Custom matchers:** Not included in v1.0.0. The `compare()` override point is
   sufficient. Built-in matchers (toBeAccessible, etc.) are a future enhancement.
4. **Vitest Reporter:** Not included in v1.0.0. The VitestFormatter handles execution
   adapter duties. A custom reporter for five-status terminal output is a future
   enhancement.
5. **Mocking:** Follow ctg-php-test philosophy — use stages for dependency injection.
   No built-in mock API. Vitest's `vi.mock`/`vi.fn` can be used in stage callables
   by the test author.
6. **State management:** No built-in provider stages. Test authors compose provider
   wrappers as pipeline fragments (e.g., a `withReduxStore` chain). This is the
   composability model working as designed.
7. **CI integration:** JUnit formatter from ctg-js-test is inherited. No additional
   CI reporters in v1.0.0.

---

## File Layout

```
ctg-react-test/
├── src/
│   ├── CTGReactTest.js              # React test pipeline (extends CTGTest)
│   ├── ReactContext.js              # Subject wrapper for React render results
│   ├── formatters/
│   │   └── CTGVitestFormatter.js    # Execution adapter for Vitest
│   └── index.js                     # Package entry point
├── tests/
│   └── SelfTest.js                  # Self-tests
├── docs/
│   ├── ctg-react-test-requirements.md  # Requirements document
│   └── spec.md                         # This file
└── package.json
```

### package.json

```json
{
    "name": "ctg-react-test",
    "version": "1.0.0",
    "type": "module",
    "exports": {
        ".": "./src/index.js"
    },
    "peerDependencies": {
        "react": ">=18.0.0",
        "react-dom": ">=18.0.0",
        "@testing-library/react": ">=14.0.0",
        "@testing-library/user-event": ">=14.0.0",
        "vitest": ">=1.0.0"
    },
    "peerDependenciesMeta": {
        "vitest": { "optional": true },
        "@testing-library/user-event": { "optional": true }
    },
    "dependencies": {
        "ctg-js-test": "file:../ctg-js-test"
    }
}
```

- **`"type": "module"`** — all `.js` files are ESM
- **Peer dependencies** — React, Testing Library, and Vitest are peer deps (not bundled)
- **Vitest is optional** — standalone/console mode works without it
- **ctg-js-test** — linked as file dependency during development; published version
  would use a registry reference
- **Minimum Node.js version:** 19.7+ (matches ctg-js-test)

---

## Class: ReactContext

**File:** `src/ReactContext.js`
**Requirements doc ref:** Section 3.2 Subject Model for React

Value object wrapping a `@testing-library/react` render result. This is the subject
threaded through React test pipelines.

### Constructor

```javascript
// CONSTRUCTOR :: OBJECT -> this
// Wraps a render result with screen, user event, container, rerender, and data bag.
constructor({ screen, user, container, rerender, data = {} })
```

### Properties

```javascript
// GETTER :: VOID -> OBJECT
// @testing-library/react screen queries (getByRole, getByText, etc.)
get screen()

// GETTER :: VOID -> OBJECT
// @testing-library/user-event instance for simulating interactions
get user()

// GETTER :: VOID -> HTMLElement
// Root DOM container element
get container()

// GETTER :: VOID -> (JSX -> VOID)
// Re-render function for updating props
get rerender()

// GETTER :: VOID -> OBJECT
// Arbitrary test data bag for passing values between stages
get data()

// SETTER :: OBJECT -> VOID
// Replace the data bag
set data(value)
```

### Instance Methods

```javascript
// :: STRING -> *
// Shorthand for this.data[key]. Returns undefined if key not set.
get(key)

// :: STRING, * -> this
// Shorthand for this.data[key] = value. Chainable.
set(key, value)
```

### Language-Specific Decisions

- `data` is a mutable bag for passing values between stages. This is the only
  mutable property — screen, user, container, and rerender are read-only.
- `get`/`set` methods provide a clean API for data threading without exposing
  the raw object. Stage functions should prefer `ctx.set("key", value)` over
  `ctx.data.key = value` for consistency.
- `user` is optional — if `@testing-library/user-event` is not installed,
  `user` is `null`. Stages that call `ctx.user.click(...)` should check first
  or use the `interact()` convenience step which validates.

---

## Class: CTGReactTest

**File:** `src/CTGReactTest.js`
**Requirements doc ref:** Sections 5.1–5.3

Extends `CTGTest` from `ctg-js-test`. Adds React-specific step types and an
overridden `start()` that delegates to execution formatters when configured.

### Static Fields

```javascript
static STEP_TYPES = new Set([
    ...CTGTest.VALID_STEP_TYPES,
    "render", "interact", "snapshot", "renderHook"
]);
```

### Constructor

```javascript
// CONSTRUCTOR :: STRING -> this
// Creates a React test pipeline. Delegates to CTGTest constructor.
constructor(name)
```

### Instance Methods — React Steps

```javascript
// :: STRING, JSX|(() -> JSX), OBJECT? -> this
// Renders a React element and wraps the result as a ReactContext subject.
// element: JSX element or function returning JSX (for lazy evaluation)
// opts: { wrapper?, user? } — optional wrapper component and userEvent options
// NOTE: Replaces the current subject with a new ReactContext.
render(name, element, opts = {})
```

Internally creates a `CTGTestStep` with type `"render"`. At execution time:
1. Call `@testing-library/react`'s `render(element, { wrapper: opts.wrapper })`
2. Create `userEvent.setup(opts.user)` if `@testing-library/user-event` is available
3. Build `ReactContext` from render result + user + container + rerender
4. Return the `ReactContext` as the new subject

```javascript
// :: STRING, (* -> *|PROMISE(*)) -> this
// Convenience stage for user interactions. Receives ReactContext, must return it.
// Semantically distinct from stage for reporting purposes.
interact(name, fn)
```

Internally creates a `CTGTestStep` with type `"interact"`. Execution is identical
to `stage` — the callable receives the subject and returns it. The distinct type
enables formatters to report interactions differently (e.g., with a `[interact]` label
vs `[stage]`).

```javascript
// :: STRING, ((ReactContext) -> *)? -> this
// Snapshot assert. fn extracts a serializable value from the subject.
// Default fn: (ctx) => ctx.container.innerHTML
// When using VitestFormatter, emits toMatchSnapshot().
// In standalone mode, stores/compares snapshots via a file-based snapshot manager.
snapshot(name, fn = null)
```

Internally creates a `CTGTestStep` with type `"snapshot"`. The `fn` defaults to
extracting `container.innerHTML`. The `expected` field stores `"__snapshot__"` as
a sentinel — the actual comparison is deferred to the formatter or snapshot manager.

```javascript
// :: STRING, (() -> *), OBJECT? -> this
// Renders a hook in isolation and makes its return value the subject.
// hookFn: function that calls the hook (e.g., () => useCounter(0))
// opts: { wrapper? } — optional wrapper component (for providers)
renderHook(name, hookFn, opts = {})
```

Internally creates a `CTGTestStep` with type `"renderHook"`. At execution time:
1. Call `@testing-library/react`'s `renderHook(hookFn, { wrapper: opts.wrapper })`
2. Build a `ReactContext` where `container` is the wrapper element, `screen` is
   the standard screen, and `data.result` holds the hook return value
3. Return the `ReactContext` as the new subject

### Overridden start()

```javascript
// :: *, OBJECT? -> PROMISE(STRING|OBJECT|VOID)
// If formatter is an ExecutionFormatter, delegates pipeline to it.
// Otherwise calls super.start() for standalone execution.
async start(subject, config = {})
```

Execution logic:
1. Resolve formatter from config (default: inherited console formatter)
2. If `formatter.constructor._isExecutionFormatter === true`:
   - Call `formatter.execute(this, subject, config)`
   - The formatter registers native test runner constructs (describe/it/expect)
   - The formatter is responsible for cleanup (via `afterAll` in the `describe` block)
   - `start()` returns immediately after registration — no `finally` cleanup here
     because test execution happens later when Vitest runs the registered blocks
   - Return value depends on the formatter
3. Otherwise (standalone mode):
   - Call `super.start(subject, config)` wrapped in try/finally
   - `finally` block calls `cleanup()` — this is safe because standalone mode
     executes synchronously (all steps complete before `start()` returns)

### Overridden _executeSteps()

The parent `_executeSteps` handles `stage`, `assert`, `assert-any`, and `chain`.
`CTGReactTest` overrides (or extends) `_executeSteps` to handle the additional
step types:

- **`render`**: calls the render logic described above, produces a `stepResult`
  with type `"render"`, updates subject to the new `ReactContext`
- **`interact`**: identical to `stage` execution but produces a `stepResult`
  with type `"interact"`
- **`snapshot`**: calls the extraction fn, then either:
  - In standalone mode: compares against stored snapshot file, produces
    `assertResult` with actual/expected
  - In VitestFormatter mode: the formatter handles snapshot comparison
    via `expect().toMatchSnapshot()`
- **`renderHook`**: calls the renderHook logic, produces a `stepResult`
  with type `"renderHook"`, updates subject

### Static Methods

```javascript
// Static Factory Method :: STRING -> ctgReactTest
// Creates a new React test definition.
static init(name)
```

Uses `new this(name)` for late-bound construction.

### Language-Specific Decisions

- **No Playwright steps in v1.0.0** — `navigate`, `screenshotAssert` are deferred.
  The `STEP_TYPES` set does not include them.
- **Snapshot sentinel** — `"__snapshot__"` in the `expected` field signals that
  comparison is deferred to the formatter/snapshot manager, not handled by `compare()`.
- **render() accepts JSX or function** — function form enables lazy evaluation for
  cases where the element depends on runtime setup (providers, context values).
- **interact() is semantically a stage** — it threads and mutates the subject. The
  distinct type is purely for reporting clarity.

---

## Class: CTGVitestFormatter

**File:** `src/formatters/CTGVitestFormatter.js`
**Requirements doc ref:** Sections 6.1–6.3

Execution formatter that registers pipeline steps as native Vitest constructs.
Implements the `execute()` method (ExecutionFormatter pattern).

### Static Methods

```javascript
// :: OBJECT, OBJECT? -> STRING
// Output formatter interface — formats a completed report for display.
// Used when the formatter is passed to a standalone start() call.
static format(report, config = {})
```

### Instance Methods

```javascript
// :: ctgReactTest, *, OBJECT? -> VOID
// Walks the pipeline definition and registers Vitest describe/it/expect blocks.
// This method is called by CTGReactTest.start() when the formatter is detected
// as an ExecutionFormatter.
execute(pipeline, subject, config = {})
```

#### Execution Mapping

See "Vitest Execution Algorithm" section below for the definitive step-by-step
algorithm. Summary:

| Pipeline Step | Vitest Emission |
|--------------|----------------|
| Pipeline name | `describe(name, () => { ... })` |
| `stage`, `render`, `renderHook`, `interact` | `it("[type] name", async () => { ... })` — executes at runtime, updates shared state |
| `assert` | `it(name, async () => { expect(...).toEqual(...) })` |
| `assertAny` | `it(name, async () => { expect(...).toContainEqual(...) })` |
| `snapshot` | `it(name, () => { expect(...).toMatchSnapshot() })` |
| `chain` | Nested `describe(name, () => { ... })` |
| `skip` (unconditional) | `it.skip(name, ...)` |
| `skip` (conditional) | Predicate evaluated at runtime inside `it()`; early-return if true (Vitest sees pass; `state.statuses` records skip) |

#### Subject Threading in Vitest Mode

All steps share a mutable `state` object declared in the `describe` closure.
Stages update `state.subject`; asserts read it. This is safe because Vitest runs
tests within a `describe` block sequentially (not in parallel). No pipeline logic
runs at describe-registration time — all execution happens inside `it()` blocks.

#### Five-Status Mapping (Lossy)

Vitest natively supports pass/fail/skip. The full five-status mapping is lossy
in Vitest mode. See "Five-Status Lossy Mapping in Vitest Mode" in the algorithm
section for the definitive table. Summary:

| Pipeline Status | Vitest Sees |
|----------------|-------------|
| pass | pass |
| fail | fail |
| error | fail |
| recovered | pass (with `[RECOVERED]` warning) |
| skip (unconditional) | skip (`it.skip`) |
| skip (conditional) | pass (early return) |
| halted | pass (early return) |

Accurate five-status counts are available via `state.statuses` after execution.

### Language-Specific Decisions

- **Formatter is instantiated, not a class reference** — unlike ctg-js-test's formatters
  which are classes with static `format()`, the VitestFormatter is an instance because
  it holds state (the shared state object, skip resolutions). The static `format()`
  method is still available for output-only usage.
- **Error recovery** — when a stage's error handler fires and recovers, the formatter
  logs `console.warn("[RECOVERED]", stepName, message)` so the recovery is visible
  in Vitest output even though the test passes.

---

## DOM Environment (Standalone Mode)

When running in standalone mode (without Vitest), `render()` and `renderHook()` steps
require a DOM environment. Vitest provides this via `jsdom` or `happy-dom` configuration.
In standalone mode, the caller is responsible for provisioning the DOM before pipeline
execution.

**Required:** The `jsdom` package must be installed and the global DOM must be
initialized before `CTGReactTest.start()` is called. The spec does not auto-provision
this — it is the caller's responsibility.

**Detection:** `render()` and `renderHook()` check for the minimal globals required
by `@testing-library/react`:

```javascript
if (typeof document === "undefined"
    || typeof window === "undefined"
    || typeof HTMLElement === "undefined") {
    throw new CTGTestError("INVALID_STEP",
        "DOM environment required — install jsdom or use Vitest with jsdom/happy-dom environment");
}
```

All three globals must be present. `document` alone is insufficient — Testing Library
and React DOM also require `window` (for event dispatch) and `HTMLElement` (for
instance checks and type validation).

**Recommendation for standalone test files:**
```javascript
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;
// ... then run pipelines
```

---

## Lifecycle and Cleanup

### Cleanup Contract

After each pipeline execution (`start()` returns), all rendered React trees must be
unmounted and DOM state cleaned. This prevents memory leaks and cross-test contamination.

**Cleanup strategy: per-pipeline.** Cleanup runs once after all steps complete (not
per-step). This is because stages thread a shared `ReactContext` — cleaning up
mid-pipeline would destroy the render tree that subsequent steps need.

**Implementation:**
1. `start()` wraps `super.start()` (or execution formatter delegation) in a try/finally
2. The `finally` block calls `@testing-library/react`'s `cleanup()` function
3. This unmounts all rendered components and resets the DOM container
4. Cleanup runs regardless of pass, fail, or error status

```javascript
async start(subject, config = {}) {
    const formatter = config?.formatter ?? null;
    if (formatter?.constructor._isExecutionFormatter === true) {
        // Vitest mode: register tests, formatter owns cleanup via afterAll
        return formatter.execute(this, subject, config);
    }
    // Standalone mode: execute pipeline, cleanup after completion
    try {
        return await super.start(subject, config);
    } finally {
        const { cleanup } = await import("@testing-library/react");
        cleanup();
    }
}
```

**In Vitest mode:** The VitestFormatter registers `afterAll(() => { cleanup() })`
within the `describe` block. `afterAll` (not `afterEach`) is used because the
pipeline's steps share a single threaded subject — the `ReactContext` from a `render`
step must remain mounted and accessible to subsequent `assert`, `interact`, and
`snapshot` steps. Cleaning up after each `it()` would unmount the component before
dependent steps can inspect it. Cleanup after the full pipeline ensures subject
continuity is preserved throughout the `describe` block.

---

## renderHook Subject Contract

When `renderHook()` executes, it calls `@testing-library/react`'s `renderHook` and
produces a `ReactContext` with a specific structure:

```javascript
const { result, rerender, unmount } = renderHookResult;
```

**Subject contract:**
- `ctx.data.result` — the `result` ref object from `renderHook()`. This is a ref
  with a `.current` property that always reflects the latest hook return value.
  It is **not** a snapshot of the initial return value — reads of `ctx.data.result.current`
  after a rerender reflect the updated state.
- `ctx.rerender` — calls `renderHookResult.rerender(newProps)` to trigger a hook
  re-execution with new props
- `ctx.container` — the wrapper element (usually a `<div>`)
- `ctx.screen` — standard screen queries

**Why `result` (ref) and not `result.current` (value):** Storing the ref preserves
reactivity. If a stage calls `ctx.rerender(newProps)`, subsequent asserts see the
updated hook return value via `ctx.data.result.current`. Storing `result.current`
at render time would freeze the initial value and miss updates.

**Test pattern:**
```javascript
CTGReactTest.init("useCounter")
    .renderHook("mount", () => useCounter(0))
    .assert("initial value", (ctx) => ctx.data.result.current.count, 0)
    .stage("increment", async (ctx) => {
        await act(() => ctx.data.result.current.increment());
        return ctx;
    })
    .assert("incremented", (ctx) => ctx.data.result.current.count, 1)
```

---

## Snapshot Manager (Standalone Mode)

When running without Vitest (standalone/console mode), snapshot assertions need a
file-based snapshot manager since there's no Vitest to handle `.snap` files.

### Snapshot File Identity

Each snapshot is keyed by a combination of **file path** and **step path**:

- **File path:** The absolute path of the test file calling `start()`. Determined
  in priority order:
  1. **Explicit override:** `config.snapshotFilePath` — if provided, used directly.
     This is the recommended approach for reliable behavior across environments.
  2. **`import.meta.url` passthrough:** `config.snapshotFileUrl` — if provided as
     `import.meta.url`, resolved to absolute path via `fileURLToPath()`.
  3. **Stack parsing fallback:** `new Error().stack` parsing at `start()` call time.
     The stack frame is parsed to extract the caller's file URL. This is fragile
     across Node versions, runners, and transpilers — use only as last resort.
  This is stored as `_snapshotFilePath` on the pipeline instance before execution.
- **Step path:** `{pipelineName} > {stepName}` — includes chain nesting for uniqueness
  (e.g., `"Login > accessibility > has form role"`).
- **Snapshot key:** `{stepPath}` within the file-scoped snapshot JSON.

### Snapshot File Location

```
{testFileDir}/__snapshots__/{testFileBaseName}.snap.json
```

Example: test file at `/project/tests/LoginTest.js` stores snapshots at
`/project/tests/__snapshots__/LoginTest.snap.json`.

### Snapshot File Format

```json
{
    "Login > render default > snapshot": "<div class=\"login-form\">...</div>",
    "Login > render error > snapshot": "<div class=\"error\">...</div>"
}
```

JSON format (not Vitest's custom `.snap` format). Keys are step paths, values are
the serialized snapshot values.

### Path Safety

- **Sanitization:** Pipeline names and step names are sanitized before use in keys:
  control characters, path separators (`/`, `\`), and null bytes are stripped.
  The key is the sanitized step path, not a file path — no path traversal risk.
- **Scoped writes:** Snapshot files are always written relative to the test file's
  directory (`__snapshots__/` subdirectory). The snapshot manager must not write
  outside this scope. Absolute paths or `..` in derived paths are rejected.
- **Symlink safety:** Before writing, the resolved real path of the
  `__snapshots__/` directory (not the target file, which may not exist yet)
  is checked via `fs.realpathSync` to ensure it falls under the test file's
  parent directory. The check is:
  1. Resolve the intended snapshot directory: `{testFileDir}/__snapshots__/`
  2. Create the directory if it doesn't exist (`mkdirSync({ recursive: true })`)
  3. Resolve the real path of the directory: `fs.realpathSync(snapshotDir)`
  4. Verify containment using `path.relative`:
     ```javascript
     const rel = path.relative(fs.realpathSync(testFileDir), realSnapshotDir);
     if (rel.startsWith("..") || path.isAbsolute(rel)) { throw ... }
     ```
     This is boundary-safe — `path.relative` produces `".."` prefixes for
     paths outside the base, and absolute paths for cross-device targets.
     Simple `startsWith` prefix checks are not used because they are
     vulnerable to sibling-path bypass (e.g., `/proj/tests-evil` matching
     `/proj/tests`).
  5. If containment fails, throw `CTGTestError("INVALID_STEP",
     "Snapshot directory resolves outside test file directory")`
  6. Write the target file inside the verified directory via atomic temp+rename
  This prevents symlink attacks where `__snapshots__/` is symlinked to an
  external location. The file itself is not checked (it may not exist on
  first run) — containment is enforced at the directory level.
- **Atomic writes:** Snapshots are written via `writeFileSync` to a temp file, then
  renamed to the target path. This prevents partial writes on crash.
- **Directory creation:** `__snapshots__/` is created via `mkdirSync({ recursive: true })`
  if it doesn't exist.

### Behavior

1. First run (no snapshot file or key missing): snapshot is written, step passes
2. Subsequent runs: snapshot is compared. Match → pass, mismatch → fail with
   actual/expected in the result
3. Update mode: `config.updateSnapshots = true` overwrites existing snapshots
4. Deleted snapshots: removing a key from the file causes first-run behavior (write + pass)
5. Size guard: if `config.maxSnapshotBytes` is set (positive integer), the serialized
   snapshot value is checked before write. If `Buffer.byteLength(JSON.stringify(value))`
   exceeds the limit, the step throws `CTGTestError("INVALID_STEP",
   "Snapshot exceeds maxSnapshotBytes limit")`. Default: no limit. Recommended
   setting for CI: `maxSnapshotBytes: 102400` (100KB) to prevent oversized
   snapshots from bloating the repository.

### Implementation

```javascript
// :: STRING, STRING, * -> {match: BOOL, stored: *}
// Reads stored snapshot by file path and step path. Compares with actual.
// Returns { match: true } if equal, { match: false, stored } if different.
// Returns { match: true } and writes if key is missing (first run).
static _compareSnapshot(filePath, stepPath, actual)

// :: STRING, STRING, * -> VOID
// Writes snapshot value to file. Creates directory and file if needed.
static _updateSnapshot(filePath, stepPath, value)
```

### Snapshot File Path in CI

In CI environments, stack-based fallback parsing is unreliable due to transpilers,
bundlers, and runner wrappers that alter stack frames. Tests should pass
`config.snapshotFilePath` or `config.snapshotFileUrl` explicitly:

```javascript
await pipeline.start(subject, {
    snapshotFileUrl: import.meta.url
});
```

If the fallback parser produces a path that does not exist or resolves outside the
project directory, the snapshot step throws `CTGTestError("INVALID_STEP",
"Unable to determine snapshot file path — set config.snapshotFilePath explicitly")`.

### Snapshot Content Safety

The default snapshot extraction (`ctx.container.innerHTML`) captures the full
rendered DOM as a string. This may include sensitive values (tokens, cookies,
PII, API keys) that were rendered into the component tree.

**Sanitization hook:** `snapshot()` accepts an optional `sanitize` function in its
options that runs after extraction and before storage/comparison:

```javascript
// :: STRING, ((ReactContext) -> *)?, OBJECT? -> this
// opts.sanitize: (value) -> value — transforms extracted value before snapshot
snapshot(name, fn = null, opts = {})
```

Usage:
```javascript
.snapshot("login form", null, {
    sanitize: (html) => html.replace(/token=[^"]+/g, "token=REDACTED")
})
```

If no sanitize hook is provided, the raw extracted value is stored. The spec
does not enforce automatic redaction — the test author is responsible for
ensuring sensitive values are not committed in `.snap.json` files. Documentation
should warn about this risk prominently.

---

## Safety and Observability

### Recovered/Error Message Sanitization

When the VitestFormatter logs `console.warn("[RECOVERED]", stepName, message)` or
error details, the message may contain sensitive information from thrown errors
(database connection strings, API keys in URLs, user data in validation errors).

**Configurable sanitizer:** The formatter accepts an optional `sanitizeMessage`
function via config:

```javascript
new CTGVitestFormatter({
    sanitizeMessage: (msg) => msg.replace(/Bearer [^\s]+/g, "Bearer REDACTED")
})
```

If not provided, messages are logged as-is. The spec does not enforce automatic
redaction — the deployer is responsible for configuring sanitization in environments
where log output may be captured (CI logs, monitoring systems).

### CI Guidance for Five-Status Accuracy

In Vitest mode, conditional skips and halted steps appear as "pass" in Vitest
output (see Five-Status Lossy Mapping). This means CI pipelines that only check
Vitest pass/fail totals may miss skipped or halted steps.

**Recommended CI assertion pattern:** After pipeline execution, read
`state.statuses` (exposed via the formatter's `getReport()` method) and assert
on the pipeline report counts:

```javascript
const formatter = new CTGVitestFormatter();
await pipeline.start(null, { formatter });

// In an afterAll or separate test:
const report = formatter.getReport();
expect(report.skipped).toBe(0);     // no unexpected skips
expect(report.errored).toBe(0);     // no errors masked as pass
```

This ensures CI catches cases where tests appear green but have internally
skipped or halted steps. The `getReport()` method returns a standard
`PipelineReport` with accurate five-status counts.

---

## Vitest Execution Algorithm

### v1.0.0: In-Process Execution

The v1.0.0 `CTGVitestFormatter` executes pipeline steps **in-process sequentially**
rather than emitting native Vitest `describe`/`it` registrations. This provides
correct five-status semantics, subject threading, and report generation without
requiring Vitest's runtime context. The formatter can run both inside Vitest
(called from a test file) and standalone (called from `node`).

**Trade-offs:**
- Skip display, watch-mode filtering, and per-step duration in Vitest output
  are not available (steps don't register as individual `it()` blocks)
- Five-status reporting is accurate via `getReport()`
- Subject threading and cleanup are correct

**Future:** A v2 formatter may emit real `describe`/`it` blocks for native Vitest
integration. The spec below describes that target model for reference, but v1.0.0
implements the in-process model.

### Target Model (Reference — Not Implemented in v1.0.0)

Given a pipeline with steps `[s1, s2, s3, ...]` and an initial subject:

1. Emit `describe(pipeline.name, () => { ... })`

2. Inside the describe block, declare a shared state container:
   ```javascript
   const state = { subject: initialSubject, error: null, halted: false };
   ```

3. Walk steps in order and emit **registration-only** constructs:

   - **If step is `stage`, `render`, `renderHook`, or `interact`:**
     Emit `it("[{type}] {name}", async () => { ... })` where the body:
     1. Checks `state.halted` — if true, skip via `return` (step is effectively skipped due to prior failure)
     2. Executes `await fn(state.subject)`
     3. On success: updates `state.subject` with the returned value
     4. On error with handler: calls handler, updates subject if recovered,
        logs `console.warn("[RECOVERED]", name, message)`
     5. On error without handler: throws (Vitest reports as failed test),
        sets `state.halted = true` if haltOnFailure is configured

   - **If step is `assert`:**
     Emit `it("{name}", async () => { ... })` where the body:
     1. Checks `state.halted` — if true, skip
     2. Executes `const actual = await fn(state.subject)`
     3. Calls `expect(actual).toEqual(expected)` (strict) or custom comparison
     4. On error with handler: recovers, compares recovered value.
        Match → pass with `[RECOVERED]` warning. No match → `expect` fails.
     5. On failure: sets `state.halted = true` if haltOnFailure

   - **If step is `assertAny`:**
     Emit `it("{name}", async () => { ... })` where the body:
     1. Checks `state.halted` — skip if true
     2. Executes `const actual = await fn(state.subject)`
     3. Calls `expect(candidates).toContainEqual(actual)`

   - **If step is `snapshot`:**
     Emit `it("{name}", () => { ... })` where the body:
     1. Checks `state.halted` — skip if true
     2. Calls extraction fn (default: `state.subject.container.innerHTML`)
     3. Calls `expect(value).toMatchSnapshot()`

   - **If step is `chain`:**
     Emit `describe("{name}", () => { ... })` and recurse with the chained
     pipeline's steps. The `state` object is shared via closure — subject
     mutations in the chain are visible to the parent.

   - **If step is skipped (unconditional):** emit `it.skip("{name}", () => {})`
   - **If step is skipped (conditional):** the predicate is evaluated **inside
     the step's own `it()` block** at runtime, against the current `state.subject`
     (which reflects all prior stage mutations). If the predicate returns `true`,
     the `it()` body records skip in `state.statuses` and returns early (no
     assertions). If `false`, the step executes normally. If the predicate throws,
     the step fails with the predicate error.

4. Emit `afterAll(() => { cleanup() })` — cleanup runs **after the entire pipeline**,
   not after each step. See Cleanup section.

### Why All Steps Are `it()` Blocks

Every step — including stages — is wrapped in an `it()` block. This ensures:
- All async work is properly awaited by Vitest's test runner
- Errors in any step are caught and reported by Vitest
- Test filtering (`--grep`, `.only`, `.skip`) works at the step level
- Duration and status are tracked per step in Vitest output
- No pipeline logic runs at describe-registration time

### Five-Status Lossy Mapping in Vitest Mode

Vitest natively supports only three statuses: pass, fail, skip. The five-status
pipeline model (pass, fail, error, recovered, skip) cannot be exactly represented.
The formatter tracks accurate five-status counts in `state.statuses` (an array of
`{ name, status }` entries), but Vitest's own reporting is lossy:

| Pipeline Status | Vitest Sees | state.statuses Records |
|----------------|-------------|----------------------|
| pass | pass | pass |
| fail | fail | fail |
| error | fail | error |
| recovered | pass (with `[RECOVERED]` warning logged) | recovered |
| skip (unconditional) | skip (via `it.skip`) | skip |
| skip (conditional, predicate true) | pass (early return, no assertions) | skip |
| halted (due to prior failure) | pass (early return, no assertions) | skip |

**Conditional skip** predicates must evaluate at runtime (inside `it()`) because
they depend on the subject at that point in the pipeline, not the initial subject.
Since `it.skip()` can only be called at registration time, conditional skips that
resolve to "skip" at runtime manifest as empty-pass tests in Vitest. The
`state.statuses` array preserves the true skip status for programmatic access.

**haltOnFailure** uses `state.halted`. When a step fails or errors and
`haltOnFailure` is true, subsequent `it()` blocks check the flag and return early.
Vitest sees pass (empty test); `state.statuses` records skip.

**Accessing accurate status counts:** After the `describe` block completes, the
formatter can produce a `PipelineReport` from `state.statuses` using the inherited
`CTGTestResult.report()` method. This report has accurate five-status counts
regardless of Vitest's lossy display. Consumers who need exact counts (e.g., for
a dashboard) should read this report rather than parsing Vitest output.

---

## Formatter Detection

**Finding 7 (loose detection):** The spec originally used `"has an execute method"`.
This is tightened:

The `start()` method checks for an `_isExecutionFormatter` static property, not
just the presence of `execute`:

```javascript
if (formatter.constructor._isExecutionFormatter === true) {
    return formatter.execute(this, subject, config);
}
```

`CTGVitestFormatter` sets `static _isExecutionFormatter = true`. This prevents
accidental delegation when a non-execution formatter happens to have an `execute`
property.

---

## User Event Validation

When `@testing-library/user-event` is not installed:

- `ReactContext.user` is `null`
- `interact()` steps that call `ctx.user.click(...)` etc. will throw a native
  `TypeError` (cannot read property of null)
- To provide a clearer error: `interact()` step execution checks
  `ctx.user === null` before calling the fn. If null, throws
  `CTGTestError("INVALID_STEP", "user-event is required for interact() — install @testing-library/user-event")`
- `render()` and `stage()` steps do not validate `ctx.user` — only `interact()`
  enforces this because it is the semantic signal for user interaction

---

## Conformance Test Traceability

| Requirements Section | JS Mechanism |
|---|---|
| Core pipeline engine | Inherited from `ctg-js-test` — no re-implementation |
| ReactContext subject | `ReactContext` class wrapping render result |
| render step | `CTGReactTest.render()` → `@testing-library/react` render |
| interact step | `CTGReactTest.interact()` → stage with distinct type |
| snapshot step | `CTGReactTest.snapshot()` → VitestFormatter or standalone manager |
| renderHook step | `CTGReactTest.renderHook()` → `@testing-library/react` renderHook |
| VitestFormatter | `CTGVitestFormatter.execute()` → describe/it/expect registration |
| Five-status mapping | Formatter bridges pass/fail/error/recovered/skip to Vitest |
| Composability | `chain()` inherited from CTGTest — works with React steps |
| Error recovery | Inherited from CTGTest — recovered status preserved in Vitest via warning |
| Report structure | Inherited `CTGTestResult.report()` — identical shape |

---

## What This Spec Does NOT Add

Per requirements doc compatibility policy and deferred scope:

- No Playwright integration (navigate, screenshotAssert, PlaywrightFormatter) — deferred to v2
- No TypeScript — plain JS with HM signatures per CTG code style
- No monorepo/multi-package structure — single package
- No custom matchers (toBeAccessible, toHaveStyle, toMatchDOM) — use `compare()` override
- No custom Vitest reporter for five-status terminal output
- No built-in mock API — use stages for injection, Vitest `vi.mock` for module mocking
- No built-in provider stages — compose as pipeline fragments
- No parallel step execution — strictly sequential within a pipeline
- No `screenshotAssert` — Playwright-only, deferred
- No inline snapshot support (`toMatchInlineSnapshot`) — standard file snapshots only
- No CJS compatibility — ESM only
