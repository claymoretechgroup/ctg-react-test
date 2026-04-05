// Static snapshot method tests — §3 (v3)
//
// Validates toSnapshot, diffSnapshot, compareSnapshot static methods.

import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting, Counter } from "../components.jsx";

export default async function run({ test, assert }) {

    // ── toSnapshot ──────────────────────────────────────────────

    await test("toSnapshot: returns react-test-renderer JSON tree", () => {
        const tree = CTGReactTest.toSnapshot(<Greeting name="World" />);
        assert(tree !== null, "tree is not null");
        assert(tree.type === "h1", "root element type");
        assert(Array.isArray(tree.children), "has children");
        assert(tree.children.join("") === "Hello, World!", "content correct");
    });

    await test("toSnapshot: returns tree for complex component", () => {
        const tree = CTGReactTest.toSnapshot(<Counter />);
        assert(tree !== null, "tree is not null");
        assert(tree.type === "div", "root is div");
        assert(Array.isArray(tree.children), "has children");
    });

    await test("toSnapshot: fresh render has no internal state", () => {
        // Two snapshots of the same component should be identical
        const a = CTGReactTest.toSnapshot(<Counter initial={0} />);
        const b = CTGReactTest.toSnapshot(<Counter initial={0} />);
        assert(JSON.stringify(a) === JSON.stringify(b), "fresh renders are identical");
    });

    // ── compareSnapshot ─────────────────────────────────────────

    await test("compareSnapshot: returns true for identical components", () => {
        const match = CTGReactTest.compareSnapshot(
            <Greeting name="World" />,
            <Greeting name="World" />
        );
        assert(match === true, "identical components match");
    });

    await test("compareSnapshot: returns false for different props", () => {
        const match = CTGReactTest.compareSnapshot(
            <Greeting name="World" />,
            <Greeting name="Other" />
        );
        assert(match === false, "different props do not match");
    });

    await test("compareSnapshot: returns false for different components", () => {
        const match = CTGReactTest.compareSnapshot(
            <Greeting name="World" />,
            <Counter initial={0} />
        );
        assert(match === false, "different components do not match");
    });

    await test("compareSnapshot: built on diffSnapshot", () => {
        // compareSnapshot returns true when diffSnapshot returns empty array
        const diffs = CTGReactTest.diffSnapshot(
            <Greeting name="World" />,
            <Greeting name="World" />
        );
        const match = CTGReactTest.compareSnapshot(
            <Greeting name="World" />,
            <Greeting name="World" />
        );
        assert(diffs.length === 0, "no diffs");
        assert(match === true, "compare matches");
    });

    // ── diffSnapshot ────────────────────────────────────────────

    await test("diffSnapshot: returns empty array for identical components", () => {
        const diffs = CTGReactTest.diffSnapshot(
            <Greeting name="World" />,
            <Greeting name="World" />
        );
        assert(Array.isArray(diffs), "returns array");
        assert(diffs.length === 0, "no differences");
    });

    await test("diffSnapshot: returns differences for different props", () => {
        const diffs = CTGReactTest.diffSnapshot(
            <Greeting name="A" />,
            <Greeting name="B" />
        );
        assert(Array.isArray(diffs), "returns array");
        assert(diffs.length > 0, "has differences");
    });

    await test("diffSnapshot: diff entries have path, expected, actual", () => {
        const diffs = CTGReactTest.diffSnapshot(
            <Greeting name="A" />,
            <Greeting name="B" />
        );
        assert(diffs.length > 0, "has differences");
        const diff = diffs[0];
        assert("path" in diff, "has path");
        assert("expected" in diff, "has expected");
        assert("actual" in diff, "has actual");
    });

    await test("diffSnapshot: returns differences for different components", () => {
        const diffs = CTGReactTest.diffSnapshot(
            <Greeting name="World" />,
            <Counter initial={0} />
        );
        assert(diffs.length > 0, "different components have diffs");
    });
}
