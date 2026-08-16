import { describe, it, expect } from "vitest";
import ReactTestState from "../src/ReactTestState.js";
import { CTGTestError, CTGTestState } from "ctg-js-test";

// --- 1. Constructor defaults ---

describe("Constructor defaults", () => {

    it("screen defaults to null", () => {
        const state = new ReactTestState();
        expect(state.screen).toBe(null);
    });

    it("user defaults to null", () => {
        const state = new ReactTestState();
        expect(state.user).toBe(null);
    });

    it("container defaults to null", () => {
        const state = new ReactTestState();
        expect(state.container).toBe(null);
    });

    it("rerender defaults to null", () => {
        const state = new ReactTestState();
        expect(state.rerender).toBe(null);
    });

    it("data defaults to empty object", () => {
        const state = new ReactTestState();
        expect(state.data).toEqual({});
    });

    it("subject defaults to undefined when no args", () => {
        const state = new ReactTestState();
        expect(state.subject).toBe(undefined);
    });

    it("label defaults to empty string when no args", () => {
        const state = new ReactTestState();
        expect(state.label).toBe("");
    });

    it("results defaults to empty array", () => {
        const state = new ReactTestState();
        expect(state.results).toEqual([]);
    });

    it("computed defaults to undefined", () => {
        const state = new ReactTestState();
        expect(state.computed).toBeUndefined();
    });

});

// --- 2. Constructor with subject and label ---

describe("Constructor with subject and label", () => {

    it("stores subject from constructor arg", () => {
        const subject = <div>test</div>;
        const state = new ReactTestState({ subject });
        expect(state.subject).toBe(subject);
    });

    it("stores label from constructor arg", () => {
        const state = new ReactTestState({ label: "my test" });
        expect(state.label).toBe("my test");
    });

    it("stores both subject and label", () => {
        const subject = <span>hello</span>;
        const state = new ReactTestState({ subject, label: "greeting" });
        expect(state.subject).toBe(subject);
        expect(state.label).toBe("greeting");
    });

    it("React fields remain at defaults when subject and label provided", () => {
        const state = new ReactTestState({ subject: "x", label: "y" });
        expect(state.screen).toBe(null);
        expect(state.user).toBe(null);
        expect(state.container).toBe(null);
        expect(state.rerender).toBe(null);
        expect(state.data).toEqual({});
    });

});

// --- 3. Inherited properties ---

describe("Inherited properties", () => {

    it("label getter returns assigned label", () => {
        const state = new ReactTestState({ label: "inherited" });
        expect(state.label).toBe("inherited");
    });

    it("label setter updates label", () => {
        const state = new ReactTestState();
        state.label = "updated";
        expect(state.label).toBe("updated");
    });

    it("subject getter returns assigned subject", () => {
        const state = new ReactTestState({ subject: 42 });
        expect(state.subject).toBe(42);
    });

    it("subject setter updates subject", () => {
        const state = new ReactTestState();
        state.subject = "new subject";
        expect(state.subject).toBe("new subject");
    });

    it("computed getter returns undefined initially", () => {
        const state = new ReactTestState();
        expect(state.computed).toBeUndefined();
    });

    it("computed setter updates computed", () => {
        const state = new ReactTestState();
        state.computed = "result";
        expect(state.computed).toBe("result");
    });

    it("results getter returns array", () => {
        const state = new ReactTestState();
        expect(Array.isArray(state.results)).toBe(true);
    });

    it("status getter returns aggregate from results", () => {
        const state = new ReactTestState();
        // Empty results should produce an aggregate status
        expect(typeof state.status).toBe("number");
    });

});

// --- 4. React field assignment ---

describe("React field assignment", () => {

    it("screen can be assigned and read back", () => {
        const state = new ReactTestState();
        const mockScreen = { getByText: () => {} };
        state.screen = mockScreen;
        expect(state.screen).toBe(mockScreen);
    });

    it("user can be assigned and read back", () => {
        const state = new ReactTestState();
        const mockUser = { click: () => {} };
        state.user = mockUser;
        expect(state.user).toBe(mockUser);
    });

    it("container can be assigned and read back", () => {
        const state = new ReactTestState();
        const el = document.createElement("div");
        state.container = el;
        expect(state.container).toBe(el);
    });

    it("rerender can be assigned and read back", () => {
        const state = new ReactTestState();
        const fn = () => {};
        state.rerender = fn;
        expect(state.rerender).toBe(fn);
    });

    it("data can be assigned and read back", () => {
        const state = new ReactTestState();
        state.data = { key: "value" };
        expect(state.data).toEqual({ key: "value" });
    });

    it("data can be mutated in place without null checks", () => {
        const state = new ReactTestState();
        state.data.foo = "bar";
        expect(state.data.foo).toBe("bar");
    });

});

