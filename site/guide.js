// The pixel me, alive on the page. Your scroll decides where he belongs (a station: the hero,
// a rope down the side, inside the dialogue box, a stop on the trail, the Journey stage, the
// prize money, the garden, the campfire); getting from one station to the next is a short move
// that always plays out (a jump, a rope shot and swing, a zip-line, a tumble), backwards if
// you scroll back up. Also here: the AI crew on the trail, the Journey team scenes, and the
// night-time campfire. Uses $, S, Sound and reduceMotion from main.js.

(() => {
  const Me = window.PixelMe;
  const still = reduceMotion;
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k);
  const easeOut = (k) => 1 - (1 - k) ** 3;
  const mix = (p, q, k) => ({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k) });
  // a jump from p to q that rises h px at the top of the arc
  const hop = (p, q, k, h) => ({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k) - h * 4 * k * (1 - k) });
  // a swing from p to q that dips through c
  const swing = (p, c, q, k) => ({
    x: (1 - k) ** 2 * p.x + 2 * (1 - k) * k * c.x + k * k * q.x,
    y: (1 - k) ** 2 * p.y + 2 * (1 - k) * k * c.y + k * k * q.y,
  });

  // A crisp canvas: CSS size in px, backing store in device pixels
  function sized(cv, w, h) {
    const k = dpr();
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    cv.width = Math.round(w * k);
    cv.height = Math.round(h * k);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { ctx, k, w, h };
  }
  const wipe = (c) => c.ctx.clearRect(0, 0, c.ctx.canvas.width, c.ctx.canvas.height);
  // Draw a pose with its feet at (x, y) in CSS px. rot turns him about the middle of his body.
  function drawMe(c, o) {
    const s = Math.max(1, Math.round(o.scale * c.k));
    const ctx = c.ctx;
    ctx.globalAlpha = o.alpha ?? 1;
    if (o.rot) {
      ctx.save();
      ctx.translate(o.x * c.k, o.y * c.k - 16 * s);
      ctx.rotate(o.rot);
      Me.draw(ctx, { ...o, x: 0, y: 16 * s, scale: s });
      ctx.restore();
    } else Me.draw(ctx, { ...o, x: o.x * c.k, y: o.y * c.k, scale: s });
    ctx.globalAlpha = 1;
  }
  const drawCrew = (c, o) => Me.crew(c.ctx, { ...o, x: o.x * c.k, y: o.y * c.k, scale: Math.max(1, Math.round(o.scale * c.k)) });
  const prop = (c, name, x, y, scale) => Me.prop(c.ctx, name, x * c.k, y * c.k, Math.max(1, Math.round(scale * c.k)));
  // Little drawing helpers for the scenes, in CSS px
  function block(c, x, y, w, h, fill, line = "#231a1b") {
    const k = c.k, ctx = c.ctx;
    ctx.fillStyle = line;
    ctx.fillRect(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k));
    ctx.fillStyle = fill;
    ctx.fillRect(Math.round((x + 2) * k), Math.round((y + 2) * k), Math.round((w - 4) * k), Math.round((h - 4) * k));
  }
  function text(c, s, x, y, { size = 15, color = "#26382d", align = "center" } = {}) {
    const ctx = c.ctx;
    ctx.font = `${Math.round(size * c.k)}px "VT323", ui-monospace, monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(s, x * c.k, y * c.k);
  }
  function bubble(c, s, x, y) { // a small speech bubble centred over (x, y)
    const ctx = c.ctx;
    ctx.font = `${Math.round(14 * c.k)}px "VT323", ui-monospace, monospace`;
    const w = ctx.measureText(s).width / c.k + 14;
    x = clamp(x, w / 2 + 2, c.w - w / 2 - 2); // never past the canvas edge
    block(c, x - w / 2, y - 20, w, 20, "#fbfaf5");
    text(c, s, x, y - 10, { size: 14 });
  }
  // Is this element on (or near) the screen? Updated by one observer.
  const seen = new WeakMap();
  const watcher = new IntersectionObserver((es) => es.forEach((e) => seen.set(e.target, e.isIntersecting)), { rootMargin: "120px 0px" });
  const watch = (n) => { seen.set(n, false); watcher.observe(n); return n; };
  const words = (el, lines, every = 2600) => { // a bubble that cycles through its lines
    const i = Math.floor(performance.now() / every) % lines.length;
    if (el.textContent !== lines[i]) el.textContent = lines[i];
  };

  /* ---------- The elements his path is built around ---------- */
  const EL = {
    wsHead: $("#workshop .section-head h2"),
    rpg: $("#rpg"),
    portrait: $(".rpg-scene"),
    nodes: [...document.querySelectorAll("#workflow .node")],
    stops: [...document.querySelectorAll("#workflow li")],
    trail: $("#trail"),
    pin: $("#trail-pin"),
    line: $(".trail-line"),
    fill: $(".trail-fill"),
    jr: $("#jr"),
    sticky: $(".jr-sticky"),
    stage: $("#stage"),
    loot: $(".loot-main"),
    gardenCard: $("#garden .garden"),
    gardenPin: $("#garden-pin"),
    plants: $("#garden-plants"),
    bed: $(".garden-bed"),
    camp: $("#camp"),
    footer: $("#footer"),
  };
  // Boxes are measured once per frame: x/top on screen, py on the page
  let frameNo = 0;
  const boxes = new Map();
  function box(el) {
    const hit = boxes.get(el);
    if (hit && hit.f === frameNo) return hit;
    const b = el.getBoundingClientRect();
    const r = { f: frameNo, x: b.left, top: b.top, w: b.width, h: b.height, py: b.top + scrollY };
    boxes.set(el, r);
    return r;
  }
  const at = (el, f) => box(el).py - f * innerHeight; // the scroll at which el's top is f of the way down the screen
  const atEnd = (el, f) => box(el).py + box(el).h - f * innerHeight;

  /* ---------- The guide ---------- */
  const G = {
    el: $("#guide"), say: $("#guide-say"), lastScroll: -1e9, cur: -1, move: null, arrivedAt: 0,
    size: 1, fx: [], ghosts: [], dock: null, dockAt: 0, lit: -2, litAt: 0,
    P: null, dir: 1, lastY: 0, // P: where he is, in stations (3.4 = 40% of the way from station 3 to 4)
  };
  addEventListener("scroll", () => {
    G.lastScroll = performance.now();
    if (scrollY !== G.lastY) G.dir = Math.sign(scrollY - G.lastY);
    G.lastY = scrollY;
  }, { passive: true });
  function layoutGuide() {
    G.c = sized(G.el, innerWidth, innerHeight);
    const content = Math.min(1040, innerWidth - 48);
    G.gutter = (innerWidth - content) / 2;
    G.wide = G.gutter >= 110; // room beside the content for the ropes
    G.scale = G.wide ? 4 : 3;
    G.stickyTop = parseFloat(getComputedStyle(EL.sticky).top) || 0;
  }
  const HIDE = { show: false };
  const sideX = (s) => (s === "L" ? G.gutter / 2 : innerWidth - G.gutter / 2);
  const hangAt = (s) => ({ x: sideX(s), y: innerHeight * 0.58 });
  // where his hand (or harness) is, in sprite pixels from his feet
  const GRIP = { hang: [9, -26], aim: [14, -28], belt: [0, -11] };
  const grip = (p, what, flip) => ({ x: p.x + (flip ? -1 : 1) * GRIP[what][0] * G.scale, y: p.y + GRIP[what][1] * G.scale });
  const anchor = (s) => ({ x: sideX(s) + (s === "L" ? -9 : 9) * G.scale, y: -6 }); // the hook, on the top edge of the screen

  /* ---------- Where things are ---------- */
  const onScreen = (p) => ({ x: p.x, y: p.y - scrollY });
  const heroPt = () => onScreen({ x: G.wide ? sideX("L") : 26 + 12 * G.scale, y: G.wide ? innerHeight * 0.95 : innerHeight - 96 });
  const headPt = () => { const h = box(EL.wsHead); return { x: h.x + 30, y: h.top + 6 }; };
  const nodePt = (i) => { const b = box(EL.nodes[i]); return { x: b.x + b.w / 2, y: b.top + 2 }; };
  const portraitPt = (f) => { const b = box(EL.portrait); return { x: b.x + b.w / 2, y: b.top + b.h * f }; };
  // a point on the Journey stage: where it will sit once pinned (a still target), or where it is now
  const STAGE_ME = 0.3; // his spot on the stage, as a fraction of its width
  const stagePinned = (fy) => { const e = box(EL.stage), s = box(EL.sticky); return { x: e.x + e.w * STAGE_ME, y: G.stickyTop + (e.top - s.top) + e.h * fy }; };
  const stageNow = (fy) => { const e = box(EL.stage); return { x: e.x + e.w * STAGE_ME, y: e.top + e.h * fy }; };
  const lootSpot = () => { const b = box(EL.loot); return { x: b.x + b.w * 0.62, y: b.top + 6 }; };
  const lootEdge = () => { const b = box(EL.loot); return { x: b.x + 28, y: b.top + 6 }; };
  const cardPt = () => { const b = box(EL.gardenCard); return { x: b.x + 70, y: b.top + 4 }; };
  const soilPt = () => { const b = box(EL.bed), p = box(EL.plants); return { x: b.x + 8, y: p.top + p.h }; };
  const gardenerPt = () => { const b = box(EL.bed), p = box(EL.plants); return { x: b.x + gardener.x, y: p.top + p.h }; }; // wherever he got to in the bed
  const seatPt = () => { const b = box(seatCv); return { x: b.x + b.w / 2, y: b.top + b.h - 2 }; };

  /* ---------- Pieces of moves ---------- */
  // Aim at the top corner of the screen and fire: the hook flies, the rope pays out behind it
  function fire(s, P, u, form) {
    const flip = s === "L", A = anchor(s);
    const muzzle = grip(P, "aim", flip);
    const tip = mix(muzzle, A, easeOut(clamp(u)));
    return { ...P, pose: "aim", flip, form, line: [muzzle, tip], hook: tip, shadow: true, kick: u < 0.15 };
  }
  // ...then swing out on it to the side of the page
  function swingOut(s, P, u, form) {
    const flip = s === "L", A = anchor(s), H = hangAt(s);
    const pos = swing(P, { x: lerp(P.x, H.x, 0.5), y: Math.max(P.y, H.y) + 110 }, H, ease(u));
    return { ...pos, pose: "hang", flip, form, line: [A, grip(pos, "hang", flip)], hook: A, streak: true };
  }
  // Let go: the rope zips back up to its hook
  function letGo(s, u, form) {
    const flip = s === "L", A = anchor(s), H = hangAt(s);
    return { ...H, pose: "hang", flip, form, line: [A, mix(grip(H, "hang", flip), A, easeOut(u))], hook: A };
  }
  // Jump into a box and vanish into it
  function dive(top, mid, u, form) {
    return { ...mix(top, mid, u), pose: "jump", form, rot: u * Math.PI * 2, size: 1 - 0.6 * u, alpha: 1 - u };
  }
  const ropeOnly = (st) => (G.wide ? st : HIDE);

  /* ---------- Stations: where he rests, given the scroll ---------- */
  const tools = S.tools.reduce((n, [, list]) => n + list.length, 0);
  const INVENTORY_LINES = ["main quest: backend", "side quests: Web3 + AI", `${tools} items in the bag`];
  function hanging(s, moving, idle, form, now) {
    if (!G.wide) return HIDE;
    const flip = s === "L", A = anchor(s), H = hangAt(s);
    const pos = { x: H.x + Math.sin(now / 650) * 3, y: H.y };
    if (!moving && idle === "type") return { ...pos, form, hook: A, pose: "type", frame: now / 200, line: [A, grip(pos, "belt", false)] }; // hangs by the harness and types
    const st = { ...pos, form, hook: A, pose: "hang", frame: now / 320, flip, line: [A, grip(pos, "hang", flip)] };
    if (!moving && idle === "talk") st.say = INVENTORY_LINES;
    if (form === "rich") st.coins = true;
    return st;
  }
  const docked = (name) => () => ({ show: false, dock: name });
  const STOP = (i) => (now) => ({ ...nodePt(i), pose: "idle", frame: now / 400, shadow: true, think: S.workflow[i][1] });
  const STATIONS = [
    { name: "hero", rest: (now, moving) => ({ ...heroPt(), pose: moving ? "idle" : "wave", frame: now / 330, shadow: true }) },
    { name: "ropeL1", rest: (now, moving) => hanging("L", moving, "type", "lv2", now) },
    { name: "rpg", rest: docked("rpg") },
    ...[0, 1, 2, 3, 4].map((i) => ({ name: `stop${i}`, rest: STOP(i) })),
    { name: "ropeR1", rest: (now, moving) => hanging("R", moving, "talk", "lv2", now) },
    { name: "stage", rest: docked("stage") },
    { name: "loot", rest: (now) => { // flat out on the money, then dizzy, then trophy up and $ for eyes
      const a = now - G.arrivedAt, spot = lootSpot();
      if (a < 650) return { ...spot, y: spot.y + 7 * G.scale, pose: "dizzy", frame: now / 200, rot: Math.PI / 2, form: "lv3" };
      if (a < 1500) return { ...spot, pose: "dizzy", frame: now / 200, form: "lv3", shadow: true };
      return { ...spot, pose: "trophy", frame: now / 300, form: "rich", coins: true, shadow: true };
    } },
    { name: "ropeL2", rest: (now, moving) => hanging("L", moving, "hang", "rich", now) },
    { name: "garden", rest: docked("garden") },
    { name: "ropeR2", rest: (now, moving) => hanging("R", moving, "hang", "lv3", now) },
    { name: "seat", rest: docked("seat") },
  ];
  const IDX = Object.fromEntries(STATIONS.map((s, i) => [s.name, i]));

  // The scroll at which each station begins (rebuilt every frame from where things are)
  function starts() {
    const vh = innerHeight;
    // the trail is pinned: its stops share the scroll from when it pins to when it lets go
    const pin = box(EL.pin), pinTop = parseFloat(getComputedStyle(EL.trail).top) || 0;
    const trailA = pin.py - pinTop, trailB = pin.py + pin.h - pinTop - box(EL.trail).h - 0.15 * vh; // the rope shot starts while still pinned
    const jrEnd = box(EL.jr).py + box(EL.jr).h - vh;
    const gTop = parseFloat(getComputedStyle(EL.gardenCard).top) || 0, gp = box(EL.gardenPin);
    const gardenA = gp.py - gTop, gardenB = gp.py + gp.h - box(EL.gardenCard).h - gTop - 0.05 * vh;
    const raw = [
      0,
      at(EL.wsHead, 0.6),
      at(EL.rpg, 0.5),
      ...[0, 1, 2, 3, 4].map((i) => lerp(trailA, trailB, i / 5)),
      trailB,
      at(EL.jr, 0.2),
      jrEnd + 0.04 * vh, // the moment the Journey stage lets go
      at(EL.loot, 0.25),
      gardenA, // the garden card pins: he lands in the bed
      gardenB, // just before it lets go: off to the rope
      Math.min(at(EL.camp, 0.4), document.documentElement.scrollHeight - vh - 40), // by the fire in the footer
    ];
    for (let i = 1; i < raw.length; i++) raw[i] = Math.max(raw[i], raw[i - 1] + 1);
    return raw;
  }

  /* ---------- Moves: from station i to station i + 1 (played backwards to go back) ---------- */
  // sfx: [moment, sound, effect]; effects: dust under his feet, flash at the gun's muzzle
  const hopTo = (from, to, h, dur) => ({
    dur,
    sfx: [[0, "jump"], [0.99, "thud", "dust"]],
    fn: (q) => ({ ...hop(from(), to(), ease(q), h), pose: q > 0.97 ? "idle" : "jump", shadow: q > 0.97 }),
  });
  const MOVES = [
    { // hero → onto the Workshop heading → fire the rope at the top-left → swing out
      dur: 1700,
      sfx: [[0, "jump"], [0.32, "thud", "dust"], [0.44, "pew", "flash"], [0.63, "whoosh"]],
      fn(q) {
        const a = heroPt(), b = headPt();
        if (q < 0.32) return { ...hop(a, b, ease(q / 0.32), 140), pose: "jump" };
        if (q < 0.42) return { ...b, pose: "idle", shadow: true };
        if (q < 0.62) return ropeOnly(fire("L", b, (q - 0.42) / 0.2));
        return ropeOnly(swingOut("L", b, (q - 0.62) / 0.38));
      },
    },
    { // let go → jump onto the dialogue box → dive in
      dur: 950,
      sfx: [[0.15, "jump"], [0.72, "whoosh"]],
      fn(q) {
        if (!G.wide) return HIDE;
        if (q < 0.15) return letGo("L", q / 0.15);
        const H = hangAt("L"), top = portraitPt(0);
        if (q < 0.72) return { ...hop(H, top, ease((q - 0.15) / 0.57), 150), pose: "jump" };
        return dive(top, portraitPt(0.7), (q - 0.72) / 0.28);
      },
    },
    { // pop out of the dialogue box and drop onto the first stop
      dur: 700,
      sfx: [[0, "jump"], [0.99, "thud", "dust"]],
      fn: (q) => ({ ...hop(portraitPt(0.95), nodePt(0), ease(q), 50), pose: q > 0.97 ? "idle" : "jump", size: lerp(0.5, 1, clamp(q * 3)), shadow: q > 0.97 }),
    },
    ...[0, 1, 2, 3].map((i) => hopTo(() => nodePt(i), () => nodePt(i + 1), 95, 480)),
    { // Trust the logs → fire at the top-right corner → swing out
      dur: 1300,
      sfx: [[0.12, "pew", "flash"], [0.5, "whoosh"]],
      fn(q) {
        const P = nodePt(4);
        if (q < 0.12) return { ...P, pose: "aim", shadow: true };
        if (q < 0.5) return ropeOnly(fire("R", P, (q - 0.12) / 0.38));
        return ropeOnly(swingOut("R", P, (q - 0.5) / 0.5));
      },
    },
    { // zip-line from the right rope across to the Journey stage, then drop in
      dur: 1350,
      sfx: [[0.05, "pew", "flash"], [0.3, "zip"], [0.82, "whoosh"]],
      fn(q) {
        if (!G.wide) return HIDE;
        const H = hangAt("R"), Z = stagePinned(0), A = anchor("R");
        const Zhook = { x: Z.x, y: Z.y - 40 }; // the hook bites just above the stage
        const muzzle = grip(H, "aim", true);
        if (q < 0.28) { // aim left and fire; the old rope zips back up
          const tip = mix(muzzle, Zhook, easeOut(q / 0.28));
          return { ...H, pose: "aim", flip: true, line: [muzzle, tip], hook: tip, line2: [A, mix(grip(H, "hang", false), A, q / 0.28)], kick: q < 0.05 };
        }
        const end = { x: Zhook.x + 9 * G.scale, y: Zhook.y + 26 * G.scale }; // where his hand meets the hook
        if (q < 0.8) {
          const pos = mix(H, end, ease((q - 0.28) / 0.52));
          return { ...pos, pose: "hang", flip: true, line: [Zhook, grip(pos, "hang", true)], hook: Zhook, streak: true };
        }
        return dive(end, stageNow(0.6), (q - 0.8) / 0.2);
      },
    },
    { // off the stage, head over heels onto the prize money
      dur: 1000,
      sfx: [[0, "jump"], [0.99, "bonk", "dust"]],
      fn(q) {
        const from = stageNow(0.5), to = lootSpot();
        const pos = hop(from, to, ease(q), 150);
        return { ...pos, y: pos.y + 7 * G.scale * q, pose: "jump", form: "lv3", rot: q * Math.PI * 2.5, size: lerp(0.6, 1, clamp(q * 4)) };
      },
    },
    { // walk to the edge of the card, coins spilling → fire at the top-left → swing out
      dur: 1500,
      sfx: [[0.38, "pew", "flash"], [0.6, "whoosh"]],
      fn(q, now) {
        const edge = lootEdge();
        if (q < 0.35) return { ...mix(lootSpot(), edge, ease(q / 0.35)), pose: "walk", frame: now / 110, form: "rich", coins: true, shadow: true };
        if (q < 0.6) return { ...ropeOnly(fire("L", edge, (q - 0.35) / 0.25, "rich")), coins: true };
        return { ...ropeOnly(swingOut("L", edge, (q - 0.6) / 0.4, "rich")), coins: true };
      },
    },
    { // let go → a flailing leap onto the garden → a flop into the bed
      dur: 1150,
      sfx: [[0.1, "jump"], [0.55, "thud", "dust"], [0.99, "thud", "dust"]],
      fn(q) {
        if (!G.wide) return HIDE;
        if (q < 0.1) return letGo("L", q / 0.1, "lv3");
        const H = hangAt("L"), card = cardPt();
        if (q < 0.55) { const u = (q - 0.1) / 0.45; return { ...hop(H, card, ease(u), 130), pose: "jump", form: "lv3", rot: Math.sin(u * Math.PI * 3) * 0.4 }; }
        const u = (q - 0.55) / 0.45;
        return { ...hop(card, soilPt(), ease(u), 40), pose: u > 0.96 ? "idle" : "jump", form: "lv3", size: lerp(1, G_SCALE / G.scale, u) };
      },
    },
    { // from wherever he's got to in the garden → fire at the top-right → swing out
      dur: 1300,
      sfx: [[0.1, "pew", "flash"], [0.5, "whoosh"]],
      fn(q) {
        const P = gardenerPt();
        if (q < 0.45) return ropeOnly(fire("R", P, q / 0.45, "lv3"));
        return ropeOnly(swingOut("R", P, (q - 0.45) / 0.55, "lv3"));
      },
    },
    { // let go → down into the night → land on my log by the fire
      dur: 1100,
      sfx: [[0.12, "jump"], [0.99, "thud", "dust"]],
      fn(q) {
        if (!G.wide) return HIDE;
        if (q < 0.12) return letGo("R", q / 0.12, "lv3");
        const end = SEAT_SCALE / G.scale, u = (q - 0.12) / 0.88;
        if (u < 0.95) return { ...hop(hangAt("R"), seatPt(), ease(u), 170), pose: "jump", form: "lv3", flip: true, size: lerp(1, end, u) };
        return { ...seatPt(), pose: "sit", form: "lv3", size: end };
      },
    },
  ];

  /* ---------- Going back up: a jetpack instead of rewinding ropes and jumps ---------- */
  // where he settles at each station, for flying there
  function restPoint(k) {
    const n = STATIONS[k].name;
    if (n === "hero") return heroPt();
    if (n.startsWith("rope")) return hangAt(n[4]);
    if (n === "rpg") return portraitPt(0.75);
    if (n.startsWith("stop")) return nodePt(+n[4]);
    if (n === "stage") return stageNow(0.9);
    if (n === "loot") return lootSpot();
    if (n === "garden") return gardenerPt();
    return seatPt();
  }
  // Flies to the station the scroll has reached; once the scroll stops there, lands the way that
  // spot needs: feet down with a puff of dust, a fresh rope fired up to the top of the screen, or
  // a drop into the scene. Returns null once he's landed (the station's own pose takes over).
  function flight(now, dt, moving) {
    const f = G.fly, K = Math.floor(G.P + 1e-6), name = STATIONS[K].name, goal = restPoint(K); // the next station up, not the one he left
    const kind = /^(hero|stop|loot)/.test(name) ? "ground" : name.startsWith("rope") && G.wide ? "rope" : "dock";
    if (!f.landing) {
      const dx = goal.x - f.x, dy = goal.y - f.y, d = Math.hypot(dx, dy);
      const step = Math.min(d, Math.max(260, d * 7) * dt);
      if (d > 0.5) { f.x += (dx / d) * step; f.y += (dy / d) * step; }
      if (!moving && G.P === K && d < 10) { f.landing = { t0: now }; if (kind === "rope") Sound.pew(); }
      return { x: f.x, y: f.y, pose: "idle", frame: now / 300, rot: clamp(dx / 900, -0.25, 0.25), jet: 1 };
    }
    const u = (now - f.landing.t0) / 1000;
    if (kind === "ground" && u < 0.35) return { ...goal, y: goal.y - 12 * (1 - ease(u / 0.35)), pose: "idle", frame: now / 300, jet: 1 - u / 0.35 };
    if (kind === "rope" && u < 0.45) return { ...fire(name[4], goal, u / 0.45), jet: 0.6 };
    if (kind === "dock" && u < 0.4) return { ...dive({ x: goal.x, y: goal.y - 36 }, goal, u / 0.4), jet: 1 - u / 0.4 };
    if (kind === "ground") { burst("dust", goal, 7); Sound.thud(); }
    G.fly = null;
    G.arrivedAt = now - 2000; // landed, not fallen: skip the loot's bonk
    return null;
  }
  // the pack's two tanks at his hips, and their flames (power 0 to 1)
  function drawJet(c, x, y, s, power) {
    const ctx = c.ctx, k = c.k;
    for (const side of [-1, 1]) {
      const nx = x + side * 9.5 * s, top = y - 21 * s;
      ctx.fillStyle = "#4a4f57";
      ctx.fillRect((nx - 2 * s) * k, top * k, 4 * s * k, 8 * s * k);
      ctx.fillStyle = "#8d939b";
      ctx.fillRect((nx - 1.5 * s) * k, (top + 8 * s) * k, 3 * s * k, 1.5 * s * k);
      if (power <= 0.02) continue;
      const len = power * (5 + Math.random() * 4) * s;
      ctx.fillStyle = "#f1bf45";
      ctx.fillRect((nx - 1.5 * s) * k, (top + 9.5 * s) * k, 3 * s * k, len * k);
      ctx.fillStyle = "#e86f55";
      ctx.fillRect((nx - s) * k, (top + 9.5 * s + len * 0.45) * k, 2 * s * k, len * 0.7 * k);
    }
  }

  /* ---------- Effects: dust, muzzle flashes, coins, poofs, afterimages ---------- */
  function burst(kind, p, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      if (kind === "dust") G.fx.push({ kind, x: p.x + (Math.random() - 0.5) * 30, y: p.y - 2, vx: Math.cos(a) * 40, vy: -20 - Math.random() * 30, t: 0, life: 0.5 });
      if (kind === "flash") G.fx.push({ kind, x: p.x, y: p.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, t: 0, life: 0.25 });
      if (kind === "poof") G.fx.push({ kind, x: p.x + (Math.random() - 0.5) * 30, y: p.y - 40 + (Math.random() - 0.5) * 50, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, t: 0, life: 0.6 });
      if (kind === "smoke") G.fx.push({ kind, x: p.x + (Math.random() - 0.5) * 14, y: p.y, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 40, t: 0, life: 0.7 });
      if (kind === "coin") G.fx.push({ kind, x: p.x + (Math.random() - 0.5) * 12 * G.scale, y: p.y - 12 * G.scale, vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 90, t: 0, life: 3 });
    }
  }
  function drawFx(dt) {
    const c = G.c, ctx = c.ctx;
    G.fx = G.fx.filter((p) => {
      p.t += dt;
      if (p.kind === "coin") p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.t / p.life;
      if (k >= 1 || p.y > innerHeight + 20) return false;
      if (p.kind === "coin") prop(c, "coin", p.x, p.y, 2);
      else if (p.kind === "smoke") {
        const s = (4 + k * 10) * c.k;
        ctx.fillStyle = `rgba(150, 150, 150, ${0.45 * (1 - k)})`;
        ctx.fillRect(Math.round(p.x * c.k - s / 2), Math.round(p.y * c.k - s / 2), Math.round(s), Math.round(s));
      } else if (p.kind === "dust") {
        const s = (3 + k * 5) * c.k;
        ctx.fillStyle = `rgba(150, 130, 105, ${0.5 * (1 - k)})`;
        ctx.fillRect(Math.round(p.x * c.k - s / 2), Math.round(p.y * c.k - s / 2), Math.round(s), Math.round(s));
      } else {
        ctx.globalAlpha = 1 - k;
        prop(c, "star", p.x, p.y, p.kind === "flash" ? 3 : 2);
        ctx.globalAlpha = 1;
      }
      return true;
    });
  }

  function lightTrail(lit, st, inTrail, now) {
    if (lit !== G.lit) {
      if (lit > G.lit && G.lit > -2) Sound.tick(Math.max(0, lit));
      EL.stops.forEach((li, i) => li.classList.toggle("lit", i <= lit));
      EL.trail.classList.toggle("done", lit >= EL.stops.length - 1);
      G.lit = lit;
      G.litAt = now;
    }
    // the solid line follows him along the trail
    const l = box(EL.line);
    const vertical = l.h > l.w;
    const to = inTrail && st?.x !== undefined ? (vertical ? st.y - l.top : st.x - l.x) : lit >= EL.stops.length - 1 ? 1e5 : 0;
    EL.fill.style[vertical ? "height" : "width"] = `${clamp(to, 0, vertical ? l.h : l.w)}px`;
  }

  function drawRope(ctx, k, [p, q]) {
    ctx.lineCap = "round";
    ctx.strokeStyle = "#4a3426";
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.moveTo(p.x * k, p.y * k);
    ctx.lineTo(q.x * k, q.y * k);
    ctx.stroke();
    ctx.strokeStyle = "rgba(196, 160, 110, .8)";
    ctx.lineWidth = 1 * k;
    ctx.stroke();
  }

  function drawGuide(now, dt) {
    frameNo++;
    const c = G.c, ctx = c.ctx;
    wipe(c);
    if (still) { lightTrail(EL.stops.length - 1, null, false, now); return; } // reduced motion: he simply waits in each spot
    const moving = now - G.lastScroll < 200;
    // his resting poses (the laptop on the rope, a wave, a chat) wait for a real stop, so a slow
    // scroll with little pauses doesn't flip him between poses every second
    const settling = now - G.lastScroll < 1200;

    // Where the scroll is, in stations. Each move plays out while the scroll runs through the stretch just
    // before the station it leads to, so he moves with the page (not on a timer) and is there when it arrives.
    const S0 = starts(), vh = innerHeight;
    let k = 0;
    while (k < S0.length - 1 && scrollY >= S0[k + 1]) k++;
    let T = k;
    if (k + 1 < S0.length) {
      const zone = Math.max(1, Math.min(0.3 * vh, 0.7 * (S0[k + 1] - S0[k])));
      T = k + clamp((scrollY - (S0[k + 1] - zone)) / zone);
    }
    if (G.P === null) { G.P = T; G.cur = Math.round(T); G.arrivedAt = now; }
    // the garden walk: how far along the bed the scroll says he should be (the last stretch is the rope out)
    const gExit = Math.min(0.3 * vh, 0.7 * (S0[IDX.ropeR2] - S0[IDX.garden]));
    gardener.want = clamp((scrollY - S0[IDX.garden]) / Math.max(1, S0[IDX.ropeR2] - gExit - S0[IDX.garden]));

    // He never parks mid-move: stop scrolling inside one and he finishes it, the way you were going.
    // Scroll on after that and he waits for the page to catch up rather than stepping back.
    let want = T;
    if (!moving && T % 1 > 0.001) want = G.dir < 0 ? Math.floor(T) : Math.ceil(T);
    else if (G.dir > 0 && G.P > T && G.P - T < 1) want = G.P;
    else if (G.dir < 0 && G.P < T && T - G.P < 1) want = G.P;
    // he waters the whole bed before he swings off (unless a link sends him a long way at once)
    G.gardenHold = want > IDX.garden && G.P <= IDX.garden && G.P > IDX.garden - 1.5 && want - G.P < 2.5 && gardener.state !== "done";
    if (G.gardenHold) want = IDX.garden;
    // ...and he stays on the Journey stage until its last scene has played
    const journeyLeft = seen.get(stage.el) && stage.shown >= 0 && (stage.shown < S.journey.length - 1 || stage.p < 0.99);
    G.stageHold = want > IDX.stage && G.P <= IDX.stage && G.P > IDX.stage - 1.5 && want - G.P < 2.5 && journeyLeft;
    if (G.stageHold) want = Math.min(want, IDX.stage);
    // Follow the scroll, but never faster than a move can be watched. A long way behind (a dock link),
    // he runs through every move in between, quickly, instead of vanishing and reappearing.
    const gap = Math.abs(want - G.P);
    const mi = clamp(Math.floor(want < G.P ? G.P - 1e-6 : G.P), 0, MOVES.length - 1);
    const speed = Math.max(1000 / (MOVES[mi].dur * 0.6), gap > 1 ? gap * 2.5 : 0); // stations per second (dur is in ms)
    const prevP = G.P;
    const step = clamp((want - G.P) * (1 - Math.exp(-dt * 14)), -speed * dt, speed * dt);
    G.P = clamp(Math.abs(want - G.P - step) < 0.002 ? want : G.P + step, 0, STATIONS.length - 1);

    const at = Math.abs(G.P - Math.round(G.P)) < 0.002 ? Math.round(G.P) : -1; // standing at a station
    if (at >= 0 && at !== G.cur) {
      if (at === IDX.garden && at > G.cur) gardener.start(); // flopped into the bed: walk it from the start
      G.cur = at;
      G.arrivedAt = now;
    }
    G.move = at >= 0 ? null : { idx: Math.floor(G.P), dir: G.P >= prevP ? 1 : -1 }; // the move he's partway through

    let st = G.move ? MOVES[G.move.idx].fn(G.P - G.move.idx, now) : STATIONS[G.cur].rest(now, settling);
    // sounds and effects at their moments in each move he passes through, going forwards at a watchable pace
    if (G.P > prevP && gap <= 1.5) {
      for (let m = Math.floor(prevP); m < G.P && m < MOVES.length; m++) {
        const q0 = Math.max(0, prevP - m), q1 = Math.min(1, G.P - m);
        for (const [t, sound, effect] of MOVES[m].sfx) {
          if (!(q0 < t && q1 >= t)) continue;
          Sound[sound]?.();
          if (effect === "dust" && st.show !== false) burst("dust", st, 7);
          if (effect === "flash" && st.line) burst("flash", st.line[0], 6);
        }
      }
    }

    // Heading back up the page, he flies there by jetpack rather than rewinding every move
    if (!still && !G.fly && want < G.P - 1e-3) {
      const from = G.last && G.last.show !== false && G.last.x !== undefined ? G.last : restPoint(G.cur);
      G.fly = { x: from.x, y: from.y, landing: null };
      Sound.whoosh();
    }
    if (G.fly && want > G.P + 1e-3) G.fly = null; // heading down again: the usual moves take over
    if (G.fly) st = flight(now, dt, moving) || STATIONS[G.cur].rest(now, settling);

    const dock = st.dock || null;
    if (dock !== G.dock) { G.dock = dock; G.dockAt = now; }
    // trail lights: the stop he's standing on (or just left) and everything before it
    const stop0 = IDX.stop0, stopN = IDX.stop4;
    const where = G.move ? G.move.idx : G.cur;
    const lit = where < stop0 ? -1 : where > stopN ? EL.stops.length - 1 : where - stop0;
    lightTrail(lit, st, where >= stop0 - 1 && where <= stopN, now);
    if (G.dock === "garden" && gardener.state === "wait") gardener.start(); // arrived some other way (by jetpack, a reload)
    if (G.cur > IDX.garden || (G.move && G.move.idx >= IDX.garden)) gardener.finish(); // he's left: the rest of the bed grows anyway
    if (G.P < IDX.garden - 0.5 && gardener.state === "done") gardener.state = "wait"; // flown back up: next time down, he walks it again

    // a little smaller whenever he's on the move
    G.size = lerp(G.size, G.move || moving ? 0.75 : 1, 1 - Math.exp(-dt * 10));
    if (st.coins && st.show !== false && Math.random() < dt * 9) {
      burst("coin", st, 1);
      if (Math.random() < 0.15) Sound.coin();
    }
    drawFx(dt);
    G.last = st;
    if (st.show === false) { G.say.className = "guide-say"; G.ghosts.length = 0; return; }

    const scale = G.scale * (st.size ?? 1) * G.size;
    const form = st.form || (G.cur > IDX.stage || (G.move && G.move.idx >= IDX.stage) ? "lv3" : "lv2");
    if (st.line2) drawRope(ctx, c.k, st.line2);
    if (st.line) {
      drawRope(ctx, c.k, st.line);
      if (st.hook) prop(c, "hook", st.hook.x, st.hook.y + 8, 3);
    }
    if (st.streak && G.ghosts.length > 1) { // speed lines behind him on swings and zip-lines
      const a = G.ghosts[0], b = G.ghosts[G.ghosts.length - 1];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = "rgba(60, 50, 40, .28)";
      ctx.lineWidth = 2 * c.k;
      for (let i = -1; i <= 1; i++) {
        const ox = (-dy / len) * i * 14, oy = (dx / len) * i * 14;
        ctx.beginPath();
        ctx.moveTo((b.x - (dx / len) * 20 + ox) * c.k, (b.y - 14 * scale - (dy / len) * 20 + oy) * c.k);
        ctx.lineTo((b.x - (dx / len) * 70 + ox) * c.k, (b.y - 14 * scale - (dy / len) * 70 + oy) * c.k);
        ctx.stroke();
      }
    }
    if (st.shadow) {
      ctx.fillStyle = "rgba(30, 20, 10, .16)";
      ctx.beginPath();
      ctx.ellipse(st.x * c.k, (st.y + 1) * c.k, 9 * scale * c.k, 2.2 * scale * c.k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // afterimages while he's moving between stations
    const pose = { pose: st.pose, frame: st.frame ?? now / 260, form, scale, flip: st.flip, rot: st.rot };
    if (G.move) {
      G.ghosts.push({ ...pose, x: st.x, y: st.y });
      if (G.ghosts.length > 5) G.ghosts.shift();
      G.ghosts.slice(0, -1).forEach((gh, i) => drawMe(c, { ...gh, alpha: 0.08 + i * 0.06 }));
    } else G.ghosts.length = 0;
    if (st.jet !== undefined) {
      drawJet(c, st.x, st.y, scale, st.jet);
      if (st.jet > 0.3 && Math.random() < dt * 24) for (const side of [-1, 1]) burst("smoke", { x: st.x + side * 9.5 * scale, y: st.y - 9 * scale }, 1);
    }
    // a thin light edge and a soft shadow, so he reads on grass and on paper alike
    ctx.filter = "drop-shadow(0 0 1px rgba(255, 250, 235, .95)) drop-shadow(0 6px 4px rgba(30, 20, 10, .22))";
    drawMe(c, { ...pose, x: st.x + (st.kick ? (st.flip ? 3 : -3) : 0), y: st.y, alpha: st.alpha }); // kick = the gun's recoil
    ctx.filter = "none";

    // what he says (inventory) or thinks (each trail stop)
    const say = st.say || st.think;
    if (say) {
      if (st.think) { if (G.say.textContent !== st.think) G.say.textContent = st.think; }
      else words(G.say, st.say);
      G.say.className = `guide-say on${st.think ? " cloud" : ""}`;
      const w = G.say.offsetWidth, h = G.say.offsetHeight;
      const left = st.think ? clamp(st.x - w / 2, 8, innerWidth - w - 8) : st.x > innerWidth / 2 ? st.x - w - 30 : st.x + 30;
      G.say.style.transform = `translate(${Math.round(left)}px, ${Math.round(st.y - 33 * scale - h - (st.think ? 18 : -10))}px)`;
    } else G.say.className = "guide-say";
  }

  /* ---------- Minimum hand-holding: my workshop. Whoever's asking walks in with a task for the quest board ---------- */
  const portrait = { el: watch($("#rpg-me")), visit: null };
  const VISITORS = [ // one per choice: how they look, what they say, the quest they leave
    { form: "mate", line: "we need someone who just ships", quest: "ship it end to end" },
    { form: "mate2", line: "I have an idea and a deadline", quest: "idea → working MVP" },
    { form: "mentor2", line: "can you own the API?", quest: "own the API + tests" },
  ];
  const DONE = ["auth flow ✓", "payments ✓", "CI + deploy ✓"];
  document.addEventListener("rpgpick", (e) => { portrait.visit = { i: e.detail, t0: performance.now(), pinned: false }; });
  function sizePortrait() {
    const box = portrait.el.parentElement; // inside its border
    portrait.c = sized(portrait.el, box.clientWidth, box.clientHeight);
  }
  function drawPortrait(now) {
    const c = portrait.c, w = c.w, narrow = w < 560, s = narrow ? 2 : 3, floor = Math.round(c.h * 0.84) + 4;
    wipe(c);
    const v = portrait.visit, vt = v ? Math.max(0, now - v.t0) / 1000 : 0, V = v && VISITORS[v.i];
    const here = still || G.dock === "rpg";
    const meX = w / 2, counter = w * (narrow ? 0.29 : 0.33), doorX = 12;
    // the door they come in by, and a window
    block(c, doorX, floor - 41 * s, 18 * s, 41 * s, "#9a6b3f", "#4a3426");
    block(c, doorX + 3 * s, floor - 37 * s, 12 * s, 15 * s, "#87592f", "#4a3426");
    c.ctx.fillStyle = "#f1bf45";
    c.ctx.fillRect((doorX + 14 * s) * c.k, (floor - 20 * s) * c.k, 2 * s * c.k, 2 * s * c.k);
    if (!narrow) {
      const wx = w * 0.15, wy = 30;
      block(c, wx, wy, 104, 78, "#cfe6ef", "#4a3426");
      c.ctx.fillStyle = "#4a3426";
      c.ctx.fillRect((wx + 51) * c.k, wy * c.k, 3 * c.k, 78 * c.k);
      c.ctx.fillRect(wx * c.k, (wy + 38) * c.k, 104 * c.k, 3 * c.k);
      c.ctx.fillStyle = "#fff6c8";
      c.ctx.fillRect((wx + 14) * c.k, (wy + 12) * c.k, 14 * c.k, 14 * c.k); // the sun
    }
    // the lantern over my bench, and its pool of light
    const glow = c.ctx.createRadialGradient(meX * c.k, 40 * c.k, 4 * c.k, meX * c.k, 40 * c.k, 150 * c.k);
    glow.addColorStop(0, "rgba(255, 214, 130, .45)");
    glow.addColorStop(1, "rgba(255, 214, 130, 0)");
    c.ctx.fillStyle = glow;
    c.ctx.fillRect(0, 0, c.ctx.canvas.width, c.ctx.canvas.height);
    c.ctx.fillStyle = "#4a3426";
    c.ctx.fillRect((meX - 1) * c.k, 0, 2 * c.k, 18 * c.k);
    prop(c, "lantern", meX, narrow ? 34 : 44, narrow ? 2 : 3);

    // the quest board: work that's done, and one open slot for yours
    const bx = w * (narrow ? 0.64 : 0.67), bw = w * (narrow ? 0.34 : 0.29), by = narrow ? 12 : 20, bh = floor - (narrow ? 40 : 52) - by;
    block(c, bx, by, bw, bh, "#c89b62", "#4a3426");
    text(c, "QUEST BOARD", bx + bw / 2, by + 13, { size: 14, color: "#4a3426" });
    const cols = narrow ? 1 : 2, rows = 4 / cols, gap = 6;
    const cw = (bw - 16 - gap * (cols - 1)) / cols, ch = (bh - 32 - gap * (rows - 1)) / rows;
    const slot = (i) => ({ x: bx + 8 + (i % cols) * (cw + gap), y: by + 26 + Math.floor(i / cols) * (ch + gap) });
    const PIN = 3.6; // when the new quest goes up
    DONE.forEach((label, i) => { const p = slot(i); block(c, p.x, p.y, cw, ch, "#fbfaf5", "#6d7a70"); text(c, label, p.x + cw / 2, p.y + ch / 2, { size: 13, color: "#4f6b2e" }); });
    const open = slot(3);
    if (V && vt >= PIN) { // the new quest, pinned with a little pop
      if (!v.pinned) { v.pinned = true; Sound.coin?.(); }
      const pop = 1 + 0.15 * Math.max(0, 1 - (vt - PIN) / 0.25);
      const pw = cw * pop, ph = ch * pop, px = open.x + (cw - pw) / 2, py = open.y + (ch - ph) / 2;
      block(c, px, py, pw, ph, "#fff3b0", "#4a3426");
      text(c, V.quest, px + pw / 2, py + ph / 2, { size: 13 });
      c.ctx.fillStyle = "#c0473a";
      c.ctx.fillRect((px + pw / 2 - 2) * c.k, (py - 2) * c.k, 5 * c.k, 5 * c.k);
    } else {
      c.ctx.save();
      c.ctx.strokeStyle = "rgba(74, 52, 38, .6)";
      c.ctx.lineWidth = 2 * c.k;
      c.ctx.setLineDash([5 * c.k, 4 * c.k]);
      c.ctx.strokeRect((open.x + 1) * c.k, (open.y + 1) * c.k, (cw - 2) * c.k, (ch - 2) * c.k);
      c.ctx.restore();
      text(c, "your task here", open.x + cw / 2, open.y + ch / 2, { size: 13, color: "#5a4030" });
    }

    // the visitor: walks in, says what they need, hands over the quest, and heads back out
    if (V && vt < 6.4) {
      const out = vt > 5;
      const x = vt < 1.3 ? lerp(doorX + 9 * s, counter, ease(vt / 1.3)) : out ? lerp(counter, doorX + 9 * s, ease((vt - 5) / 1.4)) : counter;
      const walking = vt < 1.3 || out;
      drawMe(c, { pose: walking ? "walk" : vt < 3.2 ? "wave" : "idle", frame: now / (walking ? 110 : 300), form: V.form, x, y: floor, scale: s, flip: out });
      if (vt > 1.3 && vt < 3.3) bubble(c, V.line, x, floor - 34 * s);
    }
    // me at my bench, typing (or saying hello while the box talks)
    if (here) {
      const drop = still ? 1 : ease(clamp((now - G.dockAt) / 320)); // he lands in from the top
      const talking = !$("#rpg-box").classList.contains("done");
      const holding = V && vt > 2.5 && vt < 3.1;
      const pose = drop < 1 ? "jump" : holding ? "cheer" : talking ? "wave" : "type";
      drawMe(c, { pose, frame: now / (pose === "type" ? 180 : 300), form: "lv2", x: meX, y: floor - 4 - (1 - drop) * c.h * 0.55, scale: s });
    }
    desk(c, meX, floor, narrow ? 96 : 140);
    block(c, meX - 24, floor - 54, 48, 26, "#8d939b", "#4a4f57"); // the laptop's lid, from behind
    text(c, "</>", meX, floor - 41, { size: 13, color: "#f5f2ea" });
    // the quest card on its way: visitor to me, then me to the board
    if (V && vt > 2 && vt < PIN) {
      const from = { x: counter + 8 * s, y: floor - 18 * s }, mine = { x: meX - 6, y: floor - 26 * s }, to = { x: open.x + cw / 2, y: open.y + ch / 2 + 9 };
      const p = !here ? hop(from, to, easeOut(clamp((vt - 2) / 1.6)), 60)
        : vt < 2.5 ? hop(from, mine, easeOut((vt - 2) / 0.5), 30)
        : vt < 3.1 ? mine
        : hop(mine, to, easeOut((vt - 3.1) / 0.5), 50);
      block(c, p.x - 18, p.y - 12, 36, 24, "#fff3b0", "#4a3426");
    }
  }

  /* ---------- The trail: my AI crew, and what each stop looks like in practice ---------- */
  const trailFx = { el: watch($("#trail-fx")) };
  function layoutTrailFx() {
    const b = EL.trail.getBoundingClientRect();
    trailFx.extra = innerWidth < 760 ? 230 : 250; // the strip under the stops where the crew stand
    trailFx.c = sized(trailFx.el, b.width, b.height + trailFx.extra);
  }
  const SKETCH = "#6965db"; // the violet of a whiteboard marker
  function sketchBox(c, x, y, w, h, seed) { // a slightly wobbly, hand-drawn rectangle
    const ctx = c.ctx, k = c.k, j = (n) => Math.sin(seed * 7.3 + n * 2.1) * 1.4;
    ctx.strokeStyle = SKETCH;
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo((x + j(1)) * k, (y + j(2)) * k);
    ctx.lineTo((x + w + j(3)) * k, (y + j(4)) * k);
    ctx.lineTo((x + w + j(5)) * k, (y + h + j(6)) * k);
    ctx.lineTo((x + j(7)) * k, (y + h + j(8)) * k);
    ctx.closePath();
    ctx.stroke();
  }
  function sketchArrow(c, x1, y1, x2, y2, u) { // drawn from the tail, u of the way
    const ctx = c.ctx, k = c.k;
    const x = lerp(x1, x2, u), y = lerp(y1, y2, u);
    ctx.strokeStyle = SKETCH;
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo(x1 * k, y1 * k);
    ctx.lineTo(x * k, y * k);
    if (u >= 1) { ctx.moveTo((x - 6) * k, (y - 5) * k); ctx.lineTo(x * k, y * k); ctx.lineTo((x - 6) * k, (y + 5) * k); }
    ctx.stroke();
  }
  // ---- the crew walk to each stop and act it out together ----
  const CREW_NAMES = ["claude", "codex", "openclaw"];
  const CREW_H = { claude: 13, codex: 12, openclaw: 14 }; // sprite heights, in sprite pixels
  const CREW_LABEL = { claude: "Claude", codex: "Codex", openclaw: "OpenClaw" };
  const actors = Object.fromEntries(CREW_NAMES.map((n) => [n, { x: null, face: 1, moving: false }]));
  // Walk a list of marks at a steady pace, pausing at each: where is the walker at time t?
  function route(t, marks, speed = 130) {
    let x = marks[0].x, at = 0;
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i], walk = Math.abs(m.x - x) / speed;
      if (t < at + walk) return { x: lerp(x, m.x, (t - at) / walk), leg: i, walking: true, since: 0 };
      at += walk;
      x = m.x;
      if (t < at + (m.wait ?? 0)) return { x, leg: i, walking: false, since: t - at };
      at += m.wait ?? 0;
    }
    return { x, leg: marks.length, walking: false, since: 0 };
  }
  const reached = (r, i) => r.leg > i || (r.leg === i && !r.walking);
  function paper(c, label, x, bottom, w = 62) { // a file card, centred on x
    block(c, x - w / 2, bottom - 18, w, 18, "#fbfaf5");
    text(c, label, x, bottom - 9, { size: 13 });
  }
  function easel(c, x, y, w, h, floor, fill = "#fbfaf5") { // a board on two legs, standing on the floor
    c.ctx.fillStyle = "#4a3426";
    for (const lx of [x + w * 0.1, x + w * 0.9 - 4]) c.ctx.fillRect(lx * c.k, (y + h - 2) * c.k, 4 * c.k, (floor - y - h + 2) * c.k);
    block(c, x, y, w, h, fill);
  }
  function meter(c, x, y, fill, label) { // a loading bar with its label above
    x = clamp(x, 56, c.w - 56); // kept on the canvas, even over someone at the edge
    block(c, x - 50, y, 100, 14, "#ecebe2");
    c.ctx.fillStyle = "#4f6b2e";
    c.ctx.fillRect((x - 47) * c.k, (y + 3) * c.k, 94 * clamp(fill) * c.k, 8 * c.k);
    text(c, label, x, y - 8, { size: 13 });
  }
  function cursor(c, x, y, name, color) { // a collaborator's pointer, as a whiteboard shows them
    const ctx = c.ctx, k = c.k;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#231a1b";
    ctx.lineWidth = 1.5 * k;
    ctx.beginPath();
    ctx.moveTo(x * k, y * k);
    ctx.lineTo((x + 11) * k, (y + 8) * k);
    ctx.lineTo((x + 5) * k, (y + 9) * k);
    ctx.lineTo((x + 3) * k, (y + 14) * k);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(12 * k)}px "VT323", monospace`;
    const w = ctx.measureText(name).width / k + 8;
    ctx.fillRect((x + 9) * k, (y + 12) * k, w * k, 13 * k);
    text(c, name, x + 9 + w / 2, y + 18.5, { size: 12, color: "#fff" });
  }
  // Pen strokes drawn up to a length, so a sketch draws itself in the order it was drawn
  const strokeLen = (pts) => pts.reduce((L, p, i) => (i ? L + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  function along(pts, len) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay);
      if (len <= d) return [lerp(ax, bx, len / d), lerp(ay, by, len / d)];
      len -= d;
    }
    return pts[pts.length - 1];
  }
  function pen(c, pts, len) {
    const ctx = c.ctx, k = c.k;
    ctx.strokeStyle = SKETCH;
    ctx.lineWidth = 2 * k;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * k, pts[0][1] * k);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay);
      if (len <= d) { ctx.lineTo(lerp(ax, bx, len / d) * k, lerp(ay, by, len / d) * k); break; }
      ctx.lineTo(bx * k, by * k);
      len -= d;
    }
    ctx.stroke();
  }
  function arrowHead(c, [x, y], dir) {
    const ctx = c.ctx, k = c.k, [dx, dy] = dir === "up" ? [0, -1] : [1, 0];
    ctx.beginPath();
    ctx.moveTo((x - dx * 7 - dy * 5) * k, (y - dy * 7 + dx * 5) * k);
    ctx.lineTo(x * k, y * k);
    ctx.lineTo((x - dx * 7 + dy * 5) * k, (y - dy * 7 - dx * 5) * k);
    ctx.stroke();
  }
  // The flow Claude sketches on "Draw it first", shape by shape, a little wobbly like a real marker
  function flowchart(x, y, k) {
    let n = 0;
    const P = (px, py) => { n++; return [x + px * k + Math.sin(n * 12.99) * 0.8, y + py * k + Math.cos(n * 7.31) * 0.8]; };
    const rect = (px, py, w, h) => [P(px, py), P(px + w, py), P(px + w, py + h), P(px, py + h), P(px, py - 1)];
    const arc = (cx, cy, rx, ry, a0, a1, steps) => [...Array(steps + 1)].map((_, i) => { const a = lerp(a0, a1, i / steps); return P(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); });
    const L = (px, py, s) => [x + px * k, y + py * k, s];
    return [
      { pts: rect(10, 26, 58, 28), label: ["user", ...L(39, 40, 15)] },
      { pts: [P(70, 40), P(88, 40)], head: "right" },
      { pts: [P(124, 20), P(160, 40), P(124, 60), P(88, 40), P(124, 20)], label: ["auth?", ...L(124, 40, 15)] },
      { pts: [P(162, 40), P(180, 40)], head: "right", label: ["yes", ...L(171, 31, 12)] },
      { pts: rect(182, 26, 50, 28), label: ["API", ...L(207, 40, 15)] },
      { pts: [P(234, 40), P(250, 40)], head: "right" },
      { pts: [...arc(272, 28, 20, 5, Math.PI, 3 * Math.PI, 16), P(252, 54), ...arc(272, 54, 20, 5, Math.PI, 0, 8), P(292, 28)], label: ["DB", ...L(272, 44, 15)] },
      { pts: [P(124, 62), P(124, 80), P(39, 80), P(39, 57)], head: "up", label: ["no", ...L(132, 71, 12)] },
    ];
  }
  function thinking(c, x, headY, lines, shown) { // a thought cloud over a head, its lines appearing one by one
    const w = 120, h = 16 + lines.length * 16, y = headY - 18 - h;
    block(c, x - w / 2, y, w, h, "#fbfaf5");
    block(c, x - 4, headY - 16, 9, 8, "#fbfaf5");
    block(c, x - 1, headY - 7, 5, 5, "#fbfaf5");
    lines.slice(0, shown).forEach((s, i) => text(c, s, x - w / 2 + 9, y + 15 + i * 16, { size: 14, align: "left" }));
  }

  // One short play per stop. Each says where the crew should stand (they walk there) and what they're doing.
  const PLAYS = [
    // 1. Draw it first: Claude sketches the flow on a whiteboard; Codex and OpenClaw gather round to read it
    ({ c, X, f, top, floor, t, head, narrow }) => {
      const bw = 304 * f, bh = 100 * f, bx = X(0) - bw / 2;
      const shapes = flowchart(bx + 2, top + 2, f), lens = shapes.map((s) => strokeLen(s.pts));
      const total = lens.reduce((a, b) => a + b, 0), drawn = total * clamp((t - 1.4) / 4.6);
      let left = drawn, tip = shapes[0].pts[0];
      for (let i = 0; i < shapes.length && left > 0; i++) { tip = along(shapes[i].pts, Math.min(left, lens[i])); left -= lens[i]; }
      const done = drawn >= total;
      return {
        claude: { x: t < 1.4 ? bx + 30 * f : clamp(tip[0], bx + 20, bx + bw - 20), busy: !done },
        codex: { x: X(narrow ? 60 : 108), face: -1 }, // on a phone the edge is close, so they stand nearer in
        openclaw: { x: X(narrow ? 150 : 190), face: -1 },
        back() {
          easel(c, bx, top, bw, bh, floor);
          text(c, "draw first · then code", bx + bw - 8, top + bh - 12, { size: 12, color: "#9a9a8c", align: "right" });
        },
        front() {
          let left = drawn;
          for (let i = 0; i < shapes.length && left > 0; i++) {
            const s = shapes[i];
            pen(c, s.pts, left);
            if (left >= lens[i]) {
              if (s.head) arrowHead(c, s.pts[s.pts.length - 1], s.head);
              if (s.label) { const [str, lx, ly, size] = s.label; text(c, str.slice(0, Math.ceil((left - lens[i]) / 5)), lx, ly, { size, color: SKETCH }); }
            }
            left -= lens[i];
          }
          if (t > 1.2 && !done) cursor(c, tip[0], tip[1], "Claude", "#d97757");
          if (done) bubble(c, "clear. I can build this", actors.codex.x, head("codex") - 6);
        },
      };
    },
    // 2. Load the rules: OpenClaw fetches the rule files off the shelf and hands them over, one at a time
    ({ c, X, top, floor, t, head }) => {
      const files = [["SKILL.md", "claude"], ["CLAUDE.md", "claude"], ["AGENTS.md", "codex"]];
      const shelf = X(-200), toClaude = X(-120), toCodex = X(70); // OpenClaw stands beside whoever it hands a file to
      const r = route(t, [
        { x: shelf + 34, wait: 1.3 }, { x: toClaude, wait: 0.6 },
        { x: shelf + 34, wait: 0.35 }, { x: toClaude, wait: 0.6 },
        { x: shelf + 34, wait: 0.35 }, { x: toCodex, wait: 0.6 },
        { x: X(55), wait: 1e3 },
      ]);
      const picked = [0, 2, 4].filter((i) => r.leg > i).length;
      const given = [1, 3, 5].filter((i) => reached(r, i)).length;
      const carrying = [1, 3, 5].includes(r.leg) && r.walking ? files[(r.leg - 1) / 2][0] : null;
      const handing = [1, 3, 5].includes(r.leg) && !r.walking ? { file: files[(r.leg - 1) / 2], u: clamp(r.since / 0.45) } : null;
      const toC = files.slice(0, given).filter(([, who]) => who === "claude").length;
      return {
        claude: { x: X(-40), face: -1 },
        codex: { x: X(150), face: -1 },
        openclaw: { x: r.x, busy: !!carrying },
        back() { // a little bookcase with the files still on it
          block(c, shelf - 30, floor - 78, 60, 78, "#9a6b3f", "#4a3426");
          block(c, shelf - 24, floor - 44, 48, 4, "#4a3426", "#4a3426");
          files.slice(picked).forEach(([name], i) => paper(c, name, shelf, floor - 48 - i * 10, 52));
        },
        front() {
          if (carrying) paper(c, carrying, actors.openclaw.x, head("openclaw") - 2);
          if (handing) { // the file flies into its new owner's head
            const who = actors[handing.file[1]], from = { x: actors.openclaw.x, y: head("openclaw") - 2 }, to = { x: who.x, y: head(handing.file[1]) + 10 };
            const p = hop(from, to, easeOut(handing.u), 20);
            c.ctx.globalAlpha = 1 - handing.u * 0.7;
            if (handing.u < 1) paper(c, handing.file[0], p.x, p.y, 62 * (1 - handing.u * 0.6));
            c.ctx.globalAlpha = 1;
            text(c, "+ rule", who.x, head(handing.file[1]) - 46 - handing.u * 10, { size: 14, color: "#4f6b2e" });
          }
          if (toC > 0) meter(c, actors.claude.x, head("claude") - 24, toC / 2, toC < 2 ? "loading rules…" : "✓ rules loaded");
          if (given > 2) meter(c, actors.codex.x, head("codex") - 24, 1, "✓ AGENTS.md");
          if (r.leg >= 6) text(c, "they know what NOT to write, before writing", X(30), top + 14, { size: 15, color: "#4f6b2e" });
        },
      };
    },
    // 3. Think, then type: Claude plans, walks the plan over to Codex, and Codex types it out
    ({ c, X, floor, t, head, narrow }) => {
      const plan = ["1. the flow", "2. edge cases", "3. tests"];
      // a phone is narrow: the desk goes hard right and everyone stands closer in
      const at = narrow ? { desk: c.w - 62, codex: c.w - 112, think: 112, give: c.w - 178, back: 140, oc: 40 }
        : { desk: X(150), codex: X(76), think: X(-100), give: X(-8), back: X(-70), oc: X(-190) };
      const r = route(t, [{ x: at.think, wait: 2.9 }, { x: at.give, wait: 0.6 }, { x: at.back, wait: 1e3 }]);
      const handed = reached(r, 1), typing = handed ? clamp((t - 4.9) / 2.6) : 0, deskX = at.desk, mw = narrow ? 84 : 100;
      return {
        claude: { x: r.x, face: r.leg >= 2 ? 1 : undefined },
        codex: { x: at.codex, busy: handed && typing < 1 }, // in front of its desk, so the dark monitor doesn't swallow it
        openclaw: { x: at.oc, face: 1 },
        back() { // Codex's desk and monitor, the screen filling with code once it has the plan
          desk(c, deskX, floor, narrow ? 104 : 130);
          block(c, deskX - mw / 2, floor - 104, mw, 62, "#232836", "#11141c");
          block(c, deskX - 6, floor - 44, 12, 14, "#3a4256", "#11141c");
          const lines = Math.floor(typing * 6);
          for (let i = 0; i < lines; i++) {
            c.ctx.fillStyle = ["#7ee0a2", "#9fb9ff", "#e6e1d3"][i % 3];
            c.ctx.fillRect((deskX - 42 + (i % 2) * 8) * c.k, (floor - 96 + i * 8) * c.k, (34 + ((i * 23) % 40)) * c.k, 4 * c.k);
          }
        },
        front() {
          if (r.leg === 0) thinking(c, actors.claude.x, head("claude"), plan, Math.floor((t - 0.5) / 0.6));
          if (r.leg === 1 && r.walking) paper(c, "plan.md", actors.claude.x, head("claude") - 2);
          if (r.leg === 1 && !r.walking) bubble(c, "here's the plan", actors.claude.x, head("claude") - 6);
          Me.crew(c.ctx, { name: "mug", x: (actors.openclaw.x + 34) * c.k, y: (floor - 22 - (Math.floor(t / 2.5) % 2) * 8) * c.k, scale: Math.round(4 * c.k) });
          if (typing >= 1) bubble(c, "done · fewer tokens", actors.codex.x, head("codex") - 6);
        },
      };
    },
    // 4. Prototype cheap: each brings a piece of the page and puts it up; the wrong one comes straight back down
    ({ c, X, f, top, floor, t, head }) => {
      const bw = 236 * f, bh = 104 * f, bx = X(10) - bw / 2, by = top;
      const slot = {
        header: [bx + 8, by + 22, bw - 16, 12, "#c6d4a8"],
        hero: [bx + 8, by + 40, bw * 0.4, bh - 50, "#e6e4d9"],
        wrong: [bx + bw * 0.46, by + 40, bw * 0.5, 26, "#e8a598"],
        button: [bx + bw * 0.46, by + bh - 28, bw * 0.3, 18, "#4f6b2e"],
      };
      // who brings what, and when it goes up (the carousel comes back down at 4.3s)
      const parts = [["header", "codex", 1.5], ["hero", "claude", 2.3], ["wrong", "openclaw", 3.1], ["button", "claude", 5.4]];
      const oc = route(t, [{ x: X(52), wait: 4.6 }, { x: X(196), wait: 0.5 }, { x: X(140), wait: 1e3 }]);
      const FLY = 0.35, down = 4.3;
      const onBoard = (name, at) => t >= at + FLY && !(name === "wrong" && t >= down);
      return {
        claude: { x: X(-26) }, codex: { x: X(-104) }, openclaw: { x: oc.x },
        back() {
          easel(c, bx, by, bw, bh, floor);
          c.ctx.fillStyle = "#ecebe2";
          c.ctx.fillRect((bx + 2) * c.k, (by + 2) * c.k, (bw - 4) * c.k, 12 * c.k);
          ["#c0473a", "#f1bf45", "#66863e"].forEach((col, i) => { c.ctx.fillStyle = col; c.ctx.fillRect((bx + 7 + i * 7) * c.k, (by + 6) * c.k, 4 * c.k, 4 * c.k); });
          text(c, "index.html", bx + bw / 2, by + 8, { size: 12, color: "#6d7a70" });
          for (const [name, , at] of parts) if (onBoard(name, at)) { const [x, y, w, h, col] = slot[name]; block(c, x, y, w, h, col, "#6d7a70"); if (name === "wrong") text(c, "carousel?", x + w / 2, y + h / 2, { size: 13 }); }
          block(c, X(196) - 16, floor - 30 + (oc.leg === 1 && !oc.walking && oc.since < 0.25 ? -3 : 0), 32, 30, "#8d939b", "#4a4f57"); // the bin jumps as it lands
        },
        front() {
          const small = (name, x, y) => { const [, , w, h, col] = slot[name], sw = Math.min(w, 64), sh = Math.min(h, 20); block(c, x - sw / 2, y - sh, sw, sh, col, "#6d7a70"); };
          for (const [name, who, at] of parts) {
            const held = { x: actors[who].x, y: head(who) - 4 }, [sx, sy, sw, sh] = slot[name], into = { x: sx + sw / 2, y: sy + sh };
            const mine = parts.filter((p) => p[1] === who && t < p[2] + FLY);
            if (t < at && mine[0]?.[0] === name) small(name, held.x, held.y); // carrying it (only the next one, if they brought two)
            else if (t >= at && t < at + FLY) { const p = hop(held, into, easeOut((t - at) / FLY), 26); small(name, p.x, p.y); }
          }
          if (t > 3.5 && t < down) bubble(c, "too much. out it goes", actors.openclaw.x, head("openclaw") - 6);
          if (t >= down && oc.leg === 0) { const u = clamp((t - down) / FLY), p = hop({ x: slot.wrong[0] + slot.wrong[2] / 2, y: slot.wrong[1] + 26 }, { x: actors.openclaw.x, y: head("openclaw") - 4 }, easeOut(u), 10); small("wrong", p.x, p.y); }
          if (oc.leg === 1 && oc.walking) small("wrong", actors.openclaw.x, head("openclaw") - 4);
          if (t > 6) text(c, "wrong turns cost an hour, not a week", X(10), top + bh + 14, { size: 14, color: "#4f6b2e" });
        },
      };
    },
    // 5. Trust the logs: OpenClaw runs the tests; Claude and Codex read every line before anyone ships
    ({ c, X, f, top, floor, t, head }) => {
      const tw = 262 * f, tx = X(0) - tw / 2;
      const out = [["$ npm test", "#e6e1d3", 1.4], ["✓ 802 passed", "#7ee0a2", 2.2], ["✓ 0 failed", "#7ee0a2", 2.8], ["✓ logs clean", "#7ee0a2", 3.4], ["✓ reviewed: mine + the AI's", "#f1bf45", 5.0]];
      const cl = route(t, [{ x: X(-150), wait: 3.8 }, { x: X(-70), wait: 1e3 }]);
      return {
        claude: { x: cl.x, face: 1 },
        codex: { x: X(150), face: -1 },
        openclaw: { x: X(20), busy: t > 1.1 && t < 3.6 },
        back() {
          easel(c, tx, top, tw, 108, floor, "#1b1f2a");
          out.forEach(([s, col, at], i) => { if (t > at) text(c, s, tx + 12, top + 16 + i * 18, { size: 14, color: col, align: "left" }); });
          if (Math.floor(t * 2) % 2) { const n = out.filter(([, , at]) => t > at).length; c.ctx.fillStyle = "#e6e1d3"; c.ctx.fillRect((tx + 12) * c.k, (top + 10 + n * 18) * c.k, 7 * c.k, 12 * c.k); }
        },
        front() {
          if (reached(cl, 1) && t < 5.0) bubble(c, "reading every line", actors.claude.x, head("claude") - 6);
          if (t > 5.6) {
            bubble(c, "now we ship", actors.codex.x, head("codex") - 6);
            for (let i = 0; i < 14; i++) { // confetti
              const u = ((t - 5.6) * 0.6 + i * 0.37) % 1;
              c.ctx.fillStyle = ["#f1bf45", "#7ee0a2", "#d97757", "#9fb9ff"][i % 4];
              c.ctx.fillRect((X(-120) + ((i * 53) % 240) * f) * c.k, (top + 120 + u * 60) * c.k, 4 * c.k, 4 * c.k);
            }
          }
        },
      };
    },
  ];
  const PLAY_LEN = [6.8, 8.2, 8, 6.8, 6.4]; // seconds each play runs, at normal speed
  function drawTrailFx(now) {
    const c = trailFx.c;
    wipe(c);
    const base = box(EL.trail);
    const nodes = EL.nodes.map((n) => { const b = box(n); return b.x - base.x + b.w / 2; });
    const vertical = Math.abs(nodes[1] - nodes[0]) < 4;
    const s = vertical ? 3 : 4, f = vertical ? 0.85 : 1.15, edge = 40; // f: how big the props are
    const floor = c.h - 22, top = vertical ? c.h - trailFx.extra + 6 : base.h + 24;
    const dt = Math.min(0.1, Math.max(0, now - (trailFx.last ?? now)) / 1000);
    trailFx.last = now;
    // A play is never skipped: scroll past its stop and it fast-forwards to its end, then the next one
    // starts. Scroll back and it goes straight to that stop's play.
    if (trailFx.shown === undefined || G.lit < trailFx.shown) { trailFx.shown = G.lit; trailFx.t = 0; }
    const behind = G.lit - trailFx.shown;
    trailFx.speed = behind > 0 ? 3 + 4 * behind : 1; // the further behind, the faster it catches up
    trailFx.t += dt * trailFx.speed;
    if (behind > 0 && (trailFx.shown < 0 || trailFx.t >= PLAY_LEN[trailFx.shown])) { trailFx.shown++; trailFx.t = 0; }
    const active = trailFx.shown;
    const cx = vertical ? c.w / 2 : clamp(nodes[Math.max(0, active)], 200 + edge, c.w - 200 - edge);
    const X = (dx) => clamp(cx + dx * f, edge, c.w - edge);
    const head = (n) => floor - CREW_H[n] * s;
    const t = still ? 9 : trailFx.t;
    // before the first stop lights up, they wait under the stops they'll help with
    const home = vertical ? [c.w * 0.2, c.w * 0.5, c.w * 0.8] : [nodes[1], nodes[2] + 40, nodes[4]];
    const cast = active < 0 ? { claude: { x: home[0] }, codex: { x: home[1] }, openclaw: { x: home[2] } } : PLAYS[active]({ c, X, f, top, floor, t, head, narrow: vertical });
    for (const n of CREW_NAMES) { // everyone walks to their mark; nobody teleports
      const a = actors[n], want = cast[n];
      if (a.x === null || still) a.x = want.x;
      const dx = want.x - a.x;
      a.moving = Math.abs(dx) > 1;
      if (a.moving) { a.x += Math.sign(dx) * Math.min(Math.abs(dx), (vertical ? 150 : 175) * dt * trailFx.speed); a.face = Math.sign(dx); }
      else if (want.face) a.face = want.face;
    }
    cast.back?.();
    for (const n of CREW_NAMES) {
      const a = actors[n], busy = cast[n].busy;
      drawCrew(c, { name: a.moving ? `${n}-walk` : n, frame: now / (a.moving ? 120 : busy ? 140 : 560), x: a.x, y: floor, scale: s, flip: a.face < 0 });
      text(c, CREW_LABEL[n], a.x, floor + 11, { size: 13, color: "#6d7a70" });
    }
    cast.front?.();
  }

  /* ---------- Journey: a team scene per stop, with a level-up between them ---------- */
  const stage = { el: watch($("#stage-cv")), box: EL.stage, level: -1, shown: -1, p: 0, t0: 0, anim: null };
  const DASH = 0.6; // deden: how far through each job he sets off for the next
  const CAPTION = [
    "team of 4 · mentors on hand · 550+ commits in 45 days",
    "one of two engineers: dev, community, marketing, check-in",
    "open source · HackerRank hiring-agent · PR #460",
  ];
  function layoutStage() {
    const b = EL.stage.getBoundingClientRect(), s = EL.sticky.getBoundingClientRect();
    // the stage must end above the dock while the Journey is pinned, so short screens get a shorter scene
    const chrome = b.height - stage.el.getBoundingClientRect().height;
    const room = innerHeight - 96 - (parseFloat(getComputedStyle(EL.sticky).top) || 0) - (b.top - s.top) - chrome;
    const h = innerWidth < 760 ? 140 : Math.round(clamp(room, 124, 290));
    stage.c = sized(stage.el, Math.max(200, b.width - 6), h);
    stage.s = h >= 236 ? 4 : h >= 165 ? 3 : 2; // sprite scale: as big as the stage's height allows
  }
  function tune(notes, gap) {
    notes.forEach((f, i) => setTimeout(() => Sound.blip(f, f * 1.01, 0.1, 0.03, "square"), i * gap));
  }
  // The stage follows the scroll but never skips: each scene plays to its end before the next one, and its level-up, takes over
  document.addEventListener("journeystep", (e) => { stage.level = e.detail; });
  function showStep(i, now, levelUp) {
    stage.shown = i;
    stage.t0 = now;
    $("#evo-lv").textContent = `Lv. ${i + 1}`;
    $("#evo-name").textContent = S.journey[i].evo;
    $("#evo-say").textContent = CAPTION[i] ? ` · ${CAPTION[i]}` : ""; // entries added in the admin get no caption
    if (!levelUp) return;
    stage.anim = { t0: now };
    EL.stage.classList.remove("evolving");
    void EL.stage.offsetWidth; // restart the CSS shake, flash and stamp
    EL.stage.classList.add("evolving");
    tune([523, 659, 784, 1046, 1318], 70);
  }
  function desk(c, x, floor, w = 110, k = 1) { // a desk (drawn over his legs); k scales it with the people at it
    w *= k;
    block(c, x - w / 2, floor - 30 * k, w, 12 * k, "#9a6b3f", "#4a3426");
    block(c, x - w / 2 + 6 * k, floor - 20 * k, 8 * k, 20 * k, "#7a5233", "#4a3426");
    block(c, x + w / 2 - 14 * k, floor - 20 * k, 8 * k, 20 * k, "#7a5233", "#4a3426");
  }
  function sign(c, s, x, y, on) {
    const w = Math.min(88, c.w * 0.235); // four have to fit across a phone
    block(c, x - w / 2, y, w, 22, on ? "#4f6b2e" : "#fbfaf5");
    text(c, s, x, y + 11, { size: 15, color: on ? "#f5f2ea" : "#26382d" });
  }
  const SCENES = [
    // STPI: an intern with mentors, a whiteboard and two teammates
    (c, floor, t, here, s, p) => {
      const w = c.w, narrow = w < 560; // on a phone the whiteboard hangs on the wall above the mentors
      const X = narrow
        ? { m: 0.12, m2: 0.28, me: 0.56, mate: 0.79, mate2: 0.92, desk: 0.855, myDesk: 70, theirDesk: 96 }
        : { m: 0.36, m2: 0.47, me: 0.62, mate: 0.8, mate2: 0.92, desk: 0.86, myDesk: 110, theirDesk: 150 };
      if (narrow) {
        block(c, 8, 4, 150, 44, "#fbfaf5");
        if (p > 0.15) text(c, "judge → project", 83, 18, { color: SKETCH, size: 15 });
        if (p > 0.5) text(c, "who sees what?", 83, 35, { color: SKETCH, size: 14 });
      } else { // the mentor sketches the problem as they talk it through
        block(c, w * 0.04, 14, w * 0.26, 92, "#fbfaf5");
        if (p > 0.05) { sketchBox(c, w * 0.06, 34, 58, 26, 1); text(c, "judge", w * 0.06 + 29, 47, { color: SKETCH, size: 15 }); }
        if (p > 0.15) sketchArrow(c, w * 0.06 + 62, 47, w * 0.06 + 96, 47, clamp((p - 0.15) / 0.2));
        if (p > 0.38) { sketchBox(c, w * 0.06 + 100, 34, 62, 26, 2); text(c, "project", w * 0.06 + 131, 47, { color: SKETCH, size: 15 }); }
        if (p > 0.5) text(c, "who sees what?", w * 0.17, 86, { color: SKETCH, size: 14 });
      }
      drawMe(c, { pose: "wave", frame: t * 3, form: "mentor", x: w * X.m, y: floor, scale: s, flip: true });
      drawMe(c, { pose: "idle", frame: t * 2, form: "mentor2", x: w * X.m2, y: floor, scale: s });
      if (here) {
        drawMe(c, { pose: "type", frame: t * 5, form: "lv1", x: w * X.me, y: floor, scale: s });
        if (p >= 0.55) bubble(c, "role-based access!", w * X.me, floor - 34 * s); // his answer
      }
      desk(c, w * X.me, floor, X.myDesk, s / 3);
      if (p > 0.08 && p < 0.55) bubble(c, "who sees which project?", w * X.m, floor - 34 * s);
      drawMe(c, { pose: "type", frame: t * 4 + 1, form: "mate", x: w * X.mate, y: floor, scale: s });
      drawMe(c, { pose: "type", frame: t * 4, form: "mate2", x: w * X.mate2, y: floor, scale: s });
      desk(c, w * X.desk, floor, X.theirDesk, s / 3);
    },
    // deden.space: a two-engineer startup, so he runs between every job at once
    (c, floor, t, here, s, p) => {
      const w = c.w;
      const spots = [["dev", 0.14], ["community", 0.4], ["marketing", 0.64], ["check-in", 0.88]];
      // the story: four jobs and three dashes between them (DASH is how far into each leg he sets off)
      const pos = p * (spots.length - 1), job = Math.min(spots.length - 1, Math.floor(pos)), u = pos - job;
      const running = job < spots.length - 1 && u > DASH;
      spots.forEach(([label, f], i) => sign(c, label, w * f, 14, here && job === i && !running));
      const dw = w < 560 ? 90 : 120, side = (34 * s) / 3; // the dev desk, and how far apart the two engineers sit at it
      desk(c, w * 0.14, floor, dw, s / 3);
      // props: chat bubbles, a megaphone, a QR gate
      block(c, w * 0.4 - 34, 52, 40, 22, "#fbfaf5"); block(c, w * 0.4 + 0, 64, 40, 22, "#c6d4a8");
      text(c, "gm!", w * 0.4 - 14, 63, { size: 14 }); text(c, "event?", w * 0.4 + 20, 75, { size: 13 });
      block(c, w * 0.64 - 18, 56, 36, 20, "#c0473a"); block(c, w * 0.64 + 14, 50, 14, 32, "#e86f55");
      block(c, w * 0.88 - 6, 48, 12, floor - 48, "#8d939b"); block(c, w * 0.88 - 20, 50, 40, 40, "#fbfaf5");
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x * 7 + y * 5) % 3) { c.ctx.fillStyle = "#231a1b"; c.ctx.fillRect((w * 0.88 - 14 + x * 7) * c.k, (56 + y * 7) * c.k, 6 * c.k, 6 * c.k); }
      drawMe(c, { pose: "type", frame: t * 4, form: "mate2", x: w * 0.14 + side, y: floor, scale: s }); // the other engineer
      if (here) {
        const from = w * spots[job][1], to = w * spots[Math.min(job + 1, spots.length - 1)][1];
        const x = running ? lerp(from, to, ease((u - DASH) / (1 - DASH))) : from;
        const pose = running ? "walk" : ["type", "wave", "cheer", "idle"][job];
        drawMe(c, { pose, frame: t * (running ? 10 : 4), form: "lv2", x: x - (job === 0 && !running ? side * 0.8 : 0), y: floor, scale: s });
      }
      desk(c, w * 0.14, floor, dw, s / 3);
    },
    // Open source: a PR with its tests, and the contribution squares filling in
    (c, floor, t, here, s, p) => {
      // on a phone the PR card runs across the top and the squares sit under it
      const w = c.w, narrow = w < 560, cell = narrow ? 10 : 12, rows = narrow ? 5 : 7, gy = narrow ? 58 : 14;
      const cols = Math.floor((w * 0.5) / cell);
      const shown = Math.floor(clamp(p / 0.7) * cols * rows);
      const G4 = ["#e6e4d9", "#c6d4a8", "#95b06b", "#66863e", "#3f5a22"];
      for (let i = 0; i < cols * rows; i++) {
        const x = w * 0.46 + Math.floor(i / rows) * cell, y = gy + (i % rows) * cell;
        c.ctx.fillStyle = i < shown ? G4[(i * 7 + 3) % 5] : G4[0];
        c.ctx.fillRect(x * c.k, y * c.k, (cell - 2) * c.k, (cell - 2) * c.k);
      }
      const slide = easeOut(clamp((p - 0.25) / 0.3));
      if (slide > 0) {
        const cw = narrow ? w - 16 : 260, x = lerp(w + 10, narrow ? 8 : w * 0.46, slide), y = narrow ? 6 : 104;
        block(c, x, y, cw, 46, "#fbfaf5");
        text(c, "PR #460 · match URLs case-insensitively", x + 10, y + 14, { size: 14, align: "left" });
        text(c, "✓ 8 unit tests   ● open, in review", x + 10, y + 32, { size: 14, align: "left", color: "#4f6b2e" });
      }
      if (here) drawMe(c, { pose: "type", frame: t * 5, form: "lv3", x: w * STAGE_ME, y: floor, scale: s });
      desk(c, w * STAGE_ME, floor, narrow ? 90 : 110, s / 3);
    },
  ];
  function drawStage(now) {
    const c = stage.c;
    wipe(c);
    const floor = c.h - 8;
    c.ctx.fillStyle = "rgba(120, 90, 60, .18)"; // the floorboards
    c.ctx.fillRect(0, (floor - 2) * c.k, c.ctx.canvas.width, 10 * c.k);
    const n = S.journey.length, level = Math.max(0, stage.level);
    const dt = Math.min(0.1, Math.max(0, now - (stage.last ?? now)) / 1000);
    stage.last = now;
    // how far the scroll is through the step on show: 0 at its start, 1 at its end
    const r = EL.jr.getBoundingClientRect(), jp = clamp(-r.top / Math.max(1, r.height - innerHeight));
    if (stage.shown < 0) { showStep(level, now, false); stage.p = clamp(jp * n - level); }
    if (level < stage.shown) { showStep(level, now, false); stage.p = 1; } // scrolling back: the earlier scene, from its end
    const here = still || G.dock === "stage";
    let want = level > stage.shown ? 1 : clamp(jp * n - stage.shown);
    if (stage.shown === 1) { const k = want * 3; if (k % 1 > DASH) want = Math.min(1, Math.ceil(k) / 3); } // never stop him mid-dash
    stage.lag = want - stage.p; // how far the scene is behind the scroll (the scroll hold reads this)
    if (!here) want = Math.min(want, stage.p); // the story waits until he's on the stage
    // a scene takes 3s when you scroll gently; when you scroll on ahead it fast-forwards (0.6s) rather
    // than being skipped, and the page never waits for it
    const behind = level > stage.shown || stage.lag > 0.15;
    stage.p = still ? want : stage.p + clamp(want - stage.p, -dt / 1.2, dt / (behind ? 0.6 : 3));
    if (level > stage.shown && stage.p >= 0.999) { showStep(stage.shown + 1, now, !still); stage.p = 0; }
    const t = Math.max(0, now - stage.t0) / 1000;
    SCENES[Math.min(stage.shown, SCENES.length - 1)](c, floor, still ? 9 : t, here, stage.s, stage.p); // later entries reuse the last scene
    const a = stage.anim ? now - stage.anim.t0 : 1e9;
    if (a < 500) { // a white flash as he levels up
      c.ctx.fillStyle = `rgba(255, 253, 244, ${0.9 * (1 - a / 500)})`;
      c.ctx.fillRect(0, 0, c.ctx.canvas.width, c.ctx.canvas.height);
    }
  }

  /* ---------- Garden: he runs the bed with a watering can and the plants grow behind him ---------- */
  const G_SCALE = 3, G_H = 112, G_SPEED = 650; // his fastest walk, px per second
  const START_X = 8; // where he lands in the bed (matches soilPt)
  const gardener = {
    el: watch($("#gardener")), x: START_X, end: 0, state: "wait", lastPlant: -1, want: 0, face: 1,
    start() { this.state = "walk"; this.x = START_X; },
    // stop where he is (he never jumps to the far end); every plant is grown
    finish() { if (this.state === "done") return; this.state = "done"; this.water(EL.plants.children.length - 1); $("#garden").classList.add("watered"); },
    water(upTo) {
      const plants = EL.plants.children;
      for (let i = this.lastPlant + 1; i <= Math.min(upTo, plants.length - 1); i++) {
        plants[i].classList.add("wet");
        if (i % 6 === 0) Sound.blip(1400 + (i % 3) * 120, 1800, 0.04, 0.012, "sine");
      }
      this.lastPlant = Math.max(this.lastPlant, upTo);
    },
  };
  function layoutGardener() {
    gardener.w = Math.max(EL.bed.scrollWidth, EL.plants.scrollWidth);
    gardener.end = gardener.w - 30;
    gardener.c = sized(gardener.el, gardener.w, G_H);
    gardener.el.style.top = `${EL.plants.offsetTop + EL.plants.offsetHeight - G_H + 2}px`;
  }
  function drawGardener(now) {
    const gd = gardener;
    if (!gd.c || gd.w !== Math.max(EL.bed.scrollWidth, EL.plants.scrollWidth)) layoutGardener();
    wipe(gd.c);
    const dt = Math.min(0.05, Math.max(0, now - (gd.last ?? now)) / 1000);
    gd.last = now;
    let moving = false;
    if (gd.state === "walk" && G.dock === "garden" && EL.plants.children.length) {
      // walk to where the scroll says, never faster than G_SPEED, so a quick scroll still shows the walk
      const to = START_X + gd.want * (gd.end - START_X), dx = to - gd.x;
      moving = Math.abs(dx) > 1;
      if (moving) { gd.x += Math.sign(dx) * Math.min(Math.abs(dx), G_SPEED * dt); gd.face = Math.sign(dx); }
      gd.water(Math.floor((gd.x + 13 * G_SCALE) / 14)); // the can's spout is about 13 sprite pixels to his right
      const scroller = $(".garden-scroll");
      if (scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = gd.x - scroller.clientWidth * 0.45;
      if (gd.x >= gd.end) gd.finish();
    }
    if (!still && G.dock !== "garden") return;
    if (still) gd.finish();
    drawMe(gd.c, { pose: moving ? "waterwalk" : "water", frame: (now / 1000) * (moving ? 12 : 3), form: "lv3", x: gd.x, y: G_H - 2, scale: G_SCALE, flip: gd.face < 0 });
  }

  /* ---------- The campfire, in the footer at night: my log, my AI crew, and chai ---------- */
  const SEAT_SCALE = 4;
  const seat = document.createElement("div");
  seat.className = "camper me-seat";
  seat.setAttribute("role", "img");
  seat.setAttribute("aria-label", "Pixel-art Dhruv's seat by the fire");
  const think = Object.assign(document.createElement("p"), { className: "think" });
  const seatCv = document.createElement("canvas");
  seat.append(think, seatCv);
  // between LinkedIn and X: on phones, where the campers stack, that's the middle row
  EL.camp.insertBefore(seat, document.querySelectorAll("#camp .camper")[2] || null);
  watch(seat);
  const seatC = sized(seatCv, 26 * SEAT_SCALE, 34 * SEAT_SCALE);
  const CAMP_LINES = ["come, sit with me", "tell me your idea", "we'll build your project", "…or your whole startup", "psst… I'm hireable", "chai's on me"];
  function drawSeat(now) {
    const c = seatC;
    wipe(c);
    const here = still || G.dock === "seat";
    think.classList.toggle("on", here);
    seat.classList.toggle("here", here);
    if (!here) return; // no empty log floating by the fire
    words(think, CAMP_LINES);
    const feet = c.h - 2;
    c.ctx.fillStyle = "rgba(10, 8, 20, .28)"; // a patch of shadow on the ground
    c.ctx.beginPath();
    c.ctx.ellipse((c.w / 2) * c.k, (feet - 2) * c.k, 14 * SEAT_SCALE * c.k, 2.5 * SEAT_SCALE * c.k, 0, 0, Math.PI * 2);
    c.ctx.fill();
    c.ctx.fillStyle = "rgba(255, 170, 80, .22)"; // firelight on the log
    c.ctx.fillRect((c.w / 2 - 11 * SEAT_SCALE) * c.k, (feet - 7 * SEAT_SCALE) * c.k, 22 * SEAT_SCALE * c.k, 6 * SEAT_SCALE * c.k);
    prop(c, "log", c.w / 2, feet - 4 * SEAT_SCALE, SEAT_SCALE);
    drawMe(c, { pose: "sit", frame: still ? 0 : now / 900, form: "lv3", x: c.w / 2, y: feet, scale: SEAT_SCALE });
  }
  // The crew round the fire: Claude sips chai, Codex pours, OpenClaw toasts a marshmallow
  const campCrew = { el: watch($("#camp-crew")) };
  function layoutCampCrew() {
    // the ring is laid out 640px across; in a narrower column (a phone, a small laptop) the whole camp shrinks
    EL.camp.style.setProperty("--camp-k", Math.min(1, EL.camp.offsetWidth / 640).toFixed(3));
    campCrew.c = sized(campCrew.el, 640, 450); // in the ring's own space: it scales with the camp
  }
  function drawCampCrew(now) {
    const c = campCrew.c;
    wipe(c);
    const t = still ? 0 : now / 1000, mid = c.w / 2;
    // seats round the fire, from its centre and the ground: Claude in the back row beside LinkedIn,
    // Codex across the fire from me, OpenClaw up front with a marshmallow over the flames
    const seats = { claude: [mid - 98, c.h - 182, 4], codex: [mid + 178, c.h - 36, 5], openclaw: [mid + 100, c.h - 182, 4] };
    for (const [name, [x, y, s]] of Object.entries(seats)) {
      const warm = name === "codex" && !still && t % 7 > 5.6; // hands out to the fire now and then
      drawCrew(c, { name, frame: warm ? 1 : 0, x, y: y + 2 * s, scale: s }); // sitting: the log hides the feet
      prop(c, "log", x, y + 2 * s, 3);
    }
    const [clx, cly, cls] = seats.claude, [cdx, cdy, cds] = seats.codex, [ocx, ocy, ocs] = seats.openclaw;
    // Claude sips chai: the mug comes up every few seconds, then back down
    const sip = still ? 0 : ease(clamp(Math.min((t % 5) - 3.6, 4.6 - (t % 5)) / 0.25));
    Me.crew(c.ctx, { name: "mug", x: (clx + 9 * cls) * c.k, y: (cly - 2 * cls - sip * 3 * cls) * c.k, scale: Math.round(cls * c.k) });
    // Codex holds its chai; the steam comes and goes
    Me.crew(c.ctx, { name: "mug", x: (cdx - 9 * cds) * c.k, y: (cdy - 2 * cds) * c.k, scale: Math.round(cds * c.k) });
    if (!still) {
      c.ctx.fillStyle = "rgba(255, 255, 255, .4)";
      for (let i = 0; i < 3; i++) c.ctx.fillRect((cdx - 10 * cds + i * cds) * c.k, (cdy - 8 * cds - ((t * 16 + i * 7) % 16)) * c.k, cds * 0.6 * c.k, cds * 0.6 * c.k);
    }
    // OpenClaw toasts a marshmallow until it's golden, eats it, and starts another
    const toast = (t % 8) / 8, eaten = !still && toast > 0.86;
    const mx = ocx - 9 * ocs, my = ocy - 10.5 * ocs; // held in its left claw, out over the flames
    if (!eaten) {
      Me.crew(c.ctx, { name: "marshmallow", x: mx * c.k, y: my * c.k, scale: Math.round(ocs * c.k) });
      if (toast > 0.35) { c.ctx.fillStyle = `rgba(196, 116, 40, ${Math.min(0.85, (toast - 0.35) * 1.8)})`; c.ctx.fillRect((mx - 0.5 * ocs) * c.k, (my - 6 * ocs) * c.k, 2 * ocs * c.k, 2 * ocs * c.k); }
    } else text(c, "nom!", ocx, ocy - 16 * ocs - 6, { size: 16, color: "#ffd27a" });
  }

  /* ---------- Footer: stars and the odd shooting star ---------- */
  const footer = { el: watch(EL.footer), sky: $("#footer-sky"), stars: [], shoot: null, nextShoot: 0 };
  function layoutFooter() {
    const r = EL.footer.getBoundingClientRect();
    footer.c = sized(footer.sky, r.width, r.height);
    footer.stars = [...Array(Math.round(r.width / 22))].map(() => ({
      x: Math.random() * r.width, y: Math.random() * r.height * 0.45, s: Math.random() < 0.2 ? 2 : 1, ph: Math.random() * 6.3,
    }));
  }
  function drawFooter(now) {
    const c = footer.c;
    wipe(c);
    for (const s of footer.stars) {
      const a = still ? 0.8 : 0.45 + 0.45 * Math.sin(now / 700 + s.ph);
      c.ctx.fillStyle = `rgba(255, 246, 214, ${a.toFixed(2)})`;
      c.ctx.fillRect(Math.round(s.x * c.k), Math.round(s.y * c.k), Math.round(s.s * c.k), Math.round(s.s * c.k));
    }
    if (still) return;
    if (!footer.shoot && now > footer.nextShoot) footer.shoot = { x: Math.random() * c.w * 0.6, y: Math.random() * c.h * 0.2, t0: now };
    const sh = footer.shoot;
    if (!sh) return;
    const t = (now - sh.t0) / 900;
    if (t > 1) { footer.shoot = null; footer.nextShoot = now + 4000 + Math.random() * 5000; return; }
    for (let i = 0; i < 10; i++) {
      const k = t - i * 0.02;
      if (k < 0) continue;
      c.ctx.fillStyle = `rgba(255, 244, 200, ${(1 - i / 10) * (1 - t)})`;
      c.ctx.fillRect(Math.round((sh.x + k * 260) * c.k), Math.round((sh.y + k * 110) * c.k), Math.round(2 * c.k), Math.round(2 * c.k));
    }
  }

  /* ---------- One loop for all of it ---------- */
  function layout() {
    layoutGuide();
    sizePortrait();
    layoutTrailFx();
    layoutStage();
    layoutGardener();
    layoutCampCrew();
    layoutFooter();
  }
  addEventListener("resize", layout);
  layout();
  document.fonts?.ready.then(layout); // canvases with words redraw once the pixel font is in
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05); // the first frame's time can trail performance.now()
    last = now;
    drawGuide(now, dt);
    if (seen.get(portrait.el)) drawPortrait(now);
    if (seen.get(trailFx.el)) drawTrailFx(now);
    else if (trailFx.shown !== undefined) trailFx.shown = G.lit; // off screen: nothing to catch up on
    if (seen.get(stage.el)) drawStage(now);
    if (gardener.state === "walk" || seen.get(gardener.el)) drawGardener(now);
    if (seen.get(seat)) drawSeat(now);
    if (seen.get(campCrew.el)) drawCampCrew(now);
    if (seen.get(footer.el)) drawFooter(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
