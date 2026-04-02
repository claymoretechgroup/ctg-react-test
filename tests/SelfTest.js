// Self-tests for ctg-react-test
//
// Uses ctg-js-test pipelines for all tests.
// Sets up jsdom for standalone React rendering.
// Renders real React components via React.createElement (no JSX transpiler).

import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync,
    symlinkSync, rmSync, mkdtempSync } from "node:fs"; // File ops
import { join, dirname } from "node:path"; // Path utils
import { tmpdir } from "node:os"; // Temp directory
import { fileURLToPath } from "node:url"; // URL to path

import CTGTest from "../../ctg-js-test/src/CTGTest.js"; // Test framework

// ── jsdom Setup (standalone DOM for React rendering) ─────────

import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.MutationObserver = dom.window.MutationObserver;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// ── React + Testing Library ──────────────────────────────────

import React from "react"; // React for createElement
import { useState, useCallback } from "react"; // Hooks for test components

// ── Imports under test ───────────────────────────────────────

import CTGReactTest from "../src/CTGReactTest.js"; // React test pipeline
import ReactContext from "../src/ReactContext.js"; // Subject wrapper
import CTGVitestFormatter from "../src/formatters/CTGVitestFormatter.js"; // Vitest formatter

// ── Config ───────────────────────────────────────────────────

const config = { output: "console", timeout: 0 };
const THIS_FILE = fileURLToPath(import.meta.url);

process.stdout.write("=== ctg-react-test Self Test ===\n\n");

// ── Test Components (React.createElement, no JSX) ────────────

// Simple greeting component
function Greeting({ name }) {
    return React.createElement("h1", null, `Hello, ${name}!`);
}

// Counter component with state
function Counter({ initial = 0 }) {
    const [count, setCount] = useState(initial);
    const increment = useCallback(() => setCount((c) => c + 1), []);
    const decrement = useCallback(() => setCount((c) => c - 1), []);
    return React.createElement("div", null,
        React.createElement("span", { "data-testid": "count" }, String(count)),
        React.createElement("button", { onClick: increment }, "Increment"),
        React.createElement("button", { onClick: decrement }, "Decrement")
    );
}

// Form component with input
function LoginForm() {
    const [submitted, setSubmitted] = useState(false);
    const [username, setUsername] = useState("");
    return React.createElement("form", {
        role: "form",
        onSubmit: (e) => { e.preventDefault(); setSubmitted(true); }
    },
        submitted
            ? React.createElement("p", null, `Welcome, ${username}!`)
            : React.createElement(React.Fragment, null,
                React.createElement("label", { htmlFor: "user" }, "Username"),
                React.createElement("input", {
                    id: "user",
                    value: username,
                    onChange: (e) => setUsername(e.target.value)
                }),
                React.createElement("button", { type: "submit" }, "Submit")
            )
    );
}

// Simple hook for testing
function useCounter(initial = 0) {
    const [count, setCount] = useState(initial);
    const increment = useCallback(() => setCount((c) => c + 1), []);
    const reset = useCallback(() => setCount(initial), [initial]);
    return { count, increment, reset };
}

// ══════════════════════════════════════════════════════════════
// ReactContext — Value Object
// ══════════════════════════════════════════════════════════════

await CTGTest.init("ReactContext: constructor stores all fields")
    .stage("create", () => new ReactContext({
        screen: { getByText: () => {} },
        user: { click: () => {} },
        container: document.createElement("div"),
        rerender: () => {},
        data: { key: "value" }
    }))
    .assert("has screen", (ctx) => typeof ctx.screen.getByText, "function")
    .assert("has user", (ctx) => typeof ctx.user.click, "function")
    .assert("has container", (ctx) => ctx.container instanceof HTMLElement, true)
    .assert("has rerender", (ctx) => typeof ctx.rerender, "function")
    .assert("has data", (ctx) => ctx.data.key, "value")
    .start(null, config);

await CTGTest.init("ReactContext: data defaults to empty object")
    .stage("create", () => new ReactContext({
        screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
    }))
    .assert("data is empty", (ctx) => JSON.stringify(ctx.data), "{}")
    .start(null, config);

await CTGTest.init("ReactContext: user can be null")
    .stage("create", () => new ReactContext({
        screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
    }))
    .assert("user is null", (ctx) => ctx.user, null)
    .start(null, config);

