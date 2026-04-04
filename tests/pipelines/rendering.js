// Render real React components in standalone mode

import React from "react";
import CTGTest from "ctg-js-test";
import CTGReactTest from "../../src/CTGReactTest.js";
import { Greeting } from "../components.js";

// :: OBJECT -> PROMISE(VOID)
// Runs all component rendering tests.
export default async function run({ config }) {

    await CTGTest.init("render: mounts component and produces ReactContext")
        .stage("execute", async () => {
            const r = await CTGReactTest.init("greeting")
                .render("mount", React.createElement(Greeting, { name: "World" }))
                .assert("has heading", (ctx) => ctx.screen.getByText("Hello, World!") !== null, true)
                .start(null, { output: "return-json", timeout: 0 });
            return r;
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);

    await CTGTest.init("render: container has rendered HTML")
        .stage("execute", async () => {
            const r = await CTGReactTest.init("html check")
                .render("mount", React.createElement(Greeting, { name: "React" }))
                .assert("innerHTML", (ctx) => ctx.container.innerHTML.includes("Hello, React!"), true)
                .start(null, { output: "return-json", timeout: 0 });
            return r;
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);

    await CTGTest.init("render: function element (lazy evaluation)")
        .stage("execute", async () => {
            const r = await CTGReactTest.init("lazy render")
                .render("mount", () => React.createElement(Greeting, { name: "Lazy" }))
                .assert("rendered", (ctx) => ctx.screen.getByText("Hello, Lazy!") !== null, true)
                .start(null, { output: "return-json", timeout: 0 });
            return r;
        })
        .assert("status pass", (r) => r.status, "pass")
        .start(null, config);
}
