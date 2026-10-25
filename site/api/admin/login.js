// POST { email, password, code? } → a session cookie. Wrong guesses are counted and limited.
const env = require("../_lib/env");
const { route, send, readJson, clientIp } = require("../_lib/http");
const auth = require("../_lib/auth");

module.exports = route(["POST"], async (req, res) => {
  const unset = env.missing();
  if (unset.length) return send(res, 503, { error: "The admin isn't set up yet", missing: unset });
  const ip = clientIp(req);
  await auth.guardLogin(ip);
  const body = await readJson(req, 2048);
  if (!(await auth.verify(body))) {
    await auth.loginFailed(ip);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400)); // a little extra wait on every miss
    return send(res, 401, { error: "Wrong email, password or code" });
  }
  await auth.store.del(`login:ip:${ip}`);
  await auth.startSession(res);
  console.info(`[admin] signed in from ${ip}`);
  send(res, 200, { ok: true });
});
