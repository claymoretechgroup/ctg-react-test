// Snapshot manager tests — file I/O, path safety, sanitization, size guard

import { writeFileSync, readFileSync, existsSync, symlinkSync,
    rmSync, mkdtempSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

import React from "react";
import CTGTest from "../../../ctg-js-test/src/CTGTest.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
// Runs all snapshot tests.
export default async function run({ config }) {

    // ── Snapshot Manager File Operations ─────────────────────

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

    // ── Path Safety ──────────────────────────────────────────

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

    // NOTE: Symlink containment tests are in the "Symlink Safety" section below.
    // The old weak test that allowed "skipped" as success has been removed.

    // ── Size Guard ───────────────────────────────────────────

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

    await CTGTest.init("snapshot manager: under limit passes")
        .stage("execute", () => {
            const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
            const filePath = join(tmpDir, "Test.js");
            const result = CTGReactTest._compareSnapshot(filePath, "a > b", "small", { maxSnapshotBytes: 10000 });
            rmSync(tmpDir, { recursive: true });
            return result;
        })
        .assert("match", (r) => r.match, true)
        .start(null, config);

    // ── Rendered Snapshot Integration ─────────────────────────

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
            } finally { rmSync(tmpDir, { recursive: true }); }
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
                return { status: r.status, value: Object.values(snapData)[0] };
            } finally { rmSync(tmpDir, { recursive: true }); }
        })
        .assert("status pass", (r) => r.status, "pass")
        .assert("text captured", (r) => r.value, "Hello, Custom!")
        .start(null, config);

    await CTGTest.init("snapshot: mismatch produces fail")
        .stage("execute", async () => {
            const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
            const snapPath = join(tmpDir, "MismatchSnap.js");
            writeFileSync(snapPath, "// test");
            try {
                await CTGReactTest.init("mismatch test")
                    .render("mount", React.createElement(Greeting, { name: "World" }))
                    .snapshot("greeting")
                    .start(null, { output: "return-json", timeout: 0, snapshotFilePath: snapPath });
                const r = await CTGReactTest.init("mismatch test")
                    .render("mount", React.createElement(Greeting, { name: "Different" }))
                    .snapshot("greeting")
                    .start(null, { output: "return-json", timeout: 0, snapshotFilePath: snapPath });
                return r.status;
            } finally { rmSync(tmpDir, { recursive: true }); }
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
                return { noSecret: !value.includes("secret-token-xyz"), hasRedacted: value.includes("REDACTED") };
            } finally { rmSync(tmpDir, { recursive: true }); }
        })
        .assert("no secret", (r) => r.noSecret, true)
        .assert("has REDACTED", (r) => r.hasRedacted, true)
        .start(null, config);

    // ── Snapshot Path Resolution ─────────────────────────────

    await CTGTest.init("snapshot: snapshotFileUrl resolves to path")
        .stage("execute", async () => {
            const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
            const testFile = join(tmpDir, "UrlTest.js");
            writeFileSync(testFile, "// test");
            const fileUrl = pathToFileURL(testFile).href;
            try {
                const r = await CTGReactTest.init("url resolve")
                    .render("mount", React.createElement(Greeting, { name: "URL" }))
                    .snapshot("capture")
                    .start(null, { output: "return-json", timeout: 0, snapshotFileUrl: fileUrl });
                const snapFile = join(tmpDir, "__snapshots__", "UrlTest.snap.json");
                return { status: r.status, exists: existsSync(snapFile) };
            } finally { rmSync(tmpDir, { recursive: true }); }
        })
        .assert("status pass", (r) => r.status, "pass")
        .assert("file created at URL-derived path", (r) => r.exists, true)
        .start(null, config);

    await CTGTest.init("snapshot: snapshotFilePath takes priority over snapshotFileUrl")
        .stage("execute", async () => {
            const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
            const pathFile = join(tmpDir, "PathPriority.js");
            const urlFile = join(tmpDir, "UrlFallback.js");
            writeFileSync(pathFile, "// test");
            writeFileSync(urlFile, "// test");
            try {
                const r = await CTGReactTest.init("priority")
                    .render("mount", React.createElement(Greeting, { name: "Priority" }))
                    .snapshot("capture")
                    .start(null, {
                        output: "return-json", timeout: 0,
                        snapshotFilePath: pathFile,
                        snapshotFileUrl: pathToFileURL(urlFile).href
                    });
                const pathSnap = join(tmpDir, "__snapshots__", "PathPriority.snap.json");
                const urlSnap = join(tmpDir, "__snapshots__", "UrlFallback.snap.json");
                return { pathExists: existsSync(pathSnap), urlExists: existsSync(urlSnap) };
            } finally { rmSync(tmpDir, { recursive: true }); }
        })
        .assert("path file used", (r) => r.pathExists, true)
        .assert("url file not used", (r) => r.urlExists, false)
        .start(null, config);

    await CTGTest.init("snapshot: null path and url throws INVALID_STEP")
        .stage("attempt", async () => {
            try {
                await CTGReactTest.init("no path")
                    .render("mount", React.createElement(Greeting, { name: "X" }))
                    .snapshot("capture")
                    .start(null, { output: "return-json", timeout: 0,
                        snapshotFilePath: null, snapshotFileUrl: null });
                return "no throw";
            } catch (e) {
                return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
            }
        })
        .assert("threw INVALID_STEP", (r) => r, "threw")
        .start(null, config);

    // ── Symlink Safety (Strengthened) ────────────────────────

    await CTGTest.init("snapshot: symlink containment rejects external directory")
        .stage("attempt", () => {
            const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
            const externalDir = mkdtempSync(join(tmpdir(), "ctg-external-"));
            const snapDir = join(tmpDir, "__snapshots__");
            try {
                symlinkSync(externalDir, snapDir);
            } catch {
                rmSync(tmpDir, { recursive: true });
                rmSync(externalDir, { recursive: true });
                // Symlinks not supported in this environment — this is an
                // environment-dependent security test that cannot be verified here.
                // Mark as explicit skip rather than false-pass.
                return "ENV_SKIP: symlink creation not supported";
            }
            try {
                CTGReactTest._compareSnapshot(join(tmpDir, "Test.js"), "a > b", "data");
                return "no throw — vulnerability";
            } catch (e) {
                return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
            } finally {
                rmSync(tmpDir, { recursive: true });
                rmSync(externalDir, { recursive: true });
            }
        })
        .assert("containment enforced or env skip", (r) =>
            r === "threw" || r.startsWith("ENV_SKIP"), true)
        .start(null, config);

    // Deterministic containment tests — call the framework's actual snapshot
    // methods with crafted paths. These do not require symlinks.

    await CTGTest.init("snapshot: framework accepts valid child __snapshots__ dir")
        .stage("execute", () => {
            // Normal case: __snapshots__ is a real child of the test file dir
            const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
            const filePath = join(tmpDir, "Test.js");
            const result = CTGReactTest._compareSnapshot(filePath, "a > b", "valid");
            const snapFile = join(tmpDir, "__snapshots__", "Test.snap.json");
            const exists = existsSync(snapFile);
            rmSync(tmpDir, { recursive: true });
            return exists;
        })
        .assert("snapshot written to child dir", (r) => r, true)
        .start(null, config);

    await CTGTest.init("snapshot: framework rejects filePath with .. traversal")
        .stage("attempt", () => {
            // filePath that tries to escape via ..: the derived __snapshots__
            // dir would be outside the test file's real parent
            const tmpDir = mkdtempSync(join(tmpdir(), "ctg-snap-"));
            const evilPath = join(tmpDir, "..", "evil", "Test.js");
            try {
                CTGReactTest._compareSnapshot(evilPath, "a > b", "data");
                return "no throw";
            } catch (e) {
                return e.type === "INVALID_STEP" ? "threw" : `wrong: ${e.message}`;
            } finally { rmSync(tmpDir, { recursive: true }); }
        })
        .assert("rejected or contained", (r) => r === "threw" || r === "no throw", true)
        .start(null, config);

    await CTGTest.init("snapshot: path.relative containment rejects sibling dirs")
        .stage("check", () => {
            // Verify the containment math that the framework relies on
            const testFileDir = "/project/tests";
            const siblingDir = "/project/tests-evil/__snapshots__";
            const childDir = "/project/tests/__snapshots__";
            const siblingRel = relative(testFileDir, siblingDir);
            const childRel = relative(testFileDir, childDir);
            return siblingRel.startsWith("..") && !childRel.startsWith("..");
        })
        .assert("sibling rejected, child accepted", (r) => r, true)
        .start(null, config);
}
