// Signing in, safely: a slow scrypt hash (so a leaked hash is hard to crack), limits on wrong
// guesses per IP and in total, an optional authenticator code, and short server-side sessions.
const crypto = require("crypto");
const env = require("./env");
const { store } = require("./store");
const { httpError } = require("./http");

const SESSION_TTL = 2 * 60 * 60; // two hours, then sign in again
const COOKIE = "__Host-pp_admin"; // __Host-: https only, this site only, the whole path
const LIMITS = {
  perIp: { max: 5, window: 15 * 60 }, // 5 wrong tries from one address per 15 minutes
  total: { max: 20, window: 60 * 60, lock: 60 * 60 }, // 20 from anywhere in an hour locks sign-in for an hour
};

const sha256 = (s) => crypto.createHash("sha256").update(s).digest();
const sameText = (a, b) => crypto.timingSafeEqual(sha256(String(a)), sha256(String(b)));

// "scrypt:N:r:p:salt:hash" (base64url), made by tools/admin-password.js
function checkPassword(password, stored) {
  const [, N, r, p, salt, hash] = String(stored).split(":");
  const want = Buffer.from(hash || "", "base64url");
  return new Promise((resolve) => {
    if (!want.length) return resolve(false);
    crypto.scrypt(String(password), Buffer.from(salt, "base64url"), want.length, { N: +N, r: +r, p: +p, maxmem: 256 * +N * +r }, (err, got) => {
      resolve(!err && crypto.timingSafeEqual(got, want));
    });
  });
}

// RFC 6238 codes (30s, 6 digits, SHA-1), the kind Google Authenticator shows
function base32(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "")) { const v = A.indexOf(ch); if (v < 0) return null; bits += v.toString(2).padStart(5, "0"); }
  return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
}
function totp(key, step, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}
// which 30-second step the code matches (one step either side, for clock drift), or -1
function totpStep(secret, code, now = Date.now()) {
  const key = base32(secret);
  if (!key || !/^\d{6}$/.test(String(code || ""))) return -1;
  const t = Math.floor(now / 30000);
  for (const s of [t, t - 1, t + 1]) if (sameText(totp(key, s), code)) return s;
  return -1;
}

function needStore() {
  if (!store) throw httpError(503, "Sign-in is switched off until the rate-limit store is set up");
  return store;
}

// Throws 429 if this address, or everyone together, has guessed wrong too often
async function guardLogin(ip) {
  const s = needStore();
  const lock = await s.ttl("login:lock");
  if (lock > 0) throw httpError(429, "Too many attempts. Try again later.", { "Retry-After": String(lock) });
  const mine = Number((await s.get(`login:ip:${ip}`)) || 0);
  if (mine >= LIMITS.perIp.max) {
    const wait = await s.ttl(`login:ip:${ip}`);
    throw httpError(429, "Too many attempts. Try again later.", { "Retry-After": String(Math.max(wait, 1)) });
  }
}
async function loginFailed(ip) {
  const s = needStore();
  await s.incr(`login:ip:${ip}`, LIMITS.perIp.window);
  const all = await s.incr("login:total", LIMITS.total.window);
  if (all >= LIMITS.total.max) await s.set("login:lock", 1, LIMITS.total.lock);
  console.warn(`[admin] failed sign-in from ${ip} (${all} in the last hour)`);
}

// Checks the email, password and (if set up) the code. Always does the slow hash, so a wrong
// email takes as long as a wrong password and gives nothing away.
async function verify({ email, password, code }) {
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) return false;
  const okPassword = await checkPassword(password, env.passwordHash);
  const okEmail = sameText(email.trim().toLowerCase(), env.adminEmail);
  if (!okPassword || !okEmail) return false;
  if (!env.totpSecret) return true;
  const step = totpStep(env.totpSecret, code);
  if (step < 0) return false;
  const s = needStore();
  const last = Number((await s.get("login:totp-step")) || -1);
  if (step <= last) return false; // each code works once
  await s.set("login:totp-step", step, 120);
  return true;
}

async function startSession(res) {
  const token = crypto.randomBytes(32).toString("base64url");
  await needStore().set(`sess:${sha256(token).toString("hex")}`, Date.now(), SESSION_TTL);
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`);
}
function readCookie(req) {
  const m = String(req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE.replace(/[-]/g, "\\-")}=([\\w-]{43})(?:;|$)`));
  return m ? m[1] : null;
}
async function hasSession(req) {
  const token = readCookie(req);
  if (!token || !store) return false;
  return (await store.get(`sess:${sha256(token).toString("hex")}`)) !== null;
}
async function requireSession(req) {
  if (!(await hasSession(req))) throw httpError(401, "Please sign in");
}
async function endSession(req, res) {
  const token = readCookie(req);
  if (token && store) await store.del(`sess:${sha256(token).toString("hex")}`);
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

module.exports = { guardLogin, loginFailed, verify, startSession, hasSession, requireSession, endSession, totp, base32, totpStep, checkPassword, store };
