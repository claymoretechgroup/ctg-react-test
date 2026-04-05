import CTGTestStep from "ctg-js-test/step"; // Abstract step base
import CTGTestError from "ctg-js-test/error"; // Typed errors
import CTGTestResult from "ctg-js-test/result"; // Status enum
import ReactTestState from "../ReactTestState.js"; // State type check

// Interact step — executes a user interaction callback against state.
// Requires state.user (user-event) to be available.
export default class InteractStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, (reactTestState -> reactTestState), (Error -> *)? -> this
    // Creates an interact step with a name, callback, and optional error handler.
    constructor(name, fn, errorHandler = null) {
        super("interact", name, { errorHandler });
        this._fn = fn;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> (reactTestState -> reactTestState)
    // Returns the interaction callback.
    get fn() { return this._fn; }

    // GETTER :: VOID -> BOOL
    // Interact steps produce result entries.
    get producesResult() { return true; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that fn is callable and name is non-empty.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (typeof this._fn !== "function") {
            throw new CTGTestError("INVALID_STEP",
                `Step fn must be a function, got ${typeof this._fn}`);
        }
    }

    // :: reactTestState -> PROMISE(reactTestState)
    // Validates user-event is available, calls the callback with state.
    // Callback must return ReactTestState.
    async execute(state) {
        if (state.user === null) {
            throw new CTGTestError("INVALID_STEP",
                "user-event is required for interact() — install @testing-library/user-event");
        }

        try {
            const result = await this._fn(state);
            if (!(result instanceof ReactTestState)) {
                throw new CTGTestError("INVALID_STEP",
                    "Interact callback must return ReactTestState");
            }
            return result;
        } catch (err) {
            if (this._errorHandler) {
                try {
                    await this._errorHandler(err);
                    state._lastStepStatus = CTGTestResult.STATUS.RECOVERED;
                    return state;
                } catch (handlerErr) {
                    state._lastStepStatus = CTGTestResult.STATUS.ERROR;
                    state._lastStepMessage = handlerErr.message;
                    return state;
                }
            }
            state._lastStepStatus = CTGTestResult.STATUS.ERROR;
            state._lastStepMessage = err.message;
            return state;
        }
    }
}
