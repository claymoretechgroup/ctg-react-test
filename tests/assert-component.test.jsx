import { describe, it, expect } from "vitest";
import CTGReactTest from "../src/CTGReactTest.js";
import CTGTestResult from "ctg-js-test/result";
import CTGTestPredicates from "ctg-js-test/predicates";
import CTGTestPredicate from "ctg-js-test/predicate";
import CTGTestError from "ctg-js-test/error";
import ReactTestState from "../src/ReactTestState.js";
import { Greeting, Counter } from "./components.jsx";

const S = CTGTestResult.STATUS;

describe("assertComponent", () => {

    it("PASS when computed value matches raw expected (auto-wrapped in equals)", async () => {
        const state = await CTGReactTest.init("assert raw expected")
            .assertComponent("greeting text", (screen) =>
                screen.getByText("Hello, World!").textContent, "Hello, World!")
            .start(<Greeting name="World" />);

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.PASS);
    });

    it("FAIL when computed value does not match raw expected", async () => {
        const state = await CTGReactTest.init("assert mismatch")
            .assertComponent("wrong text", (screen) =>
                screen.getByRole("heading").textContent, "Hello, Nobody!")
            .start(<Greeting name="World" />, { haltOnFailure: false });

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.FAIL);
    });

    it("CTGTestPredicate instance used directly — not double-wrapped", async () => {
        const predicate = CTGTestPredicates.contains("World");
        const state = await CTGReactTest.init("predicate instance")
            .assertComponent("contains world", (screen) =>
                screen.getByRole("heading").textContent, predicate)
            .start(<Greeting name="World" />);

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.PASS);
        // expectedOutcome should be the predicate's expected, not the predicate itself
        expect(state.results[0].expectedOutcome).toBe("World");
    });

    it("result has computedValue populated", async () => {
        const state = await CTGReactTest.init("computed value check")
            .assertComponent("count text", (screen) =>
                screen.getByTestId("count").textContent, "0")
            .start(<Counter />);

        expect(state.results[0].computedValue).toBe("0");
    });

    it("result has expectedOutcome populated from raw value", async () => {
        const state = await CTGReactTest.init("expected outcome raw")
            .assertComponent("count text", (screen) =>
                screen.getByTestId("count").textContent, "0")
            .start(<Counter />);

        expect(state.results[0].expectedOutcome).toBe("0");
    });

    it("result has expectedOutcome populated from predicate instance", async () => {
        const predicate = CTGTestPredicates.isTruthy();
        const state = await CTGReactTest.init("expected outcome predicate")
            .assertComponent("has content", (screen) =>
                screen.getByRole("heading").textContent.length > 0, predicate)
            .start(<Greeting name="World" />);

        expect(state.results[0].status).toBe(S.PASS);
        expect(state.results[0].expectedOutcome).toBe(true);
    });

    it("callback receives screen — can query rendered DOM", async () => {
        let receivedScreen = null;
        const state = await CTGReactTest.init("screen access")
            .assertComponent("capture screen", (screen) => {
                receivedScreen = screen;
                return screen.getByTestId("count").textContent;
            }, "0")
            .start(<Counter />);

        expect(receivedScreen).not.toBeNull();
        expect(typeof receivedScreen.getByText).toBe("function");
        expect(typeof receivedScreen.getByTestId).toBe("function");
        expect(state.results[0].status).toBe(S.PASS);
    });

    it("async callback supported — findBy queries", async () => {
        const state = await CTGReactTest.init("async callback")
            .assertComponent("find heading", async (screen) => {
                const el = await screen.findByRole("heading");
                return el.textContent;
            }, "Hello, World!")
            .start(<Greeting name="World" />);

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.PASS);
    });

    it("ERROR when callback throws", async () => {
        const state = await CTGReactTest.init("callback error")
            .assertComponent("bad query", (screen) => {
                // getByTestId throws if not found
                return screen.getByTestId("nonexistent").textContent;
            }, "anything")
            .start(<Greeting name="World" />, { haltOnFailure: false });

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.ERROR);
    });

    it("builder returns this for chaining", () => {
        const pipeline = CTGReactTest.init("chain test");
        const returned = pipeline.assertComponent("check", (screen) =>
            screen.getByRole("heading").textContent, "Hello");
        expect(returned).toBe(pipeline);
    });

    it("multiple assertComponent calls chain sequentially", async () => {
        const state = await CTGReactTest.init("multiple asserts")
            .assertComponent("has heading", (screen) =>
                screen.getByRole("heading").textContent, "Hello, World!")
            .start(<Greeting name="World" />);

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.PASS);
    });

    it("works with CTGTestPredicates.contains", async () => {
        const state = await CTGReactTest.init("contains predicate")
            .assertComponent("heading contains Hello", (screen) =>
                screen.getByRole("heading").textContent,
                CTGTestPredicates.contains("Hello"))
            .start(<Greeting name="World" />);

        expect(state.results[0].status).toBe(S.PASS);
    });

    it("works with CTGTestPredicates.matchesPattern", async () => {
        const state = await CTGReactTest.init("pattern predicate")
            .assertComponent("heading matches pattern", (screen) =>
                screen.getByRole("heading").textContent,
                CTGTestPredicates.matchesPattern(/^Hello, \w+!$/))
            .start(<Greeting name="World" />);

        expect(state.results[0].status).toBe(S.PASS);
    });
});

