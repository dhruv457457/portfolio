#!/usr/bin/env node
// Runs the site and its admin API locally, the way Vercel will:  node tools/dev-server.js [port]
// Settings come from .env.local. Without GITHUB_TOKEN, saves write to site/ on disk.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "site");
const PORT = Number(process.argv[2]) || 5180;

// .env.local: KEY=value per line; # comments
const envFile = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".mp3": "audio/mpeg", ".ico": "image/x-icon", ".woff2": "font/woff2" };

// the same headers vercel.json sets, so the admin's CSP is tested locally too
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const headersFor = (url) => vercel.headers
  .filter((h) => new RegExp(`^${h.source.replace(/\(\.\*\)/g, ".*")}$`).test(url))
  .flatMap((h) => h.headers);

http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  for (const { key, value } of headersFor(url)) res.setHeader(key, value);
  const api = url.match(/^\/api\/admin\/([a-z]+)$/);
  if (api) {
    const file = path.join(ROOT, "api", "admin", `${api[1]}.js`);
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
    req.headers["x-real-ip"] = req.socket.remoteAddress; // Vercel sets this at its edge
    return require(file)(req, res);
  }
  if (url.startsWith("/api/")) { res.statusCode = 404; return res.end("Not found"); } // never serve the API's source
  if (url === "/admin") { res.statusCode = 308; res.setHeader("Location", "/admin/"); return res.end(); }
  let file = path.resolve(ROOT, `.${url}`);
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-cache");
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`site + admin on http://localhost:${PORT}  (admin: /admin/)`));
