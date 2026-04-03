import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync,
    realpathSync } from "node:fs"; // File ops for snapshot manager
import { join, dirname, basename, relative, isAbsolute } from "node:path"; // Path utils
import { fileURLToPath } from "node:url"; // URL to path conversion
import { performance } from "node:perf_hooks"; // Timing

import CTGTest from "../../ctg-js-test/src/CTGTest.js"; // Base pipeline engine
import CTGTestError from "../../ctg-js-test/src/CTGTestError.js"; // Typed errors
import CTGTestResult from "../../ctg-js-test/src/CTGTestResult.js"; // Result factories
import CTGTestStep from "../../ctg-js-test/src/CTGTestStep.js"; // Step value object
import ReactContext from "./ReactContext.js"; // React subject wrapper

// Composable pipeline-based test framework for React, extending ctg-js-test
export default class CTGReactTest extends CTGTest {

    /* Static Fields */

    static STEP_TYPES = new Set([
        ...CTGTest.VALID_STEP_TYPES,
        "render", "interact", "snapshot", "renderHook"
    ]);

    static VALID_CONFIG_KEYS = [
        ...CTGTest.VALID_CONFIG_KEYS,
        "snapshotFilePath", "snapshotFileUrl", "updateSnapshots", "maxSnapshotBytes"
    ];

    /**
     *
     * Instance Methods
     *
     */

    // :: STRING, JSX|(() -> JSX), OBJECT? -> this
    // Renders a React element and wraps the result as a ReactContext subject.
    // NOTE: Replaces the current subject with a new ReactContext.
    render(name, element, opts = {}) {
        this._steps.push(new CTGTestStep("render", name, element, opts, null));
        return this;
    }

    // :: STRING, (* -> *|PROMISE(*)) -> this
    // Convenience stage for user interactions. Semantically distinct from stage.
    interact(name, fn) {
        this._steps.push(new CTGTestStep("interact", name, fn, null, null));
        return this;
    }

    // :: STRING, ((ReactContext) -> *)?, OBJECT? -> this
    // Snapshot assert. fn extracts serializable value from subject.
    // Default fn: (ctx) => ctx.container.innerHTML
    snapshot(name, fn = null, opts = {}) {
        const step = new CTGTestStep("snapshot", name, fn, "__snapshot__", null);
        step._snapshotOpts = opts;
        return this._steps.push(step), this;
    }

    // :: STRING, (() -> *), OBJECT? -> this
    // Renders a hook in isolation. result.current holds hook return value.
    renderHook(name, hookFn, opts = {}) {
        this._steps.push(new CTGTestStep("renderHook", name, hookFn, opts, null));
        return this;
    }

    // :: *, OBJECT? -> PROMISE(STRING|OBJECT|VOID)
    // If formatter is ExecutionFormatter, delegates. Otherwise standalone with cleanup.
    async start(subject, config = {}) {
        const formatter = config.formatter || null;

        if (formatter && formatter.constructor._isExecutionFormatter === true) {
            return formatter.execute(this, subject, config);
        }

        try {
            return await super.start(subject, config);
        } finally {
            try {
                const rtl = await import("@testing-library/react");
                if (rtl.cleanup) rtl.cleanup();
            } catch {
                // @testing-library/react not available — no cleanup needed
            }
        }
    }

    /**
     *
     * Private Methods
     *
     */

    // :: OBJECT -> VOID
    // Overrides parent to accept React-specific config keys.
    _validateConfig(config) {
        for (const key of Object.keys(config)) {
            if (!CTGReactTest.VALID_CONFIG_KEYS.includes(key)) {
                throw new CTGTestError("INVALID_CONFIG", `Unknown config key: ${key}`);
            }
        }
        // Delegate remaining validation to parent (output mode, booleans, formatter, timeout)
        // by temporarily removing React-specific keys
        const parentConfig = { ...config };
        delete parentConfig.snapshotFilePath;
        delete parentConfig.snapshotFileUrl;
        delete parentConfig.updateSnapshots;
        delete parentConfig.maxSnapshotBytes;
        super._validateConfig(parentConfig);
    }

