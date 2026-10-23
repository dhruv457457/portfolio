// Portfolio behaviour: renders content from data.js, calm motion, theme switch,
// GitHub garden, and sound (a soft generated music loop + tiny UI sounds, off by default).

const $ = (s, r = document) => r.querySelector(s);
const S = window.SITE;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function chips(list) {
  const ul = el("ul", "chips");
  list.forEach((c) => ul.append(el("li", "", c)));
  return ul;
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

/* ---------- Render content ---------- */
$("#hero-name").textContent = S.name;
$("#hero-sub").textContent = S.tagline;

S.projects.forEach((p) => {
  const card = el("article", "project card reveal");
  if (p.video) {
    const thumb = el("button", "thumb");
    thumb.type = "button";
    thumb.setAttribute("aria-label", `Play the ${p.name} demo video`);
    const img = el("img");
    img.alt = "";
    img.loading = "lazy";
    // Not every video has a large thumbnail. A missing size comes back as YouTube's
    // 120×90 grey placeholder (not always an error), so step down until a real one loads.
    const sizes = ["maxresdefault", "sddefault", "hqdefault"];
    const next = () => { const s = sizes.shift(); if (s) img.src = `https://i.ytimg.com/vi/${p.video}/${s}.jpg`; };
    img.onload = () => { if (img.naturalWidth <= 120 && sizes.length) next(); };
    img.onerror = next;
    next();
    thumb.append(img, el("span", "play"), el("span", "watch", "watch demo"));
    thumb.addEventListener("click", () => openVideo(p.video, p.name));
    card.append(thumb);
  }
  const actions = el("div", "actions");
  const live = el("a", "btn solid", "View live ↗");
  live.href = p.live;
  const code = el("a", "btn ghost", "View code");
  code.href = p.code;
  [live, code].forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });
  actions.append(live, code);
  const body = el("div", "project-body");
  body.append(el("span", "kind", p.team ? `${p.kind} · team project` : p.kind), el("h3", "", p.name), chips(p.chips), el("p", "", p.text), actions);
  card.append(body);
  $("#projects").append(card);
});

/* ---------- Video player ---------- */
const player = $("#player");
function openVideo(id, name) {
  $("#player-iframe").src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
  $("#player-iframe").title = `${name} demo`;
  player.showModal();
  Sound.duck(true);
}
player.addEventListener("close", () => {
  $("#player-iframe").src = "about:blank";
  Sound.duck(false);
});
player.addEventListener("click", (e) => { if (e.target === player) player.close(); });

/* ---------- Journey: a pinned panel; scrolling moves through the stops ---------- */
// Nothing changes height while you scroll (that's what made the old cards jump):
// the panel stays pinned, the timeline lights up, and the details cross-fade.
const jr = $("#jr");
jr.style.setProperty("--n", S.journey.length);
const jrSteps = S.journey.map((j, i) => {
  const b = el("button", "jr-step");
  b.type = "button";
  b.append(el("span", "jr-dot"), el("b", "", j.at), el("small", "", j.meta.split(" · ").slice(-2).join(" · ")));
  // Clicking a stop scrolls to its part of the section
  b.addEventListener("click", () => {
    const top = jr.getBoundingClientRect().top + scrollY;
    const span = jr.offsetHeight - innerHeight;
    scrollTo({ top: top + span * ((i + 0.5) / S.journey.length), behavior: "smooth" });
  });
  $("#jr-steps").append(b);
  return b;
});
const jrPanels = S.journey.map((j) => {
  const a = el("article", "jr-panel card");
  const ul = el("ul");
  j.points.forEach((p) => ul.append(el("li", "", p)));
  a.append(el("span", "jr-meta", j.meta), el("h3", "", j.role), el("span", "at", `@ ${j.at}`), ul, chips(j.tech));
  $("#jr-panels").append(a);
  return a;
});
let jrActive = -1;
function updateJourney() {
  const r = jr.getBoundingClientRect();
  const span = Math.max(1, r.height - innerHeight);
  const p = Math.min(1, Math.max(0, -r.top / span));
  jr.style.setProperty("--jp", p.toFixed(4));
  const i = Math.min(S.journey.length - 1, Math.floor(p * S.journey.length));
  if (i === jrActive) return;
  jrActive = i;
  jrSteps.forEach((b, n) => { b.classList.toggle("on", n === i); b.classList.toggle("past", n < i); });
  jrPanels.forEach((a, n) => a.classList.toggle("on", n === i));
  if (r.top < innerHeight && r.bottom > 0) Sound.hover();
}

