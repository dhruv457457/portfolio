// Reading and saving the site's content (data.js) and uploaded files. On Vercel each save is a
// commit to the GitHub repo, so Vercel redeploys and every change stays in the history;
// locally (no GITHUB_TOKEN) it writes the files in this folder instead.
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const env = require("./env");
const { httpError } = require("./http");

const DATA_FILE = "data.js";
const HEADER = `// Site content. The admin page (/admin) saves this file; hand edits are fine as long as
// everything after "window.SITE =" stays valid JSON.
//   projects  the work cards (cover = an image under assets/, video = a YouTube id)
//   journey   oldest first; form = the sprite's outfit (lv1 tee, lv2 hoodie, lv3 blazer), evo = that level's name
//   workflow  the trail's five stops: [title, what he thinks there]
//   tools     [group, [skills]]   loot  prize money and wins   trophies  the trophy wall (prize: USD or null)
`;

const serialize = (site) => `${HEADER}\nwindow.SITE = ${JSON.stringify(site, null, 2)};\n`;
function parse(src) {
  const start = src.indexOf("{", src.indexOf("window.SITE"));
  const end = src.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("data.js has no window.SITE object");
  return JSON.parse(src.slice(start, end + 1));
}

const useGitHub = () => !!env.github.token;
const repoPath = (p) => (env.github.root ? `${env.github.root}/${p}` : p);
const LOCAL_ROOT = path.resolve(__dirname, "..", ".."); // the site folder

async function gh(method, p, body) {
  const r = await fetch(`https://api.github.com/repos/${env.github.repo}/contents/${encodeURI(repoPath(p))}${method === "GET" ? `?ref=${encodeURIComponent(env.github.branch)}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.github.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "portfolio-admin",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 409 || r.status === 422) throw httpError(409, "The content changed since you opened it. Reload, then make your edit again.");
  if (!r.ok) { console.error("[admin] github", r.status, await r.text()); throw httpError(502, "Couldn't reach GitHub to save"); }
  return r.json();
}

// The current content and a version tag, so a save can't silently overwrite a newer one
async function load() {
  if (useGitHub()) {
    const f = await gh("GET", DATA_FILE);
    return { site: parse(Buffer.from(f.content, "base64").toString("utf8")), version: f.sha };
  }
  const src = await fs.readFile(path.join(LOCAL_ROOT, DATA_FILE), "utf8");
  return { site: parse(src), version: crypto.createHash("sha1").update(src).digest("hex") };
}

async function save(site, version) {
  const src = serialize(site);
  if (useGitHub()) {
    const out = await gh("PUT", DATA_FILE, { message: "Update site content from the admin page", content: Buffer.from(src).toString("base64"), sha: version, branch: env.github.branch });
    return { version: out.content.sha, commit: out.commit?.html_url || null };
  }
  const now = await load();
  if (now.version !== version) throw httpError(409, "The content changed since you opened it. Reload, then make your edit again.");
  await fs.writeFile(path.join(LOCAL_ROOT, DATA_FILE), src);
  return { version: crypto.createHash("sha1").update(src).digest("hex"), commit: null };
}

// An uploaded file goes under assets/uploads/ with a fresh name; returns its path for data.js
async function putFile(name, ext, bytes) {
  const slug = String(name).toLowerCase().replace(/\.[^.]*$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
  const rel = `assets/uploads/${slug}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  if (useGitHub()) {
    await gh("PUT", rel, { message: `Upload ${rel} from the admin page`, content: bytes.toString("base64"), branch: env.github.branch });
  } else {
    await fs.mkdir(path.join(LOCAL_ROOT, "assets", "uploads"), { recursive: true });
    await fs.writeFile(path.join(LOCAL_ROOT, rel), bytes);
  }
  return rel;
}

module.exports = { load, save, putFile, parse, serialize, useGitHub };
