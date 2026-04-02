// Self-tests for ctg-react-test
//
// Composes test pipelines from category modules.
// Sets up jsdom for standalone React rendering.
// Each pipeline category is a separate module in tests/pipelines/.

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

// ── Pipeline Categories ──────────────────────────────────────

import runReactContext from "./pipelines/reactContext.js";
import runConstruction from "./pipelines/construction.js";
import runRendering from "./pipelines/rendering.js";
import runInteraction from "./pipelines/interaction.js";
import runHooks from "./pipelines/hooks.js";
import runSnapshots from "./pipelines/snapshots.js";
import runSafety from "./pipelines/safety.js";

// ── Config ───────────────────────────────────────────────────

const config = { output: "console", timeout: 0 };

// ── Run All Categories ───────────────────────────────────────

process.stdout.write("=== ctg-react-test Self Test ===\n\n");

await runReactContext({ config });
await runConstruction({ config });
await runRendering({ config });
await runInteraction({ config });
await runHooks({ config });
await runSnapshots({ config });
await runSafety({ config });

// ── Summary + Exit ───────────────────────────────────────────

process.stdout.write("\n=== All tests complete ===\n");

const failed = CTGTest._results.some((r) => r.status === "fail" || r.status === "error");
process.exit(failed ? 1 : 0);
