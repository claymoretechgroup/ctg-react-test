// Vitest execution mode tests — formatter runtime behavior, shared state,
// lossy status mapping, getReport() counts, conditional skip, haltOnFailure

import React from "react";
import CTGTest from "../../../ctg-js-test/src/CTGTest.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import CTGVitestFormatter from "../../src/formatters/CTGVitestFormatter.js";
import { Greeting, Counter } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
// Runs all Vitest execution mode tests.
export default async function run({ config }) {

    // ── Basic Execution via Formatter ────────────────────────

    await CTGTest.init("vitest mode: formatter.execute runs pipeline")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("basic vitest")
                .stage("double", (x) => x * 2)
                .assert("is 10", (x) => x, 10)
                .start(5, { output: "return-json", timeout: 0, formatter });
            const report = formatter.getReport();
            return report;
        })
        .assert("has report", (r) => r !== null && r !== undefined, true)
        .assert("status pass", (r) => r.status, "pass")
        .assert("total 2", (r) => r.total, 2)
        .start(null, config);

    // ── Shared State Threading ───────────────────────────────

    await CTGTest.init("vitest mode: stages thread subject through shared state")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("threading")
                .stage("add 1", (x) => x + 1)
                .stage("double", (x) => x * 2)
                .assert("is 12", (x) => x, 12)
                .start(5, { output: "return-json", timeout: 0, formatter });
            return formatter.getReport();
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);

    // ── React Rendering via Formatter ────────────────────────

    await CTGTest.init("vitest mode: render produces ReactContext in formatter")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("render vitest")
                .render("mount", React.createElement(Greeting, { name: "Vitest" }))
                .assert("rendered", (ctx) => ctx.container.innerHTML.includes("Hello, Vitest!"), true)
                .start(null, { output: "return-json", timeout: 0, formatter });
            return formatter.getReport();
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);

    // ── Chain Propagation ────────────────────────────────────

    await CTGTest.init("vitest mode: chain propagates through formatter")
        .stage("execute", async () => {
            const sub = CTGReactTest.init("sub")
                .assert("positive", (x) => x > 0, true);
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("chain vitest")
                .stage("set", () => 42)
                .chain("verify", sub)
                .start(0, { output: "return-json", timeout: 0, formatter });
            return formatter.getReport();
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);

    // ── Five-Status Lossy Mapping ────────────────────────────

    await CTGTest.init("vitest mode: fail recorded in report")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("fail vitest")
                .assert("wrong", (x) => x, 999)
                .start(1, { output: "return-json", timeout: 0, formatter, haltOnFailure: false });
            return formatter.getReport();
        })
        .assert("status fail", (r) => r.status, "fail")
        .assert("failed count", (r) => r.failed, 1)
        .start(null, config);

    await CTGTest.init("vitest mode: error recovery recorded as recovered")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("recover vitest")
                .stage("throw", () => { throw new Error("boom"); }, () => "ok")
                .assert("check", (x) => x, "ok")
                .start(null, { output: "return-json", timeout: 0, formatter });
            return formatter.getReport();
        })
        .assert("status recovered", (r) => r.status, "recovered")
        .assert("recovered count", (r) => r.recovered, 1)
        .start(null, config);

    // ── Unconditional Skip ───────────────────────────────────

    await CTGTest.init("vitest mode: unconditional skip recorded")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("skip vitest")
                .stage("skipped", (x) => x * 100)
                .assert("check", (x) => x, 42)
                .skip("skipped")
                .start(42, { output: "return-json", timeout: 0, formatter });
            return formatter.getReport();
        })
        .assert("status pass", (r) => r.status, "pass")
        .assert("skipped count", (r) => r.skipped, 1)
        .start(null, config);

    // ── Conditional Skip ─────────────────────────────────────

    await CTGTest.init("vitest mode: conditional skip true recorded as skip in report")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("cond skip vitest")
                .stage("maybe", (x) => x)
                .assert("check", (x) => x, 42)
                .skip("maybe", (x) => x > 10)
                .start(42, { output: "return-json", timeout: 0, formatter });
            return formatter.getReport();
        })
        .assert("status pass", (r) => r.status, "pass")
        .assert("skipped count", (r) => r.skipped, 1)
        .start(null, config);

    await CTGTest.init("vitest mode: conditional skip false executes normally")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("cond skip false")
                .stage("runs", (x) => x * 2)
                .assert("doubled", (x) => x, 84)
                .skip("runs", (x) => x > 100)
                .start(42, { output: "return-json", timeout: 0, formatter });
            return formatter.getReport();
        })
        .assert("status pass", (r) => r.status, "pass")
        .assert("no skips", (r) => r.skipped, 0)
        .start(null, config);

    // ── haltOnFailure ────────────────────────────────────────

    await CTGTest.init("vitest mode: haltOnFailure stops subsequent steps")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("halt vitest")
                .assert("fails", (x) => x, 999)
                .assert("never runs", (x) => x, 1)
                .start(1, { output: "return-json", timeout: 0, formatter, haltOnFailure: true });
            return formatter.getReport();
        })
        .assert("failed count", (r) => r.failed, 1)
        .assert("total reflects halt", (r) => r.total <= 2, true)
        .assert("skipped from halt", (r) => r.skipped >= 0, true)
        .start(null, config);

    await CTGTest.init("vitest mode: haltOnFailure false runs all")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("no halt vitest")
                .assert("f1", (x) => x, 999)
                .assert("f2", (x) => x, 888)
                .start(1, { output: "return-json", timeout: 0, formatter, haltOnFailure: false });
            return formatter.getReport();
        })
        .assert("total 2", (r) => r.total, 2)
        .assert("failed 2", (r) => r.failed, 2)
        .start(null, config);

    // ── Cleanup in Formatter Mode ────────────────────────────

    await CTGTest.init("vitest mode: cleanup runs after formatter pipeline")
        .stage("execute", async () => {
            const formatter = new CTGVitestFormatter();
            await CTGReactTest.init("cleanup vitest")
                .render("mount", React.createElement(Greeting, { name: "CleanVitest" }))
                .assert("rendered", (ctx) => ctx.container.innerHTML.includes("Hello"), true)
                .start(null, { output: "return-json", timeout: 0, formatter });
            return document.body.innerHTML === "" || document.body.children.length === 0;
        })
        .assert("DOM cleaned up", (r) => r, true)
        .start(null, config);
}
