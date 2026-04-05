// assertComponent tests — §1 (v3)
//
// Validates that assertComponent receives screen, computes actual value,
// compares to expected. No error handler.

import CTGTestResult from "ctg-js-test/result";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter } from "../components.jsx";

export default async function run({ test, assert }) {

    // ── Basic Assertion ─────────────────────────────────────────

    await test("assertComponent: passes when query result matches expected", async () => {
        const state = await CTGReactTest.init("assertComponent pass")
            .assertComponent("has greeting", (screen) =>
                screen.getByRole("heading").textContent, "Hello, World!")
            .start(<Greeting name="World" />);
        assert(state.status === CTGTestResult.STATUS.PASS, "assertion passed");
    });

    await test("assertComponent: fails when query result does not match", async () => {
        const state = await CTGReactTest.init("assertComponent fail")
            .assertComponent("wrong text", (screen) =>
                screen.getByRole("heading").textContent, "wrong")
            .start(<Greeting name="World" />, { haltOnFailure: false });
        assert(state.status === CTGTestResult.STATUS.FAIL, "assertion failed");
    });

    // ── Callback Receives Screen ────────────────────────────────

    await test("assertComponent: callback receives screen object", async () => {
        let receivedScreen = null;
        await CTGReactTest.init("assertComponent screen")
            .assertComponent("check screen", (screen) => {
                receivedScreen = screen;
                return screen.getByRole("heading") !== null;
            }, true)
            .start(<Greeting name="Test" />);
        assert(receivedScreen !== null, "screen provided");
        assert(typeof receivedScreen.getByText === "function", "has getByText");
        assert(typeof receivedScreen.getByRole === "function", "has getByRole");
        assert(typeof receivedScreen.getByTestId === "function", "has getByTestId");
    });

    await test("assertComponent: callback does not receive user", async () => {
        let argCount = 0;
        await CTGReactTest.init("assertComponent no user")
            .assertComponent("check args", (...args) => {
                argCount = args.length;
                return true;
            }, true)
            .start(<Greeting name="Test" />);
        assert(argCount === 1, "callback receives exactly one argument");
    });

    // ── After Interaction ───────────────────────────────────────

    await test("assertComponent: verifies state change after interact", async () => {
        const state = await CTGReactTest.init("assertComponent after interact")
            .interact("click", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count updated", (screen) =>
                screen.getByTestId("count").textContent, "1")
            .start(<Counter />);
        assert(state.status === CTGTestResult.STATUS.PASS, "post-interaction assertion");
    });

    // ── Async Callback ──────────────────────────────────────────

    await test("assertComponent: async callback is awaited", async () => {
        const state = await CTGReactTest.init("assertComponent async")
            .assertComponent("async query", async (screen) => {
                return screen.getByRole("heading").textContent;
            }, "Hello, World!")
            .start(<Greeting name="World" />);
        assert(state.status === CTGTestResult.STATUS.PASS, "async callback worked");
    });

    // ── Error Handling ──────────────────────────────────────────

    await test("assertComponent: query error produces error result", async () => {
        const state = await CTGReactTest.init("assertComponent error")
            .assertComponent("missing element", (screen) => {
                return screen.getByTestId("nonexistent").textContent;
            }, "value")
            .start(<Greeting name="Test" />, { haltOnFailure: false });
        const result = state.results.find((r) => r.name === "missing element");
        assert(result.status === CTGTestResult.STATUS.ERROR, "error on missing element");
    });

    await test("assertComponent: no error handler parameter", () => {
        const pipeline = CTGReactTest.init("no handler");
        assert(pipeline.assertComponent.length === 3, "assertComponent takes 3 params");
    });

    // ── Result Shape ────────────────────────────────────────────

    await test("assertComponent: result includes actual and expected", async () => {
        const state = await CTGReactTest.init("assertComponent result")
            .assertComponent("check value", (screen) =>
                screen.getByRole("heading").textContent, "Hello, World!")
            .start(<Greeting name="World" />);
        const result = state.results.find((r) => r.name === "check value");
        assert(result.actual !== undefined, "actual present");
        assert(result.expected !== undefined, "expected present");
    });
}
