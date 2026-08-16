import { describe, it, expect } from "vitest";
import CTGReactTest from "../src/CTGReactTest.js";
import {
    CTGTestError,
    CTGTestPredicates,
    CTGTestResult,
    CTGTestState
} from "ctg-js-test";
import ReactTestState from "../src/ReactTestState.js";
import { Greeting, Counter, LoginForm } from "./components.jsx";

const S = CTGTestResult.STATUS;

describe("pipeline lifecycle", () => {

    it("start() receives JSX, mounts component, returns ReactTestState", async () => {
        const state = await CTGReactTest.init("mount test")
            .start(<Greeting name="World" />);

        expect(state).toBeInstanceOf(ReactTestState);
    });

    it("returned state is instanceof ReactTestState", async () => {
        const state = await CTGReactTest.init("instance check")
            .start(<Counter />);

        expect(state).toBeInstanceOf(ReactTestState);
        // ReactTestState extends CTGTestState
        expect(state).toBeInstanceOf(CTGTestState);
    });

    it("React fields populated after mount — screen, user, container, rerender not null", async () => {
        const state = await CTGReactTest.init("fields populated")
            .start(<Counter />, { autoCleanup: false });

        expect(state.screen).not.toBeNull();
        expect(state.user).not.toBeNull();
        expect(state.container).not.toBeNull();
        expect(state.rerender).not.toBeNull();
        expect(typeof state.screen.getByText).toBe("function");
        expect(typeof state.user.click).toBe("function");
        expect(state.container).toBeInstanceOf(HTMLElement);
        expect(typeof state.rerender).toBe("function");
    });

    it("start() with ReactTestState instance skips mounting", async () => {
        // First pipeline mounts the component
        const mounted = await CTGReactTest.init("first")
            .start(<Counter />, { autoCleanup: false });

        const originalScreen = mounted.screen;
        const originalContainer = mounted.container;

        // Second pipeline receives pre-mounted state — should not re-mount
        const result = await CTGReactTest.init("second")
            .assertComponent("count is 0", (screen) =>
                screen.getByTestId("count").textContent, "0")
            .start(mounted);

        // Same testing surface — not re-mounted
        expect(result.screen).toBe(originalScreen);
        expect(result.container).toBe(originalContainer);
    });

    it("start() with null config uses defaults without crashing", async () => {
        const state = await CTGReactTest.init("null config")
            .assertComponent("check", (screen) =>
                screen.getByText("Hello, World!").textContent, "Hello, World!")
            .start(<Greeting name="World" />, null);

        expect(state.results[0].status).toBe(S.PASS);
    });

    it("start() with undefined config uses defaults without crashing", async () => {
        const state = await CTGReactTest.init("undef config")
            .assertComponent("check", (screen) =>
                screen.getByText("Hello, World!").textContent, "Hello, World!")
            .start(<Greeting name="World" />, undefined);

        expect(state.results[0].status).toBe(S.PASS);
    });

    it("pipeline label overwrites state.label", async () => {
        const state = await CTGReactTest.init("my pipeline label")
            .start(<Greeting name="World" />);

        expect(state.label).toBe("my pipeline label");
    });

    it("start() with empty pipeline returns state with no results", async () => {
        const state = await CTGReactTest.init("empty pipeline")
            .start(<Greeting name="World" />);

        expect(state.results).toHaveLength(0);
        expect(state.status).toBe(S.PASS);
    });
});