/* ---------- Minimum hand-holding: an RPG-style conversation ---------- */
const rpgText = $("#rpg-text");
let typing = null;
// Types a line out like a game dialogue box. Clicking the box finishes it at once.
function say(text, after) {
  clearInterval(typing);
  rpgText.textContent = "";
  $("#rpg-box").classList.remove("done");
  let i = 0;
  const finish = () => {
    clearInterval(typing);
    typing = null;
    rpgText.textContent = text;
    $("#rpg-said").textContent = text; // announced once, as a whole line
    $("#rpg-box").classList.add("done");
    after?.();
  };
  if (reduceMotion) return finish();
  typing = setInterval(() => {
    i += 1;
    rpgText.textContent = text.slice(0, i);
    if (i % 3 === 0 && text[i] !== " ") Sound.blip(620 + Math.random() * 120, 600, 0.03, 0.02, "square");
    if (i >= text.length) finish();
  }, 24);
  $("#rpg-box").onclick = (e) => { if (typing && !e.target.closest("button")) finish(); };
}
const choices = S.pitch.roles.map((r, i) => {
  const b = el("button", "", r.who);
  b.type = "button";
  b.addEventListener("click", () => {
    choices.forEach((c) => c.classList.toggle("picked", c === b));
    Sound.click();
    say(`${r.title} ${r.points.join(" ")}`);
  });
  return b;
});
$("#rpg-choices").append(...choices);
// The opening line plays once, when the box first scrolls into view
new IntersectionObserver((entries, obs) => {
  if (!entries[0].isIntersecting) return;
  obs.disconnect();
  say(`Hey, I'm Dhruv. ${S.pitch.line} ${S.pitch.tail} So, who's asking?`, () => $("#rpg").classList.add("ask"));
}, { threshold: 0.6 }).observe($("#rpg"));

/* The trail: a lantern walks the dotted line as you scroll, lighting each stop, and ends at me */
S.workflow.forEach(([t, d], i) => {
  const li = el("li");
  li.append(el("span", "node", String(i + 1).padStart(2, "0")), el("b", "", t), el("span", "", d));
  $("#workflow").append(li);
});
const stops = [...document.querySelectorAll("#workflow li")];
const nodes = stops.map((s) => s.querySelector(".node"));
const walkPath = $(".walk-path");
const lantern = $(".trail-lantern");
const fill = $(".trail-fill");
const line = $(".trail-line");
const meFig = $(".walk-end img");
let lastLit = -1;
function updateTrail() {
  const r = $("#trail").getBoundingClientRect();
  // 0 when the trail enters the lower part of the screen, 1 once it reaches the upper third
  const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (innerHeight * 0.55)));

  // The route, in pixels inside the path: each stop's centre, then me at the end.
  // The lantern rides it, so whatever it has passed is lit (no guessing from p).
  const base = walkPath.getBoundingClientRect();
  const pts = nodes.map((n) => {
    const b = n.getBoundingClientRect();
    return { x: b.left + b.width / 2 - base.left, y: b.top + b.height / 2 - base.top };
  });
  const fig = meFig.getBoundingClientRect();
  const vertical = pts[1].x === pts[0].x; // phone: the stops run down the page
  pts.push(vertical
    ? { x: pts[0].x, y: fig.top - base.top - 24 }
    : { x: fig.left - base.left + 6, y: pts[0].y });
  const segs = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  let left = p * total;
  let pos = pts[0];
  let reached = 0;
  for (let i = 0; i < segs.length; i++) {
    if (left >= segs[i]) { left -= segs[i]; pos = pts[i + 1]; reached = i + 1; continue; }
    const k = left / segs[i];
    pos = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    break;
  }
  lantern.style.left = `${pos.x}px`;
  lantern.style.top = `${pos.y}px`;
  // The solid line follows the lantern
  const lineBox = line.getBoundingClientRect();
  if (vertical) fill.style.height = `${Math.max(0, pos.y - (lineBox.top - base.top))}px`;
  else fill.style.width = `${Math.max(0, pos.x - (lineBox.left - base.left))}px`;

  const lit = p > 0 ? Math.min(reached, stops.length - 1) : -1;
  stops.forEach((s, i) => s.classList.toggle("lit", i <= lit));
  if (lit > lastLit) Sound.tick(lit);
  lastLit = lit;
  const arrived = p >= 0.999;
  if (arrived && !$("#trail").classList.contains("done")) Sound.chime();
  $("#trail").classList.toggle("done", arrived);
}

