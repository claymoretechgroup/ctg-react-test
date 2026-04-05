import CTGTestStep from "ctg-js-test/step"; // Abstract step base
import CTGTestError from "ctg-js-test/error"; // Typed errors

// RenderHook step — renders a React hook in isolation via
// @testing-library/react's renderHook and populates state fields.
export default class RenderHookStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, (VOID -> *), OBJECT? -> this
    // Creates a renderHook step with a name, hook function, and
    // optional options (e.g., wrapper).
    constructor(name, hookFn, opts = {}) {
        super("renderHook", name);
        this._hookFn = hookFn;
        this._opts = opts;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> (VOID -> *)
    // Returns the hook function.
    get hookFn() { return this._hookFn; }

    // GETTER :: VOID -> BOOL
    // RenderHook steps produce result entries.
    get producesResult() { return true; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that hookFn is callable and name is non-empty.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (typeof this._hookFn !== "function") {
            throw new CTGTestError("INVALID_STEP",
                `Step fn must be a function, got ${typeof this._hookFn}`);
        }
    }

    // :: reactTestState -> PROMISE(reactTestState)
    // Renders the hook, populates state.screen, state.container,
    // state.rerender, state.user, and state.data.result.
    async execute(state) {
        // Check DOM globals
        if (typeof document === "undefined"
            || typeof window === "undefined"
            || typeof HTMLElement === "undefined") {
            throw new CTGTestError("INVALID_STEP",
                "DOM environment required — install jsdom or use Vitest with jsdom/happy-dom environment");
        }

        const rtl = await import("@testing-library/react");
        const hookResult = rtl.renderHook(this._hookFn, { wrapper: this._opts.wrapper });

        state.screen = rtl.within(document.body);
        state.container = document.body;
        state.rerender = hookResult.rerender;
        state.user = null;
        state.data.result = hookResult.result;

        return state;
    }
}
