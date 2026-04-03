import CTGTestResult from "../../../ctg-js-test/src/CTGTestResult.js"; // Result factories

// Execution adapter for Vitest — registers pipeline steps as runtime it() blocks
export default class CTGVitestFormatter {

    /* Static Fields */

    static _isExecutionFormatter = true;

    // CONSTRUCTOR :: OBJECT? -> this
    // Accepts optional config: { sanitizeMessage }
    constructor(config = {}) {
        this._sanitizeMessage = config.sanitizeMessage || null;
        this._statuses = [];
        this._report = null;
        this._isNested = false;
    }

    /**
     *
     * Instance Methods
     *
     */

    // :: ctgReactTest, *, OBJECT? -> PROMISE(VOID)
    // Executes the pipeline by running steps sequentially, tracking statuses,
    // and producing a report.
    // NOTE: v1.0.0 executes steps in-process rather than emitting Vitest
    // describe/it registrations. This provides correct five-status semantics
    // and subject threading without requiring Vitest's runtime context.
    // Future versions may emit real describe/it blocks for native Vitest
    // integration (skip display, watch mode, filtering).
    async execute(pipeline, subject, config = {}, depth = 0) {
        if (depth >= 64) {
            throw new Error("Chain depth exceeds maximum of 64");
        }
        this._depth = depth;

        const state = {
            subject,
            halted: false,
            statuses: []
        };

        const steps = pipeline.steps;
        const skips = pipeline.skips;
        const skipMap = new Map();
        for (const skip of skips) {
            skipMap.set(skip.name.trim(), skip);
        }

        for (const step of steps) {
            const trimmedName = step.name.trim();
            const skipDirective = skipMap.get(trimmedName);

            // Check unconditional skip
            if (skipDirective && skipDirective.predicate === null) {
                state.statuses.push({ name: trimmedName, status: "skip" });
                continue;
            }

            // Check conditional skip
            const timeoutMs = config.timeout ? Math.round(config.timeout * 1000) : 0;
            if (skipDirective && skipDirective.predicate) {
                try {
                    const shouldSkip = await this._withTimeout(
                        Promise.resolve(skipDirective.predicate(state.subject)),
                        timeoutMs, `${trimmedName} (skip predicate)`);
                    if (shouldSkip) {
                        state.statuses.push({ name: trimmedName, status: "skip" });
                        continue;
                    }
                } catch (err) {
                    state.statuses.push({ name: trimmedName, status: "error" });
                    if (config.haltOnFailure !== false) { state.halted = true; }
                    continue;
                }
            }

            // Check halted
            if (state.halted) {
                state.statuses.push({ name: trimmedName, status: "skip" });
                continue;
            }

            // Execute step with timeout guard
            let status;
            try {
                status = await this._withTimeout(
                    this._executeStep(step, state, config, pipeline),
                    timeoutMs, trimmedName);
            } catch (err) {
                status = "error";
            }
            state.statuses.push({ name: trimmedName, status });

            if ((status === "fail" || status === "error") && config.haltOnFailure !== false) {
                state.halted = true;
            }
        }

        // Build report from statuses
        const resultSteps = state.statuses.map((s) => ({ status: s.status, name: s.name, duration_ms: 0 }));
        this._report = CTGTestResult.report(pipeline.name, resultSteps);
        this._statuses = state.statuses;
        this._finalSubject = state.subject;

        // Cleanup — only at top level, not in chained sub-formatters
        if (!this._isNested) {
            try {
                const rtl = await import("@testing-library/react");
                if (rtl.cleanup) rtl.cleanup();
            } catch {
                // not available
            }
        }
    }

    // :: ctgTestStep, OBJECT, OBJECT, ctgReactTest -> PROMISE(STRING)
    // Executes a single step, updates state, returns status string.
    async _executeStep(step, state, config, pipeline) {
        switch (step.type) {
            case "stage":
            case "interact":
            case "render":
            case "renderHook":
                return this._executeMutatingStep(step, state, config, pipeline);
            case "assert":
                return this._executeAssertStep(step, state, config, pipeline);
            case "assert-any":
                return this._executeAssertAnyStep(step, state, config, pipeline);
            case "snapshot":
                return this._executeSnapshotStep(step, state, config, pipeline);
            case "chain":
                return this._executeChainStep(step, state, config, pipeline);
            default:
                return "error";
        }
    }

