# ctg-react-test v3.2 — Language-Specific Specification

**Realizes:** ctg-js-test v2.2 extension surfaces (STATE, PREDICATE, PIPELINE)
**Supersedes:** `spec.v3.md`
**Depends on:** ctg-js-test v2.2
**Target:** JavaScript (ES modules, Node.js)
**Code Style:** `ctg-project-proc/code-styles/js-code-style.md`
**Minimum Node:** 20

---

## 1. Realization Map

This extension maps to the three extension surfaces defined in
ctg-js-test v2.2 spec §6 (Extension Surfaces). It does not introduce
new primitive types — it realizes the base framework's extension
contract for the React testing domain.

| Extension Surface | Base Class | React Realization | Notes |
|---|---|---|---|
| STATE | `CTGTestState` | `ReactTestState` | Adds `screen`, `user`, `container`, `rerender`, `data` |
| PREDICATE | `CTGTestPredicate` | No React-specific predicates | Uses base predicates and `CTGTestPredicates` builders |
| PIPELINE | `CTGTest` | `CTGReactTest` | Adds `interact`, `assertComponent`, `assertComponentIs` builder methods |

**No STEP classes.** v3.0 had `InteractStep`, `AssertComponentStep`,
`AssertComponentIsStep`, `ReactChainStep`. v3.2 removes all four.
The builder methods on `CTGReactTest` delegate to `this.stage()` or
`this.assert()` with closures that extract domain-specific args from
state. Operations are internal tagged records owned by the base
pipeline — this extension never creates, inspects, or extends them.

**No React-specific predicates.** `assertComponent` accepts either a
raw value (wrapped internally in `CTGTestPredicates.equals()`) or a
`CTGTestPredicate` instance. `assertComponentIs` always uses
`CTGTestPredicates.equals()` internally. The base predicate library
is sufficient for React testing.

**No React-specific formatters.** Inherits `CTGTestConsoleFormatter`
and `CTGTestJsonFormatter` from ctg-js-test. React-specific fields
(`screen`, `user`, etc.) are transient testing surface — they are not
part of the result trace and do not appear in formatter output.

**No React-specific error types.** All errors thrown by this
extension use base `CTGTestError` with existing canonical codes
(`INVALID_OPERATION`, `INVALID_CONFIG`). No new error codes are added.

> **Judgment Call — no React-specific predicates:** React assertions
> compare DOM-extracted values (strings, booleans, element references)
> against expected values. These are general-purpose comparisons, not
> domain-specific predicate shapes. `CTGTestPredicates.equals`,
> `.contains`, `.isTruthy`, etc. cover the use cases. A React-specific
> predicate class would add surface area without adding capability.

> **Judgment Call — no React-specific formatters:** The formatter
> contract is `CTGTestState -> STRING`. React fields on state are
> mutable testing surface (DOM references, user-event handles), not
> serializable diagnostic data. Results carry `computedValue` and
> `expectedOutcome` — the formatter-visible fields — which are plain
> values extracted by the callbacks. No React-specific rendering needed.

> **Judgment Call — no React-specific error types:** The base error
> codes cover all validation and runtime error cases this extension
> encounters. Adding codes would require coordination with the base
> spec's code allocation. The domain-specific context (e.g., "DOM
> environment required") is communicated via the error message string,
> which is appropriate for contextual diagnostics.

---

## 2. Public Surface

### 2.1 ReactTestState

```
realizes: ctg-js-test v2.2 spec §6 — Extension Surface: STATE
extends: CTGTestState
```

```
ReactTestState :: { subject: *, label: STRING }? => {
    subject:   *,
    computed:  * | VOID,
    results:   [CTGTestResult],
    label:     STRING,
    screen:    OBJECT | NULL,
    user:      OBJECT | NULL,
    container: HTMLElement | NULL,
    rerender:  (* -> VOID) | NULL,
    data:      OBJECT
}
```

#### Constructor

```
// CONSTRUCTOR :: { subject: *, label: STRING }? -> this
```

Accepts the same optional object as `CTGTestState`. React-specific
fields are initialized to `null` (screen, user, container, rerender)
or `{}` (data). These fields are populated by `CTGReactTest.start()`
during the mount phase.

**v3.2 changes from v3.0:**
- Constructor receives `{ subject, label }`, not `{ subject, config, name }`.
  The `config` and `name` fields no longer exist on `CTGTestState` in v2.2.
  `label` replaces `name`. Config is not stored on state.
