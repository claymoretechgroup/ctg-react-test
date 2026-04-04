// ReactContext value object tests

import CTGTest from "ctg-js-test";
import ReactContext from "../../src/ReactContext.js";

// :: OBJECT -> PROMISE(VOID)
// Runs all ReactContext tests. config: shared test config.
export default async function run({ config }) {

    await CTGTest.init("ReactContext: constructor stores all fields")
        .stage("create", () => new ReactContext({
            screen: { getByText: () => {} },
            user: { click: () => {} },
            container: document.createElement("div"),
            rerender: () => {},
            data: { key: "value" }
        }))
        .assert("has screen", (ctx) => typeof ctx.screen.getByText, "function")
        .assert("has user", (ctx) => typeof ctx.user.click, "function")
        .assert("has container", (ctx) => ctx.container instanceof HTMLElement, true)
        .assert("has rerender", (ctx) => typeof ctx.rerender, "function")
        .assert("has data", (ctx) => ctx.data.key, "value")
        .start(null, config);

    await CTGTest.init("ReactContext: data defaults to empty object")
        .stage("create", () => new ReactContext({
            screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
        }))
        .assert("data is empty", (ctx) => JSON.stringify(ctx.data), "{}")
        .start(null, config);

    await CTGTest.init("ReactContext: user can be null")
        .stage("create", () => new ReactContext({
            screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
        }))
        .assert("user is null", (ctx) => ctx.user, null)
        .start(null, config);

    await CTGTest.init("ReactContext: get/set data methods")
        .stage("create and populate", () => {
            const ctx = new ReactContext({
                screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
            });
            ctx.set("name", "Alice").set("count", 42);
            return ctx;
        })
        .assert("get name", (ctx) => ctx.get("name"), "Alice")
        .assert("get count", (ctx) => ctx.get("count"), 42)
        .assert("get missing", (ctx) => ctx.get("missing"), undefined)
        .start(null, config);

    await CTGTest.init("ReactContext: set returns self for chaining")
        .stage("check", () => {
            const ctx = new ReactContext({
                screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
            });
            return ctx.set("a", 1) === ctx;
        })
        .assert("returns self", (r) => r, true)
        .start(null, config);

    await CTGTest.init("ReactContext: data setter replaces bag")
        .stage("replace", () => {
            const ctx = new ReactContext({
                screen: {}, user: null, container: document.createElement("div"), rerender: () => {}
            });
            ctx.set("old", true);
            ctx.data = { fresh: true };
            return { old: ctx.get("old"), fresh: ctx.get("fresh") };
        })
        .assert("old gone", (r) => r.old, undefined)
        .assert("fresh present", (r) => r.fresh, true)
        .start(null, config);
}
