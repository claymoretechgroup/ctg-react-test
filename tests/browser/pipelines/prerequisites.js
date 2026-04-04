// Prerequisite error contract tests — config rejection and error messages
//
// Tests that invalid config and missing prerequisites produce actionable
// INVALID_STEP or INVALID_CONFIG errors with clear messages.

import CTGTest from "ctg-js-test";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ config, CTGBrowserTest, baseUrl }) {

    // ── Invalid Browser Name ─────────────────────────────────

    await CTGTest.init("prerequisite: invalid browser name rejected at config level")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("bad browser name")
                    .navigate("go", "/index.html")
                    .start(null, { ...config, baseUrl, browser: "opera" });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw INVALID_CONFIG", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    // ── Missing Browser Binary ───────────────────────────────
    // Attempt to launch a browser that may not be installed (webkit).
    // If webkit IS installed, this test verifies the pipeline works.
    // If webkit is NOT installed, this test verifies the error is
    // INVALID_STEP with a message mentioning "playwright install".
    //
    // Either outcome is valid — the test asserts the error contract
    // when a failure occurs, and passes cleanly when it doesn't.
    //
    // NOTE: This means the actionable-message contract is only enforced
    // in environments where webkit is not installed. Full coverage of
    // the missing-binary error path requires a clean environment without
    // any browser binaries, which is outside the scope of self-tests.
    // CI can enforce this by running with only chromium installed.

    await CTGTest.init("prerequisite: missing binary produces actionable INVALID_STEP")
        .stage("execute", async () => {
            try {
                const report = await CTGBrowserTest.init("webkit test")
                    .navigate("go", "/index.html")
                    .assert("loaded", async (ctx) => await ctx.page.title(), "Home Page")
                    .start(null, { ...config, baseUrl, browser: "webkit", output: "return-json" });

                // webkit is installed — pipeline ran successfully
                return { outcome: "webkit available", status: report.status };
            } catch (e) {
                // webkit not installed — verify error contract
                const msg = e.message || "";
                return {
                    outcome: "webkit missing",
                    type: e.type || "unknown",
                    mentionsInstall: msg.includes("playwright install"),
                    mentionsBrowser: msg.includes("webkit") || msg.includes("browser")
                };
            }
        })
        .assert("valid outcome", (r) =>
            r.outcome === "webkit available"
                ? r.status === "pass"
                : r.type === "INVALID_STEP" && r.mentionsInstall && r.mentionsBrowser,
            true)
        .start(null, config);
}