await CTGTest.init("ReactContext: get/set data methods")
    .stage("create and populate", () => {
        const ctx = new ReactContext({
            screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
        });
        ctx.set("name", "Alice").set("count", 42);
        return ctx;
    })
    .assert("get name", (ctx) => ctx.get("name"), "Alice")
    .assert("get count", (ctx) => ctx.get("count"), 42)
    .assert("get missing", (ctx) => ctx.get("missing"), undefined)
    .start(null, config);

await CTGTest.init("ReactContext: set returns self for chaining")
    .stage("check", () => {
        const ctx = new ReactContext({
            screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
        });
        return ctx.set("a", 1) === ctx;
    })
    .assert("returns self", (r) => r, true)
    .start(null, config);

await CTGTest.init("ReactContext: data setter replaces bag")
    .stage("replace", () => {
        const ctx = new ReactContext({
            screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
        });
        ctx.set("old", true);
        ctx.data = { fresh: true };
        return { old: ctx.get("old"), fresh: ctx.get("fresh") };
    })
    .assert("old gone", (r) => r.old, undefined)
    .assert("fresh present", (r) => r.fresh, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Inheritance and Construction
// ══════════════════════════════════════════════════════════════

await CTGTest.init("CTGReactTest: init returns correct instances")
    .stage("create", () => CTGReactTest.init("test"))
    .assert("is CTGReactTest", (t) => t instanceof CTGReactTest, true)
    .assert("is CTGTest", (t) => t instanceof CTGTest, true)
    .assert("name preserved", (t) => t.name, "test")
    .start(null, config);

await CTGTest.init("CTGReactTest: inherits core step methods")
    .stage("create", () => CTGReactTest.init("check"))
    .assert("stage", (t) => typeof t.stage, "function")
    .assert("assert", (t) => typeof t.assert, "function")
    .assert("assertAny", (t) => typeof t.assertAny, "function")
    .assert("chain", (t) => typeof t.chain, "function")
    .assert("skip", (t) => typeof t.skip, "function")
    .assert("start", (t) => typeof t.start, "function")
    .start(null, config);

// ── React Step Methods ───────────────────────────────────────

await CTGTest.init("CTGReactTest: render adds render step")
    .stage("create", () => CTGReactTest.init("t").render("mount", () => null).steps[0])
    .assert("type", (s) => s.type, "render")
    .assert("name", (s) => s.name, "mount")
    .start(null, config);

await CTGTest.init("CTGReactTest: interact adds interact step")
    .stage("create", () => CTGReactTest.init("t").interact("click", () => {}).steps[0])
    .assert("type", (s) => s.type, "interact")
    .start(null, config);

await CTGTest.init("CTGReactTest: snapshot adds snapshot step with sentinel")
    .stage("create", () => CTGReactTest.init("t").snapshot("capture").steps[0])
    .assert("type", (s) => s.type, "snapshot")
    .assert("sentinel", (s) => s.expected, "__snapshot__")
    .start(null, config);

await CTGTest.init("CTGReactTest: renderHook adds renderHook step")
    .stage("create", () => CTGReactTest.init("t").renderHook("hook", () => {}).steps[0])
    .assert("type", (s) => s.type, "renderHook")
    .start(null, config);

await CTGTest.init("CTGReactTest: all React methods return this")
    .stage("check", () => {
        const t = CTGReactTest.init("chain");
        return t.render("r", () => null) === t
            && t.interact("i", () => {}) === t
            && t.snapshot("s") === t
            && t.renderHook("h", () => {}) === t;
    })
    .assert("all chainable", (r) => r, true)
    .start(null, config);

// ── STEP_TYPES ───────────────────────────────────────────────

await CTGTest.init("CTGReactTest: STEP_TYPES includes all types")
    .assert("stage", () => CTGReactTest.STEP_TYPES.has("stage"), true)
    .assert("assert", () => CTGReactTest.STEP_TYPES.has("assert"), true)
    .assert("assert-any", () => CTGReactTest.STEP_TYPES.has("assert-any"), true)
    .assert("chain", () => CTGReactTest.STEP_TYPES.has("chain"), true)
    .assert("render", () => CTGReactTest.STEP_TYPES.has("render"), true)
    .assert("interact", () => CTGReactTest.STEP_TYPES.has("interact"), true)
    .assert("snapshot", () => CTGReactTest.STEP_TYPES.has("snapshot"), true)
    .assert("renderHook", () => CTGReactTest.STEP_TYPES.has("renderHook"), true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Render Real Components (Standalone)
// ══════════════════════════════════════════════════════════════

await CTGTest.init("render: mounts component and produces ReactContext")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("greeting")
            .render("mount", React.createElement(Greeting, { name: "World" }))
            .assert("has heading", (ctx) => ctx.screen.getByText("Hello, World!") !== null, true)
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

await CTGTest.init("render: container has rendered HTML")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("html check")
            .render("mount", React.createElement(Greeting, { name: "React" }))
            .assert("innerHTML", (ctx) => ctx.container.innerHTML.includes("Hello, React!"), true)
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

await CTGTest.init("render: function element (lazy evaluation)")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("lazy render")
            .render("mount", () => React.createElement(Greeting, { name: "Lazy" }))
            .assert("rendered", (ctx) => ctx.screen.getByText("Hello, Lazy!") !== null, true)
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Interact with Components
// ══════════════════════════════════════════════════════════════

await CTGTest.init("interact: click button changes state")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("counter interaction")
            .render("mount", React.createElement(Counter, { initial: 0 }))
            .assert("initial count", (ctx) => ctx.screen.getByTestId("count").textContent, "0")
            .interact("click increment", async (ctx) => {
                await ctx.user.click(ctx.screen.getByText("Increment"));
                return ctx;
            })
            .assert("count after click", (ctx) => ctx.screen.getByTestId("count").textContent, "1")
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

await CTGTest.init("interact: multiple interactions")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("multi click")
            .render("mount", React.createElement(Counter, { initial: 5 }))
            .interact("click twice", async (ctx) => {
                await ctx.user.click(ctx.screen.getByText("Increment"));
                await ctx.user.click(ctx.screen.getByText("Increment"));
                return ctx;
            })
            .assert("count is 7", (ctx) => ctx.screen.getByTestId("count").textContent, "7")
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

await CTGTest.init("interact: form submission")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("login form")
            .render("mount", React.createElement(LoginForm))
            .assert("has form", (ctx) => ctx.screen.getByRole("form") !== null, true)
            .interact("fill and submit", async (ctx) => {
                await ctx.user.type(ctx.screen.getByLabelText("Username"), "alice");
                await ctx.user.click(ctx.screen.getByText("Submit"));
                return ctx;
            })
            .assert("shows welcome", (ctx) => ctx.screen.getByText("Welcome, alice!") !== null, true)
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — renderHook
// ══════════════════════════════════════════════════════════════

await CTGTest.init("renderHook: captures hook return value")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("hook test")
            .renderHook("mount", () => useCounter(0))
            .assert("initial count", (ctx) => ctx.data.result.current.count, 0)
            .assert("has increment", (ctx) => typeof ctx.data.result.current.increment, "function")
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

await CTGTest.init("renderHook: result.current updates after act")
    .stage("execute", async () => {
        const { act } = await import("@testing-library/react");
        const r = await CTGReactTest.init("hook mutation")
            .renderHook("mount", () => useCounter(10))
            .assert("initial", (ctx) => ctx.data.result.current.count, 10)
            .stage("increment", async (ctx) => {
                await act(() => { ctx.data.result.current.increment(); });
                return ctx;
            })
            .assert("after increment", (ctx) => ctx.data.result.current.count, 11)
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Snapshot (Standalone)
// ══════════════════════════════════════════════════════════════

await CTGTest.init("snapshot: captures rendered HTML")
    .stage("execute", async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const snapPath = join(tmpDir, "SnapshotTest.js");
        writeFileSync(snapPath, "// test");
        try {
            const r = await CTGReactTest.init("snapshot capture")
                .render("mount", React.createElement(Greeting, { name: "Snapshot" }))
                .snapshot("greeting html")
                .start(null, { output: "return-json", timeout: 0, snapshotFilePath: snapPath });
            const snapFile = join(tmpDir, "__snapshots__", "SnapshotTest.snap.json");
            const snapData = JSON.parse(readFileSync(snapFile, "utf-8"));
            const key = Object.keys(snapData)[0];
            return { status: r.status, hasHello: snapData[key].includes("Hello, Snapshot!") };
        } finally {
            rmSync(tmpDir, { recursive: true });
        }
    })
    .assert("status pass", (r) => r.status, "pass")
    .assert("snapshot contains greeting", (r) => r.hasHello, true)
    .start(null, config);

await CTGTest.init("snapshot: custom extraction function")
    .stage("execute", async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const snapPath = join(tmpDir, "CustomSnap.js");
        writeFileSync(snapPath, "// test");
        try {
            const r = await CTGReactTest.init("custom extract")
                .render("mount", React.createElement(Greeting, { name: "Custom" }))
                .snapshot("text only", (ctx) => ctx.container.textContent)
                .start(null, { output: "return-json", timeout: 0, snapshotFilePath: snapPath });
            const snapFile = join(tmpDir, "__snapshots__", "CustomSnap.snap.json");
            const snapData = JSON.parse(readFileSync(snapFile, "utf-8"));
            const value = Object.values(snapData)[0];
            return { status: r.status, value };
        } finally {
            rmSync(tmpDir, { recursive: true });
        }
    })
    .assert("status pass", (r) => r.status, "pass")
    .assert("text content captured", (r) => r.value, "Hello, Custom!")
    .start(null, config);

await CTGTest.init("snapshot: mismatch produces fail")
    .stage("execute", async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const snapPath = join(tmpDir, "MismatchSnap.js");
        writeFileSync(snapPath, "// test");
        try {
            // First run: write snapshot with "World"
            await CTGReactTest.init("mismatch test")
                .render("mount", React.createElement(Greeting, { name: "World" }))
                .snapshot("greeting")
                .start(null, { output: "return-json", timeout: 0, snapshotFilePath: snapPath });
            // Second run: render with "Different" — should fail
            const r = await CTGReactTest.init("mismatch test")
                .render("mount", React.createElement(Greeting, { name: "Different" }))
                .snapshot("greeting")
                .start(null, { output: "return-json", timeout: 0, snapshotFilePath: snapPath });
            return r.status;
        } finally {
            rmSync(tmpDir, { recursive: true });
        }
    })
    .assert("status fail", (r) => r, "fail")
    .start(null, config);

await CTGTest.init("snapshot: sanitize hook redacts content")
    .stage("execute", async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const snapPath = join(tmpDir, "SanitizeSnap.js");
        writeFileSync(snapPath, "// test");
        try {
            await CTGReactTest.init("sanitize test")
                .render("mount", React.createElement(Greeting, { name: "secret-token-xyz" }))
                .snapshot("redacted", null, {
                    sanitize: (html) => html.replace(/secret-token-xyz/g, "REDACTED")
                })
                .start(null, { output: "return-json", timeout: 0, snapshotFilePath: snapPath });
            const snapFile = join(tmpDir, "__snapshots__", "SanitizeSnap.snap.json");
            const snapData = JSON.parse(readFileSync(snapFile, "utf-8"));
            const value = Object.values(snapData)[0];
            return {
                noSecret: !value.includes("secret-token-xyz"),
                hasRedacted: value.includes("REDACTED")
            };
        } finally {
            rmSync(tmpDir, { recursive: true });
        }
    })
    .assert("no secret in snapshot", (r) => r.noSecret, true)
    .assert("has REDACTED marker", (r) => r.hasRedacted, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Composability (Chain)
// ══════════════════════════════════════════════════════════════

await CTGTest.init("chain: reusable React pipeline fragment")
    .stage("execute", async () => {
        const hasFormRole = CTGReactTest.init("form check")
            .assert("has form", (ctx) => ctx.screen.getByRole("form") !== null, true);

        const r = await CTGReactTest.init("login pipeline")
            .render("mount", React.createElement(LoginForm))
            .chain("accessibility", hasFormRole)
            .start(null, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — DOM Detection
// ══════════════════════════════════════════════════════════════

await CTGTest.init("render throws without DOM globals")
    .stage("attempt", async () => {
        const saved = { doc: global.document, win: global.window, el: global.HTMLElement };
        global.document = undefined;
        global.window = undefined;
        global.HTMLElement = undefined;
        try {
            await CTGReactTest.init("no dom")
                .render("mount", React.createElement(Greeting, { name: "X" }))
                .start(null, { output: "return-json", timeout: 0 });
            return "no throw";
        } catch (e) {
            return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
        } finally {
            global.document = saved.doc;
            global.window = saved.win;
            global.HTMLElement = saved.el;
        }
    })
    .assert("threw INVALID_STEP", (r) => r, "threw")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — User Event Validation
// ══════════════════════════════════════════════════════════════

await CTGTest.init("interact: validates user is not null")
    .stage("attempt", async () => {
        const ctx = new ReactContext({
            screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
        });
        try {
            await CTGReactTest.init("no user")
                .interact("click", (c) => { c.user.click(); return c; })
                .start(ctx, { output: "return-json", timeout: 0 });
            return "no error";
        } catch (e) {
            return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.type || e.message}`;
        }
    })
    .assert("threw INVALID_STEP", (r) => r, "threw")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGVitestFormatter — Detection and API
// ══════════════════════════════════════════════════════════════

await CTGTest.init("VitestFormatter: _isExecutionFormatter flag")
    .assert("flag true", () => CTGVitestFormatter._isExecutionFormatter, true)
    .start(null, config);

await CTGTest.init("VitestFormatter: instance has execute and getReport")
    .stage("create", () => new CTGVitestFormatter())
    .assert("execute", (f) => typeof f.execute, "function")
    .assert("getReport", (f) => typeof f.getReport, "function")
    .start(null, config);

await CTGTest.init("VitestFormatter: static format method")
    .assert("format exists", () => typeof CTGVitestFormatter.format, "function")
    .start(null, config);

await CTGTest.init("VitestFormatter: sanitizeMessage config accepted")
    .stage("create", () => new CTGVitestFormatter({
        sanitizeMessage: (msg) => msg.replace(/secret/g, "REDACTED")
    }))
    .assert("is instance", (f) => f instanceof CTGVitestFormatter, true)
    .start(null, config);

await CTGTest.init("formatter detection: plain class not detected as execution")
    .stage("check", () => {
        class PlainFormatter { static format(r) { return JSON.stringify(r); } }
        return PlainFormatter._isExecutionFormatter === undefined
            && CTGVitestFormatter._isExecutionFormatter === true;
    })
    .assert("distinguished", (r) => r, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// Snapshot Manager — File Operations
// ══════════════════════════════════════════════════════════════

await CTGTest.init("snapshot manager: first run writes and passes")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "Test.js");
        const result = CTGReactTest._compareSnapshot(filePath, "test > step", "<div>hello</div>");
        const snapFile = join(tmpDir, "__snapshots__", "Test.snap.json");
        const exists = existsSync(snapFile);
        rmSync(tmpDir, { recursive: true });
        return { match: result.match, exists };
    })
    .assert("match true", (r) => r.match, true)
    .assert("file created", (r) => r.exists, true)
    .start(null, config);

await CTGTest.init("snapshot manager: second run matches")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "Test.js");
        CTGReactTest._compareSnapshot(filePath, "test > step", "value");
        const result = CTGReactTest._compareSnapshot(filePath, "test > step", "value");
        rmSync(tmpDir, { recursive: true });
        return result;
    })
    .assert("match true", (r) => r.match, true)
    .start(null, config);

await CTGTest.init("snapshot manager: mismatch returns stored")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "Test.js");
        CTGReactTest._compareSnapshot(filePath, "a > b", "original");
        const result = CTGReactTest._compareSnapshot(filePath, "a > b", "changed");
        rmSync(tmpDir, { recursive: true });
        return result;
    })
    .assert("match false", (r) => r.match, false)
    .assert("stored value", (r) => r.stored, "original")
    .start(null, config);

await CTGTest.init("snapshot manager: update overwrites")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "Test.js");
        CTGReactTest._compareSnapshot(filePath, "a > b", "old");
        CTGReactTest._updateSnapshot(filePath, "a > b", "new");
        const result = CTGReactTest._compareSnapshot(filePath, "a > b", "new");
        rmSync(tmpDir, { recursive: true });
        return result;
    })
    .assert("match after update", (r) => r.match, true)
    .start(null, config);

await CTGTest.init("snapshot manager: path sanitization")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "Test.js");
        CTGReactTest._compareSnapshot(filePath, "a/../b > c\0d", "safe");
        const snapFile = join(tmpDir, "__snapshots__", "Test.snap.json");
        const data = JSON.parse(readFileSync(snapFile, "utf-8"));
        const key = Object.keys(data)[0];
        rmSync(tmpDir, { recursive: true });
        return !key.includes("/") && !key.includes("\\") && !key.includes("\0");
    })
    .assert("key sanitized", (r) => r, true)
    .start(null, config);

await CTGTest.init("snapshot manager: maxSnapshotBytes rejects oversized")
    .stage("attempt", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "Test.js");
        try {
            CTGReactTest._compareSnapshot(filePath, "a > b", "x".repeat(200), { maxSnapshotBytes: 100 });
            return "no throw";
        } catch (e) {
            return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
        } finally { rmSync(tmpDir, { recursive: true }); }
    })
    .assert("threw", (r) => r, "threw")
    .start(null, config);

await CTGTest.init("snapshot manager: symlink containment check")
    .stage("attempt", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const externalDir = mkdtempSync(join(tmpdir(), "ctg-external-"));
        const snapDir = join(tmpDir, "__snapshots__");
        try { symlinkSync(externalDir, snapDir); }
        catch { rmSync(tmpDir, { recursive: true }); rmSync(externalDir, { recursive: true }); return "skipped"; }
        try {
            CTGReactTest._compareSnapshot(join(tmpDir, "Test.js"), "a > b", "data");
            return "no throw";
        } catch (e) {
            return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
        } finally { rmSync(tmpDir, { recursive: true }); rmSync(externalDir, { recursive: true }); }
    })
    .assert("threw or skipped", (r) => r === "threw" || r === "skipped", true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Five-Status Reporting (Standalone)
// ══════════════════════════════════════════════════════════════

await CTGTest.init("standalone: pass and fail counted")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("status test")
            .render("mount", React.createElement(Greeting, { name: "Test" }))
            .assert("pass", (ctx) => ctx.container.innerHTML.includes("Hello"), true)
            .assert("fail", (ctx) => ctx.container.innerHTML.includes("Goodbye"), true)
            .start(null, { output: "return-json", timeout: 0, haltOnFailure: false });
        return { status: r.status, passed: r.passed, failed: r.failed };
    })
    .assert("overall fail", (r) => r.status, "fail")
    .assert("1 passed", (r) => r.passed >= 1, true)
    .assert("1 failed", (r) => r.failed >= 1, true)
    .start(null, config);

await CTGTest.init("standalone: error recovery produces recovered")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("recover")
            .stage("throw", () => { throw new Error("boom"); }, () => "recovered")
            .assert("check", (x) => x, "recovered")
            .start(null, { output: "return-json", timeout: 0 });
        return r.status;
    })
    .assert("recovered", (s) => s, "recovered")
    .start(null, config);

await CTGTest.init("standalone: skip produces skip status")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("skip")
            .stage("skipped", (x) => x * 100)
            .assert("check", (x) => x, 42)
            .skip("skipped")
            .start(42, { output: "return-json", timeout: 0 });
        return { status: r.status, skipped: r.skipped };
    })
    .assert("pass overall", (r) => r.status, "pass")
    .assert("1 skipped", (r) => r.skipped, 1)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Cleanup Verification
// ══════════════════════════════════════════════════════════════

await CTGTest.init("standalone: cleanup runs after pipeline completes")
    .stage("execute", async () => {
        // Run a pipeline that renders, then verify cleanup happened
        await CTGReactTest.init("cleanup")
            .render("mount", React.createElement(Greeting, { name: "Cleanup" }))
            .assert("rendered", (ctx) => ctx.container.innerHTML.includes("Hello"), true)
            .start(null, { output: "return-json", timeout: 0 });
        // After start returns, the rendered tree should be cleaned up
        // Verify by checking document.body is empty (cleanup unmounts)
        return document.body.innerHTML === "" || document.body.children.length === 0;
    })
    .assert("DOM cleaned up", (r) => r, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// Summary + Exit
// ══════════════════════════════════════════════════════════════

process.stdout.write("\n=== All tests complete ===\n");

const failed = CTGTest._results.some((r) => r.status === "fail" || r.status === "error");
process.exit(failed ? 1 : 0);