// --- 5. toHTML() returns innerHTML when container is populated ---

describe("toHTML() with populated container", () => {

    it("returns container innerHTML", () => {
        const state = new ReactTestState();
        const el = document.createElement("div");
        el.innerHTML = "<h1>Hello, World!</h1>";
        state.container = el;
        expect(state.toHTML()).toBe("<h1>Hello, World!</h1>");
    });

    it("returns empty string innerHTML from empty container", () => {
        const state = new ReactTestState();
        const el = document.createElement("div");
        state.container = el;
        expect(state.toHTML()).toBe("");
    });

    it("reflects updated innerHTML after DOM mutation", () => {
        const state = new ReactTestState();
        const el = document.createElement("div");
        el.innerHTML = "<p>before</p>";
        state.container = el;
        expect(state.toHTML()).toBe("<p>before</p>");
        el.innerHTML = "<p>after</p>";
        expect(state.toHTML()).toBe("<p>after</p>");
    });

});

// --- 6. toHTML() throws INVALID_OPERATION when container is null ---

describe("toHTML() throws when container is null", () => {

    it("throws CTGTestError when container is null", () => {
        const state = new ReactTestState();
        expect(() => state.toHTML()).toThrow(CTGTestError);
    });

    it("thrown error has INVALID_OPERATION type", () => {
        const state = new ReactTestState();
        try {
            state.toHTML();
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.type).toBe("INVALID_OPERATION");
        }
    });

    it("thrown error has code 1000", () => {
        const state = new ReactTestState();
        try {
            state.toHTML();
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.code).toBe(1000);
        }
    });

});

// --- 7. init() static factory ---

describe("init() static factory", () => {

    it("returns a ReactTestState instance", () => {
        const state = ReactTestState.init("test label", <div />);
        expect(state).toBeInstanceOf(ReactTestState);
    });

    it("sets label from first argument", () => {
        const state = ReactTestState.init("my label", null);
        expect(state.label).toBe("my label");
    });

    it("sets subject from second argument", () => {
        const subject = <span>hello</span>;
        const state = ReactTestState.init("label", subject);
        expect(state.subject).toBe(subject);
    });

    it("React fields default to null and empty object", () => {
        const state = ReactTestState.init("label", "subject");
        expect(state.screen).toBe(null);
        expect(state.user).toBe(null);
        expect(state.container).toBe(null);
        expect(state.rerender).toBe(null);
        expect(state.data).toEqual({});
    });

});

// --- 8. instanceof CTGTestState ---

describe("instanceof CTGTestState", () => {

    it("ReactTestState instance is instanceof CTGTestState", () => {
        const state = new ReactTestState();
        expect(state).toBeInstanceOf(CTGTestState);
    });

    it("init result is instanceof CTGTestState", () => {
        const state = ReactTestState.init("label", null);
        expect(state).toBeInstanceOf(CTGTestState);
    });

});

// --- 9. Subclass of CTGTestState preserves base behavior ---

describe("Subclass preserves base behavior", () => {

    it("prototype chain includes CTGTestState", () => {
        expect(Object.getPrototypeOf(ReactTestState.prototype)).toBe(CTGTestState.prototype);
    });

    it("results accumulate normally via inherited interface", () => {
        const state = new ReactTestState();
        expect(state.results).toEqual([]);
        // Results array is writable per base state contract
        state.results.push({ label: "test", status: 0 });
        expect(state.results).toHaveLength(1);
    });

    it("status reflects results from inherited getter", () => {
        const stateA = new ReactTestState();
        const stateB = new ReactTestState();
        // Both start with same default status
        expect(stateA.status).toBe(stateB.status);
    });

    it("subject set on base is visible on React state", () => {
        const state = new ReactTestState({ subject: "base value" });
        expect(state.subject).toBe("base value");
    });

    it("data does not interfere with inherited fields", () => {
        const state = new ReactTestState({ subject: "test", label: "label" });
        state.data.extra = true;
        expect(state.subject).toBe("test");
        expect(state.label).toBe("label");
        expect(state.data.extra).toBe(true);
    });

});