    // :: STRING, [ctgTestStep], Set -> VOID
    // Overrides parent to accept React-specific step types.
    _validateStepDefinitions(testName, steps, visited) {
        if (testName.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Test name must not be empty");
        }

        const names = new Set();
        for (const step of steps) {
            if (!CTGReactTest.STEP_TYPES.has(step.type)) {
                throw new CTGTestError("INVALID_STEP", `Unknown step type: ${step.type}`);
            }

            const trimmed = step.name.trim();
            if (trimmed.length === 0) {
                throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
            }
            if (names.has(trimmed)) {
                throw new CTGTestError("INVALID_STEP", `Duplicate step name: ${trimmed}`);
            }
            names.add(trimmed);

            if (step.type === "chain") {
                if (!(step.fn instanceof CTGTest)) {
                    throw new CTGTestError("INVALID_CHAIN", "Chain target must be a CTGTest instance");
                }
                if (!visited.has(step.fn)) {
                    visited.add(step.fn);
                    this._validateStepDefinitions(step.fn.name, step.fn.steps, visited);
                    this._validateSkipDefinitions(step.fn.steps, step.fn.skips);
                }
            } else if (step.type === "render" || step.type === "renderHook") {
                // fn can be JSX element, function, or hook function — no callable check
            } else if (step.type === "snapshot") {
                // fn is optional extraction function — null is valid
            } else if (step.type === "interact" || step.type === "stage") {
                if (typeof step.fn !== "function") {
                    throw new CTGTestError("INVALID_STEP", `Step fn must be a function, got ${typeof step.fn}`);
                }
            } else if (step.type === "assert" || step.type === "assert-any") {
                if (typeof step.fn !== "function") {
                    throw new CTGTestError("INVALID_STEP", `Step fn must be a function, got ${typeof step.fn}`);
                }
                if (step.type === "assert" && typeof step.expected === "function") {
                    throw new CTGTestError("INVALID_EXPECTED", "Assert expected must not be a function");
                }
                if (step.type === "assert-any" && !Array.isArray(step.expected)) {
                    throw new CTGTestError("INVALID_EXPECTED", "AssertAny expected must be an array");
                }
            }

            if (step.errorHandler !== null && step.errorHandler !== undefined && typeof step.errorHandler !== "function") {
                throw new CTGTestError("INVALID_STEP", "Error handler must be a function");
            }
        }
    }

    // :: *, OBJECT, INT, [ctgTestStep], [OBJECT] -> PROMISE({results: [OBJECT], subject: *})
    // Extends parent to handle render, interact, snapshot, renderHook step types.
    async _executeSteps(subject, config, depth, steps, skips) {
        const results = [];
        const skipMap = new Map();
        for (const skip of skips) {
            skipMap.set(skip.name.trim(), skip);
        }

        for (const step of steps) {
            const trimmedName = step.name.trim();
            const skipDirective = skipMap.get(trimmedName);

            if (skipDirective) {
                const skipResult = await this._handleSkip(step, skipDirective, subject, config);
                if (skipResult !== null) {
                    results.push(skipResult);
                    if (config.haltOnFailure && (skipResult.status === "fail" || skipResult.status === "error")) break;
                    continue;
                }
            }

            let result;
            const debugSnapshot = config.debug ? this._snapshotSubject(subject, 0) : undefined;

            switch (step.type) {
                case "render":
                    result = await this._executeRender(step, subject, config);
                    if (result.status === "pass") subject = result._newSubject;
                    delete result._newSubject;
                    break;
                case "interact":
                    result = await this._executeInteract(step, subject, config);
                    if (result.status === "pass" || result.status === "recovered") subject = result._newSubject;
                    delete result._newSubject;
                    break;
                case "renderHook":
                    result = await this._executeRenderHook(step, subject, config);
                    if (result.status === "pass") subject = result._newSubject;
                    delete result._newSubject;
                    break;
                case "snapshot":
                    result = await this._executeSnapshot(step, subject, config);
                    break;
                case "stage":
                    result = await this._executeStage(step, subject, config);
                    if (result.status === "pass" || result.status === "recovered") subject = result._newSubject;
                    delete result._newSubject;
                    break;
                case "assert":
                    result = await this._executeAssert(step, subject, config);
                    break;
                case "assert-any":
                    result = await this._executeAssertAny(step, subject, config);
                    break;
                case "chain":
                    result = await this._executeChain(step, subject, config, depth);
                    if (result._chainSubject !== undefined) subject = result._chainSubject;
                    delete result._chainSubject;
                    break;
                default:
                    throw new CTGTestError("INVALID_STEP", `Unknown step type: ${step.type}`);
            }

            if (config.debug) result.subject = debugSnapshot;
            results.push(result);
            if (config.haltOnFailure && (result.status === "fail" || result.status === "error")) break;
        }

        return { results, subject };
    }