- `computed` replaces `actual` (v2.2 alignment).

#### Properties

```
// GETTER :: VOID -> STRING
get label                  // inherited from CTGTestState

// GETTER :: VOID -> *
get subject                // inherited from CTGTestState

// GETTER :: VOID -> *
get computed               // inherited from CTGTestState

// GETTER :: VOID -> [CTGTestResult]
get results                // inherited from CTGTestState

// GETTER :: VOID -> INT
get status                 // inherited from CTGTestState (aggregate)
```

React-specific fields are plain public properties (not getters):
- `screen` — testing-library query interface, or `null` before mount
- `user` — user-event instance, or `null` before mount / if user-event unavailable
- `container` — DOM container element, or `null` before mount
- `rerender` — RTL rerender function, or `null` before mount
- `data` — plain object for developer-defined data, default `{}`

> **Judgment Call — plain properties not getters for React fields:**
> These fields are populated imperatively by `_mount()` after
> construction. They are mutable, not computed. Getters would add
> ceremony without adding safety — the fields are testing surface,
> not invariant-protected state. This matches v3.0's approach and is
> consistent with how RTL's own `render()` result is a plain object.

> **Judgment Call — `data` as plain object:** `data` provides a
> developer escape hatch for carrying arbitrary values through the
> pipeline (e.g., test fixtures, intermediate computation results).
> It is not part of the base framework's state contract. Default `{}`
> rather than `null` so the developer can write to it without null
> checks.

#### Instance Methods

```
// :: VOID -> STRING
// Returns the rendered HTML from the mounted component's container.
// Returns empty string if container is null (component not mounted).
toHTML()
```

`toHTML()` reads `this.container.innerHTML`. Throws
`CTGTestError("INVALID_OPERATION")` if container is `null` — a null
container means the component was never mounted or was already cleaned
up, and silently returning `""` would cause false-positive comparisons.
This is the bridge between the pipeline's mounted component and the
`assertComponentIs` comparison surface.

**Requires `autoCleanup: false`** if called after the pipeline
completes, since cleanup unmounts the component and invalidates
the container.

#### Static Factory

```
// Static Factory Method :: STRING, * -> reactTestState
static init(label, subject)
```

> **Judgment Call — `init` signature matches base:** `CTGTestState.init`
> takes `(label, subject)`. `ReactTestState.init` follows the same
> shape. The React-specific fields start null/empty and are populated
> by the pipeline's mount phase, not by the factory.

---

### 2.2 CTGReactTest

```
realizes: ctg-js-test v2.2 spec §6 — Extension Surface: PIPELINE
extends: CTGTest
```

```
CTGReactTest :: label : STRING => {
    label:      STRING,
    operations: [INTERNAL]   // private — inherited, not exposed
}
```

#### Constructor and Factory

```
// CONSTRUCTOR :: STRING -> this
constructor(label)

// Static Factory Method :: STRING -> ctgReactTest
static init(label)
```

#### Properties

```
// GETTER :: VOID -> STRING
get label                  // inherited from CTGTest
```

#### React-Specific Builder Methods

All builder methods return `this` for chaining. Validation is deferred
to `start()` per base framework convention.

##### interact

```
// :: STRING:label, ({screen: OBJECT, user: OBJECT} -> VOID) -> this
// Appends a stage operation. The handler extracts screen/user from
// state, validates user is not null (throws INVALID_OPERATION if
// user-event unavailable), calls the user's callback, and returns
// state.subject unchanged. Interaction is a side effect, not a
// subject transformation. The callback receives user as a guaranteed
// non-null OBJECT — the null check happens before invocation.
interact(label, fn)
```

**Implementation:** Delegates to `this.stage(label, handler)` where
the handler is a closure that:
1. Extracts `screen` and `user` from the state argument
2. Validates that `user` is not `null` (throws `INVALID_OPERATION`
   if user-event is unavailable)
3. Calls `await fn({ screen: state.screen, user: state.user })`
4. Returns `state.subject` (unchanged — the return value of `fn` is
   discarded)

The user's callback receives `{ screen, user }` — the testing-library
surface for finding elements and dispatching events. The callback
returns VOID. Async callbacks are supported (the framework awaits the
stage handler).