describe("chain", () => {

    it("same-state semantics — inner pipeline sees screen/user/container/rerender", async () => {
        let innerScreen = null;
        let innerUser = null;
        let innerContainer = null;

        const inner = CTGReactTest.init("inner")
            .interact("capture fields", async ({ screen, user }) => {
                innerScreen = screen;
                innerUser = user;
            })
            .assertComponent("count is 0", (screen) =>
                screen.getByTestId("count").textContent, "0");

        const state = await CTGReactTest.init("outer")
            .chain("run inner", inner)
            .start(<Counter />, { autoCleanup: false });

        expect(innerScreen).toBe(state.screen);
        expect(innerUser).toBe(state.user);
    });

    it("no chain override needed — base chain works", async () => {
        const inner = CTGReactTest.init("inner assert")
            .assertComponent("heading text", (screen) =>
                screen.getByRole("heading").textContent, "Hello, World!");

        const state = await CTGReactTest.init("outer chain")
            .chain("verify greeting", inner)
            .start(<Greeting name="World" />);

        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(S.PASS);
    });

    it("chain label prepended to child results", async () => {
        const inner = CTGReactTest.init("inner pipeline")
            .assertComponent("check heading", (screen) =>
                screen.getByRole("heading").textContent, "Hello, World!");

        const state = await CTGReactTest.init("outer pipeline")
            .chain("my chain", inner)
            .start(<Greeting name="World" />);

        // Result label should include the chain label in the path
        const resultLabel = state.results[0].label;
        expect(resultLabel).toContain("my chain");
        expect(resultLabel).toContain("check heading");
    });

    it("subject changes in chain visible outside", async () => {
        const inner = CTGReactTest.init("inner mutator")
            .stage("change subject", (state) => {
                return "mutated";
            });

        const state = await CTGReactTest.init("outer observer")
            .chain("mutate chain", inner)
            .start(<Greeting name="World" />);

        // Subject was changed by inner stage — visible in outer state
        expect(state.subject).toBe("mutated");
    });

    it("chain with interact and assert across boundary", async () => {
        const inner = CTGReactTest.init("inner clicks")
            .interact("click increment", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            });

        const state = await CTGReactTest.init("outer verifies")
            .chain("do clicks", inner)
            .assertComponent("count is 1", (screen) =>
                screen.getByTestId("count").textContent, "1")
            .start(<Counter />);

        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(S.PASS);
        expect(state.results[1].status).toBe(S.PASS);
    });
});

describe("config", () => {

    it("wrapper option wraps component in provider", async () => {
        // Simple wrapper that adds a data attribute
        function TestWrapper({ children }) {
            return <div data-testid="wrapper">{children}</div>;
        }

        const state = await CTGReactTest.init("wrapper test")
            .assertComponent("wrapped", (screen) =>
                screen.getByTestId("wrapper") !== null, CTGTestPredicates.isTruthy())
            .start(<Greeting name="World" />, {
                wrapper: TestWrapper,
                autoCleanup: false
            });

        expect(state.results[0].status).toBe(S.PASS);
    });

    it("autoCleanup: false preserves mounted component", async () => {
        const state = await CTGReactTest.init("no cleanup")
            .start(<Greeting name="World" />, { autoCleanup: false });

        // Container should still be populated after pipeline completes
        expect(state.container).not.toBeNull();
        expect(state.container.innerHTML).toBe("<h1>Hello, World!</h1>");
    });

    it("autoCleanup: true (default) cleans up", async () => {
        const state = await CTGReactTest.init("default cleanup")
            .start(<Greeting name="World" />);

        // After cleanup, container innerHTML is empty
        expect(state.container.innerHTML).toBe("");
    });

    it("React config stripped — base does not see wrapper/autoCleanup", async () => {
        // If React config is NOT stripped, base _validateConfig would throw
        // INVALID_CONFIG for unknown keys. This test passing means stripping works.
        const state = await CTGReactTest.init("config stripping")
            .assertComponent("heading", (screen) =>
                screen.getByRole("heading").textContent, "Hello, World!")
            .start(<Greeting name="World" />, {
                wrapper: undefined,
                autoCleanup: true
            });

        expect(state.results[0].status).toBe(S.PASS);
    });

    it("config not mutated", async () => {
        const config = {
            wrapper: undefined,
            autoCleanup: false,
            haltOnFailure: true
        };
        const frozen = { ...config };

        await CTGReactTest.init("config immutable")
            .start(<Greeting name="World" />, config);

        // Original config object should be unchanged
        expect(config).toEqual(frozen);
    });

    it("INVALID_CONFIG for non-function wrapper", async () => {
        await expect(
            CTGReactTest.init("bad wrapper")
                .start(<Greeting name="World" />, { wrapper: "not a function" })
        ).rejects.toThrow();
    });

    it("INVALID_CONFIG for non-boolean autoCleanup", async () => {
        await expect(
            CTGReactTest.init("bad autoCleanup")
                .start(<Greeting name="World" />, { autoCleanup: "yes" })
        ).rejects.toThrow();
    });
});