/* Inventory: tabs of skill groups, each skill a slot */
const invTabs = S.tools.map(([group], i) => {
  const b = el("button", "", group);
  b.type = "button";
  b.setAttribute("role", "tab");
  b.addEventListener("click", () => { showInv(i); Sound.click(); });
  $("#inv-tabs").append(b);
  return b;
});
function showInv(i) {
  invTabs.forEach((b, n) => b.setAttribute("aria-selected", String(n === i)));
  const grid = $("#inv-grid");
  grid.replaceChildren(...S.tools[i][1].map((name, n) => {
    const li = el("li", "slot", name);
    li.style.animationDelay = `${n * 40}ms`;
    return li;
  }));
}
showInv(0);

/* ---------- Trophy room ---------- */
const money = (n) => `$${n.toLocaleString("en-US")}`;
const sorted = [...S.trophies].sort((a, b) => (b.prize || 0) - (a.prize || 0) || b.year - a.year);
sorted.forEach((t) => {
  const li = el("li", `trophy card reveal${t.prize ? " paid" : ""}`);
  const top = el("div", "trophy-top");
  top.append(el("span", "prize", t.prize ? money(t.prize) : t.place), el("span", "yr", String(t.year)));
  li.append(top);
  if (t.prize) li.append(el("span", "place", t.place));
  li.append(el("b", "", t.event));
  const meta = el("span", "proj", t.project);
  if (t.solo) meta.append(el("em", "solo", "solo"));
  li.append(meta, el("p", "", t.note));
  $("#trophy-list").append(li);
});
$("#loot-shown").textContent = String(S.trophies.length);

// Count the loot up when the shelf comes into view, with a coin tick per step
function countUp(node, to, ms, onStep) {
  const start = performance.now();
  let lastShown = -1;
  (function step(now) {
    const k = Math.min(1, (now - start) / ms);
    const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
    node.textContent = v.toLocaleString("en-US");
    const bucket = Math.floor(k * 12);
    if (bucket !== lastShown) { lastShown = bucket; onStep?.(); }
    if (k < 1) requestAnimationFrame(step);
  })(start);
}
new IntersectionObserver((entries, obs) => {
  if (!entries[0].isIntersecting) return;
  obs.disconnect();
  if (reduceMotion) {
    $("#loot-total").textContent = S.loot.total.toLocaleString("en-US");
    $("#loot-wins").textContent = S.loot.wins;
    return;
  }
  countUp($("#loot-total"), S.loot.total, 1600, () => Sound.coin());
  countUp($("#loot-wins"), S.loot.wins, 1200);
  $("#loot").classList.add("rain");
}, { threshold: 0.5 }).observe($("#loot"));

/* ---------- Campfire: four campers whose monitor heads are the links ---------- */
// Tiny pixel logos, drawn on a 12×12 grid ("." = empty)
const LOGOS = {
  github: { colors: { k: "#24292f" }, rows: [
    ".k........k.", ".kk......kk.", ".kkkkkkkkkk.", "kkkkkkkkkkkk", "kkk.kkkk.kkk", "kkk.kkkk.kkk",
    "kkkkkkkkkkkk", ".kkkkkkkkkk.", "..kkkkkkkk..", "k..kkkkkk...", ".kk.kkkk....", "....kkkk....",
  ] },
  linkedin: { colors: { b: "#0a66c2", w: "#ffffff" }, rows: [
    ".bbbbbbbbbb.", "bbbbbbbbbbbb", "bbwwbbbbbbbb", "bbwwbbbbbbbb", "bbbbbbbbbbbb", "bbwwbwwwwbbb",
    "bbwwbwwbwwbb", "bbwwbwwbwwbb", "bbwwbwwbwwbb", "bbwwbwwbwwbb", "bbbbbbbbbbbb", ".bbbbbbbbbb.",
  ] },
  x: { colors: { k: "#111111" }, rows: [
    "kk........kk", "kkk......kk.", ".kkk....kk..", "..kkk..kk...", "...kkkkk....", "....kkk.....",
    "....kkkk....", "...kk.kkk...", "..kk...kkk..", ".kk.....kkk.", "kk.......kkk", "k.........kk",
  ] },
  email: { colors: { k: "#3b2f2a", p: "#ffffff", r: "#c0473a" }, rows: [
    "............", "kkkkkkkkkkkk", "kkppppppppkk", "kpkppppppkpk", "kppkppppkppk", "kpppkrrkpppk",
    "kppppkkppppk", "kppppppppppk", "kppppppppppk", "kkkkkkkkkkkk", "............", "............",
  ] },
};
function pixelLogo({ colors, rows }) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (!colors[c]) return;
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("x", x);
    r.setAttribute("y", y);
    r.setAttribute("width", 1.02);
    r.setAttribute("height", 1.02);
    r.setAttribute("fill", colors[c]);
    svg.append(r);
  }));
  return svg;
}

