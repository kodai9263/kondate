import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const bundle = await build({ entryPoints: ["mobile/src/settings-preview.tsx"], bundle: true, write: false, format: "esm", jsx: "automatic" });
const css = readFileSync("mobile/src/style.css");
createServer((req, res) => {
 if (req.url === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].contents); }
 else if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
 else { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>スマホ表示確認</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>'); }
}).listen(4327, "127.0.0.1", () => console.log("http://127.0.0.1:4327"));
