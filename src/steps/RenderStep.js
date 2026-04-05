import CTGTestStep from "ctg-js-test/step"; // Abstract step base
import CTGTestError from "ctg-js-test/error"; // Typed errors

// Render step — mounts a React component via @testing-library/react
// and populates ReactTestState fields (screen, user, container, rerender).
export default class RenderStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, JSX|(VOID -> JSX), OBJECT? -> this
    // Creates a render step with a name, element (or function returning
    // element), and optional render options (e.g., wrapper).
    constructor(name, element, opts = {}) {
        super("render", name);
        this._element = element;
        this._opts = opts;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> JSX|(VOID -> JSX)
    // Returns the element or element factory.
    get element() { return this._element; }

    // GETTER :: VOID -> BOOL
    // Render steps produce result entries.
    get producesResult() { return true; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that name is non-empty and element is provided.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (this._element === undefined || this._element === null) {
            throw new CTGTestError("INVALID_STEP",
                "Render step requires an element");
        }
    }

    // :: reactTestState -> PROMISE(reactTestState)
    // Renders the element, populates state.screen, state.container,
    // state.rerender, and state.user. user-event is optional — state.user
    // is null if not installed.
    async execute(state) {
        // Check DOM globals
        if (typeof document === "undefined"
            || typeof window === "undefined"
            || typeof HTMLElement === "undefined") {
            throw new CTGTestError("INVALID_STEP",
                "DOM environment required — install jsdom or use Vitest with jsdom/happy-dom environment");
        }

        const element = typeof this._element === "function"
            ? this._element() : this._element;

        const rtl = await import("@testing-library/react");
        const renderResult = rtl.render(element, { wrapper: this._opts.wrapper });

        // Use within() for container-scoped queries instead of global screen.
        // Global screen is reset by cleanup() between tests.
        state.screen = rtl.within(renderResult.container);
        state.container = renderResult.container;
        state.rerender = renderResult.rerender;

        // user-event is optional
        try {
            const ue = await import("@testing-library/user-event");
            state.user = ue.default.setup(this._opts.user);
        } catch {
            state.user = null;
        }

        return state;
    }
}
