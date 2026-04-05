// assertComponentIs tests — §1 (v3)
//
// Validates that assertComponentIs compares rendered HTML against a STRING
// or a ReactTestState instance (calling toHTML automatically).

import CTGTestResult from "ctg-js-test/result";
import ReactTestState from "../../src/ReactTestState.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter } from "../components.jsx";

export default async function run({ test, assert }) {

    // ── String Comparison ───────────────────────────────────────

    await test("assertComponentIs: passes when HTML matches string", async () => {
        const state = await CTGReactTest.init("assertComponentIs string pass")
            .assertComponentIs("matches", "<h1>Hello, World!</h1>")
            .start(<Greeting name="World" />);
        assert(state.status === CTGTestResult.STATUS.PASS, "HTML matched string");
    });

    await test("assertComponentIs: fails when HTML does not match string", async () => {
        const state = await CTGReactTest.init("assertComponentIs string fail")
            .assertComponentIs("mismatch", "<h1>Wrong</h1>")
            .start(<Greeting name="World" />, { haltOnFailure: false });
        assert(state.status === CTGTestResult.STATUS.FAIL, "HTML did not match");
    });

    // ── ReactTestState Comparison ───────────────────────────────

    await test("assertComponentIs: accepts ReactTestState and calls toHTML", async () => {
        const expected = await CTGReactTest.init("expected")
            .interact("click once", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .start(<Counter />, { autoCleanup: false });

        const state = await CTGReactTest.init("assertComponentIs state")
            .interact("click once", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .assertComponentIs("same result", expected)
            .start(<Counter />);
        assert(state.status === CTGTestResult.STATUS.PASS, "states matched");
    });

    await test("assertComponentIs: fails when staged states differ", async () => {
        const expected = await CTGReactTest.init("expected")
            .interact("click once", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .start(<Counter />, { autoCleanup: false });

        const state = await CTGReactTest.init("assertComponentIs state mismatch")
            .interact("click twice", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
                await user.click(screen.getByText("Increment"));
            })
            .assertComponentIs("different result", expected)
            .start(<Counter />, { haltOnFailure: false });
        assert(state.status === CTGTestResult.STATUS.FAIL, "states did not match");
    });

    // ── No Error Handler ────────────────────────────────────────

    await test("assertComponentIs: no error handler parameter", () => {
        const pipeline = CTGReactTest.init("no handler");
        assert(pipeline.assertComponentIs.length === 2, "assertComponentIs takes 2 params");
    });

    // ── Result Shape ────────────────────────────────────────────

    await test("assertComponentIs: result includes actual and expected", async () => {
        const state = await CTGReactTest.init("assertComponentIs result")
            .assertComponentIs("check", "<h1>Hello, World!</h1>")
            .start(<Greeting name="World" />);
        const result = state.results.find((r) => r.name === "check");
        assert(result.actual !== undefined, "actual present");
        assert(result.expected !== undefined, "expected present");
    });
}