// screen = where the blank monitor face sits in each sprite (% of the sprite, measured by tools/prep_site_assets.py)
const CAMPERS = [
  { sprite: "camper-1", spot: "front-left", screen: [34.8, 3, 45.7, 46.8], logo: "github", label: "GitHub", say: `@${S.links.github}`, href: `https://github.com/${S.links.github}` },
  { sprite: "camper-2", spot: "back-left", screen: [30.8, 3, 49.5, 46.8], logo: "linkedin", label: "LinkedIn", say: "let's talk work", href: `https://www.linkedin.com/in/${S.links.linkedin}` },
  { sprite: "camper-4", spot: "back-right", screen: [19.5, 3, 47.6, 46.9], logo: "x", label: "X", say: `@${S.links.x}`, href: `https://x.com/${S.links.x}` },
  { sprite: "camper-3", spot: "front-right", screen: [32.8, 3, 47.8, 34.3], logo: "email", label: "Email", say: "say hi ✉", href: `mailto:${S.links.email}` },
];
CAMPERS.forEach((c) => {
  const a = el("a", `camper ${c.spot}`);
  a.href = c.href;
  if (!c.href.startsWith("mailto:")) { a.target = "_blank"; a.rel = "noopener"; }
  a.setAttribute("aria-label", `${c.label}: ${c.say}`);
  const fig = el("span", "camper-fig");
  const img = el("img");
  img.src = `assets/${c.sprite}.png`;
  img.alt = "";
  const screen = el("span", "camper-screen");
  const [x, y, w, h] = c.screen;
  Object.assign(screen.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
  screen.append(pixelLogo(LOGOS[c.logo]));
  fig.append(img, screen);
  a.append(el("span", "camper-say", c.say), fig, el("span", "camper-tag", c.label));
  $("#camp").append(a);
});
$("#mail-link").textContent = S.links.email;
$("#mail-link").href = `mailto:${S.links.email}`;

/* ---------- Reveal on scroll ---------- */
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const sibs = [...e.target.parentElement.children];
    e.target.style.transitionDelay = `${Math.min(sibs.indexOf(e.target), 6) * 70}ms`;
    e.target.classList.add("in");
    revealer.unobserve(e.target);
  });
}, { rootMargin: "0px 0px -8% 0px" });
document.querySelectorAll(".reveal").forEach((n) => revealer.observe(n));

/* ---------- Dock: highlight the section on screen ---------- */
const dockLinks = [...document.querySelectorAll(".dock a")];
const sectionFor = { home: "home", workshop: "workshop", lantern: "lantern", journey: "journey", trophies: "trophies", garden: "trophies", campfire: "campfire" };
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const key = sectionFor[e.target.id];
    dockLinks.forEach((a) => a.classList.toggle("active", a.dataset.sec === key));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("#home, main section").forEach((s) => spy.observe(s));

/* ---------- Theme ---------- */
const THEMES = ["meadow", "pinkcity", "lake"];
let theme = store.get("theme");
if (!THEMES.includes(theme)) theme = "meadow";
document.documentElement.dataset.theme = theme;
$("#theme-btn").addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  document.documentElement.dataset.theme = theme;
  store.set("theme", theme);
  Sound.chime();
});

