// renderHook tests — custom hook rendering and result threading

import CTGTest from "../../../ctg-js-test/src/CTGTest.js";
import CTGReactTest from "../../src/CTGReactTest.js";
import { useCounter } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
// Runs all renderHook tests.
export default async function run({ config }) {

    await CTGTest.init("renderHook: captures hook return value")
        .stage("execute", async () => {
            const r = await CTGReactTest.init("hook test")
                .renderHook("mount", () => useCounter(0))
                .assert("initial count", (ctx) => ctx.data.result.current.count, 0)
                .assert("has increment", (ctx) => typeof ctx.data.result.current.increment, "function")
                .start(null, { output: "return-json", timeout: 0 });
            return r;
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);

    await CTGTest.init("renderHook: result.current updates after act")
        .stage("execute", async () => {
            const { act } = await import("@testing-library/react");
            const r = await CTGReactTest.init("hook mutation")
                .renderHook("mount", () => useCounter(10))
                .assert("initial", (ctx) => ctx.data.result.current.count, 10)
                .stage("increment", async (ctx) => {
                    await act(() => { ctx.data.result.current.increment(); });
                    return ctx;
                })
                .assert("after increment", (ctx) => ctx.data.result.current.count, 11)
                .start(null, { output: "return-json", timeout: 0 });
            return r;
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);
}
