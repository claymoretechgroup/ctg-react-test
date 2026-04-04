// Navigation tests — lazy browser launch, URL resolution, subject threading

// :: OBJECT -> PROMISE(VOID)
export default async function run({ config, CTGBrowserTest, BrowserContext, baseUrl }) {

    // ── Basic Navigation ─────────────────────────────────────

    await CTGBrowserTest.init("navigate: loads page and creates BrowserContext")
        .navigate("go home", "/index.html")
        .assert("has page title", async (ctx) => await ctx.page.title(), "Home Page")
        .start(null, { ...config, baseUrl });

    await CTGBrowserTest.init("navigate: subject is BrowserContext")
        .navigate("go home", "/index.html")
        .assert("is BrowserContext", (ctx) => ctx instanceof BrowserContext, true)
        .start(null, { ...config, baseUrl });

    await CTGBrowserTest.init("navigate: page content accessible")
        .navigate("go home", "/index.html")
        .assert("heading text", async (ctx) =>
            await ctx.page.textContent("[data-testid=heading]"), "Welcome")
        .start(null, { ...config, baseUrl });

    // ── URL Resolution ───────────────────────────────────────

    await CTGBrowserTest.init("navigate: relative URL resolves against baseUrl")
        .navigate("go to login", "/login.html")
        .assert("title", async (ctx) => await ctx.page.title(), "Login")
        .start(null, { ...config, baseUrl });

    await CTGBrowserTest.init("navigate: absolute URL ignores baseUrl")
        .navigate("go home", baseUrl + "/index.html")
        .assert("title", async (ctx) => await ctx.page.title(), "Home Page")
        .start(null, { ...config, baseUrl });

    // ── Sequential Navigation ────────────────────────────────

    await CTGBrowserTest.init("navigate: second navigate reuses page")
        .navigate("go home", "/index.html")
        .assert("first page", async (ctx) => await ctx.page.title(), "Home Page")
        .navigate("go to login", "/login.html")
        .assert("second page", async (ctx) => await ctx.page.title(), "Login")
        .start(null, { ...config, baseUrl });

    // ── waitUntil Option ─────────────────────────────────────

    await CTGBrowserTest.init("navigate: accepts waitUntil option")
        .navigate("go home", { url: "/index.html", waitUntil: "domcontentloaded" })
        .assert("loaded", async (ctx) => await ctx.page.title(), "Home Page")
        .start(null, { ...config, baseUrl });

    // ── Subject Threading ────────────────────────────────────

    await CTGBrowserTest.init("navigate: data bag persists across navigations")
        .navigate("go home", "/index.html")
        .stage("set data", (ctx) => { ctx.set("visited", true); return ctx; })
        .navigate("go to login", "/login.html")
        .assert("data persists", (ctx) => ctx.get("visited"), true)
        .start(null, { ...config, baseUrl });
}