/* ---------- Hero: slow parallax + floating pollen ---------- */
const heroArt = $("#hero-art");
const pollen = {
  canvas: $("#pollen"),
  parts: [],
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = reduceMotion ? 0 : r.width < 760 ? 22 : 46;
    this.parts = [...Array(n)].map(() => ({
      x: Math.random() * r.width,
      y: r.height * (0.35 + Math.random() * 0.65),
      d: 0.3 + Math.random() * 0.7,
      s: Math.random() * 6.3,
      tw: Math.random() * 6.3,
    }));
    // A small flock drifting across the sky, flapping in two frames like a sprite
    const flock = reduceMotion ? 0 : r.width < 760 ? 4 : 7;
    this.birds = [...Array(flock)].map(() => ({
      x: Math.random() * r.width,
      y: r.height * (0.08 + Math.random() * 0.22),
      v: 14 + Math.random() * 16,
      px: Math.random() < 0.35 ? 2 : 3, // pixel size: smaller birds read as farther away
      ph: Math.random() * 6.3,
      flap: 5 + Math.random() * 3,
    }));
  },
  // 5×3 pixel sprites: wings up, wings level
  WINGS: [
    ["x...x", ".x.x.", "..x.."],
    [".....", "xx.xx", "..x.."],
  ],
  drawBirds(dt) {
    const c = this.ctx;
    for (const b of this.birds) {
      b.x += b.v * dt;
      b.ph += dt;
      if (b.x > this.w + 20) { b.x = -20; b.y = this.h * (0.08 + Math.random() * 0.22); }
      const y = b.y + Math.sin(b.ph * 0.9) * 6;
      const frame = this.WINGS[Math.floor(b.ph * b.flap) % 2];
      c.fillStyle = `rgba(70, 48, 44, ${b.px === 2 ? 0.45 : 0.7})`;
      frame.forEach((row, ry) => [...row].forEach((ch, rx) => {
        if (ch === "x") c.fillRect(Math.round(b.x + rx * b.px), Math.round(y + ry * b.px), b.px, b.px);
      }));
    }
  },
  step(dt) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    for (const p of this.parts) {
      p.s += dt * 0.5;
      p.tw += dt * (1 + p.d);
      p.x += (Math.sin(p.s) * 6 + 5) * p.d * dt;
      p.y -= 3 * p.d * dt;
      if (p.x > this.w + 6) p.x = -6;
      if (p.y < this.h * 0.3) p.y = this.h + 6;
      const a = (0.35 + 0.45 * (0.5 + 0.5 * Math.sin(p.tw))) * p.d;
      const size = Math.max(1, Math.round(1 + 2 * p.d)); // square "pixels" to match the art
      c.fillStyle = `rgba(255, 238, 180, ${a.toFixed(3)})`;
      c.fillRect(Math.round(p.x), Math.round(p.y), size, size);
    }
    this.drawBirds(dt);
  },
};
// The trail and the journey only need measuring while they're on (or near) the screen.
// When one leaves, it gets one last update so it settles in its final state.
const onScreen = { trail: false, journey: false };
new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    onScreen.trail = e.isIntersecting;
    if (!e.isIntersecting) updateTrail();
  });
}, { rootMargin: "200px 0px" }).observe($("#trail"));
new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    onScreen.journey = e.isIntersecting;
    if (!e.isIntersecting) updateJourney();
  });
}, { rootMargin: "200px 0px" }).observe($("#jr"));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const y = scrollY;
  if (onScreen.trail) updateTrail();
  if (onScreen.journey) updateJourney();
  if (y < innerHeight * 1.2) {
    if (!reduceMotion) heroArt.style.transform = `translate3d(0, ${(y * 0.3).toFixed(1)}px, 0) scale(${(1.04 + y * 0.00008).toFixed(4)})`;
    pollen.step(dt);
  }
  requestAnimationFrame(frame);
}
addEventListener("resize", () => pollen.resize());
pollen.resize();
requestAnimationFrame(frame);

/* ---------- GitHub garden ---------- */
const GH = S.links.github;
$("#gh-handle").textContent = `@${GH}`;
$("#gh-handle").href = `https://github.com/${GH}`;
// Live numbers come from a free community service. If it's down or slow, the garden uses the
// snapshot saved with the site (assets/github.json) instead of showing an error.
function getJSON(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .finally(() => clearTimeout(timer));
}
getJSON(`https://github-contributions-api.jogruber.de/v4/${GH}?y=last`, 5000)
  .then((data) => ({ data, live: true }))
  .catch(() => getJSON("assets/github.json", 5000).then((data) => ({ data, live: false })))
  .then(({ data, live }) => plantGarden(data, live))
  .catch(() => { $("#garden").hidden = true; }); // nothing at all to show: hide the section, never a broken box

