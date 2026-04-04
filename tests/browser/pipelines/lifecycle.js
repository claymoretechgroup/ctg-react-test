// Lifecycle tests — cleanup on success, failure, and halt

import CTGTest from "ctg-js-test";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ config, CTGBrowserTest, baseUrl }) {

    // ── Cleanup on Success ───────────────────────────────────

    await CTGTest.init("lifecycle: browser closed after successful pipeline")
        .stage("execute", async () => {
            let capturedCtx = null;
            await CTGBrowserTest.init("cleanup success")
                .navigate("go home", "/index.html")
                .stage("capture", (ctx) => { capturedCtx = ctx; return ctx; })
                .assert("loaded", async (ctx) => await ctx.page.title(), "Home Page")
                .start(null, { ...config, baseUrl, output: "return-json" });

            // After start() returns, browser should be closed
            try {
                await capturedCtx.page.title();
                return "page still open";
            } catch {
                return "page closed";
            }
        })
        .assert("closed", (r) => r, "page closed")
        .start(null, config);

    // ── Cleanup on Failure ───────────────────────────────────

    await CTGTest.init("lifecycle: browser closed after failed assertion")
        .stage("execute", async () => {
            let capturedCtx = null;
            await CTGBrowserTest.init("cleanup failure")
                .navigate("go home", "/index.html")
                .stage("capture", (ctx) => { capturedCtx = ctx; return ctx; })
                .assert("wrong title", async (ctx) => await ctx.page.title(), "Wrong Title")
                .start(null, { ...config, baseUrl, output: "return-json" });

            try {
                await capturedCtx.page.title();
                return "page still open";
            } catch {
                return "page closed";
            }
        })
        .assert("closed", (r) => r, "page closed")
        .start(null, config);

    // ── Cleanup on Error ─────────────────────────────────────

    await CTGTest.init("lifecycle: browser closed after step error")
        .stage("execute", async () => {
            let capturedCtx = null;
            await CTGBrowserTest.init("cleanup error")
                .navigate("go home", "/index.html")
                .stage("capture", (ctx) => { capturedCtx = ctx; return ctx; })
                .stage("throw", () => { throw new Error("boom"); })
                .start(null, { ...config, baseUrl, output: "return-json", haltOnFailure: false });

            try {
                await capturedCtx.page.title();
                return "page still open";
            } catch {
                return "page closed";
            }
        })
        .assert("closed", (r) => r, "page closed")
        .start(null, config);
}
