# ctg-react-test

## Requirements & Design Considerations

**Composable pipeline-based testing for React**
Vitest · Playwright · Snapshot Testing

Claymore Tech Group — Draft, April 2026

---

## 1. Overview

ctg-react-test is a composable, pipeline-based test framework for React applications. It ports the core pipeline model from ctg-php-test into TypeScript/JavaScript and extends it with React-specific capabilities across three testing tiers: unit/component testing via Vitest, snapshot regression via Vitest, and end-to-end user journey testing via Playwright.

The framework preserves the defining characteristics of ctg-php-test — pipeline composition, subject threading, five-status reporting, and separation of test definition from execution — while adapting the execution model to integrate natively with modern JavaScript test runners rather than replacing them.

---

## 2. Goals & Principles

### 2.1 Primary Goals

- Port the ctg-php-test pipeline model faithfully to TypeScript
- Integrate natively with Vitest and Playwright runners without replacing them
- Provide React-specific pipeline steps for rendering, interaction, and assertion
- Add snapshot and screenshot assertion types not present in the PHP framework
- Maintain five-status reporting (pass, fail, error, recovered, skip) across all tiers

### 2.2 Design Principles

- **Pipeline as definition, not execution:** Test pipelines are declarative data structures. They describe what to test, not how to execute it. Execution is delegated to formatters.
- **Formatter as execution adapter:** Formatters are not just output renderers. When targeting Vitest or Playwright, the formatter registers native describe/test/expect blocks, letting the host runner control execution, watch mode, filtering, and reporting.
- **Composability over configuration:** Complex test scenarios are built by chaining smaller pipeline definitions, not by configuring a monolithic test object.
- **Zero lock-in:** A bare/standalone formatter runs pipelines directly without any runner dependency, preserving ctg-php-test's original standalone execution model.

---

## 3. Architecture

### 3.1 Layered Design

The framework is organized into three layers:

| Layer | Responsibility | Key Classes |
|-------|---------------|-------------|
| **Core** | Pipeline engine, step definitions, result model, comparisons | CTGTest, CTGTestResult, CTGTestStep, CTGTestError |
| **React** | React-specific subject model, render/interact stages, snapshot asserts | CTGReactTest, ReactContext |
| **Formatters** | Execution adapters for Vitest, Playwright, and standalone use | VitestFormatter, PlaywrightFormatter, ConsoleFormatter, JsonFormatter, JUnitFormatter |

### 3.2 Subject Model for React

In ctg-php-test, the subject is an arbitrary value threaded through stages. In ctg-react-test, the subject for component tests is a ReactContext object that wraps the render result and provides access to query utilities, user event simulation, and the underlying container. The ReactContext is the threaded value; stages receive it and return it (potentially modified by interaction or re-rendering).

```ts
interface ReactContext {
  screen: Screen;           // @testing-library/react screen
  user: UserEvent;          // @testing-library/user-event instance
  container: HTMLElement;    // root DOM container
  rerender: (ui) => void;   // re-render with new props
  data?: Record<string, any>; // arbitrary test data bag
}
```

For Playwright tests, the subject is a PlaywrightContext containing the page, browser context, and optional test data. The same pipeline mechanics apply — stages navigate and interact, asserts inspect page state.

```ts
interface PlaywrightContext {
  page: Page;
  context: BrowserContext;
  data?: Record<string, any>;
}
```

---

## 4. Core Pipeline Engine (JS Port of ctg-php-test)

### 4.1 Ported API Surface

The following ctg-php-test methods are ported with equivalent semantics. Type signatures are adapted from PHP to TypeScript.

| Method | Signature (TypeScript) | Notes |
|--------|----------------------|-------|
| **init** | `static init(name: string): CTGTest` | Static factory, unchanged |
| **stage** | `stage(name, fn, onError?): this` | Subject transform, supports async |
| **assert** | `assert(name, fn, expected, onError?): this` | Direct comparison, no mutation |
| **assertAny** | `assertAny(name, fn, candidates, onError?): this` | Candidate set comparison |
| **chain** | `chain(name, test): this` | Compose another CTGTest inline |
| **skip** | `skip(name, predicate?): this` | Skip by step name, optional predicate |
| **start** | `start(subject, config?): Promise<R>` | Async by default in JS port |
| **compare** | `protected compare(actual, expected, strict): boolean` | Override point for custom matchers |

