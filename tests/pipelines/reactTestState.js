// ReactTestState tests — §2 (v3)
//
// Validates ReactTestState extends CTGTestState with React-specific
// fields: screen, user, container, rerender, data, toHTML.

import CTGTestState from "ctg-js-test/state";
import ReactTestState from "../../src/ReactTestState.js";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ test, assert }) {

    // ── Inheritance ─────────────────────────────────────────────

    await test("state: extends CTGTestState", () => {
        const state = new ReactTestState();
        assert(state instanceof CTGTestState, "is CTGTestState");
        assert(state instanceof ReactTestState, "is ReactTestState");
    });

    // ── Default Fields ──────────────────────────────────────────

    await test("state: screen defaults to null", () => {
        const state = new ReactTestState();
        assert(state.screen === null, "screen is null");
    });

    await test("state: user defaults to null", () => {
        const state = new ReactTestState();
        assert(state.user === null, "user is null");
    });

    await test("state: container defaults to null", () => {
        const state = new ReactTestState();
        assert(state.container === null, "container is null");
    });

    await test("state: rerender defaults to null", () => {
        const state = new ReactTestState();
        assert(state.rerender === null, "rerender is null");
    });

    await test("state: data defaults to empty object", () => {
        const state = new ReactTestState();
        assert(typeof state.data === "object", "data is object");
        assert(Object.keys(state.data).length === 0, "data is empty");
    });

    // ── Inherited Fields ────────────────────────────────────────

    await test("state: inherits subject", () => {
        const state = new ReactTestState({ subject: 42 });
        assert(state.subject === 42, "subject set");
    });

    await test("state: inherits results", () => {
        const state = new ReactTestState();
        assert(Array.isArray(state.results), "results is array");
        assert(state.results.length === 0, "results empty");
    });

    await test("state: inherits config", () => {
        const state = new ReactTestState({ config: { haltOnFailure: true } });
        assert(state.config.haltOnFailure === true, "config set");
    });

    await test("state: inherits name", () => {
        const state = new ReactTestState({ name: "my test" });
        assert(state.name === "my test", "name set");
    });

    await test("state: inherits status aggregation", async () => {
        const CTGTestResult = (await import("ctg-js-test/result")).default;
        const state = new ReactTestState();
        state.results.push({ name: "a", status: CTGTestResult.STATUS.PASS });
        assert(state.status === CTGTestResult.STATUS.PASS, "status works");
    });

    // ── Field Mutation ──────────────────────────────────────────

    await test("state: fields are mutable", () => {
        const state = new ReactTestState();
        state.screen = { getByText: () => {} };
        state.user = { click: () => {} };
        state.container = document.createElement("div");
        state.rerender = () => {};
        assert(state.screen !== null, "screen set");
        assert(state.user !== null, "user set");
        assert(state.container !== null, "container set");
        assert(state.rerender !== null, "rerender set");
    });

    await test("state: data bag is mutable", () => {
        const state = new ReactTestState();
        state.data.result = { current: 42 };
        assert(state.data.result.current === 42, "data.result set");
    });

    // ── toHTML ──────────────────────────────────────────────────

    await test("state: toHTML returns container innerHTML", () => {
        const state = new ReactTestState();
        const div = document.createElement("div");
        div.innerHTML = "<span>hello</span>";
        state.container = div;
        assert(state.toHTML() === "<span>hello</span>", "toHTML returns innerHTML");
    });

    await test("state: toHTML returns empty string when container is null", () => {
        const state = new ReactTestState();
        assert(state.toHTML() === "", "toHTML returns empty string");
    });
}