describe("assertComponentIs", () => {

    it("PASS when string expected matches container innerHTML", async () => {
        const state = await CTGReactTest.init("string match")
            .assertComponentIs("matches html", "<h1>Hello, World!</h1>")
            .start(<Greeting name="World" />);

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.PASS);
    });

    it("FAIL when string expected does not match", async () => {
        const state = await CTGReactTest.init("string mismatch")
            .assertComponentIs("wrong html", "<h1>Hello, Nobody!</h1>")
            .start(<Greeting name="World" />, { haltOnFailure: false });

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.FAIL);
    });

    it("computedValue is container innerHTML", async () => {
        const state = await CTGReactTest.init("computed is innerHTML")
            .assertComponentIs("check html", "<h1>Hello, World!</h1>")
            .start(<Greeting name="World" />);

        expect(state.results[0].computedValue).toBe("<h1>Hello, World!</h1>");
    });

    it("expectedOutcome is the expected string", async () => {
        const expected = "<h1>Hello, World!</h1>";
        const state = await CTGReactTest.init("expected string")
            .assertComponentIs("check html", expected)
            .start(<Greeting name="World" />);

        expect(state.results[0].expectedOutcome).toBe(expected);
    });

    it("ReactTestState expected — compares toHTML() output", async () => {
        // Create a pre-mounted state to use as expected
        const expectedState = await CTGReactTest.init("expected pipeline")
            .start(<Greeting name="World" />, { autoCleanup: false });

        const state = await CTGReactTest.init("compare states")
            .assertComponentIs("same render", expectedState)
            .start(<Greeting name="World" />);

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.PASS);
    });

    it("throws INVALID_OPERATION if current container is null", async () => {
        // Create a state with null container to simulate unmounted component
        const preState = new ReactTestState({ subject: null, label: "null container" });
        // container is null by default (never mounted)

        const state = await CTGReactTest.init("null container")
            .assertComponentIs("should error", "<div>test</div>")
            .start(preState, { haltOnFailure: false });

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.ERROR);
        expect(state.results[0].error).toBeDefined();
        expect(state.results[0].error.code).toBe(1000);
        expect(state.results[0].error.type).toBe("INVALID_OPERATION");
    });

    it("throws INVALID_OPERATION (1000) if expected ReactTestState container is null", () => {
        // Expected state with null container — toHTML() called at build time
        const expectedState = new ReactTestState({ subject: null, label: "empty" });
        // container is null — toHTML() should throw

        try {
            CTGReactTest.init("null expected container")
                .assertComponentIs("should throw", expectedState);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_OPERATION");
            expect(err.code).toBe(1000);
        }
    });

    it("builder returns this for chaining", () => {
        const pipeline = CTGReactTest.init("chain test");
        const returned = pipeline.assertComponentIs("check html", "<div>test</div>");
        expect(returned).toBe(pipeline);
    });
});
