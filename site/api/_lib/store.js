// A tiny key-value store for login attempts and sessions: Upstash Redis over its REST API in
// production (no npm packages needed), or memory when running locally.
const { isProd } = require("./env");

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(commands) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`store ${r.status}`);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error(`store: ${x.error}`); return x.result; });
}

// local only: forgets everything on restart, which is fine for testing
const mem = new Map();
const alive = (k) => { const e = mem.get(k); if (e && e.exp && e.exp < Date.now()) { mem.delete(k); return null; } return e || null; };
const memory = {
  async get(k) { return alive(k)?.v ?? null; },
  async set(k, v, ttl) { mem.set(k, { v: String(v), exp: Date.now() + ttl * 1000 }); },
  async del(k) { mem.delete(k); },
  async incr(k, ttl) { // the count, with the expiry set only when the key is new
    const e = alive(k);
    if (!e) { mem.set(k, { v: "1", exp: Date.now() + ttl * 1000 }); return 1; }
    e.v = String(Number(e.v) + 1);
    return Number(e.v);
  },
  async ttl(k) { const e = alive(k); return e ? Math.max(1, Math.ceil((e.exp - Date.now()) / 1000)) : -2; },
};
const remote = {
  async get(k) { return (await redis([["GET", k]]))[0]; },
  async set(k, v, ttl) { await redis([["SET", k, String(v), "EX", String(ttl)]]); },
  async del(k) { await redis([["DEL", k]]); },
  async incr(k, ttl) { return (await redis([["INCR", k], ["EXPIRE", k, String(ttl), "NX"]]))[0]; },
  async ttl(k) { return (await redis([["TTL", k]]))[0]; },
};

const configured = !!(URL_ && TOKEN);
// In production, no store means no login at all: rate limits must never silently switch off
const store = configured ? remote : isProd ? null : memory;

module.exports = { store, storeKind: configured ? "redis" : isProd ? "missing" : "memory" };
