// AssertSnapshotStep tests — §2
//
// Validates that assertSnapshot renders via react-test-renderer,
// stores/loads JSON baselines, and hands actual/expected to the
// pipeline for standard comparison.
//
// NOTE: Coverage gaps that require separate process/environment:
// - snapshotFileUrl resolution (requires import.meta.url context)
// - Missing react-test-renderer dependency (INVALID_STEP error)

import React from "react";
import { cleanup } from "@testing-library/react";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import CTGTestResult from "ctg-js-test/result";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test: rawTest, assert }) {
    const test = (name, fn) => rawTest(name, async () => {
        try { await fn(); } finally { cleanup(); }
    });

    // ── Basic Snapshot ──────────────────────────────────────────

    await test("snapshot: first run creates baseline and passes", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const state = await CTGReactTest.init("snapshot first run")
                .assertSnapshot("greeting tree",
                    React.createElement(Greeting, { name: "Snap" }))
                .start(null, { snapshotFilePath: join(dir, "test.snap.json") });
            assert(state.status === CTGTestResult.STATUS.PASS, "first run passes");
            assert(existsSync(join(dir, "test.snap.json")), "baseline file created");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await test("snapshot: second run matches baseline", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            const config = { snapshotFilePath: snapPath };

            // First run — create baseline
            await CTGReactTest.init("snapshot match")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "Match" }))
                .start(null, config);

            // Second run — same component, should match
            const state = await CTGReactTest.init("snapshot match")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "Match" }))
                .start(null, config);
            assert(state.status === CTGTestResult.STATUS.PASS, "second run matches");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await test("snapshot: mismatch produces fail", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            const config = { snapshotFilePath: snapPath, haltOnFailure: false };

            // First run — create baseline with name "A"
            await CTGReactTest.init("snapshot mismatch")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "A" }))
                .start(null, config);

            // Second run — different component, should fail
            const state = await CTGReactTest.init("snapshot mismatch")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "B" }))
                .start(null, config);
            assert(state.status === CTGTestResult.STATUS.FAIL, "mismatch fails");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // ── createBaselines: false ──────────────────────────────────

    await test("snapshot: createBaselines false fails on missing baseline", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const state = await CTGReactTest.init("snapshot no create")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "X" }))
                .start(null, {
                    snapshotFilePath: join(dir, "test.snap.json"),
                    createBaselines: false,
                    haltOnFailure: false
                });
            assert(state.status === CTGTestResult.STATUS.FAIL, "missing baseline fails");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // ── updateSnapshots ─────────────────────────────────────────

    await test("snapshot: updateSnapshots overwrites baseline", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");

            // First run — baseline with name "Old"
            await CTGReactTest.init("snapshot update")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "Old" }))
                .start(null, { snapshotFilePath: snapPath });

            // Update run — overwrites with name "New"
            const state = await CTGReactTest.init("snapshot update")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "New" }),
                    {})
                .start(null, { snapshotFilePath: snapPath, updateSnapshots: true });
            assert(state.status === CTGTestResult.STATUS.PASS, "update passes");

            // Verify baseline was overwritten
            const snap = JSON.parse(readFileSync(snapPath, "utf-8"));
            const keys = Object.keys(snap);
            assert(keys.length > 0, "has baseline");
            const baseline = snap[keys[0]];
            assert(JSON.stringify(baseline).includes("New"), "baseline updated");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // ── Baseline File Schema ────────────────────────────────────

    await test("snapshot: baseline file is valid JSON with keyed entries", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            await CTGReactTest.init("snapshot schema")
                .assertSnapshot("tree",
                    React.createElement(Greeting, { name: "Schema" }))
                .start(null, { snapshotFilePath: snapPath });

            const snap = JSON.parse(readFileSync(snapPath, "utf-8"));
            assert(typeof snap === "object", "file is JSON object");
            const keys = Object.keys(snap);
            assert(keys.length === 1, "one entry");
            assert(keys[0].includes("snapshot schema"), "key contains pipeline name");
            assert(keys[0].includes("tree"), "key contains step name");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // ── react-test-renderer Output ──────────────────────────────

    await test("snapshot: baseline is react-test-renderer JSON tree", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            await CTGReactTest.init("snapshot tree format")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "Tree" }))
                .start(null, { snapshotFilePath: snapPath });

            const snap = JSON.parse(readFileSync(snapPath, "utf-8"));
            const tree = snap[Object.keys(snap)[0]];
            assert(tree.type === "h1", "tree has type");
            assert(Array.isArray(tree.children), "tree has children");
            assert(tree.children[0] === "Hello, Tree!", "tree content correct");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // ── maxSnapshotBytes ────────────────────────────────────────

    await test("snapshot: maxSnapshotBytes rejects oversized value", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const state = await CTGReactTest.init("snapshot size guard")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "X" }))
                .start(null, {
                    snapshotFilePath: join(dir, "test.snap.json"),
                    maxSnapshotBytes: 1,
                    haltOnFailure: false
                });
            // Should error because serialized tree exceeds 1 byte
            const result = state.results.find((r) => r.name === "greeting");
            assert(result.status === CTGTestResult.STATUS.ERROR, "oversized rejected");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // ── Config Required ─────────────────────────────────────────

    await test("snapshot: missing path config produces error result", async () => {
        const state = await CTGReactTest.init("snapshot no path")
            .assertSnapshot("greeting",
                React.createElement(Greeting, { name: "X" }))
            .start(null, { haltOnFailure: false });
        const result = state.results.find((r) => r.name === "greeting");
        assert(result.status === CTGTestResult.STATUS.ERROR, "error status");
        assert(result.message.includes("snapshotFilePath") ||
               result.message.includes("snapshotFileUrl"),
            "error mentions required config");
    });

    // ── Pipeline Comparison ─────────────────────────────────────

    await test("snapshot: uses pipeline comparison, not self-contained", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            const config = { snapshotFilePath: snapPath };

            // First run creates baseline
            const state = await CTGReactTest.init("snapshot pipeline cmp")
                .assertSnapshot("greeting",
                    React.createElement(Greeting, { name: "X" }))
                .start(null, config);

            // Result should have actual and expected fields
            // (set by step, compared by pipeline)
            const result = state.results.find((r) => r.name === "greeting");
            assert(result.actual !== undefined, "actual set");
            assert(result.expected !== undefined, "expected set");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // ── Validation ──────────────────────────────────────────────

    await test("snapshot: empty name fails validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad snapshot")
                .assertSnapshot("", React.createElement(Greeting, { name: "X" }))
                .start(null, { snapshotFilePath: "/tmp/test.snap.json" });
        } catch {
            threw = true;
        }
        assert(threw, "empty name threw");
    });
}