    // :: ctgTestStep, *, OBJECT -> PROMISE(OBJECT)
    // Renders a React element and produces a ReactContext as the new subject.
    async _executeRender(step, subject, config) {
        CTGReactTest._checkDom();
        const start = performance.now();
        try {
            const element = typeof step.fn === "function" ? step.fn() : step.fn;
            const opts = step.expected || {};
            const rtl = await import("@testing-library/react");
            const renderResult = rtl.render(element, { wrapper: opts.wrapper });

            let user = null;
            try {
                const ue = await import("@testing-library/user-event");
                user = ue.default.setup(opts.user);
            } catch {
                // user-event not available
            }

            const ctx = new ReactContext({
                screen: rtl.screen,
                user,
                container: renderResult.container,
                rerender: renderResult.rerender
            });

            const durationMs = Math.round(performance.now() - start);
            const result = CTGTestResult.stepResult("render", step.name, "pass", durationMs);
            result._newSubject = ctx;
            return result;
        } catch (err) {
            const durationMs = Math.round(performance.now() - start);
            return CTGTestResult.stepResult("render", step.name, "error", durationMs, err.message,
                CTGTestResult.formatException(err, config.trace));
        }
    }

    // :: ctgTestStep, *, OBJECT -> PROMISE(OBJECT)
    // Executes a user interaction step. Validates user-event is available.
    async _executeInteract(step, subject, config) {
        if (subject instanceof ReactContext && subject.user === null) {
            throw new CTGTestError("INVALID_STEP",
                "user-event is required for interact() — install @testing-library/user-event");
        }
        const start = performance.now();
        try {
            const timeout = config.timeout || 0;
            const newSubject = timeout > 0
                ? await this._withTimeout(step.fn, subject, "fn", step.name, timeout)
                : await step.fn(subject);
            const durationMs = Math.round(performance.now() - start);
            const result = CTGTestResult.stepResult("interact", step.name, "pass", durationMs);
            result._newSubject = newSubject;
            return result;
        } catch (err) {
            if (err instanceof CTGTestError) throw err;
            const durationMs = Math.round(performance.now() - start);
            return CTGTestResult.stepResult("interact", step.name, "error", durationMs, err.message,
                CTGTestResult.formatException(err, config.trace));
        }
    }

    // :: ctgTestStep, *, OBJECT -> PROMISE(OBJECT)
    // Renders a hook and produces a ReactContext with result ref.
    async _executeRenderHook(step, subject, config) {
        CTGReactTest._checkDom();
        const start = performance.now();
        try {
            const opts = step.expected || {};
            const rtl = await import("@testing-library/react");
            const hookResult = rtl.renderHook(step.fn, { wrapper: opts.wrapper });

            const ctx = new ReactContext({
                screen: rtl.screen,
                user: null,
                container: hookResult.result.current ? document.body : document.createElement("div"),
                rerender: hookResult.rerender,
                data: { result: hookResult.result }
            });

            const durationMs = Math.round(performance.now() - start);
            const result = CTGTestResult.stepResult("renderHook", step.name, "pass", durationMs);
            result._newSubject = ctx;
            return result;
        } catch (err) {
            const durationMs = Math.round(performance.now() - start);
            return CTGTestResult.stepResult("renderHook", step.name, "error", durationMs, err.message,
                CTGTestResult.formatException(err, config.trace));
        }
    }

