// Self-tests for CTGBrowserTest
//
// Starts a local HTTP server serving test fixtures.
// Runs all browser test pipelines against the server.
// Server is always stopped on exit (pass, fail, or error).
//
// Prerequisites:
//   npm install playwright
//   npx playwright install chromium
//
// Run:
//   node tests/browser/BrowserSelfTest.js

import CTGTest from "ctg-js-test";
import { CTGBrowserTest, BrowserContext } from "../../src/index.js";
import { startServer } from "./server.js";

// ── Pipeline Categories ──────────────────────────────────────

import runBrowserContext from "./pipelines/browserContext.js";
import runConstruction from "./pipelines/construction.js";
import runNavigation from "./pipelines/navigation.js";
import runPageInteraction from "./pipelines/pageInteraction.js";
import runMock from "./pipelines/mock.js";
import runScreenshots from "./pipelines/screenshots.js";
import runLifecycle from "./pipelines/lifecycle.js";
import runPrerequisites from "./pipelines/prerequisites.js";

// ── Config ───────────────────────────────────────────────────

const config = { output: "console", timeout: 30000 };

// ── Run ──────────────────────────────────────────────────────

let server;
try {
    server = await startServer();
    const baseUrl = server.url;

    process.stdout.write("=== CTGBrowserTest Self Test ===\n\n");
    process.stdout.write(`Server running at ${baseUrl}\n\n`);

    await runBrowserContext({ config, BrowserContext });
    await runConstruction({ config, CTGBrowserTest });
    await runNavigation({ config, CTGBrowserTest, BrowserContext, baseUrl });
    await runPageInteraction({ config, CTGBrowserTest, baseUrl });
    await runMock({ config, CTGBrowserTest, baseUrl });
    await runScreenshots({ config, CTGBrowserTest, baseUrl });
    await runLifecycle({ config, CTGBrowserTest, baseUrl });
    await runPrerequisites({ config, CTGBrowserTest, baseUrl });

    process.stdout.write("\n=== All browser tests complete ===\n");
} finally {
    if (server) await server.stop();
}

const failed = CTGTest._results.some((r) => r.status === "fail" || r.status === "error");
process.exit(failed ? 1 : 0);