describe("static utilities", () => {

    it("toSnapshot returns JSON tree", async () => {
        const tree = await CTGReactTest.toSnapshot(<Greeting name="World" />);

        expect(tree).toBeDefined();
        expect(typeof tree).toBe("object");
        expect(tree.type).toBe("h1");
        expect(tree.children).toContain("Hello, ");
        expect(tree.children).toContain("World");
        expect(tree.children).toContain("!");
    });

    it("diffSnapshot returns array of diffs", async () => {
        const diffs = await CTGReactTest.diffSnapshot(
            <Greeting name="World" />,
            <Greeting name="Alice" />
        );

        expect(Array.isArray(diffs)).toBe(true);
        expect(diffs.length).toBeGreaterThan(0);
        // Each diff has path, expected, actual
        for (const diff of diffs) {
            expect(diff).toHaveProperty("path");
            expect(diff).toHaveProperty("expected");
            expect(diff).toHaveProperty("actual");
        }
    });

    it("diffSnapshot returns empty array when trees match", async () => {
        const diffs = await CTGReactTest.diffSnapshot(
            <Greeting name="World" />,
            <Greeting name="World" />
        );

        expect(Array.isArray(diffs)).toBe(true);
        expect(diffs).toHaveLength(0);
    });

    it("compareSnapshot returns true when trees match", async () => {
        const result = await CTGReactTest.compareSnapshot(
            <Greeting name="World" />,
            <Greeting name="World" />
        );

        expect(result).toBe(true);
    });

    it("compareSnapshot returns false when trees differ", async () => {
        const result = await CTGReactTest.compareSnapshot(
            <Greeting name="World" />,
            <Greeting name="Alice" />
        );

        expect(result).toBe(false);
    });

    it("compareSnapshot with different component types", async () => {
        const result = await CTGReactTest.compareSnapshot(
            <Greeting name="World" />,
            <Counter />
        );

        expect(result).toBe(false);
    });
});

// ── DOM environment failure ───────────────────────────────────────

describe("DOM environment validation", () => {

    it("throws INVALID_OPERATION with code 1000 when DOM is missing", async () => {
        // Save and remove DOM globals
        const origDoc = globalThis.document;
        const origWin = globalThis.window;
        const origHTML = globalThis.HTMLElement;
        try {
            delete globalThis.document;
            delete globalThis.window;
            delete globalThis.HTMLElement;

            await expect(
                CTGReactTest.init("no dom")
                    .assertComponent("check", (screen) => "x", "x")
                    .start(<Greeting name="World" />)
            ).rejects.toThrow();

            try {
                await CTGReactTest.init("no dom error check")
                    .start(<Greeting name="World" />);
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_OPERATION");
                expect(err.code).toBe(1000);
            }
        } finally {
            globalThis.document = origDoc;
            globalThis.window = origWin;
            globalThis.HTMLElement = origHTML;
        }
    });
});

// ── Pre-mounted state cleanup protection ──────────────────────────

describe("pre-mounted ReactTestState cleanup protection", () => {

    it("autoCleanup: true does NOT clean up a pre-mounted ReactTestState", async () => {
        // First pipeline mounts and returns state with autoCleanup: false
        const mounted = await CTGReactTest.init("mount")
            .interact("click", async ({ screen, user }) => {
                await user.click(screen.getByText("Increment"));
            })
            .start(<Counter />, { autoCleanup: false });

        expect(mounted.container).not.toBe(null);
        const htmlBefore = mounted.container.innerHTML;

        // Second pipeline receives the pre-mounted state.
        // Even with default autoCleanup: true, the second pipeline
        // should NOT clean up because it didn't perform the mount.
        const result = await CTGReactTest.init("reuse")
            .assertComponent("still there", (screen) =>
                screen.getByTestId("count").textContent, "1")
            .start(mounted);

        // Container should still be populated after second pipeline
        expect(result.container).not.toBe(null);
        expect(result.container.innerHTML).toBe(htmlBefore);

        // Manual cleanup since autoCleanup was false on first pipeline
        const { cleanup } = await import("@testing-library/react");
        cleanup();
    });
});

// ── Config error specificity ──────────────────────────────────────

