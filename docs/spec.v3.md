# CTG React Test v3 — Specification

**Status:** Draft
**Depends on:** ctg-js-test v2.1.0
**Minimum Node:** 20

---

## Motivation

v2 aligned CTGReactTest with the ctg-js-test v2 pipeline model (polymorphic
steps, caller-owned reporting, ReactTestState). But the API still treats React
component testing like general-purpose pipeline testing — the component is
passed to `.render()` as an argument, `assert` evaluates arbitrary functions
against pipeline state, and the relationship between the pipeline subject and
the component under test is unclear (`start(null)` is the common pattern).

v3 reframes the pipeline around how React components are actually tested:

1. **The component is the subject** — passed to `start()`, not to individual
   steps. The pipeline tests *this component* through a series of interactions
   and assertions.
2. **Implicit mount** — `start()` mounts the component before running any
   steps. Render config (wrapper, etc.) is passed through the config object.
3. **Two React-specific step types** — `interact` and `assertDOM` — for
   dispatching events and verifying rendered output.
4. **assertHTML** — for comparing rendered HTML between component states,
   including staged pipeline results.
5. **Static snapshot utilities** — `toSnapshot` and `compareSnapshot` for
   structural comparison of JSX elements outside the pipeline.
6. **No error handlers on React steps** — errors are errors. Consistent
   across all React-specific steps.
7. **assert is inherited but not primary** — still available from ctg-js-test
   for pipeline state evaluation, but React testing uses the React-specific
   methods.

---

## 1. Pipeline Step Types

### interact — dispatch events

User interactions that trigger state changes in the component. The callback
receives `{screen, user}` — the testing-library surface for finding elements
and dispatching events. Returns VOID — interactions are side effects.

```jsx
.interact("click increment", async ({screen, user}) => {
    await user.click(screen.getByText("Increment"));
})
```

**Purpose:** Cause state transitions in the component under test.

**Callback signature:** `({screen, user}) -> VOID`
- `screen` — testing-library query interface (`getByText`, `getByRole`, etc.)
- `user` — user-event instance (`click`, `type`, etc.)

The developer needs both: `screen` to find the element, `user` to interact
with it. Async callbacks are supported.

**Error handling:** No error handler parameter. If the callback throws, the
pipeline records an ERROR result and halts (or continues if `haltOnFailure`
is false). If the developer needs to handle a potential failure in an
interaction, they catch inside the callback itself. This is a departure
from ctg-js-test's error handler semantics on stage/assert — see README
considerations.

### assertDOM — verify presentation via query

Verifies what the user sees via testing-library DOM queries. The callback
receives `screen` — the query interface — and computes an actual value
from the rendered output. The pipeline compares it to an expected value.

```jsx
.assertDOM("count is 1", (screen) =>
    screen.getByTestId("count").textContent, "1")
```

**Purpose:** Verify that the component presents the correct output to the
user after interactions. Uses testing-library queries (by role, text, label,
testid) — not direct DOM inspection like `container.innerHTML`.

**Callback signature:** `(screen) -> *`

The callback only needs `screen` to query the rendered output — it does
not interact with the component, so `user` is not provided. Async
callbacks are supported (e.g., `findBy*` queries).

**Error handling:** No error handler parameter. Same rationale as interact
— in React testing, if a query fails, the test should fail. Consistent
across all React-specific steps.

### assertHTML — verify rendered HTML

Compares the current mounted component's rendered HTML against an expected
HTML representation. Accepts either a STRING or a ReactTestState instance
(from another pipeline). If a ReactTestState is passed, `toHTML()` is called
on it automatically before comparison.

```jsx
// Compare against a staged pipeline result
const expected = await CTGReactTest.init("expected")
    .interact("click three times", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
        await user.click(screen.getByText("Increment"));
        await user.click(screen.getByText("Increment"));
    })
    .start(<Counter initial={0} />, { autoCleanup: false });

await CTGReactTest.init("counter test")
    .interact("different path", async ({screen, user}) => { ... })
    .assertHTML("same result", expected)
    .start(<Counter initial={0} />);

// Compare against a raw HTML string
await CTGReactTest.init("test")
    .assertHTML("matches markup", "<div><span>3</span></div>")
    .start(<Counter initial={3} />);
```

