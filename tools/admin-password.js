#!/usr/bin/env node
// Makes the values the admin sign-in needs, so the real password is never stored anywhere:
//   node tools/admin-password.js          asks for a password (hidden), prints ADMIN_PASSWORD_HASH
//   node tools/admin-password.js --code   also prints ADMIN_TOTP_SECRET and a link for an authenticator app
// Paste the printed lines into Vercel → Project → Settings → Environment Variables.
const crypto = require("crypto");

const N = 2 ** 15, r = 8, p = 1; // ~100ms per guess on a laptop; brute force stays impractical

function ask(prompt) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(prompt);
    if (!stdin.isTTY) { // piped in: one line
      let buf = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (d) => { buf += d; });
      stdin.on("end", () => resolve(buf.split(/\r?\n/)[0]));
      return;
    }
    let s = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const on = (ch) => {
      if (ch === "\u0003") process.exit(1); // ctrl-c
      if (ch === "\r" || ch === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", on); stdout.write("\n"); return resolve(s); }
      if (ch === "\u007f" || ch === "\b") s = s.slice(0, -1);
      else s += ch;
    };
    stdin.on("data", on);
  });
}

function base32(buf) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "", out = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i < bits.length; i += 5) out += A[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

(async () => {
  const pw = await ask("New admin password (12+ characters): ");
  if (pw.length < 12) { console.error("Too short: use at least 12 characters (a few random words works well)."); process.exit(1); }
  if (process.stdin.isTTY && (await ask("Type it again: ")) !== pw) { console.error("They don't match."); process.exit(1); }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 32, { N, r, p, maxmem: 256 * N * r });
  console.log(`\nADMIN_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${hash.toString("base64url")}`);
  if (process.argv.includes("--code")) {
    const secret = base32(crypto.randomBytes(20));
    console.log(`ADMIN_TOTP_SECRET=${secret}`);
    console.log(`\nAdd it to an authenticator app (Google Authenticator, 1Password, ...): enter the secret above by hand,`);
    console.log(`or open this link on your phone: otpauth://totp/Portfolio%20admin?secret=${secret}&issuer=Portfolio%20admin`);
  }
  console.log("\nKeep these out of git: they go in Vercel's environment variables (or .env.local for local testing).");
})();
