// Vitest runner-level integration test
//
// This file is executed by Vitest (not the standalone ctg-js-test runner).
// It validates that CTGVitestFormatter correctly registers describe/it/expect
// blocks, and that Vitest runner semantics (skip, nesting, hooks) work as
// specified.
//
// Run with: npx vitest run tests/integration/vitest.pipeline.test.js
//
// This file uses Vitest globals (describe, it, expect) which are injected
// by the Vitest runner. It will NOT work under node tests/SelfTest.js.

import React from "react";
import { describe, it, expect, afterAll } from "vitest";
import CTGReactTest from "../../src/CTGReactTest.js";
import CTGVitestFormatter from "../../src/formatters/CTGVitestFormatter.js";

// ── Test Components ──────────────────────────────────────────

function Greeting({ name }) {
    return React.createElement("h1", null, `Hello, ${name}!`);
}

// ── Runner-Level Tests ───────────────────────────────────────

describe("CTGVitestFormatter runner integration", () => {

    it("registers pipeline as describe/it blocks", async () => {
        const formatter = new CTGVitestFormatter();
        await CTGReactTest.init("basic pipeline")
            .stage("double", (x) => x * 2)
            .assert("is 10", (x) => x, 10)
            .start(5, { formatter });

        const report = formatter.getReport();
        expect(report).toBeDefined();
        expect(report.status).toBe("pass");
        expect(report.total).toBe(2);
    });

    it("renders React component through formatter", async () => {
        const formatter = new CTGVitestFormatter();
        await CTGReactTest.init("react render")
            .render("mount", React.createElement(Greeting, { name: "Vitest" }))
            .assert("rendered", (ctx) => ctx.container.innerHTML.includes("Hello, Vitest!"), true)
            .start(null, { formatter });

        expect(formatter.getReport().status).toBe("pass");
    });

    it("reports recovered status in getReport", async () => {
        const formatter = new CTGVitestFormatter();
        await CTGReactTest.init("recovery")
            .stage("throw", () => { throw new Error("boom"); }, () => "ok")
            .assert("check", (x) => x, "ok")
            .start(null, { formatter });

        const report = formatter.getReport();
        expect(report.status).toBe("recovered");
        expect(report.recovered).toBe(1);
    });

    it("reports skip status for unconditional skip", async () => {
        const formatter = new CTGVitestFormatter();
        await CTGReactTest.init("skip test")
            .stage("skipped", (x) => x * 100)
            .assert("check", (x) => x, 42)
            .skip("skipped")
            .start(42, { formatter });

        const report = formatter.getReport();
        expect(report.skipped).toBe(1);
    });

    it("reports conditional skip as skip in report", async () => {
        const formatter = new CTGVitestFormatter();
        await CTGReactTest.init("cond skip")
            .stage("maybe", (x) => x)
            .assert("check", (x) => x, 42)
            .skip("maybe", (x) => x > 10)
            .start(42, { formatter });

        const report = formatter.getReport();
        expect(report.skipped).toBe(1);
    });

    it("halts subsequent steps on failure when haltOnFailure true", async () => {
        const formatter = new CTGVitestFormatter();
        await CTGReactTest.init("halt")
            .assert("fails", (x) => x, 999)
            .assert("never runs", (x) => x, 1)
            .start(1, { formatter, haltOnFailure: true });

        const report = formatter.getReport();
        expect(report.failed).toBe(1);
        expect(report.skipped).toBe(1);
        expect(report.total).toBe(2);
    });
});
