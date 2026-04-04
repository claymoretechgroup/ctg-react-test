// Safety tests — DOM detection, user event validation, formatter detection, cleanup

import React from "react";
import CTGTest from "ctg-js-test";
import CTGReactTest from "../../src/CTGReactTest.js";
import ReactContext from "../../src/ReactContext.js";
import CTGVitestFormatter from "../../src/formatters/CTGVitestFormatter.js";
import { Greeting, LoginForm } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
// Runs all safety, validation, and cleanup tests.
export default async function run({ config }) {

    // ── DOM Detection ────────────────────────────────────────

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

    // ── User Event Validation ────────────────────────────────

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

    // ── Formatter Detection ──────────────────────────────────

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

    await CTGTest.init("VitestFormatter: sanitizeMessage applied to recovered log")
        .stage("execute", async () => {
            const logged = [];
            const originalWarn = console.warn;
            console.warn = (...args) => { logged.push(args.join(" ")); };
            try {
                const formatter = new CTGVitestFormatter({
                    sanitizeMessage: (msg) => msg.replace(/secret-key-123/g, "REDACTED")
                });
                await CTGReactTest.init("sanitize msg")
                    .stage("throw", () => { throw new Error("failed with secret-key-123"); },
                        () => "recovered")
                    .start(null, { output: "return-json", timeout: 0, formatter });
                const hasRedacted = logged.some((l) => l.includes("REDACTED"));
                const hasSecret = logged.some((l) => l.includes("secret-key-123"));
                return { hasRedacted, hasSecret };
            } finally { console.warn = originalWarn; }
        })
        .assert("message redacted", (r) => r.hasRedacted, true)
        .assert("no secret in log", (r) => r.hasSecret, false)
        .start(null, config);

    await CTGTest.init("formatter detection: plain class not detected as execution")
        .stage("check", () => {
            class PlainFormatter { static format(r) { return JSON.stringify(r); } }
            return PlainFormatter._isExecutionFormatter === undefined
                && CTGVitestFormatter._isExecutionFormatter === true;
        })
        .assert("distinguished", (r) => r, true)
        .start(null, config);

    // ── Composability (Chain) ────────────────────────────────

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

    // ── Cleanup ──────────────────────────────────────────────

    await CTGTest.init("standalone: cleanup runs after pipeline")
        .stage("execute", async () => {
            await CTGReactTest.init("cleanup")
                .render("mount", React.createElement(Greeting, { name: "Cleanup" }))
                .assert("rendered", (ctx) => ctx.container.innerHTML.includes("Hello"), true)
                .start(null, { output: "return-json", timeout: 0 });
            return document.body.innerHTML === "" || document.body.children.length === 0;
        })
        .assert("DOM cleaned up", (r) => r, true)
        .start(null, config);

    // ── Five-Status Reporting ────────────────────────────────

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
        .assert("has passes", (r) => r.passed >= 1, true)
        .assert("has fails", (r) => r.failed >= 1, true)
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
}
