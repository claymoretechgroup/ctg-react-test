// AssertSnapshotStep tests — §2

import { cleanup } from "@testing-library/react";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import CTGTestResult from "ctg-js-test/result";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting } from "../components.jsx";

export default async function run({ test: rawTest, assert }) {
    const test = (name, fn) => rawTest(name, async () => {
        try { await fn(); } finally { cleanup(); }
    });

    await test("snapshot: first run creates baseline and passes", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const state = await CTGReactTest.init("snapshot first run")
                .assertSnapshot("greeting tree", <Greeting name="Snap" />)
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
            await CTGReactTest.init("snapshot match")
                .assertSnapshot("greeting", <Greeting name="Match" />)
                .start(null, config);
            const state = await CTGReactTest.init("snapshot match")
                .assertSnapshot("greeting", <Greeting name="Match" />)
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
            await CTGReactTest.init("snapshot mismatch")
                .assertSnapshot("greeting", <Greeting name="A" />)
                .start(null, config);
            const state = await CTGReactTest.init("snapshot mismatch")
                .assertSnapshot("greeting", <Greeting name="B" />)
                .start(null, config);
            assert(state.status === CTGTestResult.STATUS.FAIL, "mismatch fails");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await test("snapshot: createBaselines false fails on missing baseline", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const state = await CTGReactTest.init("snapshot no create")
                .assertSnapshot("greeting", <Greeting name="X" />)
                .start(null, {
                    snapshotFilePath: join(dir, "test.snap.json"),
                    createBaselines: false,
                    haltOnFailure: false
                });
            assert(state.status === CTGTestResult.STATUS.FAIL, "missing baseline fails");
            const result = state.results.find((r) => r.name === "greeting");
            assert(result.message.includes("createBaselines"), "message mentions createBaselines");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await test("snapshot: updateSnapshots overwrites baseline", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            await CTGReactTest.init("snapshot update")
                .assertSnapshot("greeting", <Greeting name="Old" />)
                .start(null, { snapshotFilePath: snapPath });
            const state = await CTGReactTest.init("snapshot update")
                .assertSnapshot("greeting", <Greeting name="New" />, {})
                .start(null, { snapshotFilePath: snapPath, updateSnapshots: true });
            assert(state.status === CTGTestResult.STATUS.PASS, "update passes");
            const snap = JSON.parse(readFileSync(snapPath, "utf-8"));
            const baseline = snap[Object.keys(snap)[0]];
            assert(JSON.stringify(baseline).includes("New"), "baseline updated");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await test("snapshot: baseline file is valid JSON with keyed entries", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            await CTGReactTest.init("snapshot schema")
                .assertSnapshot("tree", <Greeting name="Schema" />)
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

    await test("snapshot: baseline is react-test-renderer JSON tree", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            await CTGReactTest.init("snapshot tree format")
                .assertSnapshot("greeting", <Greeting name="Tree" />)
                .start(null, { snapshotFilePath: snapPath });
            const snap = JSON.parse(readFileSync(snapPath, "utf-8"));
            const tree = snap[Object.keys(snap)[0]];
            assert(tree.type === "h1", "tree has type");
            assert(Array.isArray(tree.children), "tree has children");
            assert(tree.children.join("") === "Hello, Tree!", "tree content correct");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await test("snapshot: maxSnapshotBytes rejects oversized value", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const state = await CTGReactTest.init("snapshot size guard")
                .assertSnapshot("greeting", <Greeting name="X" />)
                .start(null, {
                    snapshotFilePath: join(dir, "test.snap.json"),
                    maxSnapshotBytes: 1,
                    haltOnFailure: false
                });
            const result = state.results.find((r) => r.name === "greeting");
            assert(result.status === CTGTestResult.STATUS.ERROR, "oversized rejected");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await test("snapshot: missing path config produces error result", async () => {
        const state = await CTGReactTest.init("snapshot no path")
            .assertSnapshot("greeting", <Greeting name="X" />)
            .start(null, { haltOnFailure: false });
        const result = state.results.find((r) => r.name === "greeting");
        assert(result.status === CTGTestResult.STATUS.ERROR, "error status");
        assert(result.message.includes("snapshotFilePath") ||
               result.message.includes("snapshotFileUrl"),
            "error mentions required config");
    });

    await test("snapshot: uses pipeline comparison, not self-contained", async () => {
        const dir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
        try {
            const snapPath = join(dir, "test.snap.json");
            const state = await CTGReactTest.init("snapshot pipeline cmp")
                .assertSnapshot("greeting", <Greeting name="X" />)
                .start(null, { snapshotFilePath: snapPath });
            const result = state.results.find((r) => r.name === "greeting");
            assert(result.actual !== undefined, "actual set");
            assert(result.expected !== undefined, "expected set");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await test("snapshot: empty name fails validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad snapshot")
                .assertSnapshot("", <Greeting name="X" />)
                .start(null, { snapshotFilePath: "/tmp/test.snap.json" });
        } catch {
            threw = true;
        }
        assert(threw, "empty name threw");
    });
}
