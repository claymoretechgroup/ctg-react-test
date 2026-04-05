import CTGTestStep from "ctg-js-test/step"; // Abstract step base
import CTGTestError from "ctg-js-test/error"; // Typed errors
import CTGTestResult from "ctg-js-test/result"; // Status enum

// AssertComponent step — queries the rendered DOM via screen and compares
// the result to an expected value. Callback receives screen, returns *.
// No error handler.
export default class AssertComponentStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, (screen -> *), * -> this
    // Creates an assertComponent step with a name, query callback, and expected value.
    constructor(name, fn, expected) {
        super("assert", name);
        this._fn = fn;
        this._expected = expected;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> (screen -> *)
    // Returns the query callback.
    get fn() { return this._fn; }

    // GETTER :: VOID -> *
    // Returns the expected value for comparison.
    get expected() { return this._expected; }

    // GETTER :: VOID -> BOOL
    // AssertComponent steps produce result entries.
    get producesResult() { return true; }

    // GETTER :: VOID -> OBJECT
    // Declares value comparison outcome for the pipeline.
    get expectedOutcome() { return { type: "value", expected: this._expected }; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that fn is callable, name is non-empty, and expected is not a function.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (typeof this._fn !== "function") {
            throw new CTGTestError("INVALID_STEP",
                `Step fn must be a function, got ${typeof this._fn}`);
        }
        if (typeof this._expected === "function") {
            throw new CTGTestError("INVALID_EXPECTED",
                "AssertComponent expected must not be a function");
        }
    }

    // :: reactTestState -> PROMISE(reactTestState)
    // Calls the query callback with screen and sets state.actual to the
    // return value for pipeline comparison.
    // NOTE: Handler mutates state as a side effect to store the result of
    // the handler for the pipeline to compare against in order to support
    // async operations.
    async execute(state) {
        try {
            const actual = await this._fn(state.screen);
            state.actual = actual;
            return state;
        } catch (err) {
            state._lastStepStatus = CTGTestResult.STATUS.ERROR;
            state._lastStepMessage = err.message;
            return state;
        }
    }
}