**Purpose:** Compare the rendered HTML of two components that have been
through different interaction paths. Useful for verifying that different
interaction sequences produce the same rendered output.

**How it works:**
1. Call `toHTML()` on the current state to get the mounted component's HTML
2. If the expected value is a ReactTestState, call `toHTML()` on it
3. Compare the two HTML strings

**Error handling:** No error handler parameter. Consistent with other
React-specific steps.

---

## 2. Instance Methods on ReactTestState

### toHTML() — serialize mounted component

Returns the rendered HTML string from the mounted component's container.

```jsx
const state = await CTGReactTest.init("test")
    .interact("click", async ({screen, user}) => { ... })
    .start(<Counter initial={0} />, { autoCleanup: false });

const html = state.toHTML(); // STRING
```

**Purpose:** Lift the DOM representation of a modified mounted component
out of the pipeline for comparison via `assertHTML`.

**Note:** Requires `autoCleanup: false` if called after the pipeline
completes, since cleanup unmounts the component.

---

## 3. Static Methods on CTGReactTest

### CTGReactTest.toSnapshot(jsx) — serialize JSX to component tree

Renders JSX through `react-test-renderer` and returns the JSON tree.
This is a fresh, isolated render — no internal state.

```jsx
const snapshot = CTGReactTest.toSnapshot(<Counter initial={0} />);
// { type: "div", props: {}, children: [...] }
```

**Purpose:** Create a serializable representation of a component's
structure for comparison or inspection.

### CTGReactTest.diffSnapshot(jsxA, jsxB) — diff two component trees

Renders both JSX elements through `react-test-renderer` and returns an
array of structural differences between the two trees. Returns an empty
array if the trees match.

```jsx
const diffs = CTGReactTest.diffSnapshot(
    <Counter initial={0} />,
    <Counter initial={1} />
);
// [{ path: "children[0].children[0]", expected: "0", actual: "1" }]

const noDiffs = CTGReactTest.diffSnapshot(
    <Counter initial={0} />,
    <Counter initial={0} />
);
// []
```

**Purpose:** Structural diff of two components outside the pipeline.
Returns what differs, not just whether things differ. Useful for debugging
when `compareSnapshot` returns false.

**Both sides are fresh, isolated renders.** Neither reflects internal state
from interactions. This is purely prop-based structural comparison.

### CTGReactTest.compareSnapshot(jsxA, jsxB) — compare two component trees

Convenience method over `diffSnapshot`. Returns true if the diff is an
empty array.

```jsx
const match = CTGReactTest.compareSnapshot(
    <Counter initial={0} />,
    <Counter initial={0} />
); // true
```

**Implementation:** `return CTGReactTest.diffSnapshot(jsxA, jsxB).length === 0;`

---

## 4. Pipeline Model

A React component test follows a mount → interact → assertDOM cycle:

```
start(<Component />) → interact → assertDOM → interact → assertDOM → ...
```

### start() receives the component

```jsx
const state = await CTGReactTest.init("counter")
    .interact("click increment", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
    })
    .assertDOM("count is 1", (screen) =>
        screen.getByTestId("count").textContent, "1")
    .start(<Counter initial={0} />);
```

`start()` receives the JSX element, wraps it in ReactTestState as
`state.subject`, and mounts it via `@testing-library/react.render()`
before executing any steps. After all steps complete (including chains),
`start()` runs RTL `cleanup()` automatically and returns state.

Render config (wrapper, etc.) is passed through the config object.

### Cleanup

Cleanup runs automatically after the pipeline completes — including after
all chained pipelines finish. The caller does not need try/finally with
`cleanup()`.

