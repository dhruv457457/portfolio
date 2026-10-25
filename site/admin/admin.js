// The admin page: sign in, then edit the site's content in forms built from schema.js.
// Every field shows its limit as you type; Save checks everything again on the server.
(() => {
  const { SCHEMA, TABS, UPLOAD, validate, check, words } = window.AdminSchema;
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    n.append(...kids.filter((k) => k != null));
    return n;
  };

  const state = { site: null, version: null, tab: TABS[0].id, dirty: false };

  async function api(path, body, method = body ? "POST" : "GET") {
    const r = await fetch(`/api/admin/${path}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, data, retry: r.headers.get("Retry-After") };
  }

  /* ---------- signing in ---------- */
  async function boot() {
    const me = await api("me");
    if (me.data.signedIn) return openEditor();
    $("#login").hidden = false;
    $("#code-row").hidden = !me.data.code;
    if (!me.data.ready) $("#login-msg").textContent = "Sign-in isn't set up on this server yet (see ADMIN.md).";
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), btn = e.target.querySelector("button");
    btn.disabled = true;
    $("#login-msg").textContent = "";
    const r = await api("login", { email: f.get("email"), password: f.get("password"), code: f.get("code") || undefined });
    btn.disabled = false;
    if (r.ok) { e.target.reset(); $("#login").hidden = true; return openEditor(); }
    $("#login-msg").textContent = r.status === 429 ? `Too many attempts. Try again in ${Math.ceil((+r.retry || 60) / 60)} min.` : r.data.error || "Couldn't sign in";
  });
  $("#logout").addEventListener("click", async () => {
    if (state.dirty && !confirm("Sign out without saving your changes?")) return;
    await api("logout", {});
    state.dirty = false;
    location.reload();
  });

  async function openEditor() {
    const r = await api("content");
    if (r.status === 401) { $("#app").hidden = true; $("#login").hidden = false; return; }
    if (!r.ok) { setStatus(r.data.error || "Couldn't load the content", "bad"); return; }
    state.site = r.data.site;
    state.version = r.data.version;
    $("#app").hidden = false;
    renderTabs();
    render();
    setStatus("All saved");
  }

  /* ---------- tabs and status ---------- */
  function renderTabs() {
    $("#tabs").replaceChildren(...TABS.map((t) => el("button", {
      type: "button", role: "tab", "aria-selected": String(t.id === state.tab),
      onclick: () => { state.tab = t.id; renderTabs(); render(); },
    }, t.label)));
  }
  function setStatus(text, kind = "") {
    $("#status").textContent = text;
    $("#status").className = `status ${kind}`;
  }
  function changed() {
    state.dirty = true;
    $("#save").disabled = false;
    setStatus("Unsaved changes", "dirty");
  }
  addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- building forms from the schema ---------- */
  const SHORT = new Set(["text", "email", "handle", "url", "youtube", "int", "select", "bool"]);
  function blank(rule) {
    switch (rule.kind) {
      case "object": return Object.fromEntries(Object.entries(rule.fields).map(([k, r]) => [k, blank(r)]));
      case "tuple": return rule.items.map(blank);
      case "list": return Array.from({ length: rule.min }, () => blank(rule.item));
      case "lines": return Array.from({ length: Math.max(1, rule.min) }, () => "");
      case "tags": return [];
      case "int": return rule.nullable ? null : rule.min;
      case "bool": return false;
      case "select": return rule.options[0];
      default: return "";
    }
  }
  // the problem with one value, if any, so a field can show it right away
  function problem(rule, value) {
    const errs = [];
    check(rule, value, "", errs);
    return errs[0]?.msg.replace(/^[^:]+: /, "") || "";
  }

  // An editor for one value: get/set read and write it in state.site
  function editor(rule, get, set) {
    switch (rule.kind) {
      case "object": return objectEditor(rule, get, set);
      case "tuple": return el("div", { class: "row" }, ...rule.items.map((r, i) => editor(r, () => get()[i], (v) => { const t = get(); t[i] = v; set(t); })));
      case "list": return listEditor(rule, get, set);
      case "lines": return linesEditor(rule, get, set);
      case "tags": return tagsEditor(rule, get, set);
      case "file": return fileEditor(rule, get, set);
      case "bool": return el("label", { class: "check" }, el("input", { type: "checkbox", checked: !!get(), onchange: (e) => { set(e.target.checked); changed(); } }), rule.label);
      case "select": return el("label", { class: "field" }, rule.label, el("select", { onchange: (e) => { set(e.target.value); changed(); } }, ...rule.options.map((o) => el("option", { value: o, selected: get() === o }, o))));
      default: return textEditor(rule, get, set);
    }
  }
  function textEditor(rule, get, set) {
    const long = rule.kind === "area";
    const count = el("span", { class: "count" });
    const wrap = el("label", { class: "field" }, rule.label);
    const input = el(long ? "textarea" : "input", {
      type: rule.kind === "int" ? "number" : rule.kind === "email" ? "email" : rule.kind === "url" ? "url" : "text",
      rows: long ? 3 : undefined,
      placeholder: rule.kind === "url" ? "https://…" : rule.kind === "youtube" ? "e.g. pVGbFo1ATDU" : rule.optional ? "(optional)" : undefined,
      oninput: (e) => {
        const raw = e.target.value;
        set(rule.kind === "int" ? (raw === "" ? (rule.nullable ? null : "") : Number(raw)) : raw);
        update();
        changed();
      },
    });
    input.value = get() ?? "";
    function update() {
      const v = String(get() ?? ""), err = problem(rule, get());
      const parts = [];
      if (rule.max && rule.kind !== "int") parts.push(`${v.trim().length}/${rule.max}`);
      if (rule.words) parts.push(`${words(v)}/${rule.words} words`);
      count.textContent = err || parts.join(" · ");
      wrap.classList.toggle("over", !!err);
    }
    wrap.append(input, count);
    update();
    return wrap;
  }
  function objectEditor(rule, get, set) {
    const box = el("div", { class: "fields" });
    let row = null;
    for (const [k, r] of Object.entries(rule.fields)) {
      const ed = editor(r, () => get()[k], (v) => { const o = get(); o[k] = v; set(o); });
      if (SHORT.has(r.kind)) { if (!row) { row = el("div", { class: "row" }); box.append(row); } row.append(ed); }
      else { row = null; box.append(ed); }
    }
    return box;
  }
  function listEditor(rule, get, set) {
    const box = el("div", { class: "items" });
    const draw = () => {
      const arr = get();
      const title = (item, i) => {
        const v = typeof rule.title === "number" ? item?.[rule.title] : item?.[rule.title];
        return `${i + 1}. ${v || "(new)"}`;
      };
      const move = (i, d) => { const a = get(); [a[i], a[i + d]] = [a[i + d], a[i]]; set(a); changed(); draw(); };
      box.replaceChildren(
        ...arr.map((item, i) => el("div", { class: "card item" },
          el("div", { class: "item-head" },
            el("h3", {}, title(item, i)),
            rule.fixed ? null : el("button", { type: "button", class: "small", disabled: i === 0, "aria-label": "Move up", onclick: () => move(i, -1) }, "↑"),
            rule.fixed ? null : el("button", { type: "button", class: "small", disabled: i === arr.length - 1, "aria-label": "Move down", onclick: () => move(i, 1) }, "↓"),
            rule.fixed ? null : el("button", { type: "button", class: "small danger", disabled: arr.length <= rule.min, onclick: () => { if (confirm(`Remove "${title(item, i)}"?`)) { const a = get(); a.splice(i, 1); set(a); changed(); draw(); } } }, "Remove"),
          ),
          editor(rule.item, () => get()[i], (v) => { const a = get(); a[i] = v; set(a); box.querySelectorAll(".item-head h3")[i].textContent = title(get()[i], i); }),
        )),
        rule.fixed || arr.length >= rule.max ? null : el("button", { type: "button", class: "ghost add", onclick: () => { const a = get(); a.push(blank(rule.item)); set(a); changed(); draw(); } }, `+ Add (${arr.length}/${rule.max})`),
      );
    };
    draw();
    return box;
  }
  function linesEditor(rule, get, set) {
    const box = el("div", { class: "fields" }, el("span", { class: "muted" }, rule.label));
    const list = el("div", { class: "fields" });
    const draw = () => {
      const arr = get();
      list.replaceChildren(
        ...arr.map((_, i) => el("div", { class: "fields" },
          textEditor({ ...rule.item, label: `${rule.item.label} ${i + 1}` }, () => get()[i], (v) => { const a = get(); a[i] = v; set(a); }),
          arr.length > rule.min ? el("button", { type: "button", class: "small danger add", onclick: () => { const a = get(); a.splice(i, 1); set(a); changed(); draw(); } }, "Remove point") : null,
        )),
        arr.length < rule.max ? el("button", { type: "button", class: "ghost add", onclick: () => { const a = get(); a.push(""); set(a); changed(); draw(); } }, "+ Add a point") : null,
      );
    };
    box.append(list);
    draw();
    return box;
  }
  function tagsEditor(rule, get, set) {
    const wrap = el("div", { class: "field" }, el("span", {}, rule.label));
    const box = el("div", { class: "tags" });
    const count = el("span", { class: "count" });
    const input = el("input", { placeholder: "type, then Enter", maxlength: rule.itemMax });
    const draw = () => {
      const arr = get();
      box.replaceChildren(...arr.map((t, i) => el("span", {}, t, el("button", { type: "button", "aria-label": `Remove ${t}`, onclick: () => { const a = get(); a.splice(i, 1); set(a); changed(); draw(); } }, "×"))), input);
      input.disabled = arr.length >= rule.max;
      count.textContent = `${arr.length}/${rule.max}`;
    };
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== ",") return;
      e.preventDefault();
      const v = input.value.trim();
      if (!v || get().length >= rule.max) return;
      const a = get(); a.push(v.slice(0, rule.itemMax)); set(a);
      input.value = "";
      changed(); draw(); input.focus();
    });
    wrap.append(box, count);
    draw();
    return wrap;
  }
  function fileEditor(rule, get, set) {
    const wrap = el("div", { class: "field" }, el("span", {}, `${rule.label} · ${rule.accept.join("/")}, under ${UPLOAD.maxBytes / 1024} KB`));
    const row = el("div", { class: "file" });
    const msg = el("span", { class: "count" });
    const draw = () => {
      const v = get();
      const isImg = v && !v.endsWith(".pdf");
      row.replaceChildren(
        isImg ? el("img", { src: `/${v}`, alt: "" }) : v ? el("a", { href: `/${v}`, target: "_blank", rel: "noopener" }, "open file") : el("span", { class: "muted" }, "no file"),
        v ? el("code", {}, v) : null,
        el("label", { class: "ghost" }, "Upload…", el("input", { type: "file", hidden: true, accept: rule.accept.map((x) => `.${x}`).join(","), onchange: (e) => upload(e.target.files[0]) })),
        v && rule.optional ? el("button", { type: "button", class: "small danger", onclick: () => { set(""); changed(); draw(); } }, "Clear") : null,
      );
    };
    async function upload(file) {
      if (!file) return;
      const ext = (file.name.split(".").pop() || "").toLowerCase().replace("jpeg", "jpg");
      if (!rule.accept.includes(ext)) { msg.textContent = `Only ${rule.accept.join("/")} files`; return; }
      if (file.size > UPLOAD.maxBytes) { msg.textContent = `That's ${Math.round(file.size / 1024)} KB: the limit is ${UPLOAD.maxBytes / 1024} KB. Try a WebP at 1024px wide.`; return; }
      msg.textContent = "Uploading…";
      const data = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.readAsDataURL(file); });
      const r = await api("upload", { name: file.name, data });
      if (!r.ok) { msg.textContent = r.data.error || "Upload failed"; return; }
      msg.textContent = "Uploaded. Save to use it.";
      set(r.data.path); changed(); draw();
    }
    wrap.append(row, msg);
    draw();
    return wrap;
  }

  function render() {
    const tab = TABS.find((t) => t.id === state.tab);
    $("#editor").replaceChildren(...tab.keys.map((key) => {
      const rule = SCHEMA[key];
      if (state.site[key] === undefined) state.site[key] = blank(rule);
      return el("section", { class: "section" },
        el("h2", {}, rule.label || ({ name: "Name", tagline: "Tagline", links: "Socials", loot: "Totals", pitch: "Pitch" })[key] || key),
        editor(rule, () => state.site[key], (v) => { state.site[key] = v; }),
      );
    }));
  }

  /* ---------- saving ---------- */
  const where = (path) => {
    const [key, i] = path.split(".");
    const tab = TABS.find((t) => t.keys.includes(key));
    return `${tab ? tab.label : key}${/^\d+$/.test(i || "") ? ` #${+i + 1}` : ""}`;
  };
  function showProblems(errors) {
    const box = $("#problems");
    if (!errors.length) { box.hidden = true; return; }
    box.replaceChildren(el("strong", {}, "Fix these before saving:"), el("ul", {}, ...errors.slice(0, 20).map((e) => el("li", {}, `${where(e.path)}: ${e.msg}`))));
    box.hidden = false;
  }
  $("#save").addEventListener("click", async () => {
    const checked = validate(state.site);
    showProblems(checked.errors);
    if (!checked.ok) { setStatus("Some fields need fixing", "bad"); return; }
    $("#save").disabled = true;
    setStatus("Saving…");
    const r = await api("content", { site: state.site, version: state.version }, "PUT");
    if (r.ok) {
      state.version = r.data.version;
      state.dirty = false;
      setStatus(r.data.live === "now" ? "Saved" : "Saved · the site updates in about a minute");
      return;
    }
    $("#save").disabled = false;
    if (r.status === 401) { setStatus("Signed out: sign in again, then save", "bad"); $("#login").hidden = false; return; }
    if (r.status === 422) showProblems(r.data.errors || []);
    setStatus(r.data.error || "Couldn't save", "bad");
  });

  boot();
})();
