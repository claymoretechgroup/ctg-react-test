// RenderStep tests — §2
//
// Validates that the render step mounts a React component and
// populates ReactTestState fields (screen, user, container, rerender).

import { cleanup } from "@testing-library/react";
import CTGTestResult from "ctg-js-test/result";
import ReactTestState from "../../src/ReactTestState.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter } from "../components.jsx";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test: rawTest, assert }) {
    const test = (name, fn) => rawTest(name, async () => {
        try { await fn(); } finally { cleanup(); }
    });

    await test("render: mounts component and populates state", async () => {
        const state = await CTGReactTest.init("render basic")
            .render("mount", <Greeting name="World" />)
            .start(null);
        assert(state instanceof ReactTestState, "returns ReactTestState");
        assert(state.screen !== null, "screen populated");
        assert(state.container !== null, "container populated");
        assert(state.rerender !== null, "rerender populated");
    });

    await test("render: container has rendered HTML", async () => {
        const state = await CTGReactTest.init("render html")
            .render("mount", <Greeting name="Test" />)
            .start(null);
        assert(state.container.innerHTML.includes("Hello, Test!"), "HTML rendered");
    });

    await test("render: screen queries work", async () => {
        const state = await CTGReactTest.init("render screen")
            .render("mount", <Greeting name="Screen" />)
            .assert("heading", (state) =>
                state.screen.getByRole("heading").textContent, "Hello, Screen!")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "screen query passed");
    });

    await test("render: accepts function returning element", async () => {
        const state = await CTGReactTest.init("render fn")
            .render("mount", () => <Greeting name="Lazy" />)
            .assert("rendered", (state) =>
                state.container.innerHTML.includes("Lazy"), true)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "function element worked");
    });

    await test("render: sets up user-event when available", async () => {
        const state = await CTGReactTest.init("render user")
            .render("mount", <Counter />)
            .start(null);
        assert(state.user !== null, "user-event set up");
    });

    await test("render: records pass result", async () => {
        const state = await CTGReactTest.init("render pass")
            .render("mount", <Greeting name="X" />)
            .start(null);
        assert(state.results.length >= 1, "has result");
        assert(state.results[0].status === CTGTestResult.STATUS.PASS, "render passed");
        assert(state.results[0].name === "mount", "result named");
    });

    await test("render: accepts wrapper option", async () => {
        function Wrapper({ children }) {
            return <div data-testid="wrapper">{children}</div>;
        }
        const state = await CTGReactTest.init("render wrapper")
            .render("mount", <Greeting name="Wrapped" />, { wrapper: Wrapper })
            .assert("wrapped", (state) =>
                state.screen.getByTestId("wrapper") !== null, true)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "wrapper applied");
    });

    await test("render: rerender function updates component", async () => {
        const state = await CTGReactTest.init("render rerender")
            .render("mount", <Greeting name="First" />)
            .stage("rerender", (state) => {
                state.rerender(<Greeting name="Second" />);
                return state;
            })
            .assert("updated", (state) =>
                state.container.innerHTML.includes("Second"), true)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "rerender worked");
    });
}