    // :: ctgTestStep, *, OBJECT -> PROMISE(OBJECT)
    // Executes a snapshot step — compares or writes snapshot in standalone mode.
    async _executeSnapshot(step, subject, config) {
        const start = performance.now();
        try {
            const extractFn = step.fn || ((ctx) => ctx.container.innerHTML);
            let value = extractFn(subject);

            // Apply sanitize hook if provided
            const snapshotOpts = step._snapshotOpts || {};
            if (snapshotOpts.sanitize) {
                value = snapshotOpts.sanitize(value);
            }

            const filePath = CTGReactTest._resolveSnapshotFilePath(config);
            const stepPath = `${this._name} > ${step.name}`;

            const compareResult = CTGReactTest._compareSnapshot(filePath, stepPath, value, config);
            const durationMs = Math.round(performance.now() - start);

            if (compareResult.match) {
                return CTGTestResult.assertResult(step.name, "pass", durationMs, value, value);
            }
            return CTGTestResult.assertResult(step.name, "fail", durationMs, value, compareResult.stored,
                `Snapshot mismatch for "${stepPath}"`);
        } catch (err) {
            if (err instanceof CTGTestError) throw err;
            const durationMs = Math.round(performance.now() - start);
            return CTGTestResult.assertResult(step.name, "error", durationMs, null, null, err.message,
                CTGTestResult.formatException(err, config.trace));
        }
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: STRING -> ctgReactTest
    static init(name) {
        return new this(name);
    }

    // :: VOID -> VOID
    // Checks that DOM globals are available. Throws INVALID_STEP if not.
    static _checkDom() {
        if (typeof document === "undefined"
            || typeof window === "undefined"
            || typeof HTMLElement === "undefined") {
            throw new CTGTestError("INVALID_STEP",
                "DOM environment required — install jsdom or use Vitest with jsdom/happy-dom environment");
        }
    }

    // :: OBJECT -> STRING
    // Resolves snapshot file path from config with priority:
    // 1. config.snapshotFilePath (explicit)
    // 2. config.snapshotFileUrl (import.meta.url)
    // 3. Stack parsing fallback
    static _resolveSnapshotFilePath(config) {
        if (config.snapshotFilePath) return config.snapshotFilePath;

        if (config.snapshotFileUrl) return fileURLToPath(config.snapshotFileUrl);

        // Stack parsing fallback
        const stack = new Error().stack;
        const lines = stack.split("\n");
        for (const line of lines) {
            const match = line.match(/(?:at\s+)?(?:file:\/\/)?(\/.+\.js)/);
            if (match && !match[1].includes("CTGReactTest") && !match[1].includes("CTGTest")) {
                return match[1];
            }
        }

        throw new CTGTestError("INVALID_STEP",
            "Unable to determine snapshot file path — set config.snapshotFilePath explicitly");
    }

    // :: STRING -> STRING
    // Sanitizes a snapshot key by removing path separators, control chars, null bytes.
    static _sanitizeSnapshotKey(key) {
        return key.replace(/[/\\:\0\r\n]/g, "");
    }

    // :: STRING -> {dir: STRING, file: STRING}
    // Computes snapshot directory and file path, validates containment.
    static _resolveSnapshotPaths(filePath) {
        const testFileDir = dirname(filePath);
        const testFileName = basename(filePath);
        const snapDir = join(testFileDir, "__snapshots__");

        try {
            mkdirSync(snapDir, { recursive: true });
        } catch (err) {
            throw new CTGTestError("INVALID_STEP",
                `Cannot create snapshot directory: ${err.message}`);
        }

        // Containment check: resolved snapshot dir must be under test file dir
        let realSnapDir, realTestDir;
        try {
            realSnapDir = realpathSync(snapDir);
            realTestDir = realpathSync(testFileDir);
        } catch (err) {
            throw new CTGTestError("INVALID_STEP",
                `Cannot resolve snapshot path: ${err.message}`);
        }
        const rel = relative(realTestDir, realSnapDir);
        if (rel.startsWith("..") || isAbsolute(rel)) {
            throw new CTGTestError("INVALID_STEP",
                "Snapshot directory resolves outside test file directory");
        }

        const snapFile = join(snapDir, testFileName.replace(/\.js$/, ".snap.json"));
        return { dir: snapDir, file: snapFile };
    }

    // :: STRING, STRING, *, OBJECT? -> {match: BOOL, stored?: *}
    // Reads stored snapshot and compares. Writes on first run.
    static _compareSnapshot(filePath, stepPath, actual, opts = {}) {
        const key = CTGReactTest._sanitizeSnapshotKey(stepPath);

        // Size guard
        if (opts.maxSnapshotBytes) {
            const size = Buffer.byteLength(JSON.stringify(actual));
            if (size > opts.maxSnapshotBytes) {
                throw new CTGTestError("INVALID_STEP", "Snapshot exceeds maxSnapshotBytes limit");
            }
        }

        const { dir, file } = CTGReactTest._resolveSnapshotPaths(filePath);

        let snapData = {};
        if (existsSync(file)) {
            snapData = JSON.parse(readFileSync(file, "utf-8"));
        }

        if (!(key in snapData) || opts.updateSnapshots) {
            // First run or update mode: write and pass
            snapData[key] = actual;
            CTGReactTest._atomicWrite(file, JSON.stringify(snapData, null, 2));
            return { match: true };
        }

        // Compare
        if (JSON.stringify(snapData[key]) === JSON.stringify(actual)) {
            return { match: true };
        }
        return { match: false, stored: snapData[key] };
    }

    // :: STRING, STRING, * -> VOID
    // Writes snapshot value to file.
    static _updateSnapshot(filePath, stepPath, value) {
        const key = CTGReactTest._sanitizeSnapshotKey(stepPath);
        const { file } = CTGReactTest._resolveSnapshotPaths(filePath);

        let snapData = {};
        if (existsSync(file)) {
            snapData = JSON.parse(readFileSync(file, "utf-8"));
        }
        snapData[key] = value;
        CTGReactTest._atomicWrite(file, JSON.stringify(snapData, null, 2));
    }

    // :: STRING, STRING -> VOID
    // Atomic write via unique temp file + rename.
    static _atomicWrite(targetPath, content) {
        const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
        writeFileSync(tmpPath, content, "utf-8");
        renameSync(tmpPath, targetPath);
    }
}

