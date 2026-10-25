// POST { name, data (base64) } → saves an image (or a PDF résumé) under assets/uploads/.
// The type comes from the file's own bytes, never its name, and the size is capped.
const { route, send, readJson } = require("../_lib/http");
const auth = require("../_lib/auth");
const content = require("../_lib/content");
const { UPLOAD } = require("../../admin/schema.js");

function sniff(b) {
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (b.length > 5 && b.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  return null;
}

module.exports = route(["POST"], async (req, res) => {
  await auth.requireSession(req);
  const body = await readJson(req, Math.ceil(UPLOAD.maxBytes * 1.4) + 1024);
  if (typeof body.data !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(body.data)) return send(res, 400, { error: "No file" });
  const bytes = Buffer.from(body.data, "base64");
  if (bytes.length > UPLOAD.maxBytes) return send(res, 413, { error: `Files must be under ${UPLOAD.maxBytes / 1024} KB` });
  const ext = sniff(bytes);
  if (!ext) return send(res, 415, { error: "Only PNG, JPG, WebP images or a PDF" });
  const file = await content.putFile(typeof body.name === "string" ? body.name : "file", ext, bytes);
  send(res, 200, { ok: true, path: file });
});
