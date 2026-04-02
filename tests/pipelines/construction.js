// CTGReactTest construction, inheritance, and step registration tests

import CTGTest from "../../../ctg-js-test/src/CTGTest.js";
import CTGReactTest from "../../src/CTGReactTest.js";

// :: OBJECT -> PROMISE(VOID)
// Runs all construction and step registration tests.
export default async function run({ config }) {

    await CTGTest.init("CTGReactTest: init returns correct instances")
        .stage("create", () => CTGReactTest.init("test"))
        .assert("is CTGReactTest", (t) => t instanceof CTGReactTest, true)
        .assert("is CTGTest", (t) => t instanceof CTGTest, true)
        .assert("name preserved", (t) => t.name, "test")
        .start(null, config);

    await CTGTest.init("CTGReactTest: inherits core step methods")
        .stage("create", () => CTGReactTest.init("check"))
        .assert("stage", (t) => typeof t.stage, "function")
        .assert("assert", (t) => typeof t.assert, "function")
        .assert("assertAny", (t) => typeof t.assertAny, "function")
        .assert("chain", (t) => typeof t.chain, "function")
        .assert("skip", (t) => typeof t.skip, "function")
        .assert("start", (t) => typeof t.start, "function")
        .start(null, config);

    await CTGTest.init("CTGReactTest: render adds render step")
        .stage("create", () => CTGReactTest.init("t").render("mount", () => null).steps[0])
        .assert("type", (s) => s.type, "render")
        .assert("name", (s) => s.name, "mount")
        .start(null, config);

    await CTGTest.init("CTGReactTest: interact adds interact step")
        .stage("create", () => CTGReactTest.init("t").interact("click", () => {}).steps[0])
        .assert("type", (s) => s.type, "interact")
        .start(null, config);

    await CTGTest.init("CTGReactTest: snapshot adds snapshot step with sentinel")
        .stage("create", () => CTGReactTest.init("t").snapshot("capture").steps[0])
        .assert("type", (s) => s.type, "snapshot")
        .assert("sentinel", (s) => s.expected, "__snapshot__")
        .start(null, config);

    await CTGTest.init("CTGReactTest: renderHook adds renderHook step")
        .stage("create", () => CTGReactTest.init("t").renderHook("hook", () => {}).steps[0])
        .assert("type", (s) => s.type, "renderHook")
        .start(null, config);

    await CTGTest.init("CTGReactTest: all React methods return this")
        .stage("check", () => {
            const t = CTGReactTest.init("chain");
            return t.render("r", () => null) === t
                && t.interact("i", () => {}) === t
                && t.snapshot("s") === t
                && t.renderHook("h", () => {}) === t;
        })
        .assert("all chainable", (r) => r, true)
        .start(null, config);

    await CTGTest.init("CTGReactTest: STEP_TYPES includes all types")
        .assert("stage", () => CTGReactTest.STEP_TYPES.has("stage"), true)
        .assert("assert", () => CTGReactTest.STEP_TYPES.has("assert"), true)
        .assert("assert-any", () => CTGReactTest.STEP_TYPES.has("assert-any"), true)
        .assert("chain", () => CTGReactTest.STEP_TYPES.has("chain"), true)
        .assert("render", () => CTGReactTest.STEP_TYPES.has("render"), true)
        .assert("interact", () => CTGReactTest.STEP_TYPES.has("interact"), true)
        .assert("snapshot", () => CTGReactTest.STEP_TYPES.has("snapshot"), true)
        .assert("renderHook", () => CTGReactTest.STEP_TYPES.has("renderHook"), true)
        .start(null, config);
}
