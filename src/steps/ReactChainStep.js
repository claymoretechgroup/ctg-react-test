import CTGTestStep from "ctg-js-test/step"; // Abstract step base
import CTGTestError from "ctg-js-test/error"; // Typed errors
import CTGTest from "ctg-js-test"; // Pipeline class for instanceof check
import ReactTestState from "../ReactTestState.js"; // React state for cloning

// React chain step — overrides CTGTest's ChainStep to preserve React
// testing state (screen, container, user, rerender) across chained pipelines.
// Clones the outer state so the inner pipeline sees the rendered component
// but has its own results array and name.
export default class ReactChainStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, ctgTest -> this
    // Creates a chain step with a name and a pipeline to inline.
    constructor(name, pipeline) {
        super("chain", name);
        this._pipeline = pipeline;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> ctgTest
    // Returns the chained pipeline instance.
    get pipeline() { return this._pipeline; }

    // GETTER :: VOID -> BOOL
    // Chain steps produce result entries.
    get producesResult() { return true; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that the target is a CTGTest instance and name is non-empty.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (!(this._pipeline instanceof CTGTest)) {
            throw new CTGTestError("INVALID_CHAIN",
                "Chain target must be a CTGTest instance");
        }
    }

    // :: reactTestState -> PROMISE(reactTestState)
    // Clones the outer state into a new ReactTestState with shared React
    // fields. Runs the inner pipeline with the clone. Updates outer subject
    // and sets _chainResult for the pipeline to record.
    async execute(state) {
        // Clone state — own results/name, shared React fields
        const innerState = new ReactTestState({
            subject: state.subject,
            config: state.config,
            name: state.name
        });
        innerState.screen = state.screen;
        innerState.container = state.container;
        innerState.user = state.user;
        innerState.rerender = state.rerender;
        innerState.data = state.data;

        // Run inner pipeline with cloned state
        const resultState = await this._pipeline.start(innerState, state.config);

        // Update outer subject from inner's final subject
        state.subject = resultState.subject;

        // Signal chain result to pipeline
        state._chainResult = {
            name: this._name,
            steps: resultState.results,
            status: resultState.status
        };

        return state;
    }
}
