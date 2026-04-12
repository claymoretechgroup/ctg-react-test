import CTGTestState from "ctg-js-test/state"; // Base pipeline state
import CTGTestError from "ctg-js-test/error"; // Typed errors

// React testing state extending CTGTestState.
// Carries the React testing surface: screen, user, container, rerender.
// Populated by CTGReactTest.start() during the mount phase.
export default class ReactTestState extends CTGTestState {

    // CONSTRUCTOR :: { subject: *, label: STRING }? -> this
    // Creates state with React-specific fields defaulting to null.
    constructor(opts = {}) {
        super(opts);
        this.screen = null;
        this.user = null;
        this.container = null;
        this.rerender = null;
        this.data = {};
    }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> STRING
    // Returns the rendered HTML from the mounted component's container.
    // Throws INVALID_OPERATION if container is null.
    toHTML() {
        if (this.container === null) {
            throw new CTGTestError("INVALID_OPERATION",
                "Cannot call toHTML() — container is null (component not mounted or already cleaned up)");
        }
        return this.container.innerHTML;
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: STRING, * -> reactTestState
    // Creates a new React test state with the given label and subject.
    static init(label, subject) {
        return new this({ subject, label });
    }
}
