// ESM loader hook — transforms .jsx, .tsx, and .ts imports via esbuild.
import { transformSync } from "esbuild";

// Extension -> esbuild loader. TypeScript is handled here rather than left to
// Node's native type stripping: stripping cannot transform JSX at all, and it
// only exists from Node 22.18, below the framework's stated Node 20 minimum.
const LOADERS = {
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".ts": "ts"
};

// :: STRING -> STRING|NULL
// Returns the esbuild loader for a URL, or null when the file is not ours.
function loaderFor(url) {
    for (const [extension, loader] of Object.entries(LOADERS)) {
        if (url.endsWith(extension)) return loader;
    }
    return null;
}

// :: STRING, OBJECT, FUNCTION -> OBJECT
// Transforms JSX/TypeScript source to plain JS via esbuild before Node
// evaluates it. Anything else is passed through untouched.
export async function load(url, context, nextLoad) {
    const loader = loaderFor(url);
    if (loader !== null) {
        const result = await nextLoad(url, { ...context, format: "module" });
        const source = typeof result.source === "string"
            ? result.source
            : Buffer.from(result.source).toString("utf-8");

        const transformed = transformSync(source, {
            loader,
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
