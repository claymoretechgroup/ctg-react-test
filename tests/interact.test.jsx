import { describe, it, expect } from "vitest";
import CTGReactTest from "../src/CTGReactTest.js";
import { CTGTestResult } from "ctg-js-test";
import { Counter, LoginForm } from "./components.jsx";

const S = CTGTestResult.STATUS;

describe("interact", () => {

    it("returns this for chaining", () => {
        const pipeline = CTGReactTest.init("chain test");
        const returned = pipeline.interact("click", async ({ user, screen }) => {
            await user.click(screen.getByText("Increment"));
        });
        expect(returned).toBe(pipeline);
    });

    it("records PASS result on successful interaction", async () => {
        const state = await CTGReactTest.init("interact pass")
            .interact("click increment", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .start(<Counter />);

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.PASS);
    });

    it("result is a stage result — computedValue and expectedOutcome are undefined", async () => {
        const state = await CTGReactTest.init("stage result shape")
            .interact("click", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .start(<Counter />);

        const result = state.results[0];
        expect(result.computedValue).toBeUndefined();
        expect(result.expectedOutcome).toBeUndefined();
    });

    it("subject unchanged after interact — JSX element stays as subject", async () => {
        const jsx = <Counter initial={5} />;
        const state = await CTGReactTest.init("subject unchanged")
            .interact("click increment", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .start(jsx);

        // Subject is the original JSX element, not mutated
        expect(state.subject).toBe(jsx);
    });

    it("callback receives screen and user from mounted component", async () => {
        let receivedScreen = null;
        let receivedUser = null;

        await CTGReactTest.init("callback args")
            .interact("capture args", async ({ screen, user }) => {
                receivedScreen = screen;
                receivedUser = user;
            })
            .start(<Counter />);

        expect(receivedScreen).not.toBeNull();
        expect(receivedUser).not.toBeNull();
        // screen should have query functions
        expect(typeof receivedScreen.getByText).toBe("function");
        // user should have interaction methods
        expect(typeof receivedUser.click).toBe("function");
    });

    it("records ERROR when callback throws", async () => {
        const state = await CTGReactTest.init("interact error")
            .interact("bad interact", async () => {
                throw new Error("interaction failed");
            })
            .start(<Counter />, { haltOnFailure: false });

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.ERROR);
        expect(state.results[0].error).toBeInstanceOf(Error);
        expect(state.results[0].error.message).toBe("interaction failed");
    });

    it("supports async callbacks", async () => {
        const state = await CTGReactTest.init("async interact")
            .interact("async click", async ({ screen, user }) => {
                // Async operation — user.click is already async
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count is 1", (screen) =>
                screen.getByTestId("count").textContent, "1")
            .start(<Counter />);

        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(S.PASS);
        expect(state.results[1].status).toBe(S.PASS);
    });

    it("click changes DOM — verified by subsequent assertComponent", async () => {
        const state = await CTGReactTest.init("click and verify")
            .interact("click increment twice", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count is 2", (screen) =>
                screen.getByTestId("count").textContent, "2")
            .start(<Counter />);

        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(S.PASS);
        expect(state.results[1].status).toBe(S.PASS);
    });

    it("type and submit form — verified by subsequent assertComponent", async () => {
        const state = await CTGReactTest.init("form interaction")
            .interact("fill and submit", async ({ screen, user }) => {
                await user.type(screen.getByLabelText("Username"), "Alice");
                await user.click(screen.getByText("Submit"));
            })
            .assertComponent("shows welcome", (screen) =>
                screen.getByText("Welcome, Alice!").textContent, "Welcome, Alice!")
            .start(<LoginForm />);

        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(S.PASS);
        expect(state.results[1].status).toBe(S.PASS);
    });

    it("multiple interact steps chain sequentially", async () => {
        const state = await CTGReactTest.init("sequential interactions")
            .interact("first click", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .interact("second click", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .interact("third click", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("count is 3", (screen) =>
                screen.getByTestId("count").textContent, "3")
            .start(<Counter />);

        expect(state.results).toHaveLength(4);
        for (const result of state.results) {
            expect(result.status).toBe(S.PASS);
        }
    });

    it("user-event null throws INVALID_OPERATION (code 1000)", async () => {
        // Create a pre-mounted state with user set to null to simulate
        // user-event being unavailable
        const state = await CTGReactTest.init("pre-mount")
            .start(<Counter />);

        // Null out user to simulate user-event unavailable
        state.user = null;

        const result = await CTGReactTest.init("null user")
            .interact("should fail", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .start(state, { haltOnFailure: false });

        expect(result.results).toHaveLength(1);
        expect(result.results[0].status).toBe(S.ERROR);
        expect(result.results[0].error).toBeDefined();
        expect(result.results[0].error.code).toBe(1000);
        expect(result.results[0].error.type).toBe("INVALID_OPERATION");
    });

    it("interact result label includes pipeline label prefix", async () => {
        const state = await CTGReactTest.init("my pipeline")
            .interact("click it", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .start(<Counter />);

        // In v2.2, labels are arrays — the result label should contain the operation label
        expect(state.results[0].label).toContain("click it");
    });

    it("non-function callback produces INVALID_OPERATION error at execution time", async () => {
        const state = await CTGReactTest.init("bad callback")
            .interact("bad", "not a function")
            .start(<Counter />, { haltOnFailure: false });

        expect(state.results[0].status).toBe(S.ERROR);
        expect(state.results[0].error.type).toBe("INVALID_OPERATION");
        expect(state.results[0].error.code).toBe(1000);
    });

    it("user as undefined (not just null) triggers INVALID_OPERATION", async () => {
        // Pre-mount a state and delete user to simulate undefined
        const mounted = await CTGReactTest.init("setup")
            .start(<Counter />, { autoCleanup: false });
        mounted.user = undefined;

        const state = await CTGReactTest.init("undefined user")
            .interact("click", async ({ user }) => { await user.click(); })
            .start(mounted, { haltOnFailure: false });

        expect(state.results[0].status).toBe(S.ERROR);
        expect(state.results[0].error.type).toBe("INVALID_OPERATION");

        const { cleanup } = await import("@testing-library/react");
        cleanup();
    });
});
