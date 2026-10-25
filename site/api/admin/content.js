// GET → the current content and its version. PUT { site, version } → checked against the
// schema's limits, then saved (a commit on Vercel). Signed-in only.
const { route, send, readJson } = require("../_lib/http");
const auth = require("../_lib/auth");
const content = require("../_lib/content");
const { SCHEMA, validate, MAX_CONTENT_BYTES } = require("../../admin/schema.js");

module.exports = route(["GET", "PUT"], async (req, res) => {
  await auth.requireSession(req);
  if (req.method === "GET") {
    const { site, version } = await content.load();
    return send(res, 200, { site, version });
  }
  const body = await readJson(req, MAX_CONTENT_BYTES * 2);
  if (typeof body.version !== "string") return send(res, 400, { error: "Missing version" });
  const checked = validate(body.site);
  if (!checked.ok) return send(res, 422, { error: "Some fields need fixing", errors: checked.errors.slice(0, 50) });
  // sections the admin doesn't edit stay exactly as they are
  const now = await content.load();
  const kept = Object.fromEntries(Object.entries(now.site).filter(([k]) => !(k in SCHEMA)));
  const saved = await content.save({ ...checked.value, ...kept }, body.version);
  send(res, 200, { ok: true, ...saved, live: content.useGitHub() ? "about a minute" : "now" });
});