**Example:**
```jsx
.interact("click increment", async ({screen, user}) => {
    await user.click(screen.getByText("Increment"));
})
```

> **Judgment Call — interact delegates to stage, not assert:**
> Interactions are side effects (clicking, typing) that mutate the
> component's DOM state. They don't produce a computed value for
> comparison. `stage` is the correct primitive — it transforms state
> (via side effects on the mounted component) and records PASS/ERROR.
> The handler returns `state.subject` unchanged because the pipeline
> subject (the JSX element) doesn't change — only the rendered DOM
> changes.

> **Judgment Call — user-event null check in handler, not at build
> time:** user-event is optional (imported dynamically in `_mount`).
> The check happens at execution time inside the stage handler because
> all validation is deferred to `start()` per the base framework
> convention. The error surfaces as an `INVALID_OPERATION` with a
> message indicating user-event is required.

##### assertComponent

```
// :: STRING:label, (OBJECT:screen -> *:computed), * | ctgTestPredicate -> this
// Appends an assert operation. The handler extracts screen from state,
// calls the user's callback, and returns the computed value. The
// predicate evaluates the computed value against expected.
assertComponent(label, fn, expected)
```

**Implementation:** Delegates to `this.assert(label, handler, predicate)`
where:
- `handler` is a closure that extracts `screen` from the state argument,
  calls `await fn(state.screen)`, and returns the computed value.
- `predicate` is resolved from `expected`:
  - If `expected` is a `CTGTestPredicate` instance, use it directly.
  - Otherwise, wrap it in `CTGTestPredicates.equals(expected)`.

The user's callback receives `screen` and returns a computed value
from the rendered output. Async callbacks are supported (e.g.,
`findBy*` queries).

**Example:**
```jsx
.assertComponent("count is 1", (screen) =>
    screen.getByTestId("count").textContent, "1")

// With explicit predicate:
.assertComponent("has content", (screen) =>
    screen.getByTestId("output").textContent,
    CTGTestPredicates.contains("hello"))
```

> **Judgment Call — auto-wrap raw values in `equals()`:** The common
> case is equality comparison. Requiring `CTGTestPredicates.equals()`
> on every call would be verbose for no benefit. The pattern is:
> raw value means equality, predicate instance means custom comparison.
> This is unambiguous because `CTGTestPredicate` instances are never
> used as raw expected values (they are objects with a specific shape,
> not domain values).

> **Judgment Call — callback receives `screen`, not `state`:** The
> user's callback should not have access to the full pipeline state.
> React assertions query the DOM via screen — that's the testing
> surface. Exposing state would invite coupling to pipeline internals
> (e.g., reading `state.results` inside an assertion callback). The
> closure wrapping bridges the gap: it reads state, calls the
> callback with screen, and returns the result.

##### assertComponentIs

```
// :: STRING:label, STRING | reactTestState -> this
// Appends an assert operation. The handler reads state.container.innerHTML
// as the computed value. If expected is a ReactTestState, toHTML() is
// called on it. The resolved expected string is compared via equals().
assertComponentIs(label, expected)
```

**Implementation:** Delegates to `this.assert(label, handler, predicate)`
where:
- `handler` is a closure that validates `state.container` is not
  `null` (throws `INVALID_OPERATION` if null — component not mounted
  or already cleaned up), then returns `state.container.innerHTML`
  (the current rendered HTML).
- `predicate` is resolved from `expected`:
  - If `expected` is a `ReactTestState` instance, call
    `expected.toHTML()` to get the expected HTML string (which
    itself throws `INVALID_OPERATION` if the expected state's
    container is null), then wrap in
    `CTGTestPredicates.equals(resolvedString)`.
  - If `expected` is a STRING, wrap in
    `CTGTestPredicates.equals(expected)`.

**Example:**
```jsx
// Compare against an HTML string
.assertComponentIs("matches markup", "<h1>Hello, World!</h1>")

// Compare against a staged pipeline result
.assertComponentIs("same result", expectedState)
```

> **Judgment Call — predicate resolved at build time, not execution
> time:** When `expected` is a `ReactTestState`, `toHTML()` is called
> when the builder method runs (during pipeline construction), not
> during pipeline execution. This means the expected state must
> already be mounted and its container populated. This is consistent
> with the staged comparison pattern where the expected state is
> produced by a prior pipeline run with `autoCleanup: false`. If the
> expected state's container is null, `toHTML()` returns `""`, which
> is the compared value — no error is thrown.

