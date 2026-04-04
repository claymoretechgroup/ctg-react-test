// pageInteract tests — callback contract, subject threading, return validation

import CTGTest from "ctg-js-test";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ config, CTGBrowserTest, baseUrl }) {

    // ── Basic Interaction ────────────────────────────────────

    await CTGBrowserTest.init("pageInteract: fills input")
        .navigate("go to login", "/login.html")
        .pageInteract("fill email", async (ctx) => {
            await ctx.page.fill("[data-testid=email-input]", "alice@test.com");
            return ctx;
        })
        .assert("email filled", async (ctx) =>
            await ctx.page.inputValue("[data-testid=email-input]"), "alice@test.com")
        .start(null, { ...config, baseUrl });

    await CTGBrowserTest.init("pageInteract: clicks button")
        .navigate("go to login", "/login.html")
        .pageInteract("fill and submit", async (ctx) => {
            await ctx.page.fill("[data-testid=email-input]", "alice@test.com");
            await ctx.page.fill("[data-testid=password-input]", "secret");
            await ctx.page.click("[data-testid=submit-btn]");
            return ctx;
        })
        .assert("success message", async (ctx) =>
            await ctx.page.textContent("[data-testid=message]"), "Welcome, alice@test.com!")
        .start(null, { ...config, baseUrl });

    await CTGBrowserTest.init("pageInteract: invalid credentials show error")
        .navigate("go to login", "/login.html")
        .pageInteract("fill wrong password", async (ctx) => {
            await ctx.page.fill("[data-testid=email-input]", "alice@test.com");
            await ctx.page.fill("[data-testid=password-input]", "wrong");
            await ctx.page.click("[data-testid=submit-btn]");
            return ctx;
        })
        .assert("error message", async (ctx) =>
            await ctx.page.textContent("[data-testid=message]"), "Invalid credentials.")
        .start(null, { ...config, baseUrl });

    // ── Subject Threading ────────────────────────────────────

    await CTGBrowserTest.init("pageInteract: data bag available in callback")
        .navigate("go home", "/index.html")
        .stage("set data", (ctx) => { ctx.set("flag", true); return ctx; })
        .pageInteract("read data", async (ctx) => {
            ctx.set("read", ctx.get("flag"));
            return ctx;
        })
        .assert("flag was readable", (ctx) => ctx.get("read"), true)
        .start(null, { ...config, baseUrl });

    // ── Return Validation ────────────────────────────────────

    await CTGTest.init("pageInteract: undefined return throws INVALID_STEP")
        .stage("execute", async () => {
            const report = await CTGBrowserTest.init("undefined return")
                .navigate("go home", "/index.html")
                .pageInteract("forget return", async (ctx) => {
                    // deliberately does not return ctx
                })
                .assert("unreachable", () => true, true)
                .start(null, { ...config, baseUrl, output: "return-json", haltOnFailure: true });

            const interactStep = report.steps.find((s) => s.name === "forget return");
            const msg = String(interactStep.message || interactStep.exception || "");
            return {
                status: interactStep.status,
                mentionsInvalidStep: msg.includes("INVALID_STEP"),
                mentionsBrowserContext: msg.includes("BrowserContext")
            };
        })
        .assert("step errored", (r) => r.status, "error")
        .assert("mentions INVALID_STEP", (r) => r.mentionsInvalidStep, true)
        .assert("mentions BrowserContext", (r) => r.mentionsBrowserContext, true)
        .start(null, config);

    // ── Error Handler ────────────────────────────────────────

    await CTGBrowserTest.init("pageInteract: error handler receives error")
        .navigate("go home", "/index.html")
        .pageInteract("fail", async (ctx) => {
            throw new Error("interaction failed");
        }, async (err) => {
            return err.message;
        })
        .assert("recovered", (msg) => msg, "interaction failed")
        .start(null, { ...config, baseUrl });
}
