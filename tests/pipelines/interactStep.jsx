// InteractStep tests — §1 (v3)
//
// Validates that interact receives {screen, user}, is VOID,
// has no error handler, and errors are recorded.

import CTGTestResult from "ctg-js-test/result";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Counter, LoginForm } from "../components.jsx";

export default async function run({ test, assert }) {

    // ── Basic Interaction ───────────────────────────────────────

    await test("interact: callback receives {screen, user}", async () => {
        let receivedScreen = null;
        let receivedUser = null;
        await CTGReactTest.init("interact surface")
            .interact("check args", ({screen, user}) => {
                receivedScreen = screen;
                receivedUser = user;
            })
            .start(<Counter />);
        assert(receivedScreen !== null, "screen provided");
        assert(receivedUser !== null, "user provided");
        assert(typeof receivedScreen.getByText === "function", "screen has query methods");
        assert(typeof receivedUser.click === "function", "user has interaction methods");
    });

    await test("interact: clicks button and changes DOM", async () => {
        const state = await CTGReactTest.init("interact click")
            .interact("click increment", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count is 1", (screen) =>
                screen.getByTestId("count").textContent, "1")
            .start(<Counter />);
        assert(state.status === CTGTestResult.STATUS.PASS, "interaction worked");
    });

    await test("interact: multiple interactions in one step", async () => {
        const state = await CTGReactTest.init("interact multi")
            .interact("click three times", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
                await user.click(screen.getByText("Increment"));
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count is 3", (screen) =>
                screen.getByTestId("count").textContent, "3")
            .start(<Counter />);
        assert(state.status === CTGTestResult.STATUS.PASS, "multiple clicks worked");
    });

    // ── Form Interaction ────────────────────────────────────────

    await test("interact: form submission", async () => {
        const state = await CTGReactTest.init("interact form")
            .interact("fill and submit", async ({screen, user}) => {
                await user.type(screen.getByLabelText("Username"), "alice");
                await user.click(screen.getByText("Submit"));
            })
            .assertComponent("welcome shown", (screen) =>
                screen.getByText("Welcome, alice!") !== null, true)
            .start(<LoginForm />);
        assert(state.status === CTGTestResult.STATUS.PASS, "form submission worked");
    });

    // ── VOID Return ─────────────────────────────────────────────

    await test("interact: callback return value is ignored", async () => {
        const state = await CTGReactTest.init("interact void")
            .interact("returns value", ({screen, user}) => {
                return "this should be ignored";
            })
            .start(<Counter />);
        // Pipeline should continue without error
        assert(state.results.length >= 1, "step recorded");
    });

    // ── Async Support ───────────────────────────────────────────

    await test("interact: async callback is awaited", async () => {
        const state = await CTGReactTest.init("interact async")
            .interact("async click", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count updated", (screen) =>
                screen.getByTestId("count").textContent, "1")
            .start(<Counter />);
        assert(state.status === CTGTestResult.STATUS.PASS, "async callback worked");
    });

    // ── Error Handling ──────────────────────────────────────────

    await test("interact: error produces error result", async () => {
        const state = await CTGReactTest.init("interact error")
            .interact("throw", async () => {
                throw new Error("interaction failed");
            })
            .start(<Counter />, { haltOnFailure: false });
        const result = state.results.find((r) => r.name === "throw");
        assert(result.status === CTGTestResult.STATUS.ERROR, "error recorded");
    });

    await test("interact: no error handler parameter", () => {
        // interact signature is (name, callback) — no third argument
        // This test verifies the API surface
        const pipeline = CTGReactTest.init("no handler");
        assert(pipeline.interact.length === 2, "interact takes 2 params");
    });
}
