# CTGBrowserTest — Implementation Spec

**Package:** `ctg-react-test`
**Language:** JavaScript (ESM, Node.js)
**Code Style:** `ctg-project-proc/code-styles/js-code-style.md`

---

## Overview

`CTGBrowserTest` is a pipeline-based browser testing class that extends `CTGTest`
from `ctg-js-test`. It runs user journeys against a real browser via Playwright.
Pipelines are sequences of navigate, interact, assert, and screenshot steps on a
threaded `BrowserContext` subject.

CTGBrowserTest lives in the `ctg-react-test` package alongside `CTGReactTest`.
Both share the core pipeline engine. They do not share step types or subject models.

- **CTGReactTest** — component-level testing in jsdom (render, interact via user-event, assert DOM)
- **CTGBrowserTest** — browser-level testing via Playwright (navigate, interact via page API, assert page state, screenshot comparison)

---

## Design Decisions

### Extends CTGTest, Not CTGReactTest

CTGBrowserTest extends `CTGTest` directly. There is no shared behavior between
jsdom rendering and Playwright page navigation that would justify inheriting from
CTGReactTest. The step types, subject model, config keys, and lifecycle are all
distinct.

### No Method Name Overlap With CTGReactTest

CTGReactTest uses `render` and `interact` with ReactContext semantics.
CTGBrowserTest uses `navigate` and `pageInteract` with Playwright Page semantics.
No method name means different things depending on which class you're using.

### Playwright as Peer Dependency

Playwright (`playwright`) is a peer dependency — not bundled. Projects that
don't use browser testing don't pay the install cost. This matches the pattern
used for Vitest and user-event in the existing package.

### GWT / User Journey Oriented

Pipelines map to user journeys or Given-When-Then scenarios:

- **Given** — navigate to a page, set up initial state
- **When** — interact with the page (click, type, select)
- **Then** — assert page state, compare screenshots

---

## File Layout

```
ctg-react-test/
├── src/
│   ├── CTGReactTest.js              # Existing — component-level
│   ├── CTGBrowserTest.js            # New — browser-level
│   ├── ReactContext.js              # Existing — jsdom subject
│   ├── BrowserContext.js            # New — Playwright subject
│   ├── formatters/
│   │   └── CTGVitestFormatter.js    # Existing
│   └── index.js                     # Updated — exports new classes
├── tests/
│   ├── pipelines/
│   │   ├── browser/                 # New — browser test pipelines
│   │   │   ├── navigation.js
│   │   │   ├── pageInteraction.js
│   │   │   └── screenshots.js
│   │   └── ...                      # Existing component test pipelines
│   └── ...
└── package.json                     # Updated — Playwright peer dep
```

### package.json Changes

```json
{
    "dependencies": {
        "pixelmatch": "^6.0.0",
        "pngjs": "^7.0.0"
    },
    "peerDependencies": {
        "playwright": ">=1.40.0"
    },
    "peerDependenciesMeta": {
        "playwright": { "optional": true }
    }
}
```

`pixelmatch` and `pngjs` are direct dependencies — required for screenshot
comparison in standalone mode without the Playwright test runner.

### Updated Exports

```javascript
// src/index.js
export { CTGReactTest, ReactContext, CTGVitestFormatter };
export { CTGBrowserTest, BrowserContext };
export default CTGReactTest;
```

---

## Class: BrowserContext

Subject wrapper for Playwright page state. Threaded through pipeline steps
as the subject, similar to how ReactContext threads through CTGReactTest
pipelines.

### Constructor

```javascript
// :: OBJECT -> browserContext
constructor({ page, browser, context, data = {} })
```

- `page` — Playwright Page instance (the primary interaction surface)
- `browser` — Playwright Browser instance (for lifecycle management)
- `context` — Playwright BrowserContext (isolation, cookies, storage)
- `data` — mutable data bag for inter-step values

### Properties (Read-Only Getters)

| Property | Type | Description |
|----------|------|-------------|
| `page` | Page | Playwright Page — navigation, interaction, assertions |
| `browser` | Browser | Playwright Browser — lifecycle management |
| `context` | BrowserContext | Playwright BrowserContext — isolation scope |
| `data` | OBJECT | Mutable data bag for passing values between steps |

