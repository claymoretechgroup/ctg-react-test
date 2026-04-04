// BrowserContext value object tests — constructor, getters, data bag

import CTGTest from "ctg-js-test";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ config, BrowserContext }) {

    // ── Constructor ──────────────────────────────────────────

    await CTGTest.init("BrowserContext: stores page, browser, context")
        .stage("create", () => {
            const mock = { page: "p", browser: "b", context: "c" };
            const ctx = new BrowserContext(mock);
            return { page: ctx.page, browser: ctx.browser, context: ctx.context };
        })
        .assert("page", (r) => r.page, "p")
        .assert("browser", (r) => r.browser, "b")
        .assert("context", (r) => r.context, "c")
        .start(null, config);

    await CTGTest.init("BrowserContext: default data is empty object")
        .stage("create", () => {
            const ctx = new BrowserContext({ page: null, browser: null, context: null });
            return ctx.data;
        })
        .assert("empty", (r) => Object.keys(r).length, 0)
        .start(null, config);

    await CTGTest.init("BrowserContext: accepts initial data")
        .stage("create", () => {
            const ctx = new BrowserContext({
                page: null, browser: null, context: null,
                data: { key: "value" }
            });
            return ctx.data.key;
        })
        .assert("has key", (r) => r, "value")
        .start(null, config);

    // ── Data Bag ─────────────────────────────────────────────

    await CTGTest.init("BrowserContext: get reads from data")
        .stage("create", () => {
            const ctx = new BrowserContext({
                page: null, browser: null, context: null,
                data: { name: "Alice" }
            });
            return ctx.get("name");
        })
        .assert("value", (r) => r, "Alice")
        .start(null, config);

    await CTGTest.init("BrowserContext: get returns undefined for missing key")
        .stage("create", () => {
            const ctx = new BrowserContext({ page: null, browser: null, context: null });
            return ctx.get("missing");
        })
        .assert("undefined", (r) => r, undefined)
        .start(null, config);

    await CTGTest.init("BrowserContext: set writes to data and returns self")
        .stage("create", () => {
            const ctx = new BrowserContext({ page: null, browser: null, context: null });
            const returned = ctx.set("count", 42);
            return { value: ctx.get("count"), isSelf: returned === ctx };
        })
        .assert("value", (r) => r.value, 42)
        .assert("chainable", (r) => r.isSelf, true)
        .start(null, config);
}
