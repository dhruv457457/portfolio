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

// 12×12 pixel icons for the project cards, in the Inventory's style ("." = empty). A project
// added later in the admin gets the treasure chest.
const PROJECT_ICONS = {
  patched: { colors: { k: "#2f3a4a", h: "#4f6b2e", d: "#3b5222", p: "#f1bf45", w: "#f6efe0" }, rows: [ // a hoodie with a patch
    "...kkkkkk...", "..khhhhhhk..", ".khhk..khhk.", "kkhhkkkkhhkk", "khhhhhhhhhhk", "khhppphhhhhk",
    "khhpwphhhhhk", "khhppphhhhhk", "khhhhhhhhhhk", "khddddddddhk", "kkkkkkkkkkkk", "............",
  ] },
  puff: { colors: { k: "#3b4150", w: "#f6f7fb", b: "#9fb9ff", n: "#8b7fd6" }, rows: [ // a cloud holding a little graph
    "............", "............", "....kkkk....", "..kkwwwwkkk.", ".kwwwwwwwwwk", "kwwnbbbbnwwk",
    "kwwwbwwbwwwk", "kwwwwnnwwwwk", ".kwwwwwwwwk.", "..kkkkkkkk..", "............", "............",
  ] },
  clove: { colors: { k: "#2e4a22", g: "#66863e", l: "#95b06b", s: "#5a4636" }, rows: [ // a four-leaf clover
    "..kk....kk..", ".kggk..kggk.", "kglggkkgglgk", "kggggggggggk", ".kggggggggk.", "..kkggggkk..",
    "..kkggggkk..", ".kggggggggk.", "kggggggggggk", "kglggkkgglgk", ".kggk.skggk.", "..kk...s.kk.",
  ] },
  kinato: { colors: { k: "#3b2a2a", r: "#d9483b", w: "#e8a598" }, rows: [ // a phone, ringing
    "kkk.........", "krrk....w...", "krrk.....w..", ".krk..w...w.", ".krrk..w..w.", "..krk...w.w.",
    "..krrk......", "...krrk.....", "....krrkkk..", ".....krrrrk.", "......krrrk.", ".......kkk..",
  ] },
  metacow: { colors: { k: "#2b2b2b", w: "#f6f1e6", p: "#f2a7b5", h: "#d9c39a" }, rows: [ // a cow
    "h..........h", ".h.kkkkkk.h.", "kkkwwkkwwkkk", "kwwwkkwwwwwk", "kwkwwwwwwkwk", ".kwwwwwwwwk.",
    ".kwwwwwwwwk.", ".kppppppppk.", ".kpkppppkpk.", ".kppppppppk.", "..kkkkkkkk..", "............",
  ] },
  "bone dry": { colors: { k: "#4a3a2c", b: "#f4ecda" }, rows: [ // a bone
    "............", ".kk......kk.", "kbbk....kbbk", "kbbbkkkkbbbk", ".kbbbbbbbbk.", ".kbbbbbbbbk.",
    "kbbbkkkkbbbk", "kbbk....kbbk", ".kk......kk.", "............", "............", "............",
  ] },
  chest: { colors: { k: "#4a3426", w: "#9a6b3f", d: "#7a5233", y: "#f1bf45" }, rows: [ // a treasure chest
    "............", "..kkkkkkkk..", ".kwwwwwwwwk.", "kwwwwwwwwwwk", "kddddddddddk", "kkkkkyykkkkk",
    "kwwwkyykwwwk", "kwwwwkkwwwwk", "kwwwwwwwwwwk", "kddddddddddk", "kkkkkkkkkkkk", "............",
  ] },
};

// the hackathon a project won, if it did (shown as a ribbon on its card)
const wonBy = Object.fromEntries((S.trophies || []).map((t) => [String(t.project).toLowerCase(), t]));
const hostOf = (url) => { try { return new URL(url).host; } catch { return ""; } };
const outLink = (cls, text, href) => Object.assign(el("a", cls, text), { href, target: "_blank", rel: "noopener" });