### Methods

```javascript
// :: STRING -> *
// Shorthand for this.data[key]
get(key)

// :: STRING, * -> browserContext
// Shorthand for this.data[key] = value. Returns self for chaining.
set(key, value)
```

---

## Class: CTGBrowserTest

### Static Fields

```javascript
static STEP_TYPES = new Set([
    ...CTGTest.VALID_STEP_TYPES,    // stage, assert, assert-any, chain
    "navigate", "pageInteract", "screenshotAssert", "mock"
]);

static VALID_CONFIG_KEYS = [
    ...CTGTest.VALID_CONFIG_KEYS,
    "baseUrl",                       // Prepended to relative navigate paths
    "browser",                       // "chromium" | "firefox" | "webkit" (default: "chromium")
    "headless",                      // BOOL (default: true)
    "screenshotDir",                 // Directory for baseline/diff screenshots
    "updateScreenshots",             // BOOL — overwrite baselines (default: false)
    "maxDiffRatio",                  // FLOAT 0-1 — max fraction of differing pixels (default: 0)
    "createBaselines",               // BOOL — create missing baselines (default: true)
    "viewport"                       // { width, height } (default: { width: 1280, height: 720 })
];
```

### Factory

```javascript
// :: STRING -> ctgBrowserTest
// Creates a new browser test pipeline.
static init(name)
```

### Step Methods

#### navigate :: STRING, STRING|OBJECT?, OBJECT? -> ctgBrowserTest

Navigate the browser to a URL. Waits for the page to reach a load state
before proceeding to the next step.

```javascript
// :: STRING, STRING -> ctgBrowserTest
// Navigate to a URL (absolute or relative to baseUrl)
.navigate("go to login", "/login")

// :: STRING, OBJECT -> ctgBrowserTest
// Navigate with options
.navigate("go to login", { url: "/login", waitUntil: "networkidle" })
```

**Parameters:**
- `name` — step name
- `target` — URL string, or object with `url` and optional `waitUntil`
- `waitUntil` options: `"load"` (default), `"domcontentloaded"`, `"networkidle"`

**Subject update:** Replaces the subject with a BrowserContext wrapping the
navigated page. If a BrowserContext already exists, reuses the same page
(navigates in place).

**First navigate creates the browser.** The browser, context, and page are
launched lazily on the first `navigate` step using the config values
(`browser`, `headless`, `viewport`). Subsequent navigates reuse the same
page.

#### pageInteract :: STRING, FUNCTION, FUNCTION? -> ctgBrowserTest

Execute a callback against the Playwright Page for user interactions.

```javascript
.pageInteract("fill login form", async (ctx) => {
    await ctx.page.fill("#username", "alice");
    await ctx.page.fill("#password", "secret");
    await ctx.page.click("button[type=submit]");
    return ctx;
})
```

**Parameters:**
- `name` — step name
- `fn` — `async (browserContext) -> browserContext`. Receives the current
  BrowserContext. Must return ctx (or a modified ctx) to thread the subject.
- `errorHandler` — optional error recovery function

**Subject update:** Return value becomes the new subject. If `fn` returns
`undefined` or a value that is not a `BrowserContext` instance, the step
throws `INVALID_STEP` with a clear message. The test author must return
`ctx` (or a new BrowserContext) to thread the subject.

#### screenshotAssert :: STRING, OBJECT? -> ctgBrowserTest

Capture a screenshot of the current page and compare against a stored
baseline. On first run (no baseline exists), the screenshot is saved as
the baseline and the step passes.

```javascript
// Full page screenshot
.screenshotAssert("dashboard loaded")

// Element screenshot with options
.screenshotAssert("nav bar", {
    selector: "nav.main",
    mask: [".timestamp", ".avatar"],
    maxDiffRatio: 0.01
})
```

**Parameters:**
- `name` — step name (also used to derive the baseline filename)
- `options` — optional:
  - `selector` — CSS selector to screenshot a specific element (default: full page)
  - `mask` — array of CSS selectors to mask before comparison (dynamic content)
  - `maxDiffRatio` — per-step max fraction of differing pixels, overrides config-level `maxDiffRatio`

