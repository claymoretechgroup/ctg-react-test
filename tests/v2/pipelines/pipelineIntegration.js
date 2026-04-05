// Pipeline integration tests — §3
//
// Tests full pipeline flows: render + interact + assert, chaining,
// inherited step types (stage, assert, assertAny, skip), and
// config validation.

import React from "react";
import CTGTest from "ctg-js-test";
import CTGTestResult from "ctg-js-test/result";
import ReactTestState from "../../../src/ReactTestState.js";
import CTGReactTest from "../../../src/CTGReactTest.js";
import { Greeting, Counter, LoginForm } from "../../components.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Full Render + Interact + Assert ─────────────────────────

    await test("pipeline: render, interact, assert flow", async () => {
        const state = await CTGReactTest.init("full flow")
            .render("mount counter", React.createElement(Counter))
            .interact("click increment", async (state) => {
                await state.user.click(state.screen.getByText("Increment"));
                return state;
            })
            .assert("count is 1", (state) =>
                state.screen.getByTestId("count").textContent, "1")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "full flow passed");
    });

    // ── Inherited Stage ─────────────────────────────────────────

    await test("pipeline: stage works in React pipeline", async () => {
        const state = await CTGReactTest.init("stage test")
            .render("mount", React.createElement(Greeting, { name: "X" }))
            .stage("extract text", (state) => {
                state.subject = state.container.textContent;
                return state;
            })
            .assert("text extracted", (state) => state.subject, "Hello, X!")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "stage worked");
    });

    // ── Inherited Assert ────────────────────────────────────────

    await test("pipeline: assert reads from state directly", async () => {
        const state = await CTGReactTest.init("assert state")
            .render("mount", React.createElement(Counter, { initial: 5 }))
            .assert("count displayed", (state) =>
                state.screen.getByTestId("count").textContent, "5")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "assert on state");
    });

    // ── Inherited Skip ──────────────────────────────────────────

    await test("pipeline: skip works in React pipeline", async () => {
        const state = await CTGReactTest.init("skip test")
            .render("mount", React.createElement(Greeting, { name: "X" }))
            .skip("skip check", "expensive check")
            .assert("expensive check", (state) => state.container.innerHTML, "wrong")
            .start(null);
        const skipped = state.results.find((r) => r.name === "expensive check");
        assert(skipped.status === CTGTestResult.STATUS.SKIP, "step was skipped");
    });

    // ── Chain Composition ───────────────────────────────────────

    await test("pipeline: chain composes React pipelines", async () => {
        const verifyGreeting = CTGReactTest.init("verify greeting")
            .assert("has greeting", (state) =>
                state.container.innerHTML.includes("Hello"), true);

        const state = await CTGReactTest.init("chain test")
            .render("mount", React.createElement(Greeting, { name: "Chain" }))
            .chain("verify", verifyGreeting)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "chain worked");
    });

    // ── Start Returns ReactTestState ────────────────────────────

    await test("pipeline: start returns ReactTestState", async () => {
        const state = await CTGReactTest.init("return type")
            .render("mount", React.createElement(Greeting, { name: "X" }))
            .start(null);
        assert(state instanceof ReactTestState, "returns ReactTestState");
    });

    await test("pipeline: start wraps raw subject in ReactTestState", async () => {
        const state = await CTGReactTest.init("wrap subject")
            .stage("noop", (state) => state)
            .start(42);
        assert(state instanceof ReactTestState, "wrapped in ReactTestState");
        assert(state.subject === 42, "subject preserved");
    });

    // ── init Factory ────────────────────────────────────────────

    await test("pipeline: init returns CTGReactTest instance", () => {
        const pipeline = CTGReactTest.init("factory test");
        assert(pipeline instanceof CTGReactTest, "is CTGReactTest");
        assert(pipeline instanceof CTGTest, "is CTGTest");
    });

    // ── React Config Keys Accepted ──────────────────────────────

    await test("pipeline: accepts snapshotFilePath config", async () => {
        const state = await CTGReactTest.init("config test")
            .stage("noop", (state) => state)
            .start(null, { snapshotFilePath: "/tmp/test.snap.json" });
        assert(state.status === CTGTestResult.STATUS.PASS, "config accepted");
    });

    // ── Removed Config Keys Rejected ────────────────────────────

    await test("pipeline: output config key rejected", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { output: "console" });
        } catch {
            threw = true;
        }
        assert(threw, "output rejected");
    });

    await test("pipeline: formatter config key rejected", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { formatter: null });
        } catch {
            threw = true;
        }
        assert(threw, "formatter rejected");
    });

    // ── No Static State ─────────────────────────────────────────

    await test("pipeline: no static _results", () => {
        assert(CTGReactTest._results === undefined, "no _results");
    });

    // ── No stdout Output ────────────────────────────────────────

    await test("pipeline: start does not write to stdout", async () => {
        const origWrite = process.stdout.write;
        let written = false;
        process.stdout.write = () => { written = true; return true; };
        try {
            await CTGReactTest.init("silent")
                .render("mount", React.createElement(Greeting, { name: "X" }))
                .start(null);
        } finally {
            process.stdout.write = origWrite;
        }
        assert(!written, "nothing written");
    });
}
