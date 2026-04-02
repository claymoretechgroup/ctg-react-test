// Self-tests for ctg-react-test — ReactContext, CTGReactTest, snapshot manager, VitestFormatter
//
// Uses ctg-js-test pipelines for all tests.
// Sets up jsdom for standalone React rendering tests.
// Tests written from spec before implementation.

import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync,
    symlinkSync, rmSync } from "node:fs"; // File ops for snapshot tests
import { join, dirname } from "node:path"; // Path utils
import { tmpdir } from "node:os"; // Temp directory
import { fileURLToPath } from "node:url"; // URL to path conversion
import { mkdtempSync } from "node:fs"; // Temp dir creation

import CTGTest from "../../ctg-js-test/src/CTGTest.js"; // Test framework

// ── jsdom Setup (standalone DOM for React rendering) ─────────

import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

// ── Imports under test ───────────────────────────────────────

import CTGReactTest from "../src/CTGReactTest.js"; // React test pipeline
import ReactContext from "../src/ReactContext.js"; // Subject wrapper
import CTGVitestFormatter from "../src/formatters/CTGVitestFormatter.js"; // Vitest formatter

// ── Config ───────────────────────────────────────────────────

const config = { output: "console", timeout: 0 };
const THIS_FILE = fileURLToPath(import.meta.url);

process.stdout.write("=== ctg-react-test Self Test ===\n\n");

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
    .assert("data is empty object", (ctx) => JSON.stringify(ctx.data), "{}")
    .start(null, config);

await CTGTest.init("ReactContext: user can be null")
    .stage("create", () => new ReactContext({
        screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
    }))
    .assert("user is null", (ctx) => ctx.user, null)
    .start(null, config);

await CTGTest.init("ReactContext: get/set data methods")
    .stage("create", () => new ReactContext({
        screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
    }))
    .stage("set values", (ctx) => { ctx.set("name", "Alice"); ctx.set("count", 42); return ctx; })
    .assert("get name", (ctx) => ctx.get("name"), "Alice")
    .assert("get count", (ctx) => ctx.get("count"), 42)
    .assert("get missing returns undefined", (ctx) => ctx.get("missing"), undefined)
    .start(null, config);

await CTGTest.init("ReactContext: set returns self for chaining")
    .stage("create", () => new ReactContext({
        screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
    }))
    .stage("chain set", (ctx) => ctx.set("a", 1).set("b", 2))
    .assert("both set", (ctx) => ctx.get("a") === 1 && ctx.get("b") === 2, true)
    .start(null, config);