// the links a project has (the admin lets either be left out)
const projectLinks = (p) => [p.live && outLink("btn solid", "Live ↗", p.live), p.code && outLink("btn ghost", "Code", p.code)].filter(Boolean);
const iconFor = (p) => pixelLogo(PROJECT_ICONS[p.name.toLowerCase()] || PROJECT_ICONS.chest, 12);

// A card is the short version: cover, name, chips. Clicking anywhere on it opens the project,
// with its demo playing and the whole write-up underneath.
S.projects.forEach((p) => {
  const card = el("article", "project card reveal");
  const open = () => openProject(p);
  card.addEventListener("click", (e) => { if (!e.target.closest("a, button")) open(); });
  if (p.cover) {
    // a little browser window: the bar names the live site, the screen is a capture of it
    const win = el("div", "window"), bar = el("div", "window-bar");
    bar.append(el("i"), el("i"), el("i"), el("span", "host", hostOf(p.live) || p.name));
    if (p.live) bar.append(el("span", "on-air", "● live"));
    const thumb = el("button", "thumb");
    thumb.type = "button";
    thumb.setAttribute("aria-label", `Open ${p.name}${p.video ? ": demo video and details" : " details"}`);
    const img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.src = p.cover;
    thumb.append(img);
    if (p.video) thumb.append(el("span", "play", "▶"));
    thumb.append(el("span", "watch", p.video ? "watch demo" : "see more"));
    thumb.addEventListener("click", open);
    win.append(bar, thumb);
    const won = wonBy[p.name.toLowerCase()];
    if (won) win.append(Object.assign(el("span", "ribbon", `★ ${won.place}`), { title: `${won.place} · ${won.event}` }));
    card.append(win);
  }
  const actions = el("div", "actions");
  const more = el("button", "btn ghost", p.video ? "▶ Demo" : "Details");
  more.type = "button";
  more.addEventListener("click", open);
  actions.append(...projectLinks(p), more);
  const body = el("div", "project-body");
  // the project's pixel icon in its own slot, beside its name
  const head = el("div", "project-head"), slot = el("span", "project-icon"), named = el("div"), h3 = el("h3", "", p.name);
  slot.append(iconFor(p));
  if (p.team) h3.append(el("span", "tag", "team"));
  named.append(el("span", "kind", p.kind), h3);
  head.append(slot, named);
  body.append(head, chips(p.chips), actions);
  card.append(body);
  $("#projects").append(card);
});

