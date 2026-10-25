// The pixel me: one 24×32 drawing in code, plus poses made by repainting a few parts,
// so every pose and every "evolution" matches pixel for pixel.
// Each frame is drawn once into a tiny canvas and reused; callers scale it up crisply.

window.PixelMe = (() => {
  const PAL = {
    o: "#231a1b", // outline
    h: "#1b1416", H: "#3b2b2c", // hair
    s: "#b97a55", S: "#93603f", L: "#d49b72", // skin
    e: "#140e0f", b: "#4a3329", m: "#8e3d2c", w: "#f4ede0", // eyes, beard, smile
    c: "#efe6d1", C: "#cdbf9f", // the tee under the hoodie
    p: "#34465a", P: "#263343", // jeans
    n: "#eee8dc", N: "#b9af9e", u: "#7b6f62", // sneakers
    x: "#d3d7dc", X: "#8d939b", y: "#a8f0dc", // laptop
    k: "#5a4636", f: "#ffd27a", F: "#f08a3c", // lantern
    t: "#7397b0", T: "#4b6d86", a: "#9bd8f5", // watering can + water
    Y: "#f1bf45", Q: "#b8862a", // gold
    z: "#fff4b8", // dizzy stars
    v: "#11161f", V: "#5d7ea8", // sunglasses
  };

  // Outfit colours per "level" (g = main, G = shadow, j = light, d = drawstring / tie)
  const FORMS = {
    lv1: { g: "#e9dfc8", G: "#c8b994", j: "#f6efdf", d: "#c8b994" }, // plain tee, first internship
    lv2: { g: "#4f6b2e", G: "#3c5222", j: "#66863e", d: "#efe6d1" }, // the green hoodie
    lv3: { g: "#2c3448", G: "#1e2433", j: "#3e4a63", d: "#c0473a", c: "#f6f1e6" }, // blazer, tie and shades
  };
  FORMS.rich = FORMS.lv3; // the Trophy Room: same suit, dollar signs for eyes
  const SUITED = new Set(["lv3", "rich"]);
  // Other people in the Journey scenes: the same body, recoloured (hair, skin, no beard, clothes)
  const NO_BEARD = (skin) => ({ b: skin });
  Object.assign(FORMS, {
    mentor: { h: "#7b7b84", H: "#a9a9b2", b: "#8b8b92", g: "#2f6f86", G: "#24576a", j: "#43879a", d: "#eee5d0" }, // grey-haired senior
    mentor2: { h: "#3a2418", H: "#5a3a26", s: "#d9a07a", S: "#b8835e", L: "#ebb894", ...NO_BEARD("#d9a07a"), m: "#a5483a", g: "#8e3a4a", G: "#6e2b38", j: "#b05566", d: "#f0d9b8" },
    mate: { h: "#5a3a22", H: "#7a5236", ...NO_BEARD("#b97a55"), g: "#c06a2e", G: "#97511f", j: "#dd8a48", d: "#f3e2c8" },
    mate2: { h: "#20161a", s: "#8a5a3c", S: "#6d4530", L: "#a06d4b", ...NO_BEARD("#8a5a3c"), g: "#5d52a8", G: "#463d85", j: "#7a70c4", d: "#e8e3f6" },
  });

  // The AI crew, drawn in the same style: the little orange Claude Code creature, Codex as a
  // terminal with hands and feet, and OpenClaw the lobster. Two frames each.
  const CREW_PAL = {
    o: "#231a1b", k: "#140e0f", w: "#f6f1e6",
    C: "#d97757", D: "#b85d3e", E: "#ec9a7d", // Claude
    T: "#232836", U: "#3a4256", V: "#7ee0a2", // Codex
    R: "#d9483b", Q: "#9c2b22", P: "#f28c6b", // OpenClaw
    Y: "#f1bf45", N: "#eee8dc", M: "#c8b994", // mug, marshmallow, stick
  };
  const CREW = {
    claude: [[
      "....oooooooo....",
      "...oCCCCCCCCo...",
      "..oCEECCCCCCCo..",
      "..oCCkCCCCkCCo..",
      "..oCCkCCCCkCCo..",
      "ooCCCCCCCCCCCCoo",
      "oCoCCCCCCCCCCoCo",
      "ooDCCCCCCCCCCDoo",
      "..oCCCCCCCCCCo..",
      "..oDDDDDDDDDDo..",
      "..oooooooooooo..",
      "..oDo.oDooDo.oDo",
      "..oo..oo..oo..oo",
    ], [
      "................",
      "....oooooooo....",
      "...oCCCCCCCCo...",
      "..oCEECCCCCCCo..",
      "..oCCkCCCCkCCo..",
      "oooCCkCCCCkCCooo",
      "oCoCCCCCCCCCCoCo",
      "ooDCCCCCCCCCCDoo",
      "..oCCCCCCCCCCo..",
      "..oDDDDDDDDDDo..",
      "..oooooooooooo..",
      ".oDo.oDo.oDo.oDo",
      ".oo..oo..oo..oo.",
    ]],
    codex: [[
      "...oooooooooooo...",
      "..oUUUUUUUUUUUUo..",
      "..oUTTTTTTTTTTUo..",
      "..oTTVTTTTTTTTTo..",
      "..oTTTVTTTTTTTTo..",
      "wooTTVTTVVVVTTToow",
      "wwoTTTTTTTTTTTToww",
      "..oTTTTTTTTTTTTo..",
      "...oooooooooooo...",
      ".....oTo...oTo....",
      ".....oTo...oTo....",
      "....owwo..owwo....",
    ], [
      "...oooooooooooo...",
      "..oUUUUUUUUUUUUo..",
      "..oUTTTTTTTTTTUo..",
      "..oTTVTTTTTTTTTo..",
      "ww.TTTVTTTTTTT.ww.",
      ".wwTTVTTVVVVTTww..",
      "..oTTTTTTTTTTTTo..",
      "..oTTTTTTTTTTTTo..",
      "...oooooooooooo...",
      "....oTo.....oTo...",
      "....oTo.....oTo...",
      "...owwo....owwo...",
    ]],
    openclaw: [[
      "oo................oo",
      "oRo..............oRo",
      "oRRo....o..o....oRRo",
      "oPRRo...k..k...oRRPo",
      ".oRRo..oooooo..oRRo.",
      "..oRRooRRRRRRooRRo..",
      "...ooRRPRRRRPRRoo...",
      ".....oRRkRRkRRo.....",
      "....oQoRRRRRRoQo....",
      ".....oRRRRRRRRo.....",
      "....oQoRRRRRRoQo....",
      "......oRRRRRRo......",
      ".......oRQQRo.......",
      "......oRRooRRo......",
    ], [
      "....................",
      "oo................oo",
      "oRo.....o..o.....oRo",
      "oPRo....k..k....oRPo",
      ".oRRo..oooooo..oRRo.",
      "..oRRooRRRRRRooRRo..",
      "...ooRRPRRRRPRRoo...",
      ".....oRRkRRkRRo.....",
      "....oQoRRRRRRoQo....",
      ".....oRRRRRRRRo.....",
      "....oQoRRRRRRoQo....",
      "......oRRRRRRo......",
      ".......oRQQRo.......",
      "......oRRooRRo......",
    ]],
    mug: [["oooo.", "oYYoo", "oYYo.o", "oYYoo", "oooo."]],
    marshmallow: [["..oo", ".oNNo", ".oNNo", "M.oo", ".M..", "..M.", "...M"]],
  };
  // Walking: the same bodies, with the feet taking turns
  const feet = (frame, rows) => [...frame.slice(0, frame.length - rows.length), ...rows];
  CREW["claude-walk"] = [feet(CREW.claude[0], ["..oo......oo...."]), feet(CREW.claude[0], ["......oo......oo"])];
  CREW["codex-walk"] = [
    feet(CREW.codex[0], ["....oTo.....oTo...", "...owwo.....owwo.."]),
    feet(CREW.codex[0], ["......oTo.oTo.....", ".....owwo.owwo...."]),
  ];
  CREW["openclaw-walk"] = [feet(CREW.openclaw[0], [".....oRRo..oRRo....."]), feet(CREW.openclaw[1], [".......oRRooRRo....."])];
  const crewCache = new Map();
  function crewCanvas(name, n) {
    const key = `${name}|${n}`;
    if (crewCache.has(key)) return crewCache.get(key);
    const rows = CREW[name][n];
    const cv = document.createElement("canvas");
    cv.width = Math.max(...rows.map((r) => r.length));
    cv.height = rows.length;
    const ctx = cv.getContext("2d");
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (!CREW_PAL[c]) return;
      ctx.fillStyle = CREW_PAL[c];
      ctx.fillRect(x, y, 1, 1);
    }));
    crewCache.set(key, cv);
    return cv;
  }

  // Standing, facing the viewer. Rows 0-12 head, 13-21 hoodie and arms, 21-30 legs.
  const BASE = [
    ".........oooooo.........",
    ".......oohHhhHhoo.......",
    "......ohhHhhhhHhhho.....",
    ".....ohhhhhhhhhhhhho....",
    ".....ohhhHhhhhhHhhho....",
    ".....ohhshhsshsshhho....",
    ".....ohsssssssssshho....",
    ".....ohssesssessShho....",
    ".....oSssesssessShho....",
    "......obssssSssbbho.....",
    "......obbsbbbbsbbo......",
    ".......obbmmmbbbo.......",
    "........obbbbbbo........",
    ".....oogGGccccGGgoo.....",
    "....oggggGccccGggggo....",
    "...oggjgggGddGgggjggo...",
    "...ogjgoggggggggogjgo...",
    "...ogjgogggdgdggogjgo...",
    "...ogggoggGGGGggogggo...",
    "...oSsSoggggggggoSsSo...",
    "...osssoGGGGGGGGossso...",
    "....ooo.oPppppPo.ooo....",
    "........oppppppo........",
    "........opppPppo........",
    "........opppPppo........",
    "........opppPppo........",
    "........opppPppo........",
    "........opppoppo........",
    ".......onnnoonnno.......",
    ".......oNnnoonnNo.......",
    ".......ouuuoouuuo.......",
    "........................",
  ];

  // Small props, each with the point (in its own grid) that sits in the hand
  const ITEMS = {
    lantern: { at: [2, 0], rows: [
      "..o..",
      ".kkk.",
      "kfffk",
      "kfFfk",
      "kfFfk",
      "kfffk",
      ".kkk.",
    ] },
    can: { at: [0, 1], rows: [
      ".ooo......",
      "o...o...oo",
      "otttto.o.o",
      "otTttttoo.",
      "otTtttto..",
      "otTtttto..",
      ".oooooo...",
    ] },
    trophy: { at: [4, 8], rows: [
      "ooooooooo",
      "oYYYYYzYo",
      "YoYYYYYoY",
      "YoYYYYQoY",
      ".ooYYQoo.",
      "...oYo...",
      "...oQo...",
      "..oYYQo..",
      "..ooooo..",
    ] },
    star: { at: [1, 1], rows: [".z.", "zzz", ".z."] },
    gun: { at: [1, 3], rows: [ // a grappling gun; the hook leaves from the top right
      "oooooo.",
      "oXXXXXo",
      "oXXooo.",
      "oXo....",
      "oo.....",
    ] },
    hook: { at: [2, 4], rows: ["X...X", "XX.XX", ".XXX.", "..X..", "..X.."] },
    coin: { at: [1, 1], rows: [".YY.", "YQYY", "YYQY", ".YY."] },
    log: { at: [11, 0], rows: [
      "..oooooooooooooooooo..",
      ".oLkkkkkkkkkkkkkkkkko.",
      "oLSLokkkHkkkkkkHkkkkko",
      "oLLLokkkkkkkHkkkkkkkko",
      ".oLoookkkkkkkkkkkkkko.",
      "..oooooooooooooooooo..",
    ] },
  };

  const W = 34, H = 40, OX = 5, OY = 8; // canvas size and where the 24×32 body sits in it

  // ---- tiny grid helpers (all coordinates are body coordinates; props may overhang) ----
  function fresh() {
    const g = [...Array(H)].map(() => Array(W).fill("."));
    BASE.forEach((row, y) => [...row].forEach((c, x) => { g[y + OY][x + OX] = c; }));
    return g;
  }
  function set(g, y, x, c) {
    const yy = y + OY, xx = x + OX;
    if (yy >= 0 && yy < H && xx >= 0 && xx < W) g[yy][xx] = c;
  }
  function get(g, y, x) { return g[y + OY]?.[x + OX] ?? "."; }
  // "." keeps what's there, "_" erases
  function paint(g, ops) {
    for (const [y, x, s] of ops) [...s].forEach((c, i) => { if (c !== ".") set(g, y, x + i, c === "_" ? "." : c); });
  }
  function item(g, name, handY, handX) {
    const it = ITEMS[name];
    it.rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== ".") set(g, handY - it.at[1] + y, handX - it.at[0] + x, c);
    }));
  }
  // Move a rectangle of pixels by (dy, dx)
  function shift(g, y0, y1, x0, x1, dy, dx) {
    const buf = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { buf.push([y, x, get(g, y, x)]); set(g, y, x, "."); }
    for (const [y, x, c] of buf) if (c !== ".") set(g, y + dy, x + dx, c);
  }

  // ---- parts ----
  function noLeftArm(g) {
    for (let y = 15; y <= 21; y++) for (let x = 3; x <= 6; x++) set(g, y, x, ".");
    for (let y = 15; y <= 20; y++) set(g, y, 7, "o");
  }
  function noRightArm(g) {
    for (let y = 15; y <= 21; y++) for (let x = 17; x <= 20; x++) set(g, y, x, ".");
    for (let y = 15; y <= 20; y++) set(g, y, 16, "o");
  }
  const RAISED = (wiggle) => [
    [4, 20 + wiggle, "ooo"],
    [5, 19 + wiggle, "oSLo"],
    [6, 19 + wiggle, "osSo"],
    [7, 19, "oggo"],
    [8, 19, "ogjo"],
    [9, 19, "ogjo"],
    [10, 18, "oggo"],
    [11, 18, "ogjo"],
    [12, 17, "oggo"],
    [13, 17, "gg"],
  ];
  // The body is drawn about column 11.5, so a part's mirror image is the other side's part
  const mirror = (ops) => ops.map(([y, x, s]) => [y, 23 - (x + s.length - 1), [...s].reverse().join("")]);
  function raisedRightArm(g, wiggle = 0) { noRightArm(g); paint(g, RAISED(wiggle)); }
  function raisedLeftArm(g, wiggle = 0) { noLeftArm(g); paint(g, mirror(RAISED(wiggle))); }
  function tuckLegs(g) { shift(g, 27, 30, 7, 16, -2, 0); } // knees up, mid-jump
  // Money goggles: a gold $ on a dark lens over each eye, joined by a bridge
  const DOLLAR = [".Y.", "YYY", "Y..", "YYY", "..Y", "YYY", ".Y."];
  function dollarEyes(g, dy = 0) {
    for (const x0 of [8, 12]) DOLLAR.forEach((row, r) => [...row].forEach((c, i) => set(g, 4 + r + dy, x0 + i, c === "Y" ? "Y" : "v")));
    set(g, 7 + dy, 11, "v");
    set(g, 7 + dy, 7, "v");
    set(g, 7 + dy, 15, "v");
  }
  function blink(g) { set(g, 7, 9, "s"); set(g, 7, 13, "s"); set(g, 8, 9, "b"); set(g, 8, 13, "b"); }
  function happyEyes(g) { paint(g, [[7, 9, "e"], [7, 13, "e"], [8, 8, "e.e"], [8, 12, "e.e"]]); set(g, 8, 9, "s"); set(g, 8, 13, "s"); } // ^ ^
  function dizzyEyes(g) { paint(g, [[7, 8, "e.e"], [8, 9, "e"], [7, 12, "e.e"], [8, 13, "e"]]); }
  function shades(g, dy = 0) { paint(g, [[7 + dy, 7, "vvvvvvvvv"], [8 + dy, 8, "vVv"], [8 + dy, 12, "vVv"]]); set(g, 7 + dy, 6, "v"); }
  function liftFoot(g, side) { // side: 0 = left foot, 1 = right foot; lifts the shoe one row
    if (side === 0) { shift(g, 27, 30, 7, 11, -1, 0); paint(g, [[27, 8, "o"]]); }
    else { shift(g, 27, 30, 12, 16, -1, 0); paint(g, [[27, 15, "o"]]); }
  }
  // Sitting: the upper body drops 5 rows, knees come toward you, feet flat in front
  function sitDown(g) {
    for (let y = 21; y <= 31; y++) for (let x = -5; x < 29; x++) set(g, y, x, ".");
    shift(g, -8, 20, -5, 28, 5, 0);
    paint(g, [
      [26, 0, "......oppppppppppo......"],
      [27, 0, "......opppPppPpppo......"],
      [28, 0, ".....oPpppo..oPpppo....."],
      [29, 0, ".....onnnno..onnnno....."],
      [30, 0, ".....ouuuuo..ouuuuo....."],
    ]);
  }
  function laptop(g, tap) {
    noLeftArm(g);
    noRightArm(g);
    paint(g, [
      [14, 6, "oooooooooooo"],
      [15, 6, "oxxxxxxxxxxo"],
      [16, 6, "oxxxxyyxxxxo"],
      [17, 6, "oxxxxyyxxxxo"],
      [18, 6, "oxxxxxxxxxxo"],
      [19, 5, "oXXXXXXXXXXXXo"],
      [20, 5, "oooooooooooooo"],
      [15, 4, "og"], [16, 3, "ogg"], [17, 3, "ogg"], [18, 3, "oS"],
      [15, 18, "go"], [16, 18, "ggo"], [17, 18, "ggo"], [18, 19, "So"],
      [19 - (tap ? 1 : 0), 4, "oSs"], [19 - (tap ? 0 : 1), 17, "sSo"],
    ]);
  }

  // ---- poses: each returns a list of frames (functions that edit a fresh grid) ----
  const WALK = [
    (g) => liftFoot(g, 0),
    (g) => shift(g, -8, 27, -5, 28, -1, 0),
    (g) => liftFoot(g, 1),
    (g) => shift(g, -8, 27, -5, 28, -1, 0),
  ];
  const POSES = {
    idle: [(g) => g, (g) => g, (g) => g, (g) => blink(g)],
    walk: WALK,
    wave: [(g) => { raisedRightArm(g, 0); happyEyes(g); }, (g) => { raisedRightArm(g, 1); happyEyes(g); }],
    type: [(g) => laptop(g, 0), (g) => laptop(g, 1)],
    lantern: WALK.map((step) => (g) => { step(g); item(g, "lantern", 21, 19); }),
    water: [0, 1].map((k) => (g) => {
      item(g, "can", 21, 18);
      for (let i = 0; i < 4; i++) set(g, 24 + i * 2 + k, 27 + (i % 2), "a");
    }),
    waterwalk: WALK.map((step, k) => (g) => {
      step(g);
      item(g, "can", 21, 18);
      for (let i = 0; i < 4; i++) set(g, 24 + i * 2 + (k % 2), 27 + (i % 2), "a");
    }),
    trophy: [0, 1].map((k) => (g) => {
      raisedRightArm(g, 0);
      happyEyes(g);
      item(g, "trophy", 5, 21);
      if (k) { item(g, "star", -4, 16); item(g, "star", -1, 27); }
    }),
    dizzy: [0, 1].map((k) => (g) => {
      dizzyEyes(g);
      if (k) { item(g, "star", -2, 6); item(g, "star", -3, 17); }
      else { item(g, "star", -3, 9); item(g, "star", -2, 20); }
    }),
    sit: [0, 0, 0, 1].map((k) => (g) => { if (k) blink(g); else happyEyes(g); sitDown(g); }),
    // mid-air: both arms up, knees tucked
    jump: [(g) => { raisedRightArm(g); raisedLeftArm(g); tuckLegs(g); happyEyes(g); }],
    // a fist in the air, hyping something up
    cheer: [0, 1].map((k) => (g) => { raisedRightArm(g, k); happyEyes(g); }),
    // hanging from a rope by the right hand, feet swaying a little
    hang: [0, 1].map((k) => (g) => { raisedRightArm(g); if (k) shift(g, 27, 30, 7, 16, 0, 1); }),
    // aiming the grappling gun up and to the right
    aim: [(g) => { raisedRightArm(g); item(g, "gun", 5, 21); }],
    sleep: [(g) => blink(g)], // drawn lying down by the caller
  };

  const cache = new Map();
  function render(pose, n, form) {
    const key = `${form}|${pose}|${n}`;
    if (cache.has(key)) return cache.get(key);
    const g = fresh();
    if (SUITED.has(form)) paint(g, [[13, 11, "dd"], [14, 11, "dd"], [15, 11, "dd"], [16, 11, "dd"], [17, 11, "dd"], [15, 10, "c"], [15, 13, "c"], [17, 13, "g"]]); // a tie instead of drawstrings
    POSES[pose][n](g);
    const dy = pose === "sit" ? 5 : 0; // sitting moves the head down 5 rows
    if (form === "lv3" && pose !== "sleep") shades(g, dy);
    if (form === "rich") dollarEyes(g, dy);
    const colors = { ...PAL, ...FORMS[form] };
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    g.forEach((row, y) => row.forEach((c, x) => {
      if (c === "." || !colors[c]) return;
      ctx.fillStyle = colors[c];
      ctx.fillRect(x, y, 1, 1);
    }));
    cache.set(key, cv);
    return cv;
  }

  return {
    W, H, OX, OY,
    poses: Object.keys(POSES),
    count: (pose) => POSES[pose].length,
    // Draws a pose at (x, y) = the point between the feet, scaled to whole pixels
    draw(ctx, { pose = "idle", frame = 0, form = "lv2", x, y, scale = 4, flip = false }) {
      const n = POSES[pose].length;
      const cv = render(pose, ((Math.floor(frame) % n) + n) % n, form);
      const left = Math.round(x - (OX + 12) * scale);
      const top = Math.round(y - (OY + 31) * scale);
      ctx.imageSmoothingEnabled = false;
      if (flip) {
        ctx.save();
        ctx.translate(left + W * scale, top);
        ctx.scale(-1, 1);
        ctx.drawImage(cv, 0, 0, W * scale, H * scale);
        ctx.restore();
      } else ctx.drawImage(cv, left, top, W * scale, H * scale);
    },
    // One of the AI crew, feet at (x, y)
    crew(ctx, { name, frame = 0, x, y, scale = 4, flip = false }) {
      const frames = CREW[name];
      const cv = crewCanvas(name, ((Math.floor(frame) % frames.length) + frames.length) % frames.length);
      const left = Math.round(x - (cv.width / 2) * scale);
      const top = Math.round(y - cv.height * scale);
      ctx.imageSmoothingEnabled = false;
      if (flip) {
        ctx.save();
        ctx.translate(left + cv.width * scale, top);
        ctx.scale(-1, 1);
        ctx.drawImage(cv, 0, 0, cv.width * scale, cv.height * scale);
        ctx.restore();
      } else ctx.drawImage(cv, left, top, cv.width * scale, cv.height * scale);
    },
    // One prop on its own (a falling trophy, the log by the fire), centred on (x, y)
    prop(ctx, name, x, y, scale = 4) {
      const it = ITEMS[name];
      ctx.imageSmoothingEnabled = false;
      it.rows.forEach((row, ry) => [...row].forEach((c, rx) => {
        if (!PAL[c]) return;
        ctx.fillStyle = PAL[c];
        ctx.fillRect(Math.round(x + (rx - row.length / 2) * scale), Math.round(y + (ry - it.rows.length / 2) * scale), scale, scale);
      }));
    },
  };
})();
