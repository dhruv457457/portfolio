// GET → am I signed in, and does sign-in ask for an authenticator code? (Never says more.)
const env = require("../_lib/env");
const { route, send } = require("../_lib/http");
const auth = require("../_lib/auth");

module.exports = route(["GET"], async (req, res) => {
  send(res, 200, { signedIn: await auth.hasSession(req), code: !!env.totpSecret, ready: env.missing().length === 0 && !!auth.store });
});