/* ---------- A project, opened: the demo plays on top, the whole write-up sits below ---------- */
const player = $("#player");
function openProject(p) {
  const frame = $("#player-iframe"), cover = $("#pm-cover");
  frame.hidden = !p.video;
  cover.hidden = !!p.video || !p.cover;
  if (p.video) {
    frame.src = `https://www.youtube-nocookie.com/embed/${p.video}?autoplay=1&rel=0&modestbranding=1`;
    frame.title = `${p.name} demo`;
  } else if (p.cover) cover.src = p.cover;
  $("#pm-host").textContent = hostOf(p.live) || p.name;
  $("#pm-live").hidden = !p.live;
  $("#pm-icon").replaceChildren(iconFor(p));
  $("#pm-kind").textContent = p.kind;
  $("#pm-name").textContent = p.name;
  if (p.team) $("#pm-name").append(el("span", "tag", "team"));
  const won = wonBy[p.name.toLowerCase()];
  $("#pm-won").hidden = !won;
  if (won) $("#pm-won").textContent = `★ ${won.place} · ${won.event}`;
  $("#pm-chips").replaceChildren(...(p.chips || []).map((c) => el("li", "", c)));
  $("#pm-text").textContent = p.text;
  $("#pm-details").replaceChildren(...(p.details || []).map((d) => el("li", "", d)));
  $("#pm-actions").replaceChildren(...projectLinks(p));
  player.showModal();
  $(".pm").scrollTop = 0;
  if (p.video) Sound.duck(true);
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
  document.dispatchEvent(new CustomEvent("journeystep", { detail: i })); // guide.js evolves the pixel me
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
    document.dispatchEvent(new CustomEvent("rpgpick", { detail: i })); // guide.js walks them into the workshop
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

/* The trail: five short stops. The pixel me hops along them as you scroll (guide.js lights them
   and shows each detail as his thought); screen readers get the detail straight away. */
S.workflow.forEach(([t, d], i) => {
  const li = el("li");
  li.append(el("span", "node", String(i + 1).padStart(2, "0")), el("b", "", t), el("span", "sr-only", d));
  $("#workflow").append(li);
});

/* Inventory: every group is a pouch and every skill a slot, all on show at once */
// 10×10 pixel icons for each pouch ("." = empty)
const POUCH_ICONS = {
  Languages: { colors: { k: "#5a4636", p: "#efe2c2", i: "#7a5a3a" }, rows: [ // a scroll
    ".kkkkkkkk.", "kppppppppk", ".kpiiiipk.", ".kppppppk.", ".kpiiiipk.", ".kppppppk.", ".kpiiipk..", "kppppppppk", ".kkkkkkkk.", "..........",
  ] },
  Backend: { colors: { k: "#3b4150", g: "#8d97a8", d: "#5d6678" }, rows: [ // a gear
    "....kk....", "..k.gg.k..", ".kggggggk.", "..gdkkdg..", "kggk..kggk", "kggk..kggk", "..gdkkdg..", ".kggggggk.", "..k.gg.k..", "....kk....",
  ] },
  Data: { colors: { k: "#4b3a2c", w: "#b98a55", b: "#8a6238" }, rows: [ // a barrel
    "..kkkkkk..", ".kwwwwwwk.", "kbbbbbbbbk", "kwwwwwwwwk", "kwwwwwwwwk", "kbbbbbbbbk", "kwwwwwwwwk", "kbbbbbbbbk", ".kwwwwwwk.", "..kkkkkk..",
  ] },
  Frontend: { colors: { k: "#2f3a4a", s: "#bfe3f2", b: "#e9a03b", w: "#f6efe0" }, rows: [ // a browser window
    "kkkkkkkkkk", "kbwbsssssk", "kkkkkkkkkk", "kssssssssk", "kskkkksssk", "kssssssssk", "kskkkkkksk", "kssssssssk", "kskkkssssk", "kkkkkkkkkk",
  ] },
  Web3: { colors: { k: "#2d2b48", a: "#8b7fd6", b: "#5d52a8", c: "#c9c2f2" }, rows: [ // a cube
    "....kk....", "..kkcckk..", "kkcccccckk", "kaakccbbbk", "kaaakkbbbk", "kaaaakbbbk", "kaaaakbbbk", "kkaaakbbkk", "..kkakbk..", "....kk....",
  ] },
  AI: { colors: { k: "#5b2e3e", p: "#f29bb5", d: "#d06a8b", y: "#ffe08a" }, rows: [ // a brain with a spark
    "...kkkk..y", ".kkppppk.y", "kppdppdpky", "kpdpppppk.", "kppppdppk.", "kpdpppdpk.", ".kppdppk..", "..kkppk...", "....kk....", "..........",
  ] },
};
const bag = $("#bag");
S.tools.forEach(([group, items]) => {
  const pouch = el("section", "pouch card");
  const head = el("div", "pouch-head");
  if (POUCH_ICONS[group]) head.append(pixelLogo(POUCH_ICONS[group], 10));
  head.append(el("b", "", group), el("small", "", `${items.length} items`));
  const ul = el("ul", "slots");
  items.forEach((name, n) => {
    const li = el("li", "slot", name);
    li.style.setProperty("--d", `${n * 55}ms`);
    ul.append(li);
  });
  pouch.append(head, ul);
  bag.append(pouch);
});
// Items drop into each pouch when it scrolls into view, with a soft pickup blip
const pouchIn = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    pouchIn.unobserve(e.target);
    e.target.classList.add("open");
    [...e.target.querySelectorAll(".slot")].forEach((_, n) => setTimeout(() => Sound.blip(880 + n * 60, 1200 + n * 60, 0.05, 0.018, "square"), n * 55));
  });
}, { threshold: 0.4 });
document.querySelectorAll(".pouch").forEach((p) => pouchIn.observe(p));

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
function pixelLogo({ colors, rows }, size = 12) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
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