**Comparison:**
- Baseline path: `{screenshotDir}/{pipelineName}/{stepName}.png`
- If no baseline exists and `createBaselines` is true (default): save screenshot as baseline, step passes
- If no baseline exists and `createBaselines` is false: step fails
- If baseline exists: pixel comparison via `pixelmatch` within `maxDiffRatio` tolerance
- If `updateScreenshots` config is true: overwrite baseline, step passes
- On mismatch: step fails, diff image saved as `{stepName}.diff.png`, actual saved as `{stepName}.actual.png`

**Subject update:** Does not modify the subject.

#### mock :: STRING, STRING, OBJECT|FUNCTION -> ctgBrowserTest

Register a network route mock on the Playwright Page. Intercepts matching
requests and fulfills them with the provided response. Mocks are registered
before navigation, so they are active when the page loads.

```javascript
// Mock with static JSON response
.mock("user api", "**/api/user", { json: { name: "Alice" } })

// Mock with status code and body
.mock("not found", "**/api/missing", { status: 404, body: "Not found" })

// Mock with a handler function for dynamic responses
.mock("search", "**/api/search*", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    route.fulfill({ json: { results: [`result for ${query}`] } });
})
```

**Parameters:**
- `name` — step name
- `pattern` — URL pattern string (glob syntax, passed to `page.route()`)
- `response` — one of:
  - `OBJECT` with optional `status` (default 200), `json`, `body`, `headers`,
    `contentType` fields. Passed to `route.fulfill()`.
  - `FUNCTION` receiving the Playwright `Route` object for dynamic handling.
    The function must call `route.fulfill()`, `route.abort()`, or
    `route.continue()`.

**Subject update:** Does not modify the subject. Mocks accumulate — multiple
mock steps register multiple routes. If multiple mocks match the same URL
pattern, the last-registered mock wins. The framework enforces this by
applying queued mocks in reverse pipeline order (last mock registered first
via `page.route()`), so Playwright's first-match routing gives last-defined
precedence. This is deterministic and independent of Playwright's internal
ordering behavior.

**Requires a page.** If no `navigate` step has run yet (no BrowserContext
exists), the mock is queued and applied when the browser launches on the
first `navigate`. This allows mocks to be defined before navigation in the
pipeline.

#### Inherited Step Methods

`stage`, `assert`, `assertAny`, `chain`, `skip` are inherited from CTGTest
and work against the BrowserContext subject.

```javascript
// Use stage for non-interaction setup (e.g., seeding data)
.stage("seed database", async (ctx) => {
    await seedTestData();
    return ctx;
})

// Use assert for value assertions against page state
.assert("page title", async (ctx) => await ctx.page.title(), "Dashboard")

// Use assert for URL checks
.assert("redirected", (ctx) => ctx.page.url(), "https://app.example.com/dashboard")
```

---

## Lifecycle

### Prerequisites

Playwright requires browser binaries to be installed separately from the
npm package. If binaries are missing, the pipeline throws `INVALID_STEP`
with an actionable message:

```
INVALID_STEP: Chromium browser binary not found.
Run "npx playwright install chromium" to install it.
```

The framework detects this by catching Playwright's launch error and
wrapping it in a `CTGTestError("INVALID_STEP", ...)` with the appropriate
install command for the configured browser.

### Browser Launch

The browser is launched lazily on the first `navigate` step:

1. Import `playwright` (throws `INVALID_STEP` with clear message if not installed)
2. Launch browser using config (`browser`, `headless`)
   - If browser binary is missing, throw `INVALID_STEP` (see Prerequisites)
3. Create a new BrowserContext with `viewport` settings
4. Create a new Page
5. Apply any queued mocks (from `mock` steps defined before `navigate`)
6. Wrap in BrowserContext subject

### Cleanup

After all steps complete (or on halt), the pipeline tears down:

1. Close the Page
2. Close the BrowserContext
3. Close the Browser

Cleanup runs in a `finally` block — guaranteed even if steps throw.

### Timeout

