// Pipeline integration tests — §3

import { cleanup } from "@testing-library/react";
import CTGTest from "ctg-js-test";
import CTGTestResult from "ctg-js-test/result";
import ReactTestState from "../../src/ReactTestState.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter, LoginForm } from "../components.jsx";

export default async function run({ test: rawTest, assert }) {
    const test = (name, fn) => rawTest(name, async () => {
        try { await fn(); } finally { cleanup(); }
    });

    await test("pipeline: render, interact, assert flow", async () => {
        const state = await CTGReactTest.init("full flow")
            .render("mount counter", <Counter />)
            .interact("click increment", async (state) => {
                await state.user.click(state.screen.getByText("Increment"));
                return state;
            })
            .assert("count is 1", (state) =>
                state.screen.getByTestId("count").textContent, "1")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "full flow passed");
    });

    await test("pipeline: stage works in React pipeline", async () => {
        const state = await CTGReactTest.init("stage test")
            .render("mount", <Greeting name="X" />)
            .stage("extract text", (state) => {
                state.subject = state.container.textContent;
                return state;
            })
            .assert("text extracted", (state) => state.subject, "Hello, X!")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "stage worked");
    });

    await test("pipeline: assert reads from state directly", async () => {
        const state = await CTGReactTest.init("assert state")
            .render("mount", <Counter initial={5} />)
            .assert("count displayed", (state) =>
                state.screen.getByTestId("count").textContent, "5")
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "assert on state");
    });

    await test("pipeline: skip works in React pipeline", async () => {
        const state = await CTGReactTest.init("skip test")
            .render("mount", <Greeting name="X" />)
            .skip("skip check", "expensive check")
            .assert("expensive check", (state) => state.container.innerHTML, "wrong")
            .start(null);
        const skipped = state.results.find((r) => r.name === "expensive check");
        assert(skipped.status === CTGTestResult.STATUS.SKIP, "step was skipped");
    });

    await test("pipeline: chain shares React state with inner pipeline", async () => {
        const verifyGreeting = CTGReactTest.init("verify greeting")
            .assert("has greeting", (state) =>
                state.container.innerHTML.includes("Hello"), true);
        const state = await CTGReactTest.init("chain test")
            .render("mount", <Greeting name="Chain" />)
            .chain("verify", verifyGreeting)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "chain shared React state");
    });

    await test("pipeline: chain also works for subject-based composition", async () => {
        const doubleSubject = CTGReactTest.init("double")
            .stage("double", (state) => { state.subject = state.subject * 2; return state; });
        const state = await CTGReactTest.init("chain subject")
            .stage("set", (state) => { state.subject = 5; return state; })
            .chain("double it", doubleSubject)
            .assert("check", (state) => state.subject, 10)
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "chain subject worked");
    });

    await test("pipeline: start returns ReactTestState", async () => {
        const state = await CTGReactTest.init("return type")
            .render("mount", <Greeting name="X" />)
            .start(null);
        assert(state instanceof ReactTestState, "returns ReactTestState");
    });

    await test("pipeline: start wraps raw subject in ReactTestState", async () => {
        const state = await CTGReactTest.init("wrap subject")
            .stage("noop", (state) => state)
            .start(42);
        assert(state instanceof ReactTestState, "wrapped in ReactTestState");
        assert(state.subject === 42, "subject preserved");
    });

    await test("pipeline: init returns CTGReactTest instance", () => {
        const pipeline = CTGReactTest.init("factory test");
        assert(pipeline instanceof CTGReactTest, "is CTGReactTest");
        assert(pipeline instanceof CTGTest, "is CTGTest");
    });

    await test("pipeline: accepts snapshotFilePath config", async () => {
        const state = await CTGReactTest.init("config test")
            .stage("noop", (state) => state)
            .start(null, { snapshotFilePath: "/tmp/test.snap.json" });
        assert(state.status === CTGTestResult.STATUS.PASS, "config accepted");
    });

    await test("pipeline: output config key rejected", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { output: "console" });
        } catch { threw = true; }
        assert(threw, "output rejected");
    });

    await test("pipeline: formatter config key rejected", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("bad config")
                .stage("noop", (state) => state)
                .start(null, { formatter: null });
        } catch { threw = true; }
        assert(threw, "formatter rejected");
    });

    await test("pipeline: no static _results", () => {
        assert(CTGReactTest._results === undefined, "no _results");
    });

    await test("pipeline: start does not write to stdout", async () => {
        const origWrite = process.stdout.write;
        let written = false;
        process.stdout.write = () => { written = true; return true; };
        try {
            await CTGReactTest.init("silent")
                .render("mount", <Greeting name="X" />)
                .start(null);
        } finally {
            process.stdout.write = origWrite;
        }
        assert(!written, "nothing written");
    });

    await test("pipeline: assertAny works in React pipeline", async () => {
        const state = await CTGReactTest.init("assertAny test")
            .render("mount", <Counter initial={5} />)
            .assertAny("count in range", (state) =>
                state.screen.getByTestId("count").textContent, ["4", "5", "6"])
            .start(null);
        assert(state.status === CTGTestResult.STATUS.PASS, "assertAny matched");
    });

    await test("pipeline: interact before render errors (no user)", async () => {
        const state = await CTGReactTest.init("interact no render")
            .interact("click", async (state) => {
                await state.user.click(state.screen.getByText("X"));
                return state;
            })
            .start(null, { haltOnFailure: false });
        const result = state.results.find((r) => r.name === "click");
        assert(result.status === CTGTestResult.STATUS.ERROR, "error without render");
    });

    await test("pipeline: empty pipeline name fails validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("")
                .render("mount", <Greeting name="X" />)
                .start(null);
        } catch { threw = true; }
        assert(threw, "empty name threw");
    });

    await test("pipeline: duplicate step names fail validation", async () => {
        let threw = false;
        try {
            await CTGReactTest.init("dupe names")
                .render("mount", <Greeting name="A" />)
                .render("mount", <Greeting name="B" />)
                .start(null);
        } catch { threw = true; }
        assert(threw, "duplicate names threw");
    });
}
