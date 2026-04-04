// CTGBrowserTest construction, step registration, and config validation tests

import CTGTest from "ctg-js-test";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ config, CTGBrowserTest }) {

    // ── Factory ──────────────────────────────────────────────

    await CTGTest.init("init: returns CTGBrowserTest instance")
        .stage("create", () => {
            const test = CTGBrowserTest.init("test");
            return test instanceof CTGBrowserTest;
        })
        .assert("is instance", (r) => r, true)
        .start(null, config);

    // ── Step Types ───────────────────────────────────────────

    await CTGTest.init("step types: includes navigate")
        .assert("has navigate", () => CTGBrowserTest.STEP_TYPES.has("navigate"), true)
        .start(null, config);

    await CTGTest.init("step types: includes pageInteract")
        .assert("has pageInteract", () => CTGBrowserTest.STEP_TYPES.has("pageInteract"), true)
        .start(null, config);

    await CTGTest.init("step types: includes screenshotAssert")
        .assert("has screenshotAssert", () => CTGBrowserTest.STEP_TYPES.has("screenshotAssert"), true)
        .start(null, config);

    await CTGTest.init("step types: includes mock")
        .assert("has mock", () => CTGBrowserTest.STEP_TYPES.has("mock"), true)
        .start(null, config);

    await CTGTest.init("step types: inherits stage")
        .assert("has stage", () => CTGBrowserTest.STEP_TYPES.has("stage"), true)
        .start(null, config);

    await CTGTest.init("step types: inherits assert")
        .assert("has assert", () => CTGBrowserTest.STEP_TYPES.has("assert"), true)
        .start(null, config);

    await CTGTest.init("step types: inherits chain")
        .assert("has chain", () => CTGBrowserTest.STEP_TYPES.has("chain"), true)
        .start(null, config);

    // ── Config Validation ────────────────────────────────────

    await CTGTest.init("config: rejects invalid browser value")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, browser: "opera" });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: accepts chromium")
        .stage("check", () => {
            return CTGBrowserTest.VALID_CONFIG_KEYS.includes("browser");
        })
        .assert("has key", (r) => r, true)
        .start(null, config);

    await CTGTest.init("config: accepts baseUrl")
        .stage("check", () => {
            return CTGBrowserTest.VALID_CONFIG_KEYS.includes("baseUrl");
        })
        .assert("has key", (r) => r, true)
        .start(null, config);

    await CTGTest.init("config: accepts maxDiffRatio")
        .stage("check", () => {
            return CTGBrowserTest.VALID_CONFIG_KEYS.includes("maxDiffRatio");
        })
        .assert("has key", (r) => r, true)
        .start(null, config);

    await CTGTest.init("config: accepts createBaselines")
        .stage("check", () => {
            return CTGBrowserTest.VALID_CONFIG_KEYS.includes("createBaselines");
        })
        .assert("has key", (r) => r, true)
        .start(null, config);

    await CTGTest.init("config: rejects unknown key")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, unknownKey: true });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    // ── Type Validation ──────────────────────────────────────

    await CTGTest.init("config: rejects non-boolean headless")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, headless: "yes" });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects maxDiffRatio below 0")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, maxDiffRatio: -0.1 });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects maxDiffRatio above 1")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, maxDiffRatio: 1.5 });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects non-number maxDiffRatio")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, maxDiffRatio: "high" });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects viewport without width")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, viewport: { height: 720 } });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects viewport without height")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, viewport: { width: 1280 } });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects viewport with non-integer dimensions")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, viewport: { width: 12.5, height: 720 } });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects non-boolean updateScreenshots")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, updateScreenshots: "yes" });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects non-boolean createBaselines")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, createBaselines: 1 });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);

    await CTGTest.init("config: rejects non-string screenshotDir")
        .stage("attempt", async () => {
            try {
                await CTGBrowserTest.init("test")
                    .navigate("go", "/")
                    .start(null, { ...config, screenshotDir: 123 });
                return "no error";
            } catch (e) { return e.type || e.message; }
        })
        .assert("threw", (r) => r, "INVALID_CONFIG")
        .start(null, config);
}
