// InteractStep tests — §2

import { cleanup } from "@testing-library/react";
import CTGTestResult from "ctg-js-test/result";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Counter, LoginForm } from "../components.jsx";

export default async function run({ test: rawTest, assert }) {
    const test = (name, fn) => rawTest(name, async () => {
        try { await fn(); } finally { cleanup(); }
    });

    await test("interact: clicks button and changes state", async () => {
        const state = await CTGReactTest.init("interact click")
            .render("mount", <Counter />)
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
            .render("mount", <Counter />)
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

    await test("interact: form submission", async () => {
        const state = await CTGReactTest.init("interact form")
            .render("mount", <LoginForm />)
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

    await test("interact: must return ReactTestState", async () => {
        const state = await CTGReactTest.init("interact no return")
            .render("mount", <Counter />)
            .interact("forget return", async (state) => {
                await state.user.click(state.screen.getByText("Increment"));
            })
            .start(null, { haltOnFailure: false });
        const interactResult = state.results.find((r) => r.name === "forget return");
        assert(interactResult.status === CTGTestResult.STATUS.ERROR, "error on no return");
    });

    await test("interact: error produces error result", async () => {
        const state = await CTGReactTest.init("interact error")
            .render("mount", <Counter />)
            .interact("throw", async () => {
                throw new Error("interaction failed");
            })
            .start(null, { haltOnFailure: false });
        const result = state.results.find((r) => r.name === "throw");
        assert(result.status === CTGTestResult.STATUS.ERROR, "error recorded");
    });

    await test("interact: error handler recovers", async () => {
        const state = await CTGReactTest.init("interact recovery")
            .render("mount", <Counter />)
            .interact("fail and recover", async () => {
                throw new Error("boom");
            }, (err) => err.message)
            .start(null);
        const result = state.results.find((r) => r.name === "fail and recover");
        assert(result.status === CTGTestResult.STATUS.RECOVERED, "recovered");
    });

    await test("interact: non-function fn fails validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad interact")
                .render("mount", <Counter />)
                .interact("bad", "not a function")
                .start(null);
        } catch {
            threw = true;
        }
        assert(threw, "validation threw");
    });
}
