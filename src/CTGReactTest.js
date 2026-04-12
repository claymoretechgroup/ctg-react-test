import CTGTest from "ctg-js-test"; // Base pipeline engine
import CTGTestError from "ctg-js-test/error"; // Typed errors
import CTGTestPredicate from "ctg-js-test/predicate"; // Predicate type
import CTGTestPredicates from "ctg-js-test/predicates"; // Convenience builders
import { isDeepStrictEqual } from "node:util"; // For snapshot comparison
import ReactTestState from "./ReactTestState.js"; // React state

// Composable pipeline-based test framework for React components.
// The component is the subject — passed to start(), mounted implicitly.
// Pipeline methods: interact, assertComponent, assertComponentIs.
export default class CTGReactTest extends CTGTest {

    // CONSTRUCTOR :: STRING -> this
    // Creates a new React test pipeline with the given label.
    constructor(label) {
        super(label);
    }

    /**
     *
     * Instance Methods
     *
     */

    // :: STRING, ({screen: OBJECT, user: OBJECT} -> VOID) -> this
    // Adds an interact operation. Callback receives {screen, user} and
    // returns void. Internally delegates to stage. Chainable.
    interact(label, fn) {
        return this.stage(label, async (state) => {
            if (typeof fn !== "function") {
                throw new CTGTestError("INVALID_OPERATION",
                    `interact callback must be a function, got ${typeof fn}`,
                    { label, got: typeof fn });
            }
            if (state.user == null) {
                throw new CTGTestError("INVALID_OPERATION",
                    "user-event is required for interact() — install @testing-library/user-event");
            }
            await fn({ screen: state.screen, user: state.user });
            return state.subject;
        });
    }

    // :: STRING, (OBJECT:screen -> *), * | ctgTestPredicate -> this
    // Adds an assertComponent operation. Callback receives screen and
    // returns a computed value. Expected is auto-wrapped in equals() if
    // not a CTGTestPredicate instance. Chainable.
    assertComponent(label, fn, expected) {
        const predicate = expected instanceof CTGTestPredicate
            ? expected
            : CTGTestPredicates.equals(expected);
        return this.assert(label, async (state) => {
            if (typeof fn !== "function") {
                throw new CTGTestError("INVALID_OPERATION",
                    `assertComponent callback must be a function, got ${typeof fn}`,
                    { label, got: typeof fn });
            }
            return await fn(state.screen);
        }, predicate);
    }

    // :: STRING, STRING | reactTestState -> this
    // Adds an assertComponentIs operation. Compares the current component's
    // rendered HTML against a STRING or ReactTestState. Chainable.
    assertComponentIs(label, expected) {
        let resolvedExpected;
        if (expected instanceof ReactTestState) {
            resolvedExpected = expected.toHTML();
        } else if (typeof expected === "string") {
            resolvedExpected = expected;
        } else {
            throw new CTGTestError("INVALID_OPERATION",
                `assertComponentIs expected must be a STRING or ReactTestState, got ${typeof expected}`,
                { label, got: typeof expected });
        }
        const predicate = CTGTestPredicates.equals(resolvedExpected);
        return this.assert(label, (state) => {
            if (state.container === null) {
                throw new CTGTestError("INVALID_OPERATION",
                    "Cannot read rendered HTML — container is null (component not mounted or already cleaned up)");
            }
            return state.container.innerHTML;
        }, predicate);
    }

    // :: JSX | reactTestState, OBJECT? -> PROMISE(reactTestState)
    // Receives JSX or ReactTestState. If JSX, wraps in ReactTestState
    // and mounts via RTL. Strips React config before base validation.
    // Runs cleanup after unless autoCleanup: false.
    async start(subject, config = {}) {
        // Extract React-specific config
        const wrapper = config.wrapper || null;
        const autoCleanup = config.autoCleanup !== false;

        // Strip React config — shallow copy, never mutate caller's object
        const baseConfig = { ...config };
        delete baseConfig.wrapper;
        delete baseConfig.autoCleanup;

        // Validate React-specific config
        if (config.wrapper !== undefined && config.wrapper !== null
            && typeof config.wrapper !== "function") {
            throw new CTGTestError("INVALID_CONFIG", "wrapper must be a React component");
        }
        if (config.autoCleanup !== undefined && typeof config.autoCleanup !== "boolean") {
            throw new CTGTestError("INVALID_CONFIG", "autoCleanup must be a boolean");
        }

        let state;
        let shouldCleanup = false;
        if (subject instanceof ReactTestState) {
            // Already mounted — testing surface is populated
            state = subject;
        } else {
            // Fresh JSX — wrap and mount
            state = new ReactTestState({ subject });
            await this.#mount(state, wrapper);
            shouldCleanup = autoCleanup;
        }

        // Delegate to base pipeline
        let result;
        try {
            result = await super.start(state, baseConfig);
        } catch (err) {
            // Ensure cleanup even on validation errors
            if (shouldCleanup && state.container) {
                try {
                    const { cleanup } = await import("@testing-library/react");
                    cleanup();
                } catch { /* ignore cleanup failure */ }
            }
            throw err;
        }

        // Cleanup
        if (shouldCleanup) {
            try {
                const { cleanup } = await import("@testing-library/react");
                cleanup();
            } catch { /* ignore cleanup failure */ }
        }

        return result;
    }