#### Inherited Builder Methods

These are inherited from `CTGTest` and remain available:

- **stage(label, fn)** — transform pipeline state
- **assert(label, fn, predicate)** — evaluate pipeline state
- **chain(label, pipeline)** — compose pipeline fragments
- **skip(targetLabel, condition?)** — conditionally skip operations

These are not the primary tools for React component testing. React
tests use `interact` / `assertComponent` / `assertComponentIs`. The
inherited methods are available for edge cases.

**chain() is NOT overridden.** In v3.0, `ReactChainStep` was needed
to copy React fields across the chain boundary. In v2.2, chain uses
same-state semantics — the sub-pipeline's operations run against the
same state object (see base spec Appendix A). React fields (screen,
user, container, rerender) are on the `ReactTestState` instance, so
they flow through automatically. No override needed.

> **Judgment Call — no chain override:** This is the key structural
> simplification from v2.2's same-state chain semantics. v3.0's
> `ReactChainStep` cloned state and copied React fields — complex and
> fragile. v2.2's `executePipeline()` runs sub-pipeline operations
> against the same state object, so React fields are just there. The
> `ReactChainStep` class is deleted entirely.

#### start()

```
realizes: ctg-js-test v2.2 spec §2.5 — start()
```

```
// :: JSX | reactTestState, OBJECT?:config -> PROMISE(reactTestState)
async start(subject, config?)
```

Executes the pipeline:

1. **Extract React config** — read `wrapper` and `autoCleanup` from
   config before base processing.
2. **Strip React config** — create a shallow copy of the config
   object, then remove `wrapper` and `autoCleanup` from the copy.
   The caller's original config object is never mutated.
3. **Normalize input:**
   - If `subject` is a `ReactTestState` instance (from domain
     extension use), skip mounting — testing surface is already
     populated.
   - If `subject` is JSX, wrap in `ReactTestState` with `{ subject }`
     and mount via RTL.
4. **Mount** (if JSX) — call `_mount(state, wrapper)` to render the
   component and populate `screen`, `user`, `container`, `rerender`
   on state.
5. **Delegate to base** — call `super.start(state, strippedConfig)`.
   The base pipeline handles validation, operation execution, result
   recording.
6. **Cleanup** — after the base pipeline returns, if `autoCleanup`
   is `true` and the subject was JSX (not a pre-mounted
   `ReactTestState`), call RTL `cleanup()`.
7. **Return** the final `ReactTestState`.

#### Config

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `wrapper` | React component \| VOID | `null` | Wraps the rendered element (providers, etc.) |
| `autoCleanup` | BOOL | `true` | Run RTL `cleanup()` after pipeline completes |

Plus inherited base config:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `haltOnFailure` | BOOL | `true` | Stop after first FAIL or ERROR |
| `timeout` | INT | `5000` | Per-operation timeout in ms. 0 disables. |

**Config validation:**
- `wrapper` must be `null`, `undefined`, or a function. Wrong type
  throws `INVALID_CONFIG`.
- `autoCleanup` must be `undefined` or a boolean. Wrong type throws
  `INVALID_CONFIG`.
- React-specific keys are stripped from a shallow copy before passing
  to base config validation. The caller's original config object is
  never mutated. The base rejects unknown keys — stripping ensures
  `wrapper` and `autoCleanup` don't trigger `INVALID_CONFIG` from
  the base.

> **Judgment Call — strip-before-super pattern:** The base pipeline
> rejects unknown config keys with `INVALID_CONFIG`. React-specific
> keys must be validated and removed before the config reaches
> `super.start()`. This is the same pattern the PHP browser test
> extension uses. The alternative — overriding the base validation
> to accept extra keys — would require the base to expose its
> valid-keys list as an extension surface, which it does not.

#### Private Methods

```
// :: reactTestState, (* -> *) | VOID -> PROMISE(VOID)
// Mounts the component from state.subject via RTL render.
// Populates state.screen, state.container, state.rerender, state.user.
#mount(state, wrapper)
```

Mount behavior:
1. Verify DOM environment exists (`document`, `window`,
   `HTMLElement`). If missing, throw `INVALID_OPERATION` with message
   indicating jsdom/happy-dom is required.
