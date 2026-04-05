// ctg-react-test v2 Self Test
//
// Tests the v2 API: ReactTestState, polymorphic step types (render,
// interact, assertSnapshot, renderHook), caller-owned cleanup.
//
// Requires jsdom for DOM globals.
// Run: node tests/v2/SelfTest.js

import CTGTestConsoleFormatter from "ctg-js-test/formatter/console";
import CTGTestResult from "ctg-js-test/result";

// ── jsdom Setup ─────────────────────────────────────────────────

import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.MutationObserver = dom.window.MutationObserver;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.Node = dom.window.Node;
global.Text = dom.window.Text;
global.DocumentFragment = dom.window.DocumentFragment;
global.Element = dom.window.Element;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

// ── Pipeline Categories ─────────────────────────────────────────

import runReactTestState from "./pipelines/reactTestState.js";
import runRenderStep from "./pipelines/renderStep.jsx";
import runInteractStep from "./pipelines/interactStep.jsx";
import runRenderHookStep from "./pipelines/renderHookStep.js";
import runAssertSnapshotStep from "./pipelines/assertSnapshotStep.jsx";
import runPipelineIntegration from "./pipelines/pipelineIntegration.jsx";
import runResultCollection from "./pipelines/resultCollection.jsx";

// ── Bootstrap Harness ───────────────────────────────────────────

let allPassed = true;
let totalTests = 0;
let totalPassed = 0;

async function test(label, fn) {
    totalTests++;
    try {
        await fn();
        totalPassed++;
        process.stdout.write(`  PASS  ${label}\n`);
    } catch (err) {
        allPassed = false;
        process.stdout.write(`  FAIL  ${label}\n`);
        process.stdout.write(`        ${err.message}\n`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

const harness = { test, assert };

// ── Run Tests ───────────────────────────────────────────────────

process.stdout.write("=== ctg-react-test v2 Self Test ===\n\n");

process.stdout.write("── ReactTestState ──\n");
await runReactTestState(harness);

process.stdout.write("\n── Render Step ──\n");
await runRenderStep(harness);

process.stdout.write("\n── Interact Step ──\n");
await runInteractStep(harness);

process.stdout.write("\n── RenderHook Step ──\n");
await runRenderHookStep(harness);

process.stdout.write("\n── AssertSnapshot Step ──\n");
await runAssertSnapshotStep(harness);

process.stdout.write("\n── Pipeline Integration ──\n");
await runPipelineIntegration(harness);

process.stdout.write("\n── Result Collection ──\n");
await runResultCollection(harness);

// ── Summary + Exit ──────────────────────────────────────────────

process.stdout.write(`\n=== ${totalPassed}/${totalTests} passed ===\n`);
process.exit(allPassed ? 0 : 1);