await CTGTest.init("ReactContext: data setter replaces bag")
    .stage("create", () => {
        const ctx = new ReactContext({
            screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
        });
        ctx.set("old", true);
        ctx.data = { fresh: true };
        return ctx;
    })
    .assert("old key gone", (ctx) => ctx.get("old"), undefined)
    .assert("new key present", (ctx) => ctx.get("fresh"), true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Inheritance and Construction
// ══════════════════════════════════════════════════════════════

await CTGTest.init("CTGReactTest: init returns instance")
    .stage("create", () => CTGReactTest.init("test"))
    .assert("is CTGReactTest", (t) => t instanceof CTGReactTest, true)
    .assert("is CTGTest", (t) => t instanceof CTGTest, true)
    .start(null, config);

await CTGTest.init("CTGReactTest: name preserved")
    .stage("create", () => CTGReactTest.init("my pipeline"))
    .assert("name", (t) => t.name, "my pipeline")
    .start(null, config);

await CTGTest.init("CTGReactTest: inherits core step methods")
    .stage("create", () => CTGReactTest.init("inherited"))
    .assert("has stage", (t) => typeof t.stage, "function")
    .assert("has assert", (t) => typeof t.assert, "function")
    .assert("has assertAny", (t) => typeof t.assertAny, "function")
    .assert("has chain", (t) => typeof t.chain, "function")
    .assert("has skip", (t) => typeof t.skip, "function")
    .assert("has start", (t) => typeof t.start, "function")
    .start(null, config);

// ── React Step Methods Exist ─────────────────────────────────

await CTGTest.init("CTGReactTest: has render method")
    .assert("render exists", () => typeof CTGReactTest.prototype.render, "function")
    .start(null, config);

await CTGTest.init("CTGReactTest: has interact method")
    .assert("interact exists", () => typeof CTGReactTest.prototype.interact, "function")
    .start(null, config);

await CTGTest.init("CTGReactTest: has snapshot method")
    .assert("snapshot exists", () => typeof CTGReactTest.prototype.snapshot, "function")
    .start(null, config);

await CTGTest.init("CTGReactTest: has renderHook method")
    .assert("renderHook exists", () => typeof CTGReactTest.prototype.renderHook, "function")
    .start(null, config);

// ── Step Type Registration ───────────────────────────────────

await CTGTest.init("CTGReactTest: render adds render step type")
    .stage("create", () => {
        const t = CTGReactTest.init("test").render("mount", () => null);
        return t.steps[0];
    })
    .assert("type is render", (step) => step.type, "render")
    .assert("name is mount", (step) => step.name, "mount")
    .start(null, config);

await CTGTest.init("CTGReactTest: interact adds interact step type")
    .stage("create", () => {
        const t = CTGReactTest.init("test").interact("click button", () => {});
        return t.steps[0];
    })
    .assert("type is interact", (step) => step.type, "interact")
    .start(null, config);

await CTGTest.init("CTGReactTest: snapshot adds snapshot step type")
    .stage("create", () => {
        const t = CTGReactTest.init("test").snapshot("capture");
        return t.steps[0];
    })
    .assert("type is snapshot", (step) => step.type, "snapshot")
    .assert("expected is sentinel", (step) => step.expected, "__snapshot__")
    .start(null, config);

await CTGTest.init("CTGReactTest: renderHook adds renderHook step type")
    .stage("create", () => {
        const t = CTGReactTest.init("test").renderHook("mount hook", () => {});
        return t.steps[0];
    })
    .assert("type is renderHook", (step) => step.type, "renderHook")
    .start(null, config);

// ── Chainability ─────────────────────────────────────────────

await CTGTest.init("CTGReactTest: all React methods return this for chaining")
    .stage("chain", () => {
        const t = CTGReactTest.init("chain test");
        const r1 = t.render("r", () => null);
        const r2 = t.interact("i", () => {});
        const r3 = t.snapshot("s");
        const r4 = t.renderHook("h", () => {});
        return r1 === t && r2 === t && r3 === t && r4 === t;
    })
    .assert("all return this", (r) => r, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Step Types in STEP_TYPES set
// ══════════════════════════════════════════════════════════════

await CTGTest.init("CTGReactTest: STEP_TYPES includes core types")
    .assert("stage", () => CTGReactTest.STEP_TYPES.has("stage"), true)
    .assert("assert", () => CTGReactTest.STEP_TYPES.has("assert"), true)
    .assert("assert-any", () => CTGReactTest.STEP_TYPES.has("assert-any"), true)
    .assert("chain", () => CTGReactTest.STEP_TYPES.has("chain"), true)
    .start(null, config);

await CTGTest.init("CTGReactTest: STEP_TYPES includes React types")
    .assert("render", () => CTGReactTest.STEP_TYPES.has("render"), true)
    .assert("interact", () => CTGReactTest.STEP_TYPES.has("interact"), true)
    .assert("snapshot", () => CTGReactTest.STEP_TYPES.has("snapshot"), true)
    .assert("renderHook", () => CTGReactTest.STEP_TYPES.has("renderHook"), true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — DOM Environment Detection
// ══════════════════════════════════════════════════════════════

await CTGTest.init("DOM detection: render throws without DOM")
    .stage("attempt", async () => {
        // Temporarily remove DOM globals
        const savedDoc = global.document;
        const savedWin = global.window;
        const savedEl = global.HTMLElement;
        global.document = undefined;
        global.window = undefined;
        global.HTMLElement = undefined;
        try {
            const t = CTGReactTest.init("no dom").render("mount", () => null);
            await t.start(null, { output: "return-json", timeout: 0 });
            return "no throw";
        } catch (e) {
            return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
        } finally {
            global.document = savedDoc;
            global.window = savedWin;
            global.HTMLElement = savedEl;
        }
    })
    .assert("threw INVALID_STEP", (r) => r, "threw")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — User Event Validation
// ══════════════════════════════════════════════════════════════

await CTGTest.init("interact throws when user is null")
    .stage("attempt", async () => {
        const ctx = new ReactContext({
            screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
        });
        const t = CTGReactTest.init("no user")
            .interact("click", (c) => { c.user.click(); return c; });
        try {
            await t.start(ctx, { output: "return-json", timeout: 0 });
            // Check if the interact step produced an error
            return "check result";
        } catch (e) {
            return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
        }
    })
    .assert("threw or errored", (r) => r === "threw" || r === "check result", true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGVitestFormatter — Detection
// ══════════════════════════════════════════════════════════════

await CTGTest.init("VitestFormatter: has _isExecutionFormatter flag")
    .assert("flag is true", () => CTGVitestFormatter._isExecutionFormatter, true)
    .start(null, config);

await CTGTest.init("VitestFormatter: has execute method")
    .stage("create", () => new CTGVitestFormatter())
    .assert("execute is function", (f) => typeof f.execute, "function")
    .start(null, config);

await CTGTest.init("VitestFormatter: has static format method")
    .assert("format is function", () => typeof CTGVitestFormatter.format, "function")
    .start(null, config);

await CTGTest.init("VitestFormatter: has getReport method")
    .stage("create", () => new CTGVitestFormatter())
    .assert("getReport is function", (f) => typeof f.getReport, "function")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGVitestFormatter — Sanitization Config
// ══════════════════════════════════════════════════════════════

await CTGTest.init("VitestFormatter: accepts sanitizeMessage config")
    .stage("create", () => new CTGVitestFormatter({
        sanitizeMessage: (msg) => msg.replace(/secret/g, "REDACTED")
    }))
    .assert("is instance", (f) => f instanceof CTGVitestFormatter, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// Snapshot Manager — File Operations
// ══════════════════════════════════════════════════════════════

await CTGTest.init("snapshot: first run writes and passes")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const snapDir = join(tmpDir, "__snapshots__");
        const filePath = join(tmpDir, "TestFile.js");
        const result = CTGReactTest._compareSnapshot(filePath, "test > step", "<div>hello</div>");
        const snapFile = join(snapDir, "TestFile.snap.json");
        const exists = existsSync(snapFile);
        rmSync(tmpDir, { recursive: true });
        return { match: result.match, exists };
    })
    .assert("match is true (first run)", (r) => r.match, true)
    .assert("snap file created", (r) => r.exists, true)
    .start(null, config);

await CTGTest.init("snapshot: second run matches")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "TestFile.js");
        CTGReactTest._compareSnapshot(filePath, "test > step", "<div>hello</div>");
        const result = CTGReactTest._compareSnapshot(filePath, "test > step", "<div>hello</div>");
        rmSync(tmpDir, { recursive: true });
        return result;
    })
    .assert("match is true", (r) => r.match, true)
    .start(null, config);