### 4.2 JS-Specific Adaptations

- **Async-first:** All stage and assert callbacks may return Promises. The pipeline awaits each step sequentially. The PHP framework is synchronous; the JS port must be async to support React rendering, network calls, and Playwright interactions.
- **Strict by default:** The compare method uses `Object.is()` for strict comparison (equivalent to PHP's `===`). Loose mode uses `==` with standard JS coercion rules.
- **Error model:** CTGTestError is ported as a class extending Error with `type`, `code`, `msg`, and `data` properties matching the PHP structure.
- **Debug serialization:** The debug mode serializer handles JS-specific types: Promises serialize as `'[Promise]'`, Symbols as `'[Symbol: description]'`, DOM nodes as `'[HTMLElement: tagName]'`, and circular references as `'[Circular: constructor.name]'`.

### 4.3 Configuration Options

All ctg-php-test configuration options are preserved, with the addition of the formatter option being extended to accept formatter instances (not just class strings):

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| output | string | `'console'` | console \| return \| return-json \| json \| junit |
| haltOnFailure | boolean | `true` | Stop on first fail or error |
| strict | boolean | `true` | `Object.is()` (true) or `==` (false) |
| trace | boolean | `false` | Include stack traces in error structures |
| debug | boolean | `false` | Capture subject snapshots before each step |
| formatter | Formatter | `null` | Formatter instance or class; overrides output mode execution |

---

## 5. React Layer (CTGReactTest)

### 5.1 Class Relationship

CTGReactTest extends CTGTest. It inherits the full pipeline API and adds React-specific step types and an overridden `start()` method that delegates to execution-adapter formatters.

### 5.2 Overridden start() Method

This is the key architectural change from ctg-php-test. The `start()` method inspects the configured formatter. If the formatter is an ExecutionFormatter (the base type for Vitest and Playwright formatters), it hands the pipeline definition to the formatter, which registers native test runner constructs. If the formatter is a standard output formatter, `start()` calls `super.start()` and passes the result to the formatter for rendering.

```ts
class CTGReactTest extends CTGTest {
  start(subject, config?) {
    const formatter = config?.formatter ?? new ConsoleFormatter();
    if (formatter instanceof ExecutionFormatter) {
      return formatter.execute(this.pipeline, subject, config);
    }
    return super.start(subject, config);
  }
}
```

### 5.3 New Step Types

CTGReactTest adds the following methods that are not present in the base CTGTest:

| Method | Signature | Description |
|--------|-----------|-------------|
| **snapshot** | `snapshot(name, fn?): this` | Snapshot assert. `fn` extracts serializable value from subject (defaults to container innerHTML). Formatter emits `toMatchSnapshot()`. |
| **screenshotAssert** | `screenshotAssert(name, opts?): this` | Playwright-only. Captures page screenshot and compares to baseline. Formatter emits `toHaveScreenshot()`. |
| **render** | `render(name, element, opts?): this` | Convenience stage that renders a React element and wraps the result as a ReactContext subject. |
| **interact** | `interact(name, fn): this` | Convenience stage for user interactions. Receives ReactContext, must return it. Semantically distinct from stage for reporting. |
| **navigate** | `navigate(name, url, opts?): this` | Playwright-only. Stage that navigates to URL and waits for load. Sets PlaywrightContext.page location. |

---

## 6. Formatter Architecture

### 6.1 Formatter Types

Formatters fall into two categories based on their relationship to test execution:

- **Output formatters** receive a completed result object and render it. They do not control execution. These correspond directly to ctg-php-test's formatters: ConsoleFormatter, JsonFormatter, JUnitFormatter.
- **Execution formatters** receive the pipeline definition and register it with a host test runner. They control how and when steps execute. These are new to ctg-react-test: VitestFormatter, PlaywrightFormatter.

Both types implement a common FormatterInterface. Execution formatters additionally implement an `execute()` method.

### 6.2 Execution Formatter Behavior

When an execution formatter receives a pipeline definition, it walks the step list and emits native runner constructs:

| Pipeline Step | Vitest Emission | Playwright Emission |
|--------------|----------------|-------------------|
| Pipeline name | `describe(name, () => { ... })` | `test.describe(name, () => { ... })` |
| stage | Executed inline, no `test()` wrapper | Executed inline, no `test()` wrapper |
| assert | `it(name, () => expect(...))` | `test(name, () => expect(...))` |
| assertAny | `it(name, () => expect.toBeOneOf(...))` | `test(name, () => expect.toBeOneOf(...))` |
| snapshot | `it(name, () => expect.toMatchSnapshot())` | N/A (use screenshotAssert) |
| screenshotAssert | N/A | `test(name, () => expect.toHaveScreenshot())` |
| chain | Nested `describe()` block | Nested `test.describe()` block |
| skip | `it.skip()` or `describe.skip()` | `test.skip()` or `test.describe.skip()` |

### 6.3 Five-Status Mapping

The five-status model from ctg-php-test must be preserved when execution is delegated to a host runner. Native runners only understand pass/fail/skip. The execution formatter bridges this gap:

- **pass:** Native test passes.
- **fail:** Native test fails via `expect()` assertion.
- **error:** Stage or assert throws. Reported as a test failure with error metadata attached.
- **recovered:** Error handler returns a replacement value. The native test passes, but the formatter emits a console warning or custom reporter annotation marking the step as recovered.
- **skip:** Mapped to `it.skip()` / `test.skip()`. Conditional skips evaluate the predicate in a `beforeAll` or `beforeEach` hook.

---

## 7. Three-Tier Testing Model

### 7.1 Tier 1: Unit & Component Tests (Vitest)

- Runner: Vitest with jsdom or happy-dom environment
- Subject: ReactContext wrapping @testing-library/react render results
- Stages: render, interact (userEvent), state manipulation
- Asserts: DOM queries, prop checks, hook return values, accessibility checks
- Formatter: VitestFormatter (execution adapter)
- File convention: `*.pipeline.test.tsx`

### 7.2 Tier 2: Snapshot Regression (Vitest)

- Runner: Vitest with snapshot support
- Subject: ReactContext, same as Tier 1
- Stages: render under various conditions (themes, locales, viewports, prop combinations)
- Asserts: `snapshot()` calls that emit `toMatchSnapshot()` or `toMatchInlineSnapshot()`
- Composability: Reusable rendering pipelines (`withTheme`, `withLocale`) chained before snapshot asserts
- Formatter: VitestFormatter (same as Tier 1; snapshot is just another assert type)
- File convention: `*.snapshot.test.tsx`

### 7.3 Tier 3: User Journeys (Playwright)

- Runner: Playwright Test
- Subject: PlaywrightContext wrapping Page and BrowserContext
- Stages: navigate, interact (click, fill, select), wait for network
- Asserts: page content, URL, element visibility, screenshot comparison
- Error recovery: Screenshot on failure, retry with fallback selectors
- Formatter: PlaywrightFormatter (execution adapter)
- File convention: `*.journey.test.ts`

---

## 8. Composability Patterns

### 8.1 Reusable Pipeline Fragments

Following ctg-php-test's composability model, test fragments are defined as standalone CTGReactTest instances and chained into larger pipelines. This is the primary mechanism for reducing duplication across tests:

```ts
const hasAccessibleForm = CTGReactTest.init('accessible form')
  .assert('has form role', ctx => ctx.screen.getByRole('form') !== null, true)
  .assert('has submit button', ctx => ctx.screen.getByRole('button', { name: /submit/i }) !== null, true);

const loginTest = CTGReactTest.init('Login')
  .render('mount', <LoginForm />)
  .chain('accessibility', hasAccessibleForm)
  .interact('fill credentials', async ctx => { /* ... */ return ctx; })
  .assert('shows welcome', ctx => ctx.screen.getByText(/welcome/i) !== null, true);
```

### 8.2 Cross-Tier Sharing

Assert-only pipeline fragments can be shared across tiers when they operate on values extractable from both ReactContext and PlaywrightContext. This requires the fragment to accept a generic subject and use accessor functions rather than directly accessing tier-specific APIs.

### 8.3 Closure Purity

The ctg-php-test documentation warns about closure purity when reusing definitions across multiple `start()` calls. The same concern applies in JavaScript. Pipeline closures should depend only on the subject argument and not capture mutable state from the enclosing scope. The framework should document this and optionally provide a lint rule or runtime check.

---

## 9. Report Structure & Result Model

The CTGTestResult utility class is ported from PHP with equivalent static methods. The report structure is identical:

```ts
interface PipelineReport {
  name: string;
  status: 'pass' | 'fail' | 'error' | 'recovered' | 'skip';
  passed: number;
  failed: number;
  skipped: number;
  recovered: number;
  errored: number;
  total: number;
  duration_ms: number;
  steps: StepResult[];
}
```

Status severity order for aggregation is preserved: error > fail > recovered > pass > skip. Empty pipelines are pass by special case. The report has no type field at the root level, matching ctg-php-test's convention.

When execution is delegated to a host runner via an execution formatter, the formatter may also produce a PipelineReport for programmatic use (e.g., for a custom dashboard), even though the runner handles its own reporting for the terminal.

---

## 10. Error Handling

### 10.1 CTGTestError

The CTGTestError class is ported from PHP. It extends the native JavaScript Error and adds `type`, `code` (numeric), `msg` (human-readable), and `data` (structured context) properties. Error code ranges follow ctg-php-test conventions: 1xxx for definition/validation errors, 2xxx for runtime errors.

### 10.2 Error Recovery in Pipelines

Stage and assert steps accept an optional error handler. When the primary callback throws and an error handler is provided, the handler receives the error and returns a replacement subject. The step status becomes 'recovered' rather than 'error'. If both the primary callback and the error handler throw, the step status is 'error' with a `caused_by` field linking both exceptions.

### 10.3 React-Specific Error Handling

The 'recovered' status has particular meaning for React tests. When a component's error boundary catches a render error, the test technically passes (the boundary rendered fallback UI), but the pipeline should report the step as 'recovered' to flag the degraded state. This is a signal most testing frameworks lose entirely.

---

## 11. Open Questions & Future Considerations

1. **Hook testing:** Should CTGReactTest provide a dedicated `renderHook()` stage, or should hook testing go through a wrapper component rendered via the standard `render()` stage?
2. **Parallel execution:** Vitest runs test files in parallel. Should pipeline steps within a single file support parallel assert execution (where asserts are independent), or should all steps remain strictly sequential?
3. **Custom matchers:** The `compare()` override point allows custom matchers. Should the framework ship built-in matchers for common React patterns (e.g., `toBeAccessible`, `toHaveStyle`, `toMatchDOM`)?
4. **Vitest Reporter integration:** Beyond the execution formatter, should ctg-react-test ship a custom Vitest reporter that renders the five-status model in the terminal output?
5. **Mocking:** ctg-php-test uses recording proxies as regular pipeline stages rather than a built-in mock API. Should ctg-react-test follow the same philosophy, or integrate with Vitest's `vi.mock`/`vi.fn` utilities?
6. **State management:** For components connected to external state (Redux, Zustand, Context), should the framework provide convenience stages for wrapping components in providers, or leave this to userland pipeline fragments?
7. **CI integration:** The JUnit formatter covers basic CI needs. Should the framework also support Playwright's built-in HTML reporter, or provide its own unified report across all three tiers?

---

## 12. Package Structure

The recommended package structure separates concerns to keep dependencies minimal:

```
ctg-react-test/
  packages/
    core/                    # CTGTest, CTGTestResult, CTGTestError, CTGTestStep
                             # Zero dependencies. Usable standalone.
    react/                   # CTGReactTest, ReactContext, render/interact/snapshot steps
                             # Peer deps: react, @testing-library/react, @testing-library/user-event
    vitest-formatter/        # VitestFormatter (execution adapter)
                             # Peer dep: vitest
    playwright-formatter/    # PlaywrightFormatter (execution adapter)
                             # Peer dep: @playwright/test
    formatters/              # ConsoleFormatter, JsonFormatter, JUnitFormatter
                             # Zero dependencies beyond core.
```

---

## 13. Compatibility Requirements

- TypeScript >= 5.0
- Node.js >= 18 (required by Vitest and Playwright)
- React >= 18 (concurrent rendering support)
- Vitest >= 1.0
- Playwright >= 1.40
- ESM-first with CJS compatibility via dual exports

---

*End of document — ctg-react-test Requirements & Design Considerations*