/* ---------- Footer: name, one line, the links ---------- */
$("#footer-line").textContent = `${S.tagline.replace(/\.$/, "")} · Jaipur, India`;
[
  ["GitHub", `https://github.com/${S.links.github}`, LOGOS.github],
  ["LinkedIn", `https://www.linkedin.com/in/${S.links.linkedin}`, LOGOS.linkedin],
  ["X", `https://x.com/${S.links.x}`, LOGOS.x],
  ["Email", `mailto:${S.links.email}`, LOGOS.email],
].forEach(([label, href, logo]) => {
  const a = el("a");
  a.href = href;
  if (!href.startsWith("mailto:")) { a.target = "_blank"; a.rel = "noopener"; }
  a.append(pixelLogo(logo), el("span", "", label));
  const li = el("li");
  li.append(a);
  $("#footer-links").append(li);
});

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
const sectionFor = { home: "home", workshop: "workshop", lantern: "lantern", journey: "journey", trophies: "trophies", garden: "trophies", footer: "footer" };
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const key = sectionFor[e.target.id];
    dockLinks.forEach((a) => a.classList.toggle("active", a.dataset.sec === key));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("#home, main section, #footer").forEach((s) => spy.observe(s));

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
    // Two kites over the valley (it's Jaipur) and a hot-air balloon drifting past the hills.
    // Positions are fractions of the hero, so they stay in the open sky at any size.
    const px = r.width < 760 ? 2 : 3;
    this.kites = reduceMotion ? [] : [
      { fx: 0.13, fy: 0.2, ax: -0.05, a: "#c0473a", b: "#e86f55", ph: 0, px },
      { fx: 0.87, fy: 0.15, ax: 1.06, a: "#2f6f86", b: "#5da3b8", ph: 2.1, px },
    ];
    this.balloon = reduceMotion ? null : { x: r.width * 0.05, fy: 0.42, px };
  },
  KITE: ["....o....", "...oao...", "..oaabo..", ".oaaabbo.", "oaaaabbbo", ".oaaabbo.", "..oaabo..", "...oao...", "....o...."],
  BALLOON: ["..ooooo..", ".oabbbao.", "oaabbbaao", "oaabbbaao", "oaabbbaao", ".oabbbao.", "..oabao..", "...oao...", "...o.o...", "...kkk...", "...kkk..."],
  sprite(rows, colors, x, y, px) {
    const c = this.ctx;
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
      if (!colors[ch]) return;
      c.fillStyle = colors[ch];
      c.fillRect(Math.round(x + rx * px), Math.round(y + ry * px), px, px);
    }));
  },
  drawSky(t) {
    const c = this.ctx;
    for (const k of this.kites) {
      const x = this.w * k.fx + Math.sin(t * 0.7 + k.ph) * 10;
      const y = this.h * k.fy + Math.cos(t * 1.1 + k.ph) * 6;
      const tipX = x + 4 * k.px, tipY = y + 8 * k.px;
      // the string sags down to someone on a rooftop below the screen
      c.strokeStyle = "rgba(60, 40, 35, .35)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(tipX, tipY);
      c.quadraticCurveTo((tipX + this.w * k.ax) / 2, this.h * 0.9, this.w * k.ax, this.h * 1.05);
      c.stroke();
      // a wiggling tail of little squares
      c.fillStyle = k.a;
      for (let i = 1; i <= 5; i++) c.fillRect(Math.round(tipX + Math.sin(t * 3 + i + k.ph) * 3 * k.px), Math.round(tipY + i * 2 * k.px), k.px, k.px);
      this.sprite(this.KITE, { o: "#4a2c28", a: k.a, b: k.b }, x, y, k.px);
    }
    const b = this.balloon;
    if (b) {
      b.x += 0.12;
      if (b.x > this.w + 40) b.x = -40;
      this.sprite(this.BALLOON, { o: "#5a2f28", a: "#c0473a", b: "#f1bf45", k: "#6b4a32" }, b.x, this.h * b.fy + Math.sin(t * 0.4) * 5, b.px);
    }
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
    this.t = (this.t || 0) + dt;
    this.drawSky(this.t);
    this.drawBirds(dt);
  },
};
// The journey only needs measuring while it's on (or near) the screen.
// When it leaves, it gets one last update so it settles in its final state.
const onScreen = { journey: false };
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
    plant.title = `${n} contribution${n === 1 ? "" : "s"} that week`;
    // the data can arrive after the watering walk is over: then the bed is simply grown
    if (reduceMotion || $("#garden").classList.contains("watered")) plant.classList.add("wet");
    bed.append(plant);
  });
  $(".garden-scroll").scrollLeft = 9999;
}

