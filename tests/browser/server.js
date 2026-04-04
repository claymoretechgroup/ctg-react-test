// Minimal static file server for browser tests.
// Serves HTML fixtures from tests/browser/fixtures/.
// Starts on a random available port, returns { url, stop }.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png"
};

// :: VOID -> PROMISE({ url: STRING, stop: FUNCTION })
export function startServer() {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            const path = req.url === "/" ? "/index.html" : req.url;
            const filePath = join(fixturesDir, path);
            const ext = extname(filePath);
            const contentType = mimeTypes[ext] || "text/plain";

            try {
                const content = readFileSync(filePath);
                res.writeHead(200, { "Content-Type": contentType });
                res.end(content);
            } catch {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not found");
            }
        });

        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            const url = `http://127.0.0.1:${port}`;
            const stop = () => new Promise((res) => server.close(res));
            resolve({ url, stop });
        });

        server.on("error", reject);
    });
}