describe("config validation error specificity", () => {

    it("non-function wrapper throws CTGTestError INVALID_CONFIG (1002)", async () => {
        try {
            await CTGReactTest.init("bad wrapper")
                .start(<Greeting name="World" />, { wrapper: "not a function" });
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_CONFIG");
            expect(err.code).toBe(1002);
        }
    });

    it("non-boolean autoCleanup throws CTGTestError INVALID_CONFIG (1002)", async () => {
        try {
            await CTGReactTest.init("bad autoCleanup")
                .start(<Greeting name="World" />, { autoCleanup: "yes" });
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_CONFIG");
            expect(err.code).toBe(1002);
        }
    });

    it("numeric autoCleanup throws CTGTestError INVALID_CONFIG (1002)", async () => {
        try {
            await CTGReactTest.init("numeric autoCleanup")
                .start(<Greeting name="World" />, { autoCleanup: 1 });
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_CONFIG");
            expect(err.code).toBe(1002);
        }
    });
});

// ── Inherited skip and timeout with React operations ──────────────

describe("inherited skip with React operations", () => {

    it("skip gates an interact operation", async () => {
        let interactRan = false;
        const state = await CTGReactTest.init("skip interact")
            .skip("click", () => true)
            .interact("click", async ({ screen, user }) => {
                interactRan = true;
                await user.click(screen.getByText("Increment"));
            })
            .assertComponent("still zero", (screen) =>
                screen.getByTestId("count").textContent, "0")
            .start(<Counter />);

        expect(interactRan).toBe(false);
        const skipResult = state.results.find(r =>
            r.label[r.label.length - 1] === "click");
        expect(skipResult.skipped).toBe(true);
    });

    it("skip gates an assertComponent operation", async () => {
        const state = await CTGReactTest.init("skip assert")
            .skip("check", () => true)
            .assertComponent("check", (screen) =>
                screen.getByTestId("count").textContent, "0")
            .start(<Counter />, { haltOnFailure: false });

        const skipResult = state.results.find(r =>
            r.label[r.label.length - 1] === "check");
        expect(skipResult.skipped).toBe(true);
    });
});

describe("inherited timeout with React operations", () => {

    it("timeout on interact produces ERROR", async () => {
        const state = await CTGReactTest.init("timeout interact")
            .interact("slow click", async () => {
                await new Promise(resolve => setTimeout(resolve, 200));
            })
            .start(<Counter />, { timeout: 50, haltOnFailure: false });

        const result = state.results.find(r =>
            r.label[r.label.length - 1] === "slow click");
        expect(result.status).toBe(S.ERROR);
    });

    it("timeout on assertComponent produces ERROR", async () => {
        const state = await CTGReactTest.init("timeout assert")
            .assertComponent("slow query", async () => {
                await new Promise(resolve => setTimeout(resolve, 200));
                return "value";
            }, "value")
            .start(<Counter />, { timeout: 50, haltOnFailure: false });

        const result = state.results.find(r =>
            r.label[r.label.length - 1] === "slow query");
        expect(result.status).toBe(S.ERROR);
    });

    it("assertComponentIs completes within timeout (inherently sync)", async () => {
        // assertComponentIs delegates to assert with a sync handler
        // (reads container.innerHTML) and a sync predicate (equals).
        // This test verifies the operation completes within a tight
        // timeout, proving it participates in timeout enforcement but
        // doesn't trigger it under normal conditions.
        const state = await CTGReactTest.init("assertComponentIs timeout")
            .assertComponentIs("check html", "<h1>Hello, World!</h1>")
            .start(<Greeting name="World" />, { timeout: 50 });

        const result = state.results.find(r =>
            r.label[r.label.length - 1] === "check html");
        expect(result.status).toBe(S.PASS);
    });

    it("cleanup still runs after timeout", async () => {
        const state = await CTGReactTest.init("timeout cleanup")
            .interact("slow", async () => {
                await new Promise(resolve => setTimeout(resolve, 200));
            })
            .start(<Counter />, { timeout: 50, haltOnFailure: false });

        // Pipeline completed (with error) — cleanup should have run.
        // We can verify by checking that a new mount works without issues.
        const fresh = await CTGReactTest.init("fresh after timeout")
            .assertComponent("renders", (screen) =>
                screen.getByTestId("count").textContent, "0")
            .start(<Counter />);
        expect(fresh.results[0].status).toBe(S.PASS);
    });
});
