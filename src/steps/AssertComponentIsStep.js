import CTGTestStep from "ctg-js-test/step"; // Abstract step base
import CTGTestError from "ctg-js-test/error"; // Typed errors
import CTGTestResult from "ctg-js-test/result"; // Status enum

// AssertComponentIs step — compares the current component's rendered HTML
// against a STRING or a ReactTestState (calling toHTML automatically).
// No error handler.
export default class AssertComponentIsStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, STRING|reactTestState -> this
    // Creates an assertComponentIs step with a name and expected value.
    constructor(name, expected) {
        super("assert", name);
        this._expected = expected;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> STRING|reactTestState
    // Returns the expected value.
    get expected() { return this._expected; }

    // GETTER :: VOID -> BOOL
    // AssertComponentIs steps produce result entries.
    get producesResult() { return true; }

    // GETTER :: VOID -> OBJECT|NULL
    // Expected outcome is resolved at execution time since ReactTestState
    // needs toHTML() called. Returns null before execution.
    get expectedOutcome() {
        if (this._resolvedExpected !== undefined) {
            return { type: "value", expected: this._resolvedExpected };
        }
        return null;
    }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that name is non-empty and expected is provided.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (this._expected === undefined || this._expected === null) {
            throw new CTGTestError("INVALID_STEP",
                "AssertComponentIs requires an expected value (STRING or ReactTestState)");
        }
    }

    // :: reactTestState -> PROMISE(reactTestState)
    // Compares the current component's HTML against the expected value.
    // If expected is a ReactTestState, calls toHTML() on it.
    // Sets state.actual to current HTML for pipeline comparison.
    async execute(state) {
        try {
            const actual = state.container ? state.container.innerHTML : "";

            let expected;
            if (typeof this._expected === "string") {
                expected = this._expected;
            } else if (this._expected && typeof this._expected.toHTML === "function") {
                expected = this._expected.toHTML();
            } else {
                throw new CTGTestError("INVALID_STEP",
                    "AssertComponentIs expected must be a STRING or ReactTestState");
            }

            this._resolvedExpected = expected;
            state.actual = actual;
            return state;
        } catch (err) {
            state._lastStepStatus = CTGTestResult.STATUS.ERROR;
            state._lastStepMessage = err.message;
            return state;
        }
    }
}
