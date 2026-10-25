// Where the admin's settings come from. On Vercel every one is required (it fails closed);
// locally, tools/dev-server.js loads them from .env.local and saves go to the files on disk.
const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

const env = {
  isProd,
  adminEmail: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  passwordHash: (process.env.ADMIN_PASSWORD_HASH || "").trim(),
  totpSecret: (process.env.ADMIN_TOTP_SECRET || "").replace(/\s+/g, "").toUpperCase(), // optional: an authenticator app code on top
  github: {
    token: process.env.GITHUB_TOKEN || "",
    repo: process.env.GITHUB_REPO || "dhruv457457/portfolio",
    branch: process.env.GITHUB_BRANCH || "main",
    root: (process.env.SITE_DIR ?? "site").replace(/\/+$/, ""), // the site's folder inside the repo
  },
};

// what's missing before anyone can sign in (never the values themselves)
function missing() {
  const out = [];
  if (!env.adminEmail) out.push("ADMIN_EMAIL");
  if (!/^scrypt:\d+:\d+:\d+:[\w-]+:[\w-]+$/.test(env.passwordHash)) out.push("ADMIN_PASSWORD_HASH");
  if (isProd && !env.github.token) out.push("GITHUB_TOKEN");
  return out;
}

module.exports = { ...env, missing };
