# CTGVitestFormatter

Execution formatter that runs pipeline steps in-process with accurate five-status tracking. Can be used inside Vitest test files or standalone. Provides `getReport()` for programmatic access to pipeline results.

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| _isExecutionFormatter | BOOL | `true` — signals to `CTGReactTest.start()` that this is an execution formatter |

---

### CONSTRUCTOR :: OBJECT? -> ctgVitestFormatter

Creates a formatter instance. Config: `{ sanitizeMessage? }` — optional function to redact sensitive content from `[RECOVERED]` log messages.

```javascript
const formatter = new CTGVitestFormatter();

const sanitized = new CTGVitestFormatter({
    sanitizeMessage: (msg) => msg.replace(/Bearer [^\s]+/g, "Bearer REDACTED")
});
```

---

### ctgVitestFormatter.execute :: ctgReactTest, *, OBJECT?, INT? -> PROMISE(VOID)

Executes the pipeline by running steps sequentially, tracking five-status results. Handles subject threading, skip evaluation, error recovery, halt-on-failure, chain recursion, and per-step timeout. Runs cleanup after the top-level pipeline (not after chained sub-pipelines).

```javascript
const formatter = new CTGVitestFormatter();
await pipeline.start(subject, { formatter });
```

---

### ctgVitestFormatter.getReport :: VOID -> OBJECT|NULL

Returns the pipeline report with accurate five-status counts. Available after `execute()` completes.

```javascript
const report = formatter.getReport();
// { name, status, passed, failed, skipped, recovered, errored, total, duration_ms, steps }
```

---

### CTGVitestFormatter.format :: OBJECT, OBJECT? -> STRING

Static output formatter interface. Returns JSON representation of a completed report. Used when the formatter is passed to a standalone `start()` call as an output formatter (not execution formatter).

---

### Five-Status Mapping

| Pipeline Status | Formatter Behavior |
|----------------|-------------------|
| pass | Step passes |
| fail | Step fails (assertion mismatch) |
| error | Step throws (unhandled or timeout) |
| recovered | Step passes, `console.warn("[RECOVERED]", name, message)` logged |
| skip | Step skipped (unconditional or conditional predicate true) |

In Vitest runner output, recovered appears as pass and conditional skip appears as pass. `getReport()` provides the true five-status counts.
