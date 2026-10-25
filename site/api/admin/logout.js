// POST → ends the session, on the server and in the browser
const { route, send } = require("../_lib/http");
const auth = require("../_lib/auth");

module.exports = route(["POST"], async (req, res) => {
  await auth.endSession(req, res);
  send(res, 200, { ok: true });
});