To opt out of automatic cleanup (e.g., for staged comparison where the
caller needs to call `toHTML()` on the returned state):

```jsx
const state = await CTGReactTest.init("staged")
    .interact("setup", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
    })
    .start(<Counter initial={0} />, { autoCleanup: false });

const html = state.toHTML(); // component still mounted
// caller must cleanup manually
```

### Chaining

Chain shares the testing surface (`screen`, `user`) from the outer
pipeline's mounted component. The inner pipeline runs its steps against
the same mounted component — no re-mounting.

```jsx
const verifyCount = CTGReactTest.init("verify")
    .assertDOM("count visible", (screen) =>
        screen.getByTestId("count") !== null, true);

await CTGReactTest.init("counter")
    .interact("click", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
    })
    .chain("verify count exists", verifyCount)
    .assertDOM("count is 1", (screen) =>
        screen.getByTestId("count").textContent, "1")
    .start(<Counter initial={0} />);
```

Cleanup runs after the entire pipeline — including chains — completes.

### Typical test patterns

**Behavioral verification:**
```jsx
await CTGReactTest.init("counter behavior")
    .interact("click increment", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
    })
    .assertDOM("count updated", (screen) =>
        screen.getByTestId("count").textContent, "1")
    .start(<Counter initial={0} />);
```

**Staged comparison:**
```jsx
const expected = await CTGReactTest.init("expected state")
    .interact("setup", async ({screen, user}) => {
        await user.click(screen.getByText("Increment"));
        await user.click(screen.getByText("Increment"));
    })
    .start(<Counter initial={0} />, { autoCleanup: false });

await CTGReactTest.init("counter test")
    .interact("different path", async ({screen, user}) => {
        // some other interaction sequence
    })
    .assertHTML("same result", expected)
    .start(<Counter initial={0} />);
```

**Structural comparison (outside pipeline):**
```jsx
const match = CTGReactTest.compareSnapshot(
    <Counter initial={0} />,
    <Counter initial={0} />
);
// use in a ctg-js-test assert if needed
```

---

## 5. Inherited Step Types

These are inherited from ctg-js-test and remain available:

- **stage** — transform pipeline state (e.g., extract values, set up data)
- **assert** — evaluate pipeline state against expected values
- **assertAny** — evaluate pipeline state against candidate list
- **chain** — compose pipeline fragments
- **skip** — conditionally skip steps

These are not the primary tools for React component testing. React tests
use interact/assertDOM/assertHTML. The inherited steps are available for
edge cases — e.g., `stage` to set up test data on state before interactions.

---

## 6. Open Questions

### Multi-component interaction testing

Testing how component A affects component B through shared state requires
a container component:

```jsx
function Container() {
    const [count, setCount] = useState(0);
    return <>
        <Incrementer onClick={() => setCount(c => c + 1)} />
        <Display count={count} />
    </>;
}

await CTGReactTest.init("cross-component")
    .interact("click incrementer", async ({screen, user}) => {
        await user.click(screen.getByText("+"));
    })
    .assertDOM("display updated", (screen) =>
        screen.getByTestId("display").textContent, "1")
    .start(<Container />);
```

This is consistent with "the component is the subject" — the container
is the unit under test. Fine for integration tests. For unit testing
cross-component effects in isolation, the developer writes a test-specific
container. This is a documentation concern, not an API concern.

### Render config

`start()` mounts the component implicitly. Render options (wrapper, etc.)
are passed through the config object:

```jsx
await CTGReactTest.init("themed component")
    .assertDOM("has theme", (screen) =>
        screen.getByTestId("theme").textContent, "dark")
    .start(<MyComponent />, { wrapper: ThemeProvider });
```

Config keys needed:
- `wrapper` — React component to wrap the rendered element (providers, etc.)
- `autoCleanup` — boolean, default `true`. Run RTL cleanup after pipeline
  completes. Set to `false` for staged comparison (toHTML) patterns.

---

## 7. Resolved Decisions

