// Pipeline integration tests — §4 (v3)
//
// Tests start() with JSX, implicit mount, automatic cleanup,
// chaining, config validation, inherited step types.

import CTGTest from "ctg-js-test";
import CTGTestResult from "ctg-js-test/result";
import ReactTestState from "../../src/ReactTestState.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter, LoginForm } from "../components.jsx";

export default async function run({ test, assert }) {

    // ── start() Mounts Component ────────────────────────────────

    await test("pipeline: start receives JSX and mounts", async () => {
        const state = await CTGReactTest.init("start mount")
            .assertComponent("rendered", (screen) =>
                screen.getByRole("heading").textContent, "Hello, World!")
            .start(<Greeting name="World" />);
        assert(state.status === CTGTestResult.STATUS.PASS, "component mounted");
    });

    await test("pipeline: start returns ReactTestState", async () => {
        const state = await CTGReactTest.init("start type")
            .start(<Greeting name="X" />);
        assert(state instanceof ReactTestState, "returns ReactTestState");
    });

    await test("pipeline: state.subject holds the JSX element", async () => {
        const element = <Greeting name="Subject" />;
        const state = await CTGReactTest.init("start subject")
            .start(element);
        assert(state.subject !== null, "subject set");
    });

    await test("pipeline: screen and user populated after mount", async () => {
        let hasScreen = false;
        let hasUser = false;
        await CTGReactTest.init("mount surface")
            .interact("check surface", ({screen, user}) => {
                hasScreen = screen !== null;
                hasUser = user !== null;
            })
            .start(<Counter />);
        assert(hasScreen, "screen populated");
        assert(hasUser, "user populated");
    });

    // ── Automatic Cleanup ───────────────────────────────────────

    await test("pipeline: cleanup runs automatically after start", async () => {
        await CTGReactTest.init("cleanup auto")
            .assertComponent("mounted", (screen) =>
                screen.getByRole("heading") !== null, true)
            .start(<Greeting name="Cleanup" />);
        // If cleanup didn't run, next test would see stale DOM
        // Run another pipeline — should mount fresh
        const state = await CTGReactTest.init("cleanup verify")
            .assertComponent("fresh mount", (screen) =>
                screen.getByRole("heading").textContent, "Hello, Fresh!")
            .start(<Greeting name="Fresh" />);
        assert(state.status === CTGTestResult.STATUS.PASS, "fresh mount after cleanup");
    });

    await test("pipeline: autoCleanup false preserves mounted component", async () => {
        const state = await CTGReactTest.init("no cleanup")
            .start(<Greeting name="Preserved" />, { autoCleanup: false });
        const html = state.toHTML();
        assert(html.includes("Preserved"), "component still mounted");
        // Manual cleanup
        const { cleanup } = await import("@testing-library/react");
        cleanup();
    });

    // ── Wrapper Config ──────────────────────────────────────────

    await test("pipeline: wrapper config wraps component", async () => {
        function Wrapper({children}) {
            return <div data-testid="wrapper">{children}</div>;
        }
        const state = await CTGReactTest.init("wrapper test")
            .assertComponent("wrapped", (screen) =>
                screen.getByTestId("wrapper") !== null, true)
            .start(<Greeting name="Wrapped" />, { wrapper: Wrapper });
        assert(state.status === CTGTestResult.STATUS.PASS, "wrapper applied");
    });

    // ── Full Interact + AssertDOM Flow ──────────────────────────

    await test("pipeline: interact then assertComponent flow", async () => {
        const state = await CTGReactTest.init("full flow")
            .interact("click increment", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count is 1", (screen) =>
                screen.getByTestId("count").textContent, "1")
            .start(<Counter />);
        assert(state.status === CTGTestResult.STATUS.PASS, "full flow passed");
    });

    // ── Inherited Stage ─────────────────────────────────────────

    await test("pipeline: inherited stage works", async () => {
        const state = await CTGReactTest.init("stage test")
            .stage("set subject", (state) => {
                state.subject = "modified";
                return state;
            })
            .assert("subject changed", (state) => state.subject, "modified")
            .start(<Greeting name="X" />);
        assert(state.status === CTGTestResult.STATUS.PASS, "stage worked");
    });

    // ── Inherited Skip ──────────────────────────────────────────

    await test("pipeline: inherited skip works", async () => {
        const state = await CTGReactTest.init("skip test")
            .skip("skip check", "expensive check")
            .assertComponent("expensive check", (screen) =>
                screen.getByRole("heading").textContent, "wrong")
            .start(<Greeting name="X" />);
        const skipped = state.results.find((r) => r.name === "expensive check");
        assert(skipped.status === CTGTestResult.STATUS.SKIP, "step was skipped");
    });

    // ── Chaining ────────────────────────────────────────────────

    await test("pipeline: chain shares testing surface", async () => {
        const verifyGreeting = CTGReactTest.init("verify")
            .assertComponent("has greeting", (screen) =>
                screen.getByRole("heading").textContent.includes("Hello"), true);

        const state = await CTGReactTest.init("chain test")
            .chain("verify greeting", verifyGreeting)
            .start(<Greeting name="Chain" />);
        assert(state.status === CTGTestResult.STATUS.PASS, "chain shared surface");
    });

    await test("pipeline: chain sees interact changes", async () => {
        const verifyCount = CTGReactTest.init("verify count")
            .assertComponent("count is 1", (screen) =>
                screen.getByTestId("count").textContent, "1");

        const state = await CTGReactTest.init("chain after interact")
            .interact("click", async ({screen, user}) => {
                await user.click(screen.getByText("Increment"));
            })
            .chain("verify", verifyCount)
            .start(<Counter />);
        assert(state.status === CTGTestResult.STATUS.PASS, "chain sees changes");
    });

    // ── init Factory ────────────────────────────────────────────

    await test("pipeline: init returns CTGReactTest instance", () => {
        const pipeline = CTGReactTest.init("factory test");
        assert(pipeline instanceof CTGReactTest, "is CTGReactTest");
        assert(pipeline instanceof CTGTest, "is CTGTest");
    });

    // ── Removed Config Keys ─────────────────────────────────────

    await test("pipeline: output config key rejected", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad config")
                .start(<Greeting name="X" />, { output: "console" });
        } catch { threw = true; }
        assert(threw, "output rejected");
    });

    await test("pipeline: formatter config key rejected", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad config")
                .start(<Greeting name="X" />, { formatter: null });
        } catch { threw = true; }
        assert(threw, "formatter rejected");
    });

    // ── Removed Methods ─────────────────────────────────────────

    await test("pipeline: render method does not exist", () => {
        const pipeline = CTGReactTest.init("no render");
        assert(pipeline.render === undefined, "render removed");
    });

    await test("pipeline: renderHook method does not exist", () => {
        const pipeline = CTGReactTest.init("no renderHook");
        assert(pipeline.renderHook === undefined, "renderHook removed");
    });

    await test("pipeline: assertSnapshot method does not exist", () => {
        const pipeline = CTGReactTest.init("no assertSnapshot");
        assert(pipeline.assertSnapshot === undefined, "assertSnapshot removed");
    });

    // ── No Static State ─────────────────────────────────────────

    await test("pipeline: no static _results", () => {
        assert(CTGReactTest._results === undefined, "no _results");
    });

    // ── No stdout ───────────────────────────────────────────────

    await test("pipeline: start does not write to stdout", async () => {
        const origWrite = process.stdout.write;
        let written = false;
        process.stdout.write = () => { written = true; return true; };
        try {
            await CTGReactTest.init("silent")
                .start(<Greeting name="X" />);
        } finally {
            process.stdout.write = origWrite;
        }
        assert(!written, "nothing written");
    });

    // ── Empty Name Validation ───────────────────────────────────

    await test("pipeline: empty pipeline name fails validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("").start(<Greeting name="X" />);
        } catch { threw = true; }
        assert(threw, "empty name threw");
    });

    await test("pipeline: duplicate step names fail validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("dupe names")
                .assertComponent("check", (screen) => true, true)
                .assertComponent("check", (screen) => true, true)
                .start(<Greeting name="X" />);
        } catch { threw = true; }
        assert(threw, "duplicate names threw");
    });
}