2. Import `@testing-library/react` dynamically.
3. Call `rtl.render(state.subject, opts)` where opts includes wrapper
   if provided.
4. Set `state.screen` to `rtl.within(renderResult.container)` —
   scoped queries on the rendered container.
5. Set `state.container` to `renderResult.container`.
6. Set `state.rerender` to `renderResult.rerender`.
7. Attempt to import `@testing-library/user-event` dynamically. If
   available, set `state.user` to `userEvent.setup()`. If import
   fails, set `state.user` to `null` (user-event is optional for
   assertion-only pipelines; `interact` validates it at execution
   time).

> **Judgment Call — dynamic imports for RTL and user-event:** These
> are peer dependencies that must be installed by the consumer. Dynamic
> import allows the module to load without them being present at
> import time. user-event is optional because some pipelines only
> assert against initial render state. RTL is required — if the import
> fails, the error propagates naturally.

> **Judgment Call — `INVALID_OPERATION` for DOM check, not a new
> error type:** The absence of a DOM environment is a configuration
> error, not a React-specific error category. `INVALID_OPERATION`
> (1000) with a descriptive message is sufficient. The message tells
> the user what to do ("install jsdom or use Vitest with jsdom/
> happy-dom environment").

> **Judgment Call — `#mount` as truly private:** v3.0 used `_mount`.
> v3.2 uses `#mount` (private field syntax) because mount is never
> called by subclasses or external code. It is an implementation
> detail of `start()`.

---

### 2.3 Static Utilities on CTGReactTest

These methods are unchanged from v3.0. They operate outside the
pipeline — no state, no results, no operations.

##### toSnapshot

```
// :: JSX -> PROMISE(OBJECT)
// Renders JSX through react-test-renderer and returns the JSON tree.
// Fresh, isolated render — no internal state.
static toSnapshot(jsx)
```

##### diffSnapshot

```
// :: JSX, JSX -> PROMISE([OBJECT])
// Renders both JSX elements and returns an array of structural
// differences. Returns empty array if trees match.
// Each diff has { path: STRING, expected: *, actual: * }.
static diffSnapshot(jsxA, jsxB)
```

Uses internal `_diffTrees` recursive helper (unchanged from v3.0).

##### compareSnapshot

```
// :: JSX, JSX -> PROMISE(BOOL)
// Convenience over diffSnapshot. Returns true if no differences.
static compareSnapshot(jsxA, jsxB)
```

**Implementation:** `return (await CTGReactTest.diffSnapshot(jsxA, jsxB)).length === 0;`

> **Judgment Call — static utilities unchanged:** These methods
> operate on JSX, not pipeline state. They are orthogonal to the
> pipeline model changes in v2.2. No reason to change them.

---

### 2.4 JSX Loader

Unchanged from v3.0. Two files:

- **JSXHook.js** — ESM loader hook that transforms `.jsx` imports
  via esbuild's `transformSync`. Exported function: `load(url, context, nextLoad)`.
- **JSXLoader.js** — Registration entry point. Calls
  `register("./JSXHook.js", import.meta.url)` via `node:module`.
  Used as: `node --import ctg-react-test/jsx-loader`.

These are not part of the testing pipeline. They are development
tooling for loading JSX test files in Node.js.

> **Judgment Call — esbuild as a dependency:** esbuild is the only
> external dependency this package carries. It is required for JSX
> transformation at the loader level — there is no standard library
> JSX parser. This is a build-tool dependency, not a runtime testing
> dependency. The alternative (requiring consumers to pre-compile JSX)
> would shift complexity to every consumer.

---

## 3. Method Signatures (Complete)

All signatures use HM-like notation per the JS code style guide.

### ReactTestState

```
// CONSTRUCTOR :: { subject: *, label: STRING }? -> this
// :: VOID -> STRING                                toHTML()
// Static Factory Method :: STRING, * -> reactTestState
//                                                  init(label, subject)
```

Plus inherited from CTGTestState:
```
// GETTER :: VOID -> STRING                         label
// SETTER :: STRING -> VOID                         label
// GETTER :: VOID -> *                              subject
// SETTER :: * -> VOID                              subject
// GETTER :: VOID -> *                              computed
// SETTER :: * -> VOID                              computed
// GETTER :: VOID -> [CTGTestResult]                results
// :: CTGTestResult -> VOID                         addResult(result)
// GETTER :: VOID -> INT                            status
```

### CTGReactTest

```
// CONSTRUCTOR :: STRING -> this
// :: STRING, ({screen: OBJECT, user: OBJECT} -> VOID) -> this
//                                                  interact(label, fn)
// :: STRING, (OBJECT -> *), * | ctgTestPredicate -> this
//                                                  assertComponent(label, fn, expected)
// :: STRING, STRING | reactTestState -> this
//                                                  assertComponentIs(label, expected)
// :: JSX | reactTestState, OBJECT? -> PROMISE(reactTestState)
//                                                  start(subject, config?)
// Static Factory Method :: STRING -> ctgReactTest
//                                                  init(label)
// :: JSX -> PROMISE(OBJECT)                        toSnapshot(jsx)
// :: JSX, JSX -> PROMISE([OBJECT])                 diffSnapshot(jsxA, jsxB)
// :: JSX, JSX -> PROMISE(BOOL)                     compareSnapshot(jsxA, jsxB)
```

Plus inherited from CTGTest:
```
// :: STRING, (CTGTestState -> *) -> this            stage(label, fn)
// :: STRING, (CTGTestState -> *), CTGTestPredicate -> this
//                                                   assert(label, fn, predicate)
// :: STRING, CTGTest -> this                        chain(label, pipeline)
// :: STRING, (CTGTestState -> BOOL)? -> this        skip(targetLabel, condition?)
// GETTER :: VOID -> STRING                          label
```

---

## 4. Resolution of Extension-Specific Decisions

### 4.1 interact Is a Stage, Not a New Operation Type

The v2.2 base has two operation types: stage and assert. `interact`
maps to stage because interactions are side effects that transform
DOM state without producing a computed value for predicate evaluation.
The handler returns `state.subject` unchanged — the subject is the
JSX element, which doesn't change when the user clicks a button.

### 4.2 assertComponent and assertComponentIs Are Asserts

Both map to the base `assert` operation. They differ in what the
handler extracts as the computed value:
- `assertComponent` — user callback queries screen, returns computed
- `assertComponentIs` — handler reads `container.innerHTML`

Both use `CTGTestPredicates.equals()` for comparison (unless the user
provides an explicit predicate to `assertComponent`).

### 4.3 Predicate Wrapping in assertComponent

`assertComponent(label, fn, expected)` accepts `expected` as either:
- A `CTGTestPredicate` instance — used directly
- Any other value — wrapped in `CTGTestPredicates.equals(expected)`

The wrapping happens in the `assertComponent` builder method before
delegating to `this.assert()`. The base `assert()` requires a
`CTGTestPredicate` — it will throw `INVALID_EXPECTED_OUTCOME` if it
receives a raw value. The wrapping ensures this contract is met.

### 4.4 ReactTestState Passed to start() Skips Mounting

When `start()` receives a `ReactTestState` instance (detected via
`instanceof`), it assumes the testing surface is already populated
and skips `#mount()`. This supports domain extensions that mount
their own way, or test patterns where a pre-mounted state is reused.

The `autoCleanup` logic also respects this: cleanup only runs when
the pipeline performed the mount (i.e., when the subject was JSX,
not a `ReactTestState`).

### 4.5 Chain Does Not Need Override

v2.2's chain runs sub-pipeline operations against the **same state
object** via `executePipeline()`. Since React fields live on the
`ReactTestState` instance (which is that same state object), they
are visible to all sub-pipeline operations without copying.

v3.0's `ReactChainStep` is deleted. `CTGReactTest` does not override
`chain()`.

### 4.6 No Error Handlers on React Builder Methods

The base v2.2 removed error handler parameters from `stage()` and
`assert()`. Since `interact`, `assertComponent`, and
`assertComponentIs` delegate to `stage()` and `assert()`, they
inherit the no-error-handler behavior. If the user needs error
recovery, they wrap in try/catch inside the callback.

### 4.7 screen Is Scoped to Container

`state.screen` is set to `rtl.within(renderResult.container)`, not
`rtl.screen`. This scopes queries to the rendered component's
container, preventing queries from finding elements outside the
component under test (e.g., elements from other components still in
the DOM).

> **Judgment Call — scoped screen vs global screen:** RTL's `screen`
> queries the entire document. `within(container)` scopes to just the
> rendered component. Scoped queries are safer for isolated component
> testing. The tradeoff: queries like `getByRole` won't find elements
> in portals that render outside the container. For portal testing,
> the developer uses the inherited `assert` with a handler that
> queries `document` directly.

---

## 5. Error Types

This extension uses only base `CTGTestError` canonical codes:

| Error Code | Name | Used When |
|---|---|---|
| 1000 | `INVALID_OPERATION` | DOM environment missing; user-event null during interact; malformed operation args (caught by base validation) |
| 1002 | `INVALID_CONFIG` | `wrapper` not a function; `autoCleanup` not boolean |

No new error codes are introduced.

---

## 6. Formatters

Inherits `CTGTestConsoleFormatter` and `CTGTestJsonFormatter` from
ctg-js-test v2.2. No React-specific formatters.

The formatter output for React tests looks identical to base framework
output — `[PASS]`, `[FAIL]`, `[ERROR]`, `[SKIPPED]` tags with labels.
The labels provided by the developer (e.g., `"click increment"`,
`"count is 1"`) are the labels that appear in the output.

---

## 7. Anti-Patterns

All anti-patterns from the base spec (§5) are enforced by
inheritance. This extension additionally does NOT:

| Anti-Pattern | Why Not |
|---|---|
| Step classes | No `InteractStep`, `AssertComponentStep`, `AssertComponentIsStep`, `ReactChainStep`. Builder methods delegate to base stage/assert with closures. |
| Chain override | No `ReactChainStep`. Same-state chain semantics make it unnecessary. |
| Error handlers on React methods | Removed in base v2.2. React methods delegate to base stage/assert which have no error handler parameter. |
| Direct DOM state on results | React DOM references (`screen`, `container`) are not serialized into results. Results carry only the computed value (a string, boolean, etc.) and expected outcome. |
| Snapshot file management | No file-backed snapshots. `toSnapshot`/`diffSnapshot`/`compareSnapshot` are in-memory, stateless utilities. |
| Hook testing API | No `renderHook`. Hooks are tested through components. |

---

## 8. Test Target

Tests live at `tests/` and follow the pattern `tests/*.test.jsx`:

```
tests/
    react-test-state.test.jsx
    interact.test.jsx
    assert-component.test.jsx
    assert-component-is.test.jsx
    chain.test.jsx
    start.test.jsx
    config.test.jsx
    snapshot-utils.test.jsx
```

**Test framework:** Vitest (as independent oracle, same rationale as
base spec §4.9).

**Environment:** Vitest with `jsdom` or `happy-dom` environment for
DOM access.

**JSX support:** Either Vitest's built-in JSX transform or the
`ctg-react-test/jsx-loader` hook.

**Running tests:**

```bash
npx vitest run
```

**Test pattern:** Each test creates a `CTGReactTest` pipeline, runs it
via `start()` with a React component, and uses Vitest assertions to
verify the returned `ReactTestState` — its results, statuses,
computed values, expected outcomes, and error fields. Tests validate
rendered output (DOM content), not internal React state.

> **Judgment Call — `.test.jsx` not `.test.js`:** React test files
> contain JSX syntax (component definitions, JSX subjects passed to
> `start()`). Using `.jsx` extension enables direct JSX support
> without loader configuration in most test runners.

---

## 9. Module Structure / File Layout

```
src/
    CTGReactTest.js           # Pipeline extension (extends CTGTest)
    ReactTestState.js         # State extension (extends CTGTestState)
    JSXHook.js                # ESM loader hook for .jsx files
    JSXLoader.js              # Loader registration entry point
index.js                      # Package entry point
```

**Removed from v3.0:**
- `src/steps/InteractStep.js`
- `src/steps/AssertComponentStep.js`
- `src/steps/AssertComponentIsStep.js`
- `src/steps/ReactChainStep.js`
- `src/steps/` directory

**Package exports (package.json):**
- `"."` — `src/index.js` (default export: `CTGReactTest`, named: `ReactTestState`)
- `"ctg-react-test/jsx-loader"` — `src/JSXLoader.js`

---

## 10. Judgment Calls Index

1. **No React-specific predicates** (§1) — base predicates cover all React assertion shapes.
2. **No React-specific formatters** (§1) — React DOM fields are transient testing surface, not serializable diagnostics.
3. **No React-specific error types** (§1) — base canonical codes cover all cases; messages carry context.
4. **Plain properties for React fields** (§2.1) — mutable testing surface, not invariant-protected; matches RTL's own result shape.
5. **`data` as plain object** (§2.1) — developer escape hatch; default `{}` avoids null checks.
6. **`init` matches base factory shape** (§2.1) — `(label, subject)` not `(name, config)`.
7. **interact delegates to stage** (§2.2, §4.1) — interactions are side effects; no computed value for predicate evaluation.
8. **user-event null check at execution time** (§2.2) — follows deferred-validation convention.
9. **Auto-wrap raw values in equals()** (§2.2) — common case is equality; predicate instance means custom comparison.
10. **assertComponent callback receives screen, not state** (§2.2) — prevents coupling to pipeline internals.
11. **assertComponentIs predicate resolved at build time** (§2.2) — expected state must already be mounted; consistent with staged comparison pattern.
12. **No chain override** (§2.2, §4.5) — v2.2 same-state semantics eliminate the need.
13. **Static utilities unchanged** (§2.3) — orthogonal to pipeline model changes.
14. **esbuild dependency** (§2.4) — no standard library JSX parser; build-tool dependency, not runtime.
15. **Dynamic imports for RTL and user-event** (§2.2) — peer dependencies; allows module to load without them.
16. **INVALID_OPERATION for DOM check** (§2.2) — configuration error, not React-specific category.
17. **#mount as truly private** (§2.2) — never called by subclasses or external code.
18. **Strip-before-super config pattern** (§2.2) — base rejects unknown keys; React keys must be removed first.
19. **Scoped screen via within()** (§4.7) — safer isolation; tradeoff with portal testing documented.
20. **`.test.jsx` extension** (§8) — JSX syntax in test files; direct support in most runners.

---

## 11. Migration Summary: v3.0 to v3.2

| v3.0 Concept | v3.2 Equivalent | Breaking? |
|---|---|---|
| `InteractStep` class | Removed — `interact` delegates to `this.stage()` | Yes (internal) |
| `AssertComponentStep` class | Removed — `assertComponent` delegates to `this.assert()` | Yes (internal) |
| `AssertComponentIsStep` class | Removed — `assertComponentIs` delegates to `this.assert()` | Yes (internal) |
| `ReactChainStep` class | Removed — base `chain()` with same-state semantics | Yes (internal) |
| `steps/` directory | Removed | Yes |
| `chain()` override | Removed — inherited from CTGTest | Yes (internal) |
| `_mount` (underscore private) | `#mount` (truly private) | Yes (internal) |
| `_validateConfig` override | Strip-before-super in `start()` | Yes (internal) |
| `VALID_CONFIG_KEYS` static | Removed — config validated via strip pattern | Yes (internal) |
| `state.name` | `state.label` | Yes — v2.2 alignment |
| `state.config` on state | Removed — config not stored on state in v2.2 | Yes |
| `state.actual` | `state.computed` | Yes — v2.2 alignment |
| `assertComponent(name, fn, expected)` raw value | `assertComponent(label, fn, expected)` where raw value auto-wrapped in `equals()` predicate | Yes — label param renamed, predicate wrapping |
| `assertComponentIs(name, expected)` | `assertComponentIs(label, expected)` | Yes — label param renamed |
| `interact(name, fn)` | `interact(label, fn)` | Yes — label param renamed |
| Result `name` field (string) | Result `label` field (array of strings) | Yes — v2.2 alignment |
| Result `type` field | Removed | Yes — v2.2 alignment |
| Result `actual` / `expected` | `computedValue` / `expectedOutcome` | Yes — v2.2 alignment |
| `_lastStepStatus`, `_lastStepMessage`, `_chainResult` on state | Removed — internal to pipeline | Yes — v2.2 alignment |

**Public API shape is preserved.** The three builder methods
(`interact`, `assertComponent`, `assertComponentIs`) keep the same
argument shapes. The changes are:
- `name` parameter renamed to `label` (v2.2 alignment)
- `assertComponent` now accepts `CTGTestPredicate` as well as raw values
- Return state uses v2.2 field names (`computed`, `label`, result arrays)
- All step classes are internal implementation details — removed

**No new public API.** v3.2 does not add methods beyond what v3.0
provided. It aligns internals with v2.2 and removes the step class
layer.
