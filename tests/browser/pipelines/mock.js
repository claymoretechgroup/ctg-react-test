// Mock step tests — static response, dynamic handler, queueing, precedence

// :: OBJECT -> PROMISE(VOID)
export default async function run({ config, CTGBrowserTest, baseUrl }) {

    // ── Static Response ──────────────────────────────────────

    await CTGBrowserTest.init("mock: static JSON response")
        .mock("user api", "**/api/user", { json: { name: "Mocked Alice" } })
        .navigate("go to dynamic", "/dynamic.html")
        .assert("user name", async (ctx) => {
            await ctx.page.waitForSelector("[data-testid=user-name]:not(:text('Loading...'))");
            return await ctx.page.textContent("[data-testid=user-name]");
        }, "Mocked Alice")
        .start(null, { ...config, baseUrl });

    await CTGBrowserTest.init("mock: static response with status code")
        .mock("user api 404", "**/api/user", { status: 404, body: "Not found" })
        .navigate("go to dynamic", "/dynamic.html")
        .assert("error shown", async (ctx) => {
            await ctx.page.waitForSelector("[data-testid=user-name]:not(:text('Loading...'))");
            return await ctx.page.textContent("[data-testid=user-name]");
        }, "Error loading user")
        .start(null, { ...config, baseUrl });

    // ── Multiple Mocks ───────────────────────────────────────

    await CTGBrowserTest.init("mock: multiple endpoints")
        .mock("user api", "**/api/user", { json: { name: "Bob" } })
        .mock("notifications", "**/api/notifications", { json: [] })
        .navigate("go to dynamic", "/dynamic.html")
        .assert("user name", async (ctx) => {
            await ctx.page.waitForSelector("[data-testid=user-name]:not(:text('Loading...'))");
            return await ctx.page.textContent("[data-testid=user-name]");
        }, "Bob")
        .assert("no notifications", async (ctx) => {
            await ctx.page.waitForSelector("[data-testid=notifications]:not(:text('Loading...'))");
            return await ctx.page.textContent("[data-testid=notifications]");
        }, "No notifications")
        .start(null, { ...config, baseUrl });

    // ── Dynamic Handler ──────────────────────────────────────

    await CTGBrowserTest.init("mock: dynamic handler function")
        .mock("user api", "**/api/user", (route) => {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ name: "Dynamic Handler" })
            });
        })
        .navigate("go to dynamic", "/dynamic.html")
        .assert("dynamic response", async (ctx) => {
            await ctx.page.waitForSelector("[data-testid=user-name]:not(:text('Loading...'))");
            return await ctx.page.textContent("[data-testid=user-name]");
        }, "Dynamic Handler")
        .start(null, { ...config, baseUrl });

    // ── Last-Defined Wins ────────────────────────────────────

    await CTGBrowserTest.init("mock: last-defined wins for same pattern")
        .mock("user first", "**/api/user", { json: { name: "First" } })
        .mock("user second", "**/api/user", { json: { name: "Second" } })
        .navigate("go to dynamic", "/dynamic.html")
        .assert("second mock wins", async (ctx) => {
            await ctx.page.waitForSelector("[data-testid=user-name]:not(:text('Loading...'))");
            return await ctx.page.textContent("[data-testid=user-name]");
        }, "Second")
        .start(null, { ...config, baseUrl });

    // ── Mock Before Navigate (Queueing) ──────────────────────

    // This is the standard usage pattern — mocks are defined before navigate.
    // The framework queues them and applies when the browser launches.
    // Already tested implicitly above, but this test makes the contract explicit.

    await CTGBrowserTest.init("mock: queued before first navigate")
        .mock("user api", "**/api/user", { json: { name: "Queued" } })
        .mock("notifications", "**/api/notifications", { json: [1, 2, 3] })
        .navigate("go to dynamic", "/dynamic.html")
        .assert("user from queued mock", async (ctx) => {
            await ctx.page.waitForSelector("[data-testid=user-name]:not(:text('Loading...'))");
            return await ctx.page.textContent("[data-testid=user-name]");
        }, "Queued")
        .assert("notifications from queued mock", async (ctx) => {
            await ctx.page.waitForSelector("[data-testid=notifications]:not(:text('Loading...'))");
            return await ctx.page.textContent("[data-testid=notifications]");
        }, "3 notifications")
        .start(null, { ...config, baseUrl });
}
