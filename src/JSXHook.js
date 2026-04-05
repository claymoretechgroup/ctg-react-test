// ESM loader hook — transforms .jsx imports via esbuild.
import { transformSync } from "esbuild";

// :: STRING, OBJECT, FUNCTION -> OBJECT
// Transforms .jsx source to plain JS via esbuild before Node evaluates it.
export async function load(url, context, nextLoad) {
    if (url.endsWith(".jsx")) {
        const result = await nextLoad(url, { ...context, format: "module" });
        const source = typeof result.source === "string"
            ? result.source
            : Buffer.from(result.source).toString("utf-8");

        const transformed = transformSync(source, {
            loader: "jsx",
            format: "esm",
            jsx: "automatic"
        });

        return {
            format: "module",
            source: transformed.code,
            shortCircuit: true
        };
    }
    return nextLoad(url, context);
}
