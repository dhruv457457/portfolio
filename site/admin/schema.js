// What the admin page can edit, and the limits on every field. The same rules run in the browser
// (as you type) and on the server (before anything is saved), so nothing oversized or malformed gets in.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AdminSchema = api;
})(typeof self !== "undefined" ? self : globalThis, () => {
  const optional = { optional: true };
  const text = (label, max, more) => ({ kind: "text", label, max, ...more });
  const area = (label, max, words, more) => ({ kind: "area", label, max, words, ...more });
  const tags = (label, max, itemMax) => ({ kind: "tags", label, max, itemMax });
  const lines = (label, min, max, item) => ({ kind: "lines", label, min, max, item });
  const int = (label, min, max, more) => ({ kind: "int", label, min, max, ...more });
  const list = (label, min, max, item, more) => ({ kind: "list", label, min, max, item, ...more });
  const object = (fields) => ({ kind: "object", fields });

  const SCHEMA = {
    name: text("Name", 40),
    tagline: area("Tagline", 140, 24),
    links: object({
      email: { kind: "email", label: "Email", max: 254 },
      github: { kind: "handle", label: "GitHub username", max: 39 },
      linkedin: { kind: "handle", label: "LinkedIn handle", max: 100 },
      x: { kind: "handle", label: "X handle", max: 15 },
      resume: { kind: "file", label: "Résumé (PDF)", accept: ["pdf"], ...optional },
    }),
    projects: list("Projects", 1, 12, object({
      name: text("Name", 40),
      kind: text("One-line description", 70),
      chips: tags("Chips (up to 4)", 4, 40),
      text: area("About it", 440, 75),
      live: { kind: "url", label: "Live link", ...optional },
      code: { kind: "url", label: "Code link", ...optional },
      video: { kind: "youtube", label: "YouTube video id", ...optional },
      cover: { kind: "file", label: "Cover image", accept: ["webp", "png", "jpg"], ...optional },
      team: { kind: "bool", label: "Team project", ...optional },
    }), { title: "name" }),
    journey: list("Experience", 1, 6, object({
      role: text("Role", 60),
      at: text("Where", 50),
      meta: text("Type · dates · place", 70),
      form: { kind: "select", label: "Outfit at this level", options: ["lv1", "lv2", "lv3"] },
      evo: text("Level name", 30),
      points: lines("What you did", 1, 6, area("Point", 300, 55)),
      tech: tags("Tech (up to 8)", 8, 24),
    }), { title: "at" }),
    tools: list("Skills", 1, 10, { kind: "tuple", items: [text("Group", 20), tags("Skills (up to 14)", 14, 24)] }, { title: 0 }),
    loot: object({
      total: int("Total prize money (USD)", 0, 10000000),
      wins: int("Hackathon wins", 0, 999),
    }),
    trophies: list("Trophies", 0, 30, object({
      prize: int("Prize (USD, blank if not shown)", 0, 10000000, { nullable: true }),
      place: text("Place", 40),
      event: text("Event", 70),
      project: text("Project", 40),
      note: area("Note", 140, 24),
      year: int("Year", 2000, 2100),
      solo: { kind: "bool", label: "Solo", ...optional },
    }), { title: "event" }),
    // the trail always has five stops (the pixel me hops exactly five), so only their words change
    workflow: list("How a ticket travels (5 stops)", 5, 5, { kind: "tuple", items: [text("Stop", 26), area("What he thinks there", 150, 26)] }, { title: 0, fixed: true }),
    pitch: object({
      line: text("Opening line", 80),
      tail: text("Second line", 80),
      roles: list("Who's asking (3 choices)", 3, 3, object({
        who: text("Choice", 24),
        title: text("Answer headline", 60),
        points: lines("Answer points", 1, 4, area("Point", 170, 28)),
      }), { title: "who", fixed: true }),
    }),
  };

  // the admin page's tabs: which parts of the content each one edits
  const TABS = [
    { id: "profile", label: "Profile & socials", keys: ["name", "tagline", "links"] },
    { id: "projects", label: "Projects", keys: ["projects"] },
    { id: "experience", label: "Experience", keys: ["journey"] },
    { id: "achievements", label: "Achievements", keys: ["loot", "trophies"] },
    { id: "skills", label: "Skills", keys: ["tools"] },
    { id: "pitch", label: "Pitch & trail", keys: ["pitch", "workflow"] },
  ];

  const UPLOAD = { maxBytes: 300 * 1024, types: { png: "image/png", jpg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" } };
  const MAX_CONTENT_BYTES = 64 * 1024;

  const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  // control characters never belong in content (newlines are fine in longer text)
  const clean = (s, multiline) => s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "").trim();
  function isHttpsUrl(s) {
    try { const u = new URL(s); return u.protocol === "https:" && !!u.hostname; } catch { return false; }
  }
  const FILE_PATH = /^assets\/[A-Za-z0-9/_.-]+\.([a-z0-9]+)$/;

  // Checks a value against its rule. Returns the cleaned value (only known keys, trimmed text);
  // anything wrong is pushed onto errors as { path, msg }.
  function check(rule, value, path, errors) {
    const fail = (msg) => { errors.push({ path, msg: `${rule.label ? rule.label + ": " : ""}${msg}` }); return undefined; };
    const empty = value === undefined || value === null || value === "";
    switch (rule.kind) {
      case "text":
      case "area": {
        if (typeof value !== "string" && !empty) return fail("must be text");
        const v = clean(value || "", rule.kind === "area");
        if (!v) return rule.optional ? undefined : fail("can't be empty");
        if (v.length > rule.max) return fail(`${v.length}/${rule.max} characters`);
        if (rule.words && words(v) > rule.words) return fail(`${words(v)}/${rule.words} words`);
        return v;
      }
      case "email": {
        const v = clean(String(value || ""));
        if (!v) return fail("can't be empty");
        if (v.length > rule.max || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return fail("not a valid email");
        return v;
      }
      case "handle": {
        const v = clean(String(value || "")).replace(/^@/, "");
        if (!v) return rule.optional ? undefined : fail("can't be empty");
        if (v.length > rule.max || !/^[A-Za-z0-9_.-]+$/.test(v)) return fail("only letters, numbers, _ . -");
        return v;
      }
      case "url": {
        const v = clean(String(value || ""));
        if (!v) return rule.optional ? undefined : fail("can't be empty");
        if (v.length > 300 || !isHttpsUrl(v)) return fail("must be a full https:// link");
        return v;
      }
      case "youtube": {
        const v = clean(String(value || ""));
        if (!v) return rule.optional ? undefined : fail("can't be empty");
        if (!/^[A-Za-z0-9_-]{11}$/.test(v)) return fail("the 11-character id from the video's link");
        return v;
      }
      case "file": {
        const v = clean(String(value || ""));
        if (!v) return rule.optional ? undefined : fail("needs a file");
        const m = v.match(FILE_PATH);
        if (!m || v.includes("..") || !rule.accept.includes(m[1] === "jpeg" ? "jpg" : m[1])) return fail(`must be an uploaded ${rule.accept.join("/")} file`);
        return v;
      }
      case "bool":
        if (empty || value === false) return undefined; // only stored when on
        if (value !== true) return fail("must be on or off");
        return true;
      case "int": {
        if (empty) return rule.nullable ? null : fail("needs a number");
        const n = typeof value === "number" ? value : Number(String(value).trim());
        if (!Number.isInteger(n) || n < rule.min || n > rule.max) return fail(`a whole number from ${rule.min} to ${rule.max}`);
        return n;
      }
      case "select":
        if (!rule.options.includes(value)) return fail(`one of ${rule.options.join(", ")}`);
        return value;
      case "tags": {
        if (!Array.isArray(value)) return fail("must be a list");
        const v = value.map((t) => clean(String(t ?? ""))).filter(Boolean);
        if (v.length > rule.max) return fail(`at most ${rule.max}`);
        const long = v.find((t) => t.length > rule.itemMax);
        if (long) return fail(`"${long.slice(0, 20)}…" is over ${rule.itemMax} characters`);
        return v;
      }
      case "lines": {
        if (!Array.isArray(value)) return fail("must be a list");
        const v = value.map((x, i) => check(rule.item, x, `${path}.${i}`, errors)).filter((x) => x !== undefined);
        if (v.length < rule.min || v.length > rule.max) return fail(`${rule.min === rule.max ? rule.min : `${rule.min} to ${rule.max}`} needed`);
        return v;
      }
      case "list": {
        if (!Array.isArray(value)) return fail("must be a list");
        if (value.length < rule.min || value.length > rule.max) return fail(rule.min === rule.max ? `exactly ${rule.min}` : `${rule.min} to ${rule.max} entries`);
        return value.map((x, i) => check(rule.item, x, `${path}.${i}`, errors));
      }
      case "tuple": {
        if (!Array.isArray(value)) return fail("must be a list");
        return rule.items.map((r, i) => check(r, value[i], `${path}.${i}`, errors));
      }
      case "object": {
        if (!value || typeof value !== "object" || Array.isArray(value)) return fail("must be a group of fields");
        const out = {};
        for (const [k, r] of Object.entries(rule.fields)) {
          const v = check(r, value[k], path ? `${path}.${k}` : k, errors);
          if (v !== undefined) out[k] = v;
        }
        return out;
      }
      default:
        return fail("unknown field");
    }
  }

  // The whole content: every section the schema knows, nothing else
  function validate(content) {
    const errors = [];
    const value = check({ kind: "object", fields: SCHEMA }, content, "", errors);
    if (!errors.length && JSON.stringify(value).length > MAX_CONTENT_BYTES) errors.push({ path: "", msg: `Everything together is over ${MAX_CONTENT_BYTES / 1024} KB` });
    return { ok: errors.length === 0, errors, value };
  }

  return { SCHEMA, TABS, UPLOAD, MAX_CONTENT_BYTES, validate, check, words };
});
