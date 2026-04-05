// RenderStep tests — §2
//
// Validates that the render step mounts a React component and
// populates ReactTestState fields (screen, user, container, rerender).

import React from "react";
import CTGTestResult from "ctg-js-test/result";
import ReactTestState from "../../src/ReactTestState.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Basic Render ────────────────────────────────────────────

    await test("render: mounts component and populates state", async () => {
        const state = await CTGReactTest.init("render basic")
            .render("mount", React.createElement(Greeting, { name: "World" }))
            .start(null);
        assert(state instanceof ReactTestState, "returns ReactTestState");
        assert(state.screen !== null, "screen populated");
        assert(state.container !== null, "container populated");
        assert(state.rerender !== null, "rerender populated");
    });

    await test("render: container has rendered HTML", async () => {
        const state = await CTGReactTest.init("render html")
            .render("mount", React.createElement(Greeting, { name: "Test" }))
            .start(null);
        assert(state.container.innerHTML.includes("Hello, Test!"), "HTML rendered");
    });

    await test("render: screen queries work", async () => {
        const state = await CTGReactTest.init("render screen")
            .render("mount", React.createElement(Greeting, { name: "Screen" }))
            .assert("heading", (state) =>
                state.screen.getByRole("heading").textContent, "Hello, Screen!")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "screen query passed");
    });

    // ── Function Element ────────────────────────────────────────

    await test("render: accepts function returning element", async () => {
        const state = await CTGReactTest.init("render fn")
            .render("mount", () => React.createElement(Greeting, { name: "Lazy" }))
            .assert("rendered", (state) =>
                state.container.innerHTML.includes("Lazy"), true)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "function element worked");
    });

    // ── User Event Setup ────────────────────────────────────────

    await test("render: sets up user-event when available", async () => {
        const state = await CTGReactTest.init("render user")
            .render("mount", React.createElement(Counter))
            .start(null);
        assert(state.user !== null, "user-event set up");
    });

    // ── Render Result Status ────────────────────────────────────

    await test("render: records pass result", async () => {
        const state = await CTGReactTest.init("render pass")
            .render("mount", React.createElement(Greeting, { name: "X" }))
            .start(null);
        assert(state.results.length >= 1, "has result");
        assert(state.results[0].status === CTGTestResult.STATUS.PASS, "render passed");
        assert(state.results[0].name === "mount", "result named");
    });

    // ── Wrapper Support ─────────────────────────────────────────

    await test("render: accepts wrapper option", async () => {
        function Wrapper({ children }) {
            return React.createElement("div", { "data-testid": "wrapper" }, children);
        }
        const state = await CTGReactTest.init("render wrapper")
            .render("mount", React.createElement(Greeting, { name: "Wrapped" }), { wrapper: Wrapper })
            .assert("wrapped", (state) =>
                state.screen.getByTestId("wrapper") !== null, true)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "wrapper applied");
    });

    // ── Rerender ────────────────────────────────────────────────

    await test("render: rerender function updates component", async () => {
        const state = await CTGReactTest.init("render rerender")
            .render("mount", React.createElement(Greeting, { name: "First" }))
            .stage("rerender", (state) => {
                state.rerender(React.createElement(Greeting, { name: "Second" }));
                return state;
            })
            .assert("updated", (state) =>
                state.container.innerHTML.includes("Second"), true)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "rerender worked");
    });

    // ── DOM Required ────────────────────────────────────────────
    // NOTE: Can't easily test DOM-missing case since jsdom is always set up
    // in SelfTest. This would need a separate process to validate.
}