// The garden grows when it scrolls into view: the sprout first, then each plant as the
// pixel me waters it (guide.js). With reduced motion, everything is simply grown.
new IntersectionObserver((entries, obs) => {
  if (!entries[0].isIntersecting) return;
  obs.disconnect();
  $("#garden").classList.add("grow");
  if (reduceMotion) document.querySelectorAll(".garden-plants i").forEach((p) => p.classList.add("wet"));
  else document.dispatchEvent(new Event("gardenopen"));
}, { threshold: 0.35 }).observe($("#garden"));

/* ---------- Sound: the bird track in the background + tiny UI sounds ---------- */
// Played exactly like the reference site: the untouched recording, looping at volume 0.1.
// Browsers block sound until the first click, tap or key press (scrolling doesn't count),
// so it starts on that first gesture. The speaker shows what is really happening: it's lit
// only while the birds are actually playing, and pressing it always does what it shows.
const birds = new Audio(new Audio().canPlayType("audio/ogg") ? "assets/birds.ogg" : "assets/birds.mp3");
birds.preload = "auto";
birds.loop = true;
birds.volume = 0.1;
birds.load(); // fetch it now, so it's ready the moment the browser lets it play

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
let muted = store.get("muted") === "1"; // the visitor's choice, remembered
const playing = () => Sound.on && !birds.paused;
function showSoundState() {
  const on = playing();
  soundBtn.setAttribute("aria-pressed", String(on));
  soundBtn.setAttribute("aria-label", on ? "Mute background sound" : "Play background sound");
}
showSoundState();
["playing", "pause"].forEach((ev) => birds.addEventListener(ev, showSoundState));
soundBtn.addEventListener("click", () => {
  // silent (blocked or muted) → sound on; playing → mute. One press, never two.
  muted = playing();
  store.set("muted", muted ? "1" : "0");
  Sound.set(!muted);
  showSoundState();
});
// The first gesture anywhere wakes the sound. pointerdown fires before click, so it's sooner,
// and listening in the capture phase means nothing on the page can swallow it.
const WAKE = ["pointerdown", "touchstart", "keydown"];
function wake(e) {
  WAKE.forEach((ev) => removeEventListener(ev, wake, true));
  hint.classList.remove("on");
  if (e.target.closest?.("#music-btn")) return; // the button handles itself
  if (!muted) Sound.set(true);
}
WAKE.forEach((ev) => addEventListener(ev, wake, true));
// some browsers allow sound straight away (on a site you've used before); then it just plays
if (!muted) birds.play().then(() => { Sound.set(true); showSoundState(); }).catch(() => {});

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
// Sounds guide.js plays when the pixel me does something
Object.assign(Sound, {
  jump() { this.blip(320, 760, 0.12, 0.035, "square"); },
  thud() { this.blip(180, 70, 0.12, 0.06, "triangle"); },
  pew() { this.blip(1800, 420, 0.16, 0.04, "square"); },
  whoosh() { this.blip(900, 220, 0.3, 0.03, "sine"); },
  zip() { this.blip(420, 1500, 0.45, 0.022, "sawtooth"); },
  bonk() { this.blip(260, 90, 0.22, 0.06, "square"); },
  poof() { this.blip(1300, 300, 0.2, 0.03, "triangle"); },
});

// While the page is still silent, the first scroll shows a small hint by the speaker
const hint = $("#music-hint");
addEventListener("scroll", function firstScroll() {
  removeEventListener("scroll", firstScroll);
  if (muted || playing()) return;
  hint.classList.add("on");
  setTimeout(() => hint.classList.remove("on"), 6000);
}, { passive: true });
