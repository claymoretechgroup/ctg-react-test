import { isDeepStrictEqual } from "node:util"; // For snapshot comparison
import CTGTest from "ctg-js-test"; // Base pipeline engine
import CTGTestError from "ctg-js-test/error"; // Typed errors
import ReactTestState from "./ReactTestState.js"; // React state
import InteractStep from "./steps/InteractStep.js"; // Interact step type
import AssertComponentStep from "./steps/AssertComponentStep.js"; // AssertComponent step type
import AssertComponentIsStep from "./steps/AssertComponentIsStep.js"; // AssertComponentIs step type
import ReactChainStep from "./steps/ReactChainStep.js"; // React-aware chain step

// Composable pipeline-based test framework for React components.
// The component is the subject — passed to start(), mounted implicitly.
// Pipeline steps: interact, assertComponent, assertComponentIs.
export default class CTGReactTest extends CTGTest {

    /* Static Fields */

    static VALID_CONFIG_KEYS = [
        ...CTGTest.VALID_CONFIG_KEYS,
        "wrapper", "autoCleanup"
    ];

    // CONSTRUCTOR :: STRING -> this
    // Creates a new React test pipeline with the given name.
    constructor(name) {
        super(name);
    }

    /**
     *
     * Instance Methods
     *
     */

    // :: STRING, ({screen, user}) -> VOID -> this
    // Adds an interact step. The callback receives {screen, user} from
    // the testing surface and dispatches events. VOID return. Chainable.
    interact(name, fn) {
        this._steps.push(new InteractStep(name, fn));
        return this;
    }

    // :: STRING, (screen -> *), * -> this
    // Adds an assertComponent step. The callback queries the DOM via screen
    // and returns a value. The pipeline compares it to expected. Chainable.
    assertComponent(name, fn, expected) {
        this._steps.push(new AssertComponentStep(name, fn, expected));
        return this;
    }

    // :: STRING, STRING|reactTestState -> this
    // Adds an assertComponentIs step. Compares the current component's
    // rendered HTML against a STRING or a ReactTestState (calls toHTML
    // automatically). Chainable.
    assertComponentIs(name, expected) {
        this._steps.push(new AssertComponentIsStep(name, expected));
        return this;
    }

    // :: STRING, ctgTest -> this
    // Overrides CTGTest.chain to use ReactChainStep. Shares the testing
    // surface (screen, user, container, rerender) with the inner pipeline.
    // Chainable.
    chain(name, pipeline) {
        this._steps.push(new ReactChainStep(name, pipeline));
        return this;
    }

    // :: JSX|reactTestState, OBJECT? -> PROMISE(reactTestState)
    // Receives a JSX element or ReactTestState. If JSX, wraps in
    // ReactTestState and mounts via @testing-library/react. If
    // ReactTestState (from chain), skips mounting — testing surface
    // is already populated. Runs cleanup after unless autoCleanup: false.
    async start(subject, config = {}) {
        // Extract React-specific config before pipeline validation
        const wrapper = config.wrapper || null;
        const autoCleanup = config.autoCleanup !== false;

        let state;
        if (subject instanceof ReactTestState) {
            // Already mounted — chain is passing in a cloned state
            state = subject;
        } else {
            // Fresh JSX — wrap and mount
            state = new ReactTestState({
                subject,
                config,
                name: this._name
            });
            await this._mount(state, wrapper);
        }

        // Delegate to parent pipeline for step execution
        const result = await super.start(state, this._stripReactConfig(config));

        // Cleanup unless opted out or chained (chained states don't own cleanup)
        if (autoCleanup && !(subject instanceof ReactTestState)) {
            try {
                const { cleanup } = await import("@testing-library/react");
                cleanup();
            } catch {
                // cleanup may fail if RTL not loaded — ignore
            }
        }

        return result;
    }

    /**
     *
     * Private Methods
     *
     */

    // :: reactTestState, FUNCTION? -> PROMISE(VOID)
    // Mounts the component from state.subject via RTL render.
    // Populates state.screen, state.container, state.rerender, state.user.
    async _mount(state, wrapper) {
        if (typeof document === "undefined"
            || typeof window === "undefined"
            || typeof HTMLElement === "undefined") {
            throw new CTGTestError("INVALID_STEP",
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

    // :: OBJECT -> OBJECT
    // Strips React-specific config keys before passing to parent validation.
    _stripReactConfig(config) {
        const parentConfig = { ...config };
        delete parentConfig.wrapper;
        delete parentConfig.autoCleanup;
        return parentConfig;
    }

    // :: OBJECT -> VOID
    // Overrides parent to accept React-specific config keys.
    _validateConfig(config) {
        if (config.wrapper !== undefined && config.wrapper !== null
            && typeof config.wrapper !== "function") {
            throw new CTGTestError("INVALID_CONFIG", "wrapper must be a React component");
        }
        if (config.autoCleanup !== undefined && typeof config.autoCleanup !== "boolean") {
            throw new CTGTestError("INVALID_CONFIG", "autoCleanup must be a boolean");
        }

        // Strip React keys before delegating to parent
        const parentConfig = this._stripReactConfig(config);
        super._validateConfig(parentConfig);
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: STRING -> ctgReactTest
    // Creates a new React test pipeline with the given name.
    static init(name) {
        return new this(name);
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
        CTGReactTest._diffTrees(treeA, treeB, "", diffs);
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
    static _diffTrees(a, b, path, diffs) {
        // Both null/undefined
        if (a == null && b == null) return;

        // One null, other not
        if (a == null || b == null) {
            diffs.push({ path: path || "(root)", expected: a, actual: b });
            return;
        }

        // Primitives (text nodes)
        if (typeof a !== "object" || typeof b !== "object") {
            if (a !== b) {
                diffs.push({ path: path || "(root)", expected: a, actual: b });
            }
            return;
        }

        // Type mismatch
        if (a.type !== b.type) {
            diffs.push({ path: path ? `${path}.type` : "type", expected: a.type, actual: b.type });
            return;
        }

        // Props diff
        if (!isDeepStrictEqual(a.props, b.props)) {
            diffs.push({ path: path ? `${path}.props` : "props", expected: a.props, actual: b.props });
        }

        // Children diff
        const childrenA = a.children || [];
        const childrenB = b.children || [];
        const maxLen = Math.max(childrenA.length, childrenB.length);
        for (let i = 0; i < maxLen; i++) {
            const childPath = path ? `${path}.children[${i}]` : `children[${i}]`;
            CTGReactTest._diffTrees(
                i < childrenA.length ? childrenA[i] : null,
                i < childrenB.length ? childrenB[i] : null,
                childPath, diffs
            );
        }
    }
}
