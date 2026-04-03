// Value object wrapping a @testing-library/react render result for pipeline threading
export default class ReactContext {

    // CONSTRUCTOR :: OBJECT -> this
    // Wraps render result with screen, user event, container, rerender, and data bag.
    constructor({ screen, user, container, rerender, data = {} }) {
        this._screen = screen;
        this._user = user;
        this._container = container;
        this._rerender = rerender;
        this._data = data;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> OBJECT
    get screen() { return this._screen; }

    // GETTER :: VOID -> OBJECT|NULL
    get user() { return this._user; }

    // GETTER :: VOID -> HTMLElement
    get container() { return this._container; }

    // GETTER :: VOID -> (JSX -> VOID)
    get rerender() { return this._rerender; }

    // GETTER :: VOID -> OBJECT
    get data() { return this._data; }

    // SETTER :: OBJECT -> VOID
    set data(value) { this._data = value; }

    /**
     *
     * Instance Methods
     *
     */

    // :: STRING -> *
    // Shorthand for this.data[key]. Returns undefined if key not set.
    get(key) {
        return this._data[key];
    }

    // :: STRING, * -> this
    // Shorthand for this.data[key] = value. Chainable.
    set(key, value) {
        this._data[key] = value;
        return this;
    }
}
