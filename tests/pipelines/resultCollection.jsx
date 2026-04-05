// Result collection tests — §4 (v3)
//
// Tests caller-owned reporting with automatic cleanup.

import CTGTestResult from "ctg-js-test/result";
import CTGTestConsoleFormatter from "ctg-js-test/formatter/console";
import ReactTestState from "../../src/ReactTestState.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter } from "../components.jsx";

export default async function run({ test, assert }) {

    // ── Caller-Owned Collection ─────────────────────────────────

    await test("result: caller collects from returned state", async () => {
        const collector = [];

        const state1 = await CTGReactTest.init("first")
            .assertComponent("check", (screen) =>
                screen.getByRole("heading").textContent.includes("A"), true)
            .start(<Greeting name="A" />);
        collector.push({ name: state1.name, status: state1.status });

        const state2 = await CTGReactTest.init("second")
            .assertComponent("check", (screen) =>
                screen.getByRole("heading").textContent.includes("B"), true)
            .start(<Greeting name="B" />);
        collector.push({ name: state2.name, status: state2.status });

        assert(collector.length === 2, "two entries");
        assert(collector[0].status === CTGTestResult.STATUS.PASS, "first passed");
        assert(collector[1].status === CTGTestResult.STATUS.PASS, "second passed");
    });

    // ── Formatter Compatibility ─────────────────────────────────

    await test("result: console formatter accepts ReactTestState", async () => {
        const state = await CTGReactTest.init("formatter test")
            .assertComponent("check", (screen) =>
                screen.getByRole("heading").textContent.includes("X"), true)
            .start(<Greeting name="X" />);
        assert(state instanceof ReactTestState, "is ReactTestState");
        const formatted = CTGTestConsoleFormatter.format(state);
        assert(typeof formatted === "string", "returns string");
        assert(formatted.length > 0, "non-empty");
        assert(formatted.includes("formatter test"), "has pipeline name");
    });

    // ── Sequential Pipelines ────────────────────────────────────

    await test("result: sequential pipelines get clean state", async () => {
        // First pipeline
        await CTGReactTest.init("pipeline A")
            .interact("click", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count is 1", (screen) =>
                screen.getByTestId("count").textContent, "1")
            .start(<Counter />);

        // Second pipeline should start fresh (cleanup ran after first)
        const state = await CTGReactTest.init("pipeline B")
            .assertComponent("count is 0", (screen) =>
                screen.getByTestId("count").textContent, "0")
            .start(<Counter />);
        assert(state.status === CTGTestResult.STATUS.PASS, "fresh state after cleanup");
    });
}
