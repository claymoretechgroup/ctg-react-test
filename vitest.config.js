import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        include: ["tests/**/*.test.jsx"]
    },
    esbuild: {
        jsx: "automatic",
        jsxImportSource: "react"
    }
});
