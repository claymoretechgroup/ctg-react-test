import CTGTestState from "ctg-js-test/state"; // Base pipeline state

// React testing state extending CTGTestState.
// Carries the React testing surface: screen, user, container, rerender.
// Populated by the render or renderHook step.
export default class ReactTestState extends CTGTestState {

    // CONSTRUCTOR :: {subject:*, config:OBJECT, name:STRING}? -> this
    // Creates state with React-specific fields defaulting to null.
    constructor(opts = {}) {
        super(opts);
        this.screen = null;
        this.user = null;
        this.container = null;
        this.rerender = null;
        this.data = {};
    }
}