Async browser steps (`navigate`, `pageInteract`, `screenshotAssert`) are
wrapped with `_withTimeout` from the inherited pipeline engine, using the
`timeout` config value. The `mock` step is excluded — route registration
is synchronous setup, not an async operation that can hang. The default of 5000ms inherited from CTGTest may be
too short for browser operations — test authors should configure an appropriate
timeout for their environment:

```javascript
.start(null, { timeout: 30000 }) // 30 seconds for browser steps
```

Timeout of 0 disables the guard, same as CTGTest.

### Config Validation

```javascript
_validateConfig(config) {
    // Validate browser is one of: "chromium", "firefox", "webkit"
    // Validate headless is boolean
    // Validate viewport has width and height as positive integers
    // Validate screenshotDir is a string (if provided)
    // Validate maxDiffRatio is 0-1 (if provided)
    // Validate updateScreenshots is boolean (if provided)
    // Validate createBaselines is boolean (if provided)
    // Delegate remaining keys to super._validateConfig()
}
```

---

## Screenshot Management

### Directory Structure

```
{screenshotDir}/
├── {pipeline-name}/
│   ├── {step-name}.png           # baseline
│   ├── {step-name}.actual.png    # latest capture (on mismatch)
│   └── {step-name}.diff.png      # visual diff (on mismatch)
```

### Filename Sanitization

Pipeline and step names are sanitized for filesystem safety:
- Replace non-alphanumeric characters (except hyphen, underscore) with hyphen
- Collapse consecutive hyphens
- Trim leading/trailing hyphens
- Lowercase
- Append a short stable hash (first 8 characters of a hex-encoded hash of the
  original unsanitized name) to prevent collisions when distinct names normalize
  to the same slug (e.g. `"A/B"` and `"A B"` both slugify to `"a-b"` but
  produce different hashes)

Example: step name `"A/B test"` → `a-b-test-3f2a1b9c.png`

This is a different strategy from CTGReactTest's snapshot key sanitization,
which uses escape-based encoding. The slug-plus-hash approach is better suited
for filesystem paths where readability and uniqueness both matter.

### Pixel Comparison

Screenshot comparison uses `pixelmatch` (a direct dependency) for pixel-level
diffing. Both the baseline and actual PNGs are decoded via `pngjs`, compared
pixel-by-pixel, and the number of mismatched pixels is checked against the
threshold.

There are two distinct threshold concepts — named differently to avoid
confusion:

- **`maxDiffRatio`** (config and per-step option) — the maximum fraction of
  pixels allowed to differ before the step fails. A value of 0 means exact
  match. A value of 0.01 allows up to 1% of pixels to differ. This is the
  public-facing pass/fail control.

- **`pixelSensitivity`** (internal, not configurable) — the per-pixel
  color distance threshold passed to `pixelmatch`. Fixed at 0.1, which is
  pixelmatch's default and handles anti-aliasing and minor rendering
  differences. This controls whether an individual pixel counts as
  "different."

```
diffCount = pixelmatch(baseline, actual, diff, width, height,
                       { threshold: pixelSensitivity });
diffRatio = diffCount / (width * height);
if (diffRatio > maxDiffRatio) → step fails
```

On mismatch, the diff image is written to `{stepName}.diff.png` with
mismatched pixels highlighted.

### Baseline Creation Behavior

When no baseline exists for a screenshotAssert step:

- **Default:** Save the screenshot as the new baseline, step passes. This
  allows first-run execution to establish baselines without manual setup.
- **If `createBaselines` config is `false`:** Step fails with a clear message
  indicating no baseline was found. This is useful in CI where baselines
  should already exist and unexpected new screenshots indicate a problem.

The `createBaselines` config key defaults to `true`.

---

## Example Pipelines

### Simple Navigation and Assert

```javascript
import { CTGBrowserTest } from "ctg-react-test";

await CTGBrowserTest.init("homepage loads")
    .navigate("go home", "/")
    .assert("title", async (ctx) => await ctx.page.title(), "My App")
    .screenshotAssert("homepage")
    .start(null, {
        baseUrl: "http://localhost:3000",
        screenshotDir: "./screenshots"
    });
```

### Login User Journey

