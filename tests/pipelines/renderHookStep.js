// RenderHookStep tests — §2
//
// Validates that renderHook renders a hook in isolation, populates
// state.data.result, and sets appropriate state fields.

import React from "react";
import { cleanup } from "@testing-library/react";
import CTGTestResult from "ctg-js-test/result";
import ReactTestState from "../../src/ReactTestState.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { useCounter } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test: rawTest, assert }) {
    const test = (name, fn) => rawTest(name, async () => {
        try { await fn(); } finally { cleanup(); }
    });

    // ── Basic Hook Render ───────────────────────────────────────

    await test("renderHook: captures hook return value", async () => {
        const state = await CTGReactTest.init("hook basic")
            .renderHook("use counter", () => useCounter(0))
            .assert("initial count", (state) => state.data.result.current.count, 0)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "hook rendered");
    });

    await test("renderHook: result.current updates on rerender", async () => {
        const state = await CTGReactTest.init("hook rerender")
            .renderHook("use counter", () => useCounter(0))
            .stage("increment", (state) => {
                // Call the hook's increment function
                React.act(() => {
                    state.data.result.current.increment();
                });
                return state;
            })
            .assert("count incremented", (state) => state.data.result.current.count, 1)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "hook updated");
    });

    // ── State Fields ────────────────────────────────────────────

    await test("renderHook: returns ReactTestState", async () => {
        const state = await CTGReactTest.init("hook state")
            .renderHook("use counter", () => useCounter(0))
            .start(null);
        assert(state instanceof ReactTestState, "is ReactTestState");
    });

    await test("renderHook: populates data.result", async () => {
        const state = await CTGReactTest.init("hook data")
            .renderHook("use counter", () => useCounter(5))
            .start(null);
        assert(state.data.result !== undefined, "data.result exists");
        assert(state.data.result.current !== undefined, "result.current exists");
        assert(state.data.result.current.count === 5, "initial value correct");
    });

    await test("renderHook: screen is set", async () => {
        const state = await CTGReactTest.init("hook screen")
            .renderHook("use counter", () => useCounter(0))
            .start(null);
        assert(state.screen !== null, "screen available");
    });

    await test("renderHook: user is null (hooks have no interactions)", async () => {
        const state = await CTGReactTest.init("hook user")
            .renderHook("use counter", () => useCounter(0))
            .start(null);
        assert(state.user === null, "user is null");
    });

    await test("renderHook: rerender is set", async () => {
        const state = await CTGReactTest.init("hook rerender fn")
            .renderHook("use counter", () => useCounter(0))
            .start(null);
        assert(typeof state.rerender === "function", "rerender available");
    });

    // ── Result Status ───────────────────────────────────────────

    await test("renderHook: records pass result", async () => {
        const state = await CTGReactTest.init("hook pass")
            .renderHook("use counter", () => useCounter(0))
            .start(null);
        assert(state.results[0].status === CTGTestResult.STATUS.PASS, "render passed");
    });

    // ── Validation ──────────────────────────────────────────────

    await test("renderHook: non-function hookFn fails validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad hook")
                .renderHook("bad", "not a function")
                .start(null);
        } catch {
            threw = true;
        }
        assert(threw, "validation threw");
    });
}
