// Result collection tests — §1, §4
//
// Tests that start() returns ReactTestState, caller owns formatting
// and collection, cleanup is caller concern.

import React from "react";
import CTGTestResult from "ctg-js-test/result";
import CTGTestConsoleFormatter from "ctg-js-test/formatter/console";
import ReactTestState from "../../../src/ReactTestState.js";
import CTGReactTest from "../../../src/CTGReactTest.js";
import { Greeting, Counter } from "../../components.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Caller-Owned Collection ─────────────────────────────────

    await test("result: caller collects from returned state", async () => {
        const collector = [];

        let state;
        try {
            state = await CTGReactTest.init("first")
                .render("mount", React.createElement(Greeting, { name: "A" }))
                .assert("check", (state) =>
                    state.container.innerHTML.includes("A"), true)
                .start(null);
        } finally {
            const { cleanup } = await import("@testing-library/react");
            cleanup();
        }
        collector.push({ name: state.name, status: state.status });

        try {
            state = await CTGReactTest.init("second")
                .render("mount", React.createElement(Greeting, { name: "B" }))
                .assert("check", (state) =>
                    state.container.innerHTML.includes("B"), true)
                .start(null);
        } finally {
            const { cleanup } = await import("@testing-library/react");
            cleanup();
        }
        collector.push({ name: state.name, status: state.status });

        assert(collector.length === 2, "two entries");
        assert(collector[0].status === CTGTestResult.STATUS.PASS, "first passed");
        assert(collector[1].status === CTGTestResult.STATUS.PASS, "second passed");
    });

    // ── Formatter Compatibility ─────────────────────────────────

    await test("result: console formatter accepts ReactTestState", async () => {
        let state;
        try {
            state = await CTGReactTest.init("formatter test")
                .render("mount", React.createElement(Greeting, { name: "X" }))
                .assert("check", (state) =>
                    state.container.innerHTML.includes("X"), true)
                .start(null);
        } finally {
            const { cleanup } = await import("@testing-library/react");
            cleanup();
        }
        assert(state instanceof ReactTestState, "is ReactTestState");
        const formatted = CTGTestConsoleFormatter.format(state);
        assert(typeof formatted === "string", "returns string");
        assert(formatted.length > 0, "non-empty");
        assert(formatted.includes("formatter test"), "has pipeline name");
    });

    // ── Inner Pipeline Independence ─────────────────────────────

    await test("result: inner pipeline state is independent", async () => {
        const collector = [];

        let state;
        try {
            state = await CTGReactTest.init("outer")
                .render("mount", React.createElement(Greeting, { name: "Outer" }))
                .stage("run inner", async (state) => {
                    let innerState;
                    try {
                        innerState = await CTGReactTest.init("inner fixture")
                            .render("mount", React.createElement(Greeting, { name: "Inner" }))
                            .assert("bad", (state) =>
                                state.container.innerHTML.includes("Wrong"), true)
                            .start(null, { haltOnFailure: false });
                    } finally {
                        const { cleanup } = await import("@testing-library/react");
                        cleanup();
                    }
                    state.subject = innerState.status;
                    return state;
                })
                .assert("inner failed", (state) =>
                    state.subject, CTGTestResult.STATUS.FAIL)
                .start(null);
        } finally {
            const { cleanup } = await import("@testing-library/react");
            cleanup();
        }

        collector.push({ name: state.name, status: state.status });

        assert(collector.length === 1, "only outer collected");
        assert(collector[0].status === CTGTestResult.STATUS.PASS, "outer passed");
    });

    // ── Cleanup as Caller Concern ───────────────────────────────

    await test("result: cleanup in try/finally pattern", async () => {
        let cleanedUp = false;
        let state;
        try {
            state = await CTGReactTest.init("cleanup test")
                .render("mount", React.createElement(Counter))
                .assert("rendered", (state) =>
                    state.screen.getByTestId("count") !== null, true)
                .start(null);
        } finally {
            const { cleanup } = await import("@testing-library/react");
            cleanup();
            cleanedUp = true;
        }
        assert(cleanedUp, "cleanup ran");
        assert(state.status === CTGTestResult.STATUS.PASS, "test passed");
    });
}
