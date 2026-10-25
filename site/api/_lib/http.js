// Helpers shared by the admin API: JSON in and out, the caller's IP, and a same-origin check.
// Plain Node req/res, so the same handlers run on Vercel and in tools/dev-server.js.

const BASE_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  const all = { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...headers };
  for (const [k, v] of Object.entries(all)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function httpError(status, message, headers) {
  const e = new Error(message);
  e.status = status;
  e.headers = headers;
  return e;
}

// The body as JSON, refusing anything over `limit` bytes (Vercel may have parsed it already)
async function readJson(req, limit) {
  let raw;
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    raw = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
  } else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw httpError(413, "Too large");
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.byteLength(raw) > limit) throw httpError(413, "Too large");
  return raw ? JSON.parse(raw) : {};
}

// Vercel sets x-real-ip to the real client address
function clientIp(req) {
  const real = req.headers["x-real-ip"];
  if (real) return String(real).trim();
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// Writes must come from this site's own pages, as JSON. A form on another site can't do that,
// and the session cookie is SameSite=Strict on top.
function sameOrigin(req) {
  try {
    return !!req.headers.origin && new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}
const isJson = (req) => String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json");

// Wraps a handler with method, origin and JSON checks, and errors that never leak internals
function route(methods, handler) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) return send(res, 405, { error: "Method not allowed" }, { Allow: methods.join(", ") });
      if (req.method !== "GET" && (!sameOrigin(req) || !isJson(req))) return send(res, 403, { error: "Forbidden" });
      await handler(req, res);
    } catch (e) {
      if (e instanceof SyntaxError) return send(res, 400, { error: "Bad JSON" });
      if (e.status) return send(res, e.status, { error: e.message }, e.headers || {});
      console.error("[admin]", e);
      send(res, 500, { error: "Something went wrong" });
    }
  };
}

module.exports = { send, readJson, httpError, clientIp, route };