### Hook testing

Hooks are tested through the components that use them. If a hook drives
a state change, the component renders the result — verify it with
`assertDOM`. Direct hook testing (renderHook, result.current) is not
supported in v3.

For hooks that don't produce visible output (e.g., WebSocket management,
caching), the developer writes a thin test component that renders the
hook's return values and tests that component through the pipeline.

Alternatively, hooks can be tested directly using ctg-js-test with
stage/assert, since hook testing is fundamentally value-based rather
than component-based.

This is a README consideration, not an API concern.

### Naming ambiguity

"State" ambiguity (pipeline state vs React component state) is resolved
by the step types. React tests use interact/assertDOM/assertHTML — the
callback parameters are testing-library concepts (`screen`, `user`), not
pipeline state. The developer is never inspecting React component state
directly.

### Error handling

No error handlers on any React-specific step (interact, assertDOM,
assertHTML). In React testing, errors are errors — a missing element or
a failed interaction is a test failure, not something to recover from.
This is a departure from ctg-js-test's error handler semantics on
stage/assert. The inherited steps (stage, assert, assertAny) retain
their error handlers. This divergence is a README consideration — the
React testing domain does not map cleanly to recovery semantics.

### Assertion naming convention

All verification steps use the `assert*` prefix for consistency:

| Method | Input | Compares | Mechanism |
|--------|-------|----------|-----------|
| assertDOM | Callback + expected value | DOM query result vs expected | testing-library |
| assertHTML | STRING or ReactTestState | Rendered HTML vs rendered HTML | toHTML() |

Static utilities for structural comparison:

| Method | Input | Returns | Mechanism |
|--------|-------|---------|-----------|
| toSnapshot | JSX element | JSON tree | react-test-renderer |
| diffSnapshot | JSX, JSX | [OBJECT] | react-test-renderer tree diff |
| compareSnapshot | JSX, JSX | BOOL | diffSnapshot().length === 0 |

Pipeline steps verify behavioral correctness (what the user sees, how
the HTML compares). Static methods verify structural correctness (what
the component tree looks like for given props).

---

## 8. What Stays From v2

- **ReactTestState** — still the state object, fields stay the same
- **Caller-owned reporting** — pipeline returns state, caller formats
- **JSX loader** — JSXLoader/JSXHook for .jsx file support
- **Polymorphic steps** — step subclasses with execute/validate
- **Chain** — composable pipeline fragments with shared React state
- **Config** — haltOnFailure, timeout
- **Formatters** — console and JSON formatters via ctg-js-test
- **react-test-renderer** — moves from peer dependency to regular dependency
  (required by static snapshot methods on the public API)

---

## 9. What Changes From v2

- **start() receives the component** — implicit mount, no `.render()` step
- **render() removed** — component mounting is handled by `start()`
- **assertSnapshot removed** — replaced by static `compareSnapshot`/`toSnapshot`
- **renderHook removed** — hooks tested through components or ctg-js-test
- **assertDOM added** — presentation verification via testing-library queries
- **assertHTML added** — rendered HTML comparison between component states
- **toHTML() added** — on ReactTestState, serializes mounted component HTML
- **toSnapshot() added** — static, serializes JSX to react-test-renderer tree
- **diffSnapshot() added** — static, returns array of differences between two JSX trees
- **compareSnapshot() added** — static, convenience over diffSnapshot, returns boolean
- **No error handlers on React steps** — interact, assertDOM, assertHTML
- **Automatic cleanup** — start() runs RTL cleanup after pipeline completes
- **autoCleanup config** — opt out for staged comparison patterns
- **No file-backed snapshots** — snapshot comparison is inline via static methods
- **Snapshot config keys removed** — snapshotFilePath, snapshotFileUrl,
  updateSnapshots, createBaselines, maxSnapshotBytes no longer needed
- **interact callback change** — receives `{screen, user}`, VOID return
- **assertDOM callback change** — receives `screen`, no pipeline state