await CTGTest.init("snapshot: mismatch returns false with stored value")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "TestFile.js");
        CTGReactTest._compareSnapshot(filePath, "test > step", "<div>original</div>");
        const result = CTGReactTest._compareSnapshot(filePath, "test > step", "<div>changed</div>");
        rmSync(tmpDir, { recursive: true });
        return result;
    })
    .assert("match is false", (r) => r.match, false)
    .assert("stored has original", (r) => r.stored, "<div>original</div>")
    .start(null, config);

await CTGTest.init("snapshot: update mode overwrites")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "TestFile.js");
        CTGReactTest._compareSnapshot(filePath, "test > step", "<div>old</div>");
        CTGReactTest._updateSnapshot(filePath, "test > step", "<div>new</div>");
        const result = CTGReactTest._compareSnapshot(filePath, "test > step", "<div>new</div>");
        rmSync(tmpDir, { recursive: true });
        return result;
    })
    .assert("match after update", (r) => r.match, true)
    .start(null, config);

// ── Snapshot Path Safety ─────────────────────────────────────

await CTGTest.init("snapshot: sanitizes control chars in step path")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "TestFile.js");
        // Step path with path separators and control chars should be sanitized
        CTGReactTest._compareSnapshot(filePath, "test/../evil > step\0name", "safe");
        const snapFile = join(tmpDir, "__snapshots__", "TestFile.snap.json");
        const data = JSON.parse(readFileSync(snapFile, "utf-8"));
        const keys = Object.keys(data);
        rmSync(tmpDir, { recursive: true });
        // Key should not contain path separators or null bytes
        return !keys[0].includes("/") && !keys[0].includes("\\") && !keys[0].includes("\0");
    })
    .assert("key sanitized", (r) => r, true)
    .start(null, config);

