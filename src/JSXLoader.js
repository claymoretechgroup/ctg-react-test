// Node.js ESM loader registration for JSX files.
// Register with: node --import ctg-react-test/jsx-loader
import { register } from "node:module";

register("./JSXHook.js", import.meta.url);