    /**
     *
     * Private Methods
     *
     */

    // :: reactTestState, (* -> *)? -> PROMISE(VOID)
    // Mounts the component from state.subject via RTL render.
    // Populates state.screen, state.container, state.rerender, state.user.
    async #mount(state, wrapper) {
        if (typeof document === "undefined"
            || typeof window === "undefined"
            || typeof HTMLElement === "undefined") {
            throw new CTGTestError("INVALID_OPERATION",
                "DOM environment required — install jsdom or use Vitest with jsdom/happy-dom environment");
        }

        const element = state.subject;
        const rtl = await import("@testing-library/react");
        const opts = wrapper ? { wrapper } : {};
        const renderResult = rtl.render(element, opts);

        state.screen = rtl.within(renderResult.container);
        state.container = renderResult.container;
        state.rerender = renderResult.rerender;

        // user-event is optional
        try {
            const ue = await import("@testing-library/user-event");
            state.user = ue.default.setup();
        } catch {
            state.user = null;
        }
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: STRING -> ctgReactTest
    // Creates a new React test pipeline with the given label.
    static init(label) {
        return new this(label);
    }

    // :: JSX -> PROMISE(OBJECT)
    // Renders JSX through react-test-renderer and returns the JSON tree.
    // Fresh, isolated render — no internal state.
    static async toSnapshot(jsx) {
        const renderer = await import("react-test-renderer");
        return renderer.default.create(jsx).toJSON();
    }

    // :: JSX, JSX -> PROMISE([OBJECT])
    // Renders both JSX elements and returns an array of structural differences.
    // Returns empty array if trees match. Each diff has {path, expected, actual}.
    static async diffSnapshot(jsxA, jsxB) {
        const treeA = await CTGReactTest.toSnapshot(jsxA);
        const treeB = await CTGReactTest.toSnapshot(jsxB);
        const diffs = [];
        CTGReactTest.#diffTrees(treeA, treeB, "", diffs);
        return diffs;
    }

    // :: JSX, JSX -> PROMISE(BOOL)
    // Convenience over diffSnapshot. Returns true if no differences.
    static async compareSnapshot(jsxA, jsxB) {
        const diffs = await CTGReactTest.diffSnapshot(jsxA, jsxB);
        return diffs.length === 0;
    }

    // :: *, *, STRING, [OBJECT] -> VOID
    // Recursively diffs two react-test-renderer trees.
    static #diffTrees(a, b, path, diffs) {
        if (a == null && b == null) return;

        if (a == null || b == null) {
            diffs.push({ path: path || "(root)", expected: a, actual: b });
            return;
        }

        if (typeof a !== "object" || typeof b !== "object") {
            if (a !== b) {
                diffs.push({ path: path || "(root)", expected: a, actual: b });
            }
            return;
        }

        if (a.type !== b.type) {
            diffs.push({ path: path ? `${path}.type` : "type", expected: a.type, actual: b.type });
            return;
        }

        if (!isDeepStrictEqual(a.props, b.props)) {
            diffs.push({ path: path ? `${path}.props` : "props", expected: a.props, actual: b.props });
        }

        const childrenA = a.children || [];
        const childrenB = b.children || [];
        const maxLen = Math.max(childrenA.length, childrenB.length);
        for (let i = 0; i < maxLen; i++) {
            const childPath = path ? `${path}.children[${i}]` : `children[${i}]`;
            CTGReactTest.#diffTrees(
                i < childrenA.length ? childrenA[i] : null,
                i < childrenB.length ? childrenB[i] : null,
                childPath, diffs
            );
        }
    }
}