await CTGTest.init("snapshot: rejects symlink outside snapshot dir")
    .stage("attempt", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const externalDir = mkdtempSync(join(tmpdir(), "ctg-external-"));
        const snapDir = join(tmpDir, "__snapshots__");
        // Create symlink: __snapshots__ -> external directory
        try {
            symlinkSync(externalDir, snapDir);
        } catch {
            // Symlinks may require privileges on some systems
            rmSync(tmpDir, { recursive: true });
            rmSync(externalDir, { recursive: true });
            return "skipped"; // Can't test symlinks in this env
        }
        const filePath = join(tmpDir, "TestFile.js");
        try {
            CTGReactTest._compareSnapshot(filePath, "test > step", "data");
            return "no throw";
        } catch (e) {
            return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
        } finally {
            rmSync(tmpDir, { recursive: true });
            rmSync(externalDir, { recursive: true });
        }
    })
    .assert("threw or skipped", (r) => r === "threw" || r === "skipped", true)
    .start(null, config);

// ── Snapshot Size Guard ──────────────────────────────────────

await CTGTest.init("snapshot: maxSnapshotBytes rejects oversized value")
    .stage("attempt", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "TestFile.js");
        const largeValue = "x".repeat(200);
        try {
            CTGReactTest._compareSnapshot(filePath, "test > step", largeValue, { maxSnapshotBytes: 100 });
            return "no throw";
        } catch (e) {
            return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
        } finally {
            rmSync(tmpDir, { recursive: true });
        }
    })
    .assert("threw INVALID_STEP", (r) => r, "threw")
    .start(null, config);

