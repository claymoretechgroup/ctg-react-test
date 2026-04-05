import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs"; // File ops
import { join, dirname, basename } from "node:path"; // Path utils
import { fileURLToPath } from "node:url"; // URL to path conversion

import CTGTestStep from "ctg-js-test/step"; // Abstract step base
import CTGTestError from "ctg-js-test/error"; // Typed errors
import CTGTestResult from "ctg-js-test/result"; // Status enum

// AssertSnapshot step — renders a component via react-test-renderer,
// serializes to JSON, and compares against a stored baseline.
// Uses a different renderer than RenderStep (structural vs behavioral).
export default class AssertSnapshotStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, JSX|(VOID -> JSX), OBJECT? -> this
    // Creates an assertSnapshot step with a name, element, and optional
    // options (e.g., baselinePath).
    constructor(name, element, opts = {}) {
        super("assertSnapshot", name);
        this._element = element;
        this._opts = opts;
        this._resolvedExpected = undefined;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> JSX|(VOID -> JSX)
    // Returns the element or element factory.
    get element() { return this._element; }

    // GETTER :: VOID -> BOOL
    // Snapshot steps produce result entries.
    get producesResult() { return true; }

    // GETTER :: VOID -> OBJECT|NULL
    // Returns the resolved expected outcome after execution.
    // Before execution, returns null.
    get expectedOutcome() {
        if (this._resolvedExpected === undefined) return null;
        return { type: "value", expected: this._resolvedExpected };
    }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that name is non-empty and element is provided.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (this._element === undefined || this._element === null) {
            throw new CTGTestError("INVALID_STEP",
                "assertSnapshot requires an element");
        }
    }

    // :: reactTestState -> PROMISE(reactTestState)
    // Renders via react-test-renderer, loads/creates baseline, sets
    // state.actual and resolvedExpected for pipeline comparison.
    async execute(state) {
        // Import react-test-renderer
        let renderer;
        try {
            renderer = await import("react-test-renderer");
        } catch {
            throw new CTGTestError("INVALID_STEP",
                "react-test-renderer is required for assertSnapshot() — install react-test-renderer");
        }

        const config = state.config;

        // Resolve baseline file path
        const filePath = this._resolveFilePath(config);

        // Size guard
        const element = typeof this._element === "function"
            ? this._element() : this._element;

        // Render to JSON tree
        const tree = renderer.create(element).toJSON();

        // Check maxSnapshotBytes
        if (config.maxSnapshotBytes) {
            const size = Buffer.byteLength(JSON.stringify(tree));
            if (size > config.maxSnapshotBytes) {
                throw new CTGTestError("INVALID_STEP",
                    "Snapshot exceeds maxSnapshotBytes limit");
            }
        }

        // Load or create baseline
        const stepPath = `${state.name} > ${this._name}`;
        const key = AssertSnapshotStep._sanitizeKey(stepPath);

        let snapData = {};
        if (existsSync(filePath)) {
            snapData = JSON.parse(readFileSync(filePath, "utf-8"));
        }

        if (config.updateSnapshots) {
            // Update mode: overwrite baseline, pass
            snapData[key] = tree;
            AssertSnapshotStep._atomicWrite(filePath, JSON.stringify(snapData, null, 2));
            state.actual = tree;
            this._resolvedExpected = tree;
            return state;
        }

        if (!(key in snapData)) {
            const createBaselines = config.createBaselines !== undefined
                ? config.createBaselines : true;
            if (createBaselines) {
                // First run: create baseline, pass
                mkdirSync(dirname(filePath), { recursive: true });
                snapData[key] = tree;
                AssertSnapshotStep._atomicWrite(filePath, JSON.stringify(snapData, null, 2));
                state.actual = tree;
                this._resolvedExpected = tree;
                return state;
            }
            // No baseline and createBaselines false: signal fail with
            // specific message. Pipeline reads _lastStepStatus FAIL
            // and records with step's message, bypassing comparison.
            state.actual = tree;
            state._lastStepStatus = CTGTestResult.STATUS.FAIL;
            state._lastStepMessage = "No baseline found and createBaselines is false";
            this._resolvedExpected = tree; // match actual to avoid double failure
            return state;
        }

        // Baseline exists: compare
        state.actual = tree;
        this._resolvedExpected = snapData[key];
        return state;
    }

    /**
     *
     * Private Methods
     *
     */

    // :: OBJECT -> STRING
    // Resolves the baseline file path from config.
    _resolveFilePath(config) {
        if (this._opts.baselinePath) return this._opts.baselinePath;
        if (config.snapshotFilePath) return config.snapshotFilePath;
        if (config.snapshotFileUrl) {
            const dir = dirname(fileURLToPath(config.snapshotFileUrl));
            return join(dir, "__snapshots__",
                basename(fileURLToPath(config.snapshotFileUrl))
                    .replace(/\.(js|mjs|ts|tsx|jsx)$/, ".snap.json"));
        }
        throw new CTGTestError("INVALID_CONFIG",
            "snapshotFilePath or snapshotFileUrl required for assertSnapshot");
    }

    /**
     *
     * Static Methods
     *
     */

    // :: STRING -> STRING
    // Sanitizes a snapshot key by escaping path separators and control chars.
    static _sanitizeKey(key) {
        return key
            .replace(/\\/g, "\\\\")
            .replace(/\//g, "\\_")
            .replace(/:/g, "\\c")
            .replace(/\0/g, "\\0")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

    // :: STRING, STRING -> VOID
    // Atomic write via unique temp file + rename.
    static _atomicWrite(targetPath, content) {
        mkdirSync(dirname(targetPath), { recursive: true });
        const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
        writeFileSync(tmpPath, content, "utf-8");
        renameSync(tmpPath, targetPath);
    }
}
