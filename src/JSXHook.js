// ESM loader hook — makes the imports a React component file actually contains
// loadable by Node: JSX, TypeScript, CSS Modules, and ?raw text assets.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

// :: STRING -> STRING
// Reads a file from a file: URL, ignoring any query string.
function readSource(url) {
    return readFileSync(fileURLToPath(url.split("?")[0]), "utf8");
}

// :: STRING -> OBJECT
// A module exporting the file's text as its default export. Mirrors the ?raw
// convention bundlers use for importing an asset's contents as a string.
function rawModule(url) {
    return {
        format: "module",
        source: `export default ${JSON.stringify(readSource(url))};`,
        shortCircuit: true
    };
}

// :: STRING -> OBJECT
// A module standing in for a CSS import. A stylesheet has no runtime meaning
// under Node, but the import must still resolve or no component that has styles
// can be tested. CSS Modules get a proxy whose every property returns its own
// key, so `styles.root` is "root" — real bundlers hash that value, so nothing
// may depend on it and tests must never assert on a class name.
function styleModule(url) {
    if (!url.includes(".module.")) {
        return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return {
        format: "module",
        source: "export default new Proxy({}, { get: (_, key) => "
            + "typeof key === \"string\" ? key : undefined });",
        shortCircuit: true
    };
}

// :: STRING, OBJECT, FUNCTION -> OBJECT
// Transforms or stands in for the imports Node cannot evaluate itself. Anything
// else is passed through untouched.
export async function load(url, context, nextLoad) {
    const [path] = url.split("?");

    if (url.includes("?raw")) return rawModule(url);

    if (path.endsWith(".css")) return styleModule(path);

    const loader = loaderFor(path);
    if (loader !== null) {
        const result = await nextLoad(path, { ...context, format: "module" });
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