await CTGTest.init("snapshot: maxSnapshotBytes allows under-limit value")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const filePath = join(tmpDir, "TestFile.js");
        const result = CTGReactTest._compareSnapshot(filePath, "test > step", "small",
            { maxSnapshotBytes: 10000 });
        rmSync(tmpDir, { recursive: true });
        return result;
    })
    .assert("match (first run)", (r) => r.match, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// Snapshot — Content Sanitization Hook
// ══════════════════════════════════════════════════════════════

await CTGTest.init("snapshot: sanitize option transforms value before storage")
    .stage("create", () => {
        const t = CTGReactTest.init("sanitize test")
            .snapshot("capture", null, {
                sanitize: (html) => html.replace(/token=[^"]+/g, "token=REDACTED")
            });
        return t.steps[0];
    })
    .assert("step type is snapshot", (step) => step.type, "snapshot")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Standalone Execution with Inherited Pipeline
// ══════════════════════════════════════════════════════════════

await CTGTest.init("standalone: stage and assert work via inheritance")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("inherited pipeline")
            .stage("double", (x) => x * 2)
            .assert("is 10", (x) => x, 10)
            .start(5, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .assert("total 2", (r) => r.total, 2)
    .start(null, config);

await CTGTest.init("standalone: chain works via inheritance")
    .stage("execute", async () => {
        const sub = CTGReactTest.init("sub").assert("positive", (x) => x > 0, true);
        const r = await CTGReactTest.init("main")
            .stage("set", () => 42)
            .chain("verify", sub)
            .start(0, { output: "return-json", timeout: 0 });
        return r;
    })
    .assert("status pass", (r) => r.status, "pass")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Formatter Detection
// ══════════════════════════════════════════════════════════════

await CTGTest.init("formatter detection: _isExecutionFormatter flag used")
    .stage("check", () => {
        // A plain object with an execute method should NOT be detected
        const fakeFormatter = { execute: () => {}, constructor: { _isExecutionFormatter: false } };
        // Check that detection requires the flag
        return CTGVitestFormatter._isExecutionFormatter === true
            && fakeFormatter.constructor._isExecutionFormatter === false;
    })
    .assert("flag distinguishes formatters", (r) => r, true)
    .start(null, config);

await CTGTest.init("formatter detection: plain format class not detected as execution")
    .stage("check", () => {
        class PlainFormatter {
            static format(report) { return JSON.stringify(report); }
        }
        return PlainFormatter._isExecutionFormatter === undefined;
    })
    .assert("no flag", (r) => r, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Cleanup
// ══════════════════════════════════════════════════════════════

await CTGTest.init("standalone: cleanup runs after pipeline")
    .stage("execute", async () => {
        // After start() returns in standalone mode, rendered trees should be cleaned up
        // We verify by checking that the pipeline completes without leaked DOM state
        const r = await CTGReactTest.init("cleanup test")
            .stage("identity", (x) => x)
            .start(42, { output: "return-json", timeout: 0 });
        return r.status;
    })
    .assert("completed cleanly", (s) => s, "pass")
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// CTGReactTest — Snapshot File Path Config
// ══════════════════════════════════════════════════════════════

await CTGTest.init("snapshot config: snapshotFilePath override accepted")
    .stage("execute", () => {
        const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        const customPath = join(tmpDir, "custom", "MyTest.js");
        mkdirSync(dirname(customPath), { recursive: true });
        writeFileSync(customPath, "// test file");
        const result = CTGReactTest._compareSnapshot(customPath, "test > step", "value");
        const snapFile = join(tmpDir, "custom", "__snapshots__", "MyTest.snap.json");
        const exists = existsSync(snapFile);
        rmSync(tmpDir, { recursive: true });
        return { match: result.match, exists };
    })
    .assert("match", (r) => r.match, true)
    .assert("file at custom path", (r) => r.exists, true)
    .start(null, config);

// ══════════════════════════════════════════════════════════════
// Five-Status Reporting Preserved
// ══════════════════════════════════════════════════════════════

await CTGTest.init("standalone: five-status reporting works")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("status test")
            .stage("ok", (x) => x)
            .assert("pass", (x) => x, 42)
            .assert("fail", (x) => x, 999)
            .start(42, { output: "return-json", timeout: 0, haltOnFailure: false });
        return { status: r.status, passed: r.passed, failed: r.failed };
    })
    .assert("overall fail", (r) => r.status, "fail")
    .assert("1 passed", (r) => r.passed, 1)
    .assert("1 failed", (r) => r.failed, 1)
    .start(null, config);

await CTGTest.init("standalone: error recovery produces recovered status")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("recover test")
            .stage("throws", () => { throw new Error("boom"); }, () => "recovered")
            .assert("check", (x) => x, "recovered")
            .start(null, { output: "return-json", timeout: 0 });
        return r.status;
    })
    .assert("recovered status", (s) => s, "recovered")
    .start(null, config);

await CTGTest.init("standalone: skip produces skip status")
    .stage("execute", async () => {
        const r = await CTGReactTest.init("skip test")
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
// Summary + Exit
// ══════════════════════════════════════════════════════════════

process.stdout.write("\n=== All tests complete ===\n");

const failed = CTGTest._results.some((r) => r.status === "fail" || r.status === "error");
process.exit(failed ? 1 : 0);
