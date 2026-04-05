import CTGTestStep from "ctg-js-test/step"; // Abstract step base
import CTGTestError from "ctg-js-test/error"; // Typed errors
import CTGTestResult from "ctg-js-test/result"; // Status enum

// Interact step — dispatches user events to the mounted component.
// Callback receives {screen, user}, returns VOID. No error handler.
export default class InteractStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, ({screen, user}) -> VOID -> this
    // Creates an interact step with a name and callback.
    constructor(name, fn) {
        super("interact", name);
        this._fn = fn;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> ({screen, user}) -> VOID
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
    // Validates user-event is available, calls the callback with {screen, user}.
    // Callback is VOID — return value is ignored. Errors set status on state.
    async execute(state) {
        if (state.user === null) {
            throw new CTGTestError("INVALID_STEP",
                "user-event is required for interact() — install @testing-library/user-event");
        }

        try {
            await this._fn({ screen: state.screen, user: state.user });
            return state;
        } catch (err) {
            state._lastStepStatus = CTGTestResult.STATUS.ERROR;
            state._lastStepMessage = err.message;
            return state;
        }
    }
}