function plantGarden(data, live) {
  const days = data.contributions || [];
  if (!days.length) throw new Error("no contribution data");
  const grid = $("#garden-grid");
  const pad = new Date(days[0].date).getDay(); // align the first column to the weekday
  for (let i = 0; i < pad; i++) grid.append(Object.assign(el("i"), { style: "visibility:hidden" }));
  days.forEach((d) => {
    const c = el("i");
    c.dataset.l = d.level;
    c.title = `${d.count} contribution${d.count === 1 ? "" : "s"} on ${d.date}`;
    grid.append(c);
  });
  const total = data.total?.lastYear ?? days.reduce((s, d) => s + d.count, 0);
  const asOf = new Date(days[days.length - 1].date).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  $("#garden-total").textContent = live
    ? `${total.toLocaleString()} contributions in the last year`
    : `${total.toLocaleString()} contributions in the year to ${asOf}`;

  // A plant above every week column, as tall as that week's commits; the best weeks flower
  const weeks = [];
  days.forEach((d, i) => { const w = Math.floor((i + pad) / 7); weeks[w] = (weeks[w] || 0) + d.count; });
  const max = Math.max(1, ...weeks);
  const sortedWeeks = [...weeks].sort((a, b) => a - b);
  const bloomAt = sortedWeeks[Math.floor(sortedWeeks.length * 0.85)] || max;
  const bed = $("#garden-plants");
  weeks.forEach((n = 0, w) => {
    const plant = el("i");
    if (n > 0) {
      plant.style.setProperty("--h", `${Math.round(6 + (n / max) * 34)}px`);
      if (n >= bloomAt) plant.className = "bloom";
    } else {
      plant.className = "tuft";
    }
    plant.style.transitionDelay = `${w * 14}ms`;
    plant.title = `${n} contribution${n === 1 ? "" : "s"} that week`;
    bed.append(plant);
  });
  $(".garden-scroll").scrollLeft = 9999;
}

// The garden grows when it scrolls into view: the sprout first, then the plants, left to right
new IntersectionObserver((entries, obs) => {
  if (!entries[0].isIntersecting) return;
  obs.disconnect();
  $("#garden").classList.add("grow");
}, { threshold: 0.35 }).observe($("#garden"));

/* ---------- Sound: the bird track in the background + tiny UI sounds ---------- */
// Played exactly like the reference site: the untouched recording, looping at volume 0.1.
// It tries to start right away; browsers usually block that, so it starts on the first
// click, touch or key press instead. The speaker button pauses and plays it.
const birds = new Audio(new Audio().canPlayType("audio/ogg") ? "assets/birds.ogg" : "assets/birds.mp3");
birds.loop = true;
birds.volume = 0.1;

const Sound = {
  on: false,
  ctx: null,
  start() {
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
  },
  blip(f1, f2, dur, gain, type = "sine") {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  // Pause the birds while a demo video plays, and bring them back after
  duck(down) {
    if (!this.on) return;
    if (down) birds.pause();
    else birds.play().catch(() => {});
  },
  hover() { this.blip(1500, 1250, 0.035, 0.018); },
  coin() { this.blip(1975, 2637, 0.07, 0.025, "square"); },
  tick(i = 0) { this.blip(660 * Math.pow(2, i / 6), 640 * Math.pow(2, i / 6), 0.18, 0.04, "triangle"); },
  click() { this.blip(700, 420, 0.1, 0.05, "triangle"); },
  chime() { this.blip(1046, 1040, 0.5, 0.04, "sine"); this.blip(1568, 1560, 0.6, 0.02, "sine"); },
  set(on) {
    this.on = on;
    if (on && !this.ctx) this.start();
    this.ctx?.resume();
    if (on) birds.play().catch(() => {});
    else birds.pause();
  },
};

const soundBtn = $("#music-btn");
let muted = store.get("muted") === "1";
function showSoundState() {
  soundBtn.setAttribute("aria-pressed", String(!muted));
  soundBtn.setAttribute("aria-label", muted ? "Unmute background sound" : "Mute background sound");
}
showSoundState();
soundBtn.addEventListener("click", () => {
  muted = !muted;
  store.set("muted", muted ? "1" : "0");
  showSoundState();
  Sound.set(!muted);
});
// The birds start with the first tap or key press (browsers block sound before that)
function wake(e) {
  if (e.target.closest?.("#music-btn")) return; // the button handles itself
  ["click", "touchstart", "keydown"].forEach((ev) => removeEventListener(ev, wake));
  if (!muted) Sound.set(true);
}
["click", "touchstart", "keydown"].forEach((ev) => addEventListener(ev, wake));
if (!muted) birds.play().then(() => { Sound.on = true; }).catch(() => {}); // works only if the browser allows it

// Tiny sounds on things you can press (only while sound is on)
let lastHover = 0;
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest("a, button, .card");
  if (!t || t.contains(e.relatedTarget)) return;
  const now = performance.now();
  if (now - lastHover < 70) return;
  lastHover = now;
  Sound.hover();
});
document.addEventListener("click", (e) => {
  if (e.target.closest("a, .trail")) Sound.click();
});
