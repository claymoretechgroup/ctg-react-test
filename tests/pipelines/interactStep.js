// InteractStep tests — §2
//
// Validates that interact executes user interactions against state,
// requires user-event, and follows stage-like error semantics.

import React from "react";
import CTGTestResult from "ctg-js-test/result";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Counter, LoginForm } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Basic Interaction ───────────────────────────────────────

    await test("interact: clicks button and changes state", async () => {
        const state = await CTGReactTest.init("interact click")
            .render("mount", React.createElement(Counter))
            .interact("click increment", async (state) => {
                await state.user.click(state.screen.getByText("Increment"));
                return state;
            })
            .assert("count is 1", (state) =>
                state.screen.getByTestId("count").textContent, "1")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "interaction worked");
    });

    await test("interact: multiple interactions", async () => {
        const state = await CTGReactTest.init("interact multi")
            .render("mount", React.createElement(Counter))
            .interact("click three times", async (state) => {
                await state.user.click(state.screen.getByText("Increment"));
                await state.user.click(state.screen.getByText("Increment"));
                await state.user.click(state.screen.getByText("Increment"));
                return state;
            })
            .assert("count is 3", (state) =>
                state.screen.getByTestId("count").textContent, "3")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "multiple clicks worked");
    });

    // ── Form Interaction ────────────────────────────────────────

    await test("interact: form submission", async () => {
        const state = await CTGReactTest.init("interact form")
            .render("mount", React.createElement(LoginForm))
            .interact("fill and submit", async (state) => {
                await state.user.type(state.screen.getByLabelText("Username"), "alice");
                await state.user.click(state.screen.getByText("Submit"));
                return state;
            })
            .assert("welcome shown", (state) =>
                state.screen.getByText("Welcome, alice!") !== null, true)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "form submission worked");
    });

    // ── Must Return State ───────────────────────────────────────

    await test("interact: must return ReactTestState", async () => {
        const state = await CTGReactTest.init("interact no return")
            .render("mount", React.createElement(Counter))
            .interact("forget return", async (state) => {
                await state.user.click(state.screen.getByText("Increment"));
                // deliberately does not return state
            })
            .start(null, { haltOnFailure: false });
        const interactResult = state.results.find((r) => r.name === "forget return");
        assert(interactResult.status === CTGTestResult.STATUS.ERROR, "error on no return");
    });

    // ── Error Handling ──────────────────────────────────────────

    await test("interact: error produces error result", async () => {
        const state = await CTGReactTest.init("interact error")
            .render("mount", React.createElement(Counter))
            .interact("throw", async () => {
                throw new Error("interaction failed");
            })
            .start(null, { haltOnFailure: false });
        const result = state.results.find((r) => r.name === "throw");
        assert(result.status === CTGTestResult.STATUS.ERROR, "error recorded");
    });

    await test("interact: error handler recovers", async () => {
        const state = await CTGReactTest.init("interact recovery")
            .render("mount", React.createElement(Counter))
            .interact("fail and recover", async () => {
                throw new Error("boom");
            }, (err) => err.message)
            .start(null);
        const result = state.results.find((r) => r.name === "fail and recover");
        assert(result.status === CTGTestResult.STATUS.RECOVERED, "recovered");
    });

    // ── Validation ──────────────────────────────────────────────

    await test("interact: non-function fn fails validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad interact")
                .render("mount", React.createElement(Counter))
                .interact("bad", "not a function")
                .start(null);
        } catch {
            threw = true;
        }
        assert(threw, "validation threw");
    });
}
