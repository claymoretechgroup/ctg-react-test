// Screenshot assertion tests — baseline creation, comparison, diff output,
// maxDiffRatio, masking, updateScreenshots, createBaselines

import { existsSync, mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import CTGTest from "ctg-js-test";

// :: OBJECT -> PROMISE(VOID)
export default async function run({ config, CTGBrowserTest, baseUrl }) {

    // ── Baseline Creation ────────────────────────────────────

    await CTGTest.init("screenshot: creates baseline on first run")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                await CTGBrowserTest.init("baseline test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("stable card")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                // Verify pipeline subdirectory was created and contains a .png
                const pipelineDirs = readdirSync(dir);
                if (pipelineDirs.length === 0) return { hasDir: false, hasPng: false };

                const pipelineDir = join(dir, pipelineDirs[0]);
                const files = readdirSync(pipelineDir);
                const pngFiles = files.filter((f) => f.endsWith(".png"));

                return { hasDir: true, hasPng: pngFiles.length > 0, pngCount: pngFiles.length };
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("pipeline dir created", (r) => r.hasDir, true)
        .assert("baseline png exists", (r) => r.hasPng, true)
        .assert("exactly one baseline", (r) => r.pngCount, 1)
        .start(null, config);

    await CTGTest.init("screenshot: first run passes (baseline created)")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                const report = await CTGBrowserTest.init("first run")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("card screenshot")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                return report.status;
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("passed", (r) => r, "pass")
        .start(null, config);

    // ── Baseline Comparison (Second Run Matches) ─────────────

    await CTGTest.init("screenshot: second run matches baseline")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                // First run — creates baseline
                await CTGBrowserTest.init("match test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("stable")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                // Second run — should match
                const report = await CTGBrowserTest.init("match test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("stable")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                return report.status;
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("passed", (r) => r, "pass")
        .start(null, config);

    // ── Mismatch Detection ───────────────────────────────────

    await CTGTest.init("screenshot: mismatch produces fail and diff")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                // First run — baseline of stable page
                await CTGBrowserTest.init("mismatch test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("content")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                // Second run — different page, same pipeline/step name
                const report = await CTGBrowserTest.init("mismatch test")
                    .navigate("go to login", "/login.html")
                    .screenshotAssert("content")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json",
                        haltOnFailure: false
                    });

                return report.status;
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("failed", (r) => r, "fail")
        .start(null, config);

    // ── createBaselines: false ───────────────────────────────

    await CTGTest.init("screenshot: createBaselines false fails on missing baseline")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                const report = await CTGBrowserTest.init("no baseline")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("missing")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        createBaselines: false,
                        output: "return-json",
                        haltOnFailure: false
                    });

                return report.status;
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("failed", (r) => r, "fail")
        .start(null, config);

    // ── updateScreenshots ────────────────────────────────────

    await CTGTest.init("screenshot: updateScreenshots overwrites baseline")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                // First run — baseline of stable page
                await CTGBrowserTest.init("update test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("content")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                // Second run — different page, updateScreenshots true
                const report = await CTGBrowserTest.init("update test")
                    .navigate("go to login", "/login.html")
                    .screenshotAssert("content")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        updateScreenshots: true,
                        output: "return-json"
                    });

                return report.status;
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("passed (baseline overwritten)", (r) => r, "pass")
        .start(null, config);

    // ── Element Selector ─────────────────────────────────────

    await CTGTest.init("screenshot: selector captures specific element")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                const report = await CTGBrowserTest.init("element shot")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("card only", { selector: "[data-testid=card]" })
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                return report.status;
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("passed", (r) => r, "pass")
        .start(null, config);

    // ── maxDiffRatio ─────────────────────────────────────────

    await CTGTest.init("screenshot: maxDiffRatio allows minor differences")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                // First run — baseline
                await CTGBrowserTest.init("ratio test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("content")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                // Second run — same page, generous threshold should still pass
                const report = await CTGBrowserTest.init("ratio test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("content", { maxDiffRatio: 0.05 })
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                return report.status;
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("passed", (r) => r, "pass")
        .start(null, config);

    // ── Filename Sanitization ────────────────────────────────

    await CTGTest.init("screenshot: filenames are slugified with hash suffix")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                await CTGBrowserTest.init("My Pipeline!")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("Card / Screenshot")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                // Pipeline dir should be slugified
                const pipelineDirs = readdirSync(dir);
                const pipelineDir = pipelineDirs[0];

                // Step file should be slugified with hash
                const files = readdirSync(join(dir, pipelineDir));
                const baselineFile = files.find((f) => f.endsWith(".png"));

                // Verify slug-hash pattern: lowercase-slug-[0-9a-f]{8}
                const slugHashPattern = /^[a-z0-9]+-[a-z0-9-]*[0-9a-f]{8}$/;
                const fileSlugHashPattern = /^[a-z0-9]+-[a-z0-9-]*[0-9a-f]{8}\.png$/;

                return {
                    pipelineDir,
                    baselineFile,
                    dirMatchesPattern: slugHashPattern.test(pipelineDir),
                    fileMatchesPattern: fileSlugHashPattern.test(baselineFile)
                };
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("dir matches slug-hash pattern", (r) => r.dirMatchesPattern, true)
        .assert("file matches slug-hash pattern", (r) => r.fileMatchesPattern, true)
        .start(null, config);

    await CTGTest.init("screenshot: distinct names with same slug produce different files")
        .stage("execute", async () => {
            const dir = mkdtempSync(join(tmpdir(), "ctg-ss-"));
            try {
                // "A/B" and "A B" both slugify to "a-b" but should have different hashes
                await CTGBrowserTest.init("collision test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("A/B")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                await CTGBrowserTest.init("collision test")
                    .navigate("go to stable", "/screenshot-stable.html")
                    .screenshotAssert("A B")
                    .start(null, {
                        ...config,
                        baseUrl,
                        screenshotDir: dir,
                        output: "return-json"
                    });

                const pipelineDirs = readdirSync(dir);
                const files = readdirSync(join(dir, pipelineDirs[0]));
                const pngFiles = files.filter((f) => f.endsWith(".png"));

                return pngFiles.length;
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        })
        .assert("two distinct files", (r) => r, 2)
        .start(null, config);
}