```javascript
await CTGBrowserTest.init("login journey")
    .navigate("go to login", "/login")
    .screenshotAssert("login page")
    .pageInteract("fill credentials", async (ctx) => {
        await ctx.page.fill("[name=email]", "alice@example.com");
        await ctx.page.fill("[name=password]", "password123");
        return ctx;
    })
    .pageInteract("submit form", async (ctx) => {
        await ctx.page.click("button[type=submit]");
        await ctx.page.waitForURL("**/dashboard");
        return ctx;
    })
    .assert("redirected", (ctx) => ctx.page.url().endsWith("/dashboard"), true)
    .screenshotAssert("dashboard after login")
    .start(null, {
        baseUrl: "http://localhost:3000",
        screenshotDir: "./screenshots"
    });
```

### GWT Pattern

```javascript
// Given
const givenUserOnLoginPage = CTGBrowserTest.init("given: login page")
    .navigate("go to login", "/login");

// When
const whenUserSubmitsCredentials = CTGBrowserTest.init("when: submit login")
    .pageInteract("fill and submit", async (ctx) => {
        await ctx.page.fill("[name=email]", "alice@example.com");
        await ctx.page.fill("[name=password]", "password123");
        await ctx.page.click("button[type=submit]");
        await ctx.page.waitForURL("**/dashboard");
        return ctx;
    });

// Then
const thenDashboardLoads = CTGBrowserTest.init("then: dashboard")
    .assert("on dashboard", (ctx) => ctx.page.url().endsWith("/dashboard"), true)
    .screenshotAssert("dashboard");

// Compose
await CTGBrowserTest.init("user can log in")
    .chain("given", givenUserOnLoginPage)
    .chain("when", whenUserSubmitsCredentials)
    .chain("then", thenDashboardLoads)
    .start(null, {
        baseUrl: "http://localhost:3000",
        screenshotDir: "./screenshots"
    });
```

### Mocked API Journey

```javascript
await CTGBrowserTest.init("dashboard with mocked data")
    .mock("user api", "**/api/user", { json: { name: "Alice", role: "admin" } })
    .mock("notifications", "**/api/notifications", { json: [] })
    .navigate("go to dashboard", "/dashboard")
    .assert("shows name", async (ctx) =>
        await ctx.page.textContent(".username"), "Alice")
    .assert("no badge", async (ctx) =>
        await ctx.page.isHidden(".notification-badge"), true)
    .screenshotAssert("dashboard empty state")
    .start(null, {
        baseUrl: "http://localhost:3000",
        screenshotDir: "./screenshots"
    });
```

### Masking Dynamic Content

```javascript
await CTGBrowserTest.init("profile page")
    .navigate("go to profile", "/profile")
    .screenshotAssert("profile", {
        mask: [".timestamp", ".notification-badge", "[data-testid=avatar]"],
        maxDiffRatio: 0.005
    })
    .start(null, {
        baseUrl: "http://localhost:3000",
        screenshotDir: "./screenshots"
    });
```

---

## What This Spec Does NOT Add

- **No multi-page/multi-tab support** — One page per pipeline. Multi-tab
  workflows require separate pipelines.
- **No video recording** — Playwright supports it, but recording configuration
  is outside pipeline scope.
- **No trace collection** — Same rationale. Can be configured externally.
- **No mobile emulation** — Viewport config covers sizing. Device emulation
  (user agent, touch events) is a future consideration.
- **No CTGPlaywrightFormatter** — Standalone execution via `start()` is the
  v2 target. A test runner formatter (analogous to CTGVitestFormatter) can be
  added once the standalone pipeline is proven.

---

## Summary

| Aspect | CTGReactTest | CTGBrowserTest |
|--------|-------------|----------------|
| Extends | CTGTest | CTGTest |
| Subject | ReactContext (screen, user, container) | BrowserContext (page, browser, context) |
| Rendering | jsdom via @testing-library/react | Real browser via Playwright |
| Interaction | `interact` — user-event API | `pageInteract` — Playwright Page API |
| Entry point | `render` (component) | `navigate` (URL) |
| Assertions | DOM queries | Page state, screenshots |
| Cleanup | RTL cleanup() | Browser close |
| Screenshot comparison | N/A (DOM snapshot via string) | pixelmatch pixel-level diff |
| Runner | CTGVitestFormatter | Standalone only (formatter deferred) |