    // :: ctgTestStep, OBJECT, OBJECT, ctgReactTest -> PROMISE(STRING)
    // Executes stage/interact/render/renderHook — updates state.subject.
    async _executeMutatingStep(step, state, config, pipeline) {
        try {
            let newSubject;
            if (step.type === "render") {
                newSubject = await pipeline._executeRender(step, state.subject, config);
                if (newSubject._newSubject) {
                    state.subject = newSubject._newSubject;
                    delete newSubject._newSubject;
                }
                return newSubject.status;
            }
            if (step.type === "renderHook") {
                newSubject = await pipeline._executeRenderHook(step, state.subject, config);
                if (newSubject._newSubject) {
                    state.subject = newSubject._newSubject;
                    delete newSubject._newSubject;
                }
                return newSubject.status;
            }
            if (step.type === "interact") {
                newSubject = await pipeline._executeInteract(step, state.subject, config);
                if (newSubject._newSubject) {
                    state.subject = newSubject._newSubject;
                    delete newSubject._newSubject;
                }
                return newSubject.status;
            }
            // stage
            const result = await step.fn(state.subject);
            state.subject = result;
            return "pass";
        } catch (err) {
            if (step.errorHandler) {
                try {
                    const recovered = await step.errorHandler(err);
                    state.subject = recovered;
                    const msg = this._sanitize(`Error recovered: ${err.message}`);
                    console.warn("[RECOVERED]", step.name, msg);
                    return "recovered";
                } catch {
                    return "error";
                }
            }
            return "error";
        }
    }

    // :: ctgTestStep, OBJECT, OBJECT, ctgReactTest -> PROMISE(STRING)
    // Executes an assert step — compares fn result against expected.
    async _executeAssertStep(step, state, config, pipeline) {
        try {
            const actual = await step.fn(state.subject);
            const matched = pipeline.compare(actual, step.expected, config.strict !== false);
            return matched ? "pass" : "fail";
        } catch (err) {
            if (step.errorHandler) {
                try {
                    const recovered = await step.errorHandler(err);
                    const matched = pipeline.compare(recovered, step.expected, config.strict !== false);
                    if (matched) {
                        const msg = this._sanitize(`Error recovered: ${err.message}`);
                        console.warn("[RECOVERED]", step.name, msg);
                        return "recovered";
                    }
                    return "fail";
                } catch {
                    return "error";
                }
            }
            return "error";
        }
    }

    // :: ctgTestStep, OBJECT, OBJECT, ctgReactTest -> PROMISE(STRING)
    // Executes an assertAny step.
    async _executeAssertAnyStep(step, state, config, pipeline) {
        try {
            const actual = await step.fn(state.subject);
            for (const candidate of step.expected) {
                if (pipeline.compare(actual, candidate, config.strict !== false)) return "pass";
            }
            return "fail";
        } catch {
            return "error";
        }
    }

    // :: ctgTestStep, OBJECT, OBJECT, ctgReactTest -> PROMISE(STRING)
    // Executes a snapshot step via the pipeline's snapshot manager.
    async _executeSnapshotStep(step, state, config, pipeline) {
        try {
            const result = await pipeline._executeSnapshot(step, state.subject, config);
            return result.status;
        } catch {
            return "error";
        }
    }

    // :: ctgTestStep, OBJECT, OBJECT, ctgReactTest -> PROMISE(STRING)
    // Executes a chain step by recursing into the chained pipeline's steps.
    async _executeChainStep(step, state, config, pipeline) {
        const chainPipeline = step.fn;
        const subFormatter = new CTGVitestFormatter({ sanitizeMessage: this._sanitizeMessage });
        subFormatter._isNested = true;
        const nextDepth = (this._depth || 0) + 1;
        await subFormatter.execute(chainPipeline, state.subject, config, nextDepth);
        const subReport = subFormatter.getReport();

        // Thread subject back from chain
        state.subject = subFormatter._finalSubject;

        state.statuses.push(...subFormatter._statuses.map((s) => ({
            name: `${step.name} > ${s.name}`, status: s.status
        })));

        return subReport.status;
    }

    // :: PROMISE(*), INT, STRING -> PROMISE(*)
    // Wraps a promise with a timeout guard. Returns the promise result or throws on timeout.
    async _withTimeout(promise, timeoutMs, stepName) {
        if (!timeoutMs || timeoutMs <= 0) return promise;
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Step '${stepName}' timed out after ${timeoutMs}ms`)), timeoutMs);
        });
        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timer);
            return result;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    }

    // :: STRING -> STRING
    // Applies sanitizeMessage if configured.
    _sanitize(msg) {
        if (this._sanitizeMessage) return this._sanitizeMessage(msg);
        return msg;
    }

    // :: VOID -> OBJECT|NULL
    // Returns the pipeline report with accurate five-status counts.
    getReport() {
        return this._report;
    }

    /**
     *
     * Static Methods
     *
     */

    // :: OBJECT, OBJECT? -> STRING
    // Output formatter interface — formats a completed report for display.
    static format(report, config = {}) {
        return JSON.stringify(report, null, 2);
    }
}
