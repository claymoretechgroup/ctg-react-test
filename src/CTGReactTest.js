import CTGTest from "ctg-js-test"; // Base pipeline engine
import CTGTestError from "ctg-js-test/error"; // Typed errors
import ReactTestState from "./ReactTestState.js"; // React state
import RenderStep from "./steps/RenderStep.js"; // Render step type
import InteractStep from "./steps/InteractStep.js"; // Interact step type
import RenderHookStep from "./steps/RenderHookStep.js"; // RenderHook step type
import AssertSnapshotStep from "./steps/AssertSnapshotStep.js"; // Snapshot step type
import ReactChainStep from "./steps/ReactChainStep.js"; // React-aware chain step

// Composable pipeline-based test framework for React, extending ctg-js-test.
// Adds render, interact, assertSnapshot, renderHook step types.
export default class CTGReactTest extends CTGTest {

    /* Static Fields */

    static VALID_CONFIG_KEYS = [
        ...CTGTest.VALID_CONFIG_KEYS,
        "snapshotFilePath", "snapshotFileUrl", "updateSnapshots",
        "createBaselines", "maxSnapshotBytes"
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

    // :: STRING, JSX|(VOID -> JSX), OBJECT? -> this
    // Adds a render step. Mounts a React component and populates
    // state.screen, state.container, state.rerender, state.user. Chainable.
    render(name, element, opts = {}) {
        this._steps.push(new RenderStep(name, element, opts));
        return this;
    }

    // :: STRING, (reactTestState -> reactTestState), (Error -> *)? -> this
    // Adds an interact step. Executes a user interaction callback.
    // Requires state.user (user-event). Chainable.
    interact(name, fn, errorHandler = null) {
        this._steps.push(new InteractStep(name, fn, errorHandler));
        return this;
    }

    // :: STRING, JSX|(VOID -> JSX), OBJECT? -> this
    // Adds an assertSnapshot step. Renders via react-test-renderer and
    // compares the component tree against a stored JSON baseline. Chainable.
    assertSnapshot(name, element, opts = {}) {
        this._steps.push(new AssertSnapshotStep(name, element, opts));
        return this;
    }

    // :: STRING, (VOID -> *), OBJECT? -> this
    // Adds a renderHook step. Renders a hook in isolation and populates
    // state.data.result with the hook return value. Chainable.
    renderHook(name, hookFn, opts = {}) {
        this._steps.push(new RenderHookStep(name, hookFn, opts));
        return this;
    }

    // :: STRING, ctgTest -> this
    // Overrides CTGTest.chain to use ReactChainStep. Clones React state
    // (screen, container, user, rerender) into the inner pipeline so
    // chained pipelines see the rendered component. Chainable.
    chain(name, pipeline) {
        this._steps.push(new ReactChainStep(name, pipeline));
        return this;
    }

    // :: reactTestState|*, OBJECT? -> PROMISE(reactTestState)
    // Executes the pipeline. Wraps the subject in ReactTestState if
    // not already one. Validates React-specific config keys. Returns
    // ReactTestState. The caller owns cleanup and formatting.
    async start(subject, config = {}) {
        // Wrap in ReactTestState if needed
        if (!(subject instanceof ReactTestState)) {
            subject = new ReactTestState({
                subject,
                config,
                name: this._name
            });
        }

        // Delegate to parent with full config — _validateConfig is
        // overridden to accept React-specific keys
        return await super.start(subject, config);
    }

    /**
     *
     * Private Methods
     *
     */

    // :: OBJECT -> VOID
    // Overrides parent to accept React-specific config keys.
    // Validates React keys, then strips them before delegating to parent.
    _validateConfig(config) {
        if (config.snapshotFilePath !== undefined && config.snapshotFilePath !== null
            && typeof config.snapshotFilePath !== "string") {
            throw new CTGTestError("INVALID_CONFIG", "snapshotFilePath must be a string");
        }
        if (config.snapshotFileUrl !== undefined && config.snapshotFileUrl !== null
            && typeof config.snapshotFileUrl !== "string") {
            throw new CTGTestError("INVALID_CONFIG", "snapshotFileUrl must be a string");
        }
        if (config.updateSnapshots !== undefined && typeof config.updateSnapshots !== "boolean") {
            throw new CTGTestError("INVALID_CONFIG", "updateSnapshots must be a boolean");
        }
        if (config.createBaselines !== undefined && typeof config.createBaselines !== "boolean") {
            throw new CTGTestError("INVALID_CONFIG", "createBaselines must be a boolean");
        }
        if (config.maxSnapshotBytes !== undefined && config.maxSnapshotBytes !== null) {
            if (typeof config.maxSnapshotBytes !== "number"
                || !Number.isFinite(config.maxSnapshotBytes)
                || config.maxSnapshotBytes <= 0
                || config.maxSnapshotBytes !== Math.trunc(config.maxSnapshotBytes)) {
                throw new CTGTestError("INVALID_CONFIG", "maxSnapshotBytes must be a positive integer");
            }
        }

        // Strip React keys before delegating to parent validation
        const parentConfig = { ...config };
        delete parentConfig.snapshotFilePath;
        delete parentConfig.snapshotFileUrl;
        delete parentConfig.updateSnapshots;
        delete parentConfig.createBaselines;
        delete parentConfig.maxSnapshotBytes;
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
}
