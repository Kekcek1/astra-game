(function () {
  "use strict";

  const C = {
    ink: "#2b2a4a",
    inkSoft: "#57547a",
    cream: "#fff6e3",
    paper: "#fffdf7",
    gold: "#ffd05a",
    goldDeep: "#f2a62f",
    coral: "#ff7d6e",
    coralDeep: "#e45c50",
    mint: "#bfe8d0",
    green: "#5e9e6d",
    greenDeep: "#3e7d55",
    sky: "#a9dbf2",
    lav: "#c9b6f5",
    violet: "#8e77d6",
    silver: "#cfe0ff",
    moon: "#b9c8ff",
  };

  const THEMES = [
    { skyTop: "#dff4ff", skyBottom: "#fff3d2", hill1: "#c6e8c1", hill2: "#9fd3a6", hill3: "#7fbf8b", sun: "#ffd05a", night: false },
    { skyTop: "#dff8ef", skyBottom: "#fff6df", hill1: "#c9eedd", hill2: "#a0dcc5", hill3: "#7bc4a7", sun: "#ffd361", night: false },
    { skyTop: "#cbbcf1", skyBottom: "#ffd3a8", hill1: "#e4c7b4", hill2: "#c7a5a4", hill3: "#9b7e91", sun: "#ffb15c", night: false, sunset: true },
    { skyTop: "#1d2750", skyBottom: "#4a477e", hill1: "#38426d", hill2: "#2e3760", hill3: "#242c51", sun: "#dfe8ff", night: true },
  ];

  let canvas = null;
  let ctx = null;
  let W = 0, H = 0, DPR = 1;
  let t = 0;
  let last = 0;
  let raf = 0;
  let menuRect = { left: 0, top: 0, width: 0, height: 0 };
  let view = { x: 0, y: 0, w: 0, h: 0, cell: 0, cols: 5, rows: 5 };
  let levelKey = "";
  let mirrorAngles = [];
  let mirrorPulse = [];
  let flowerBloom = [];
  const particles = [];
  const MAX_PARTICLES = 160;
  let fireflies = [];
  let promoTitle = ["Сад", "Лучей"];
  let promoSub = "Уютная головоломка";
  let bgCache = null;
  let bgKey = "";
  let boardCache = null;
  let boardKey = "";
  const glowCache = {};
  let scene = {
    screen: "menu",
    chapter: 0,
    level: null,
    bits: [],
    trace: null,
    lit: new Set(),
    selected: { x: -1, y: -1 },
    hintIndex: -1,
    hintUntil: 0,
    solved: false,
    paused: false,
    promo: null,
    lang: "ru",
  };

  function rand(seed) {
    let a = seed | 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rr(x, y, w, h, r) {
    const q = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + q, y);
    ctx.arcTo(x + w, y, x + w, y + h, q);
    ctx.arcTo(x + w, y + h, x, y + h, q);
    ctx.arcTo(x, y + h, x, y, q);
    ctx.arcTo(x, y, x + w, y, q);
    ctx.closePath();
  }

  function fillRR(x, y, w, h, r, fill) {
    rr(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRR(x, y, w, h, r, stroke, width) {
    rr(x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function circle(x, y, r, fill) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function ellipse(x, y, rx, ry, fill, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function starPath(cx, cy, outer, inner, points, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = (i * Math.PI) / points - Math.PI / 2 + (rot || 0);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function sparkle(x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.22, -r * 0.22, r, 0);
    ctx.quadraticCurveTo(r * 0.22, r * 0.22, 0, r);
    ctx.quadraticCurveTo(-r * 0.22, r * 0.22, -r, 0);
    ctx.quadraticCurveTo(-r * 0.22, -r * 0.22, 0, -r);
    ctx.fill();
    ctx.restore();
  }

  function cellCenter(gx, gy) {
    return {
      x: view.x + (gx + 0.5) * view.cell,
      y: view.y + (gy + 0.5) * view.cell,
    };
  }

  function levelMirrorState(i) {
    const lv = scene.level;
    if (!lv) return 0;
    const m = lv.mirrors[i];
    if (m.fixed) return m.state;
    return m.state ^ ((scene.bits[i] || 0) & 1);
  }

  function targetAngle(state) {
    return state ? Math.PI / 4 : -Math.PI / 4;
  }

  function ensureAnimations() {
    const lv = scene.level;
    if (!lv) {
      mirrorAngles = [];
      mirrorPulse = [];
      flowerBloom = [];
      return;
    }
    const key = lv.id + ":" + lv.mirrors.length + ":" + lv.flowers.length;
    if (key !== levelKey) {
      levelKey = key;
      mirrorAngles = lv.mirrors.map((m) => targetAngle(m.state));
      mirrorPulse = lv.mirrors.map(() => 0);
      flowerBloom = lv.flowers.map(() => 0);
    }
  }

  function init(el) {
    canvas = el;
    ctx = canvas.getContext("2d", { alpha: true });
    resize();
    buildFireflies();
    last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      frame(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function resize() {
    if (!canvas) return;
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildFireflies();
  }

  function buildFireflies() {
    const rng = rand(1931);
    fireflies = [];
    for (let i = 0; i < 20; i++) {
      fireflies.push({
        nx: rng(),
        ny: rng(),
        r: 1.2 + rng() * 2.2,
        phase: rng() * Math.PI * 2,
        speed: 0.25 + rng() * 0.65,
        drift: 8 + rng() * 22,
      });
    }
  }

  function setMenuRect(rect) {
    if (!rect) return;
    menuRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  function setScene(patch) {
    Object.assign(scene, patch);
    ensureAnimations();
  }

  function layout(rect, level) {
    if (!rect || !level) return view;
    const cols = level.cols, rows = level.rows;
    const pad = 0.98;
    const cell = Math.max(12, Math.min(rect.width / (cols + pad * 2), rect.height / (rows + pad * 2)));
    const w = cols * cell;
    const h = rows * cell;
    view = {
      x: rect.left + (rect.width - w) / 2,
      y: rect.top + (rect.height - h) / 2,
      w, h, cell, cols, rows,
    };
    return view;
  }

  function getView() { return view; }

  function hitTest(clientX, clientY, level) {
    if (!level || !view.cell) return null;
    const gx = Math.floor((clientX - view.x) / view.cell);
    const gy = Math.floor((clientY - view.y) / view.cell);
    if (gx < 0 || gy < 0 || gx >= level.cols || gy >= level.rows) return null;
    const mirror = (level.mirrors || []).findIndex((m) => m.x === gx && m.y === gy);
    return { gx, gy, mirror };
  }

  function pulseMirror(i) {
    if (mirrorPulse[i] !== undefined) mirrorPulse[i] = 1;
  }

  function spawnBurst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (speed || 80) * (0.4 + Math.random() * 0.9);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: 0,
        max: 0.5 + Math.random() * 0.7,
        size: 1.5 + Math.random() * 3.5,
        color,
        star: Math.random() < 0.45,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 55 * dt;
      p.vx *= 0.985;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const k = 1 - p.life / p.max;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      if (p.star) sparkle(p.x, p.y, p.size * (0.6 + k), p.color, k);
      else circle(p.x, p.y, p.size * k, p.color);
      ctx.restore();
    }
  }

  function theme() {
    return THEMES[Math.max(0, Math.min(3, scene.chapter || 0))];
  }

  function glowSprite(name, r, g, b, alpha) {
    if (glowCache[name]) return glowCache[name];
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g2 = c.getContext("2d");
    const gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    gr.addColorStop(0.48, `rgba(${r},${g},${b},${alpha * 0.34})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 128, 128);
    glowCache[name] = c;
    return c;
  }

  function buildBgCache() {
    const key = W + "x" + H + ":" + DPR + ":" + (scene.chapter || 0);
    if (bgCache && bgKey === key) return bgCache;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(W * DPR));
    c.height = Math.max(1, Math.round(H * DPR));
    const g = c.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const th = theme();
    const w = W, h = H;

    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, th.skyTop);
    grad.addColorStop(0.62, th.skyBottom);
    grad.addColorStop(1, th.night ? "#2b3260" : "#ffe7bd");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    const hY = h * 0.67;
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, hY + 20);
    g.bezierCurveTo(w * 0.18, hY - 60, w * 0.36, hY + 32, w * 0.52, hY - 18);
    g.bezierCurveTo(w * 0.68, hY - 68, w * 0.84, hY + 22, w, hY - 30);
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = th.hill1;
    g.fill();

    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, hY + 70);
    g.bezierCurveTo(w * 0.2, hY + 12, w * 0.4, hY + 92, w * 0.57, hY + 48);
    g.bezierCurveTo(w * 0.74, hY + 4, w * 0.88, hY + 74, w, hY + 36);
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = th.hill2;
    g.fill();

    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, hY + 130);
    g.bezierCurveTo(w * 0.22, hY + 76, w * 0.46, hY + 150, w * 0.64, hY + 108);
    g.bezierCurveTo(w * 0.8, hY + 70, w * 0.92, hY + 122, w, hY + 92);
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = th.hill3;
    g.fill();

    const hz = g.createLinearGradient(0, h * 0.72, 0, h);
    hz.addColorStop(0, "rgba(255,246,227,0)");
    hz.addColorStop(1, th.night ? "rgba(24,28,60,0.55)" : "rgba(255,243,210,0.5)");
    g.fillStyle = hz;
    g.fillRect(0, h * 0.7, w, h * 0.3);

    bgCache = c;
    bgKey = key;
    return c;
  }

  function drawSky(w, h) {
    const th = theme();
    ctx.drawImage(buildBgCache(), 0, 0, w, h);

    if (th.night) {
      const rng = rand(77);
      for (let i = 0; i < 46; i++) {
        const x = rng() * w;
        const y = rng() * h * 0.62;
        const s = 0.8 + rng() * 2.1;
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.8 + i));
        ctx.globalAlpha = a;
        circle(x, y, s, i % 7 === 0 ? C.gold : "#eef3ff");
      }
      ctx.globalAlpha = 1;
    }

    // sun / moon
    const sunX = w * (0.79 + Math.sin(t * 0.03) * 0.008);
    const sunY = h * 0.17;
    const sunR = Math.min(w, h) * (th.night ? 0.055 : 0.075);
    ctx.drawImage(
      th.night ? glowSprite("moonGlow", 207, 224, 255, 0.45) : glowSprite("sunGlow", 255, 225, 140, 0.48),
      sunX - sunR * 4, sunY - sunR * 4, sunR * 8, sunR * 8
    );

    if (th.night) {
      ctx.save();
      ctx.translate(sunX, sunY);
      circle(0, 0, sunR, "#dfe8ff");
      circle(sunR * 0.38, -sunR * 0.16, sunR * 0.88, th.skyTop);
      ctx.globalAlpha = 0.85;
      circle(-sunR * 0.32, sunR * 0.25, sunR * 0.12, "#b9c8ff");
      circle(sunR * 0.2, sunR * 0.48, sunR * 0.08, "#b9c8ff");
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(sunX, sunY);
      ctx.rotate(t * 0.06);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        fillRR(sunR * 1.08, -sunR * 0.08, sunR * 0.36, sunR * 0.16, sunR * 0.08, "rgba(255,208,90,0.55)");
      }
      ctx.restore();
      circle(sunX, sunY, sunR, "#ffd86d");
      circle(sunX - sunR * 0.28, sunY - sunR * 0.2, sunR * 0.72, "rgba(255,246,180,0.35)");
      circle(sunX - sunR * 0.26, sunY - sunR * 0.06, sunR * 0.07, C.ink);
      circle(sunX + sunR * 0.26, sunY - sunR * 0.06, sunR * 0.07, C.ink);
      ctx.beginPath();
      ctx.arc(sunX, sunY + sunR * 0.1, sunR * 0.26, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1.5, sunR * 0.07);
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // clouds
    const cloudAlpha = th.night ? 0.12 : 0.55;
    ctx.globalAlpha = cloudAlpha;
    for (let i = 0; i < 4; i++) {
      const cw = w * (0.16 + i * 0.035);
      const cx = ((t * (4 + i * 2) + i * 330) % (w + cw * 2)) - cw;
      const cy = h * (0.12 + (i % 3) * 0.07);
      ellipse(cx, cy, cw, cw * 0.18, "#fffdf7");
      ellipse(cx + cw * 0.24, cy - cw * 0.1, cw * 0.42, cw * 0.2, "#fffdf7");
      ellipse(cx - cw * 0.28, cy + cw * 0.03, cw * 0.38, cw * 0.16, "#fffdf7");
    }
    ctx.globalAlpha = 1;
  }

  function drawBush(x, y, s, color, dark) {
    ellipse(x, y, s * 0.9, s * 0.32, dark || "rgba(43,42,74,0.12)");
    circle(x - s * 0.55, y - s * 0.18, s * 0.48, color);
    circle(x, y - s * 0.38, s * 0.62, color);
    circle(x + s * 0.56, y - s * 0.16, s * 0.46, color);
    circle(x - s * 0.18, y - s * 0.6, s * 0.3, "rgba(255,255,255,0.16)");
  }

  function drawGardenSilhouette(w, h) {
    const th = theme();
    const baseY = h * 1.02;
    const rng = rand(504);
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 7; i++) {
      const x = (i / 6) * w + (rng() - 0.5) * w * 0.08;
      const s = 24 + rng() * 52;
      drawBush(x, baseY, s, th.night ? "#28335a" : "#6aa878", "transparent");
    }
    ctx.globalAlpha = 1;
  }

  function drawFireflies(w, h, ox, oy) {
    const x0 = ox || 0;
    const y0 = oy || 0;
    const sprite = glowSprite("firefly", 255, 236, 151, 0.9);
    const night = theme().night;
    for (const f of fireflies) {
      const x = x0 + f.nx * w + Math.sin(t * f.speed + f.phase) * f.drift;
      const y = y0 + f.ny * h + Math.cos(t * f.speed * 0.8 + f.phase) * f.drift * 0.7;
      const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.3 + f.phase));
      ctx.globalAlpha = a * (night ? 0.95 : 0.55);
      ctx.drawImage(sprite, x - f.r * 5, y - f.r * 5, f.r * 10, f.r * 10);
      circle(x, y, f.r, "#ffe58a");
    }
    ctx.globalAlpha = 1;
  }

  function drawButterfly(x, y, s, phase) {
    const flap = 0.35 + Math.abs(Math.sin(t * 2.2 + phase)) * 0.65;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 0.7 + phase) * 0.18);
    ctx.globalAlpha = 0.85;
    ellipse(-s * 0.35, 0, s * 0.42 * flap, s * 0.28, "#ffe1a0", -0.35);
    ellipse(s * 0.35, 0, s * 0.42 * flap, s * 0.28, "#ffd08a", 0.35);
    ellipse(-s * 0.22, s * 0.18, s * 0.28 * flap, s * 0.18, "#ffc1a8", -0.5);
    ellipse(s * 0.22, s * 0.18, s * 0.28 * flap, s * 0.18, "#ffc1a8", 0.5);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(0, s * 0.22);
    ctx.stroke();
    ctx.restore();
  }

  function drawMenuScene() {
    const w = W, h = H;
    const th = theme();
    if (W < H * 0.92 && menuRect.width > 40) {
      drawMenuMeadow();
      return;
    }
    // garden mound
    const baseY = h * 0.88;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, baseY);
    ctx.bezierCurveTo(w * 0.22, baseY - h * 0.1, w * 0.46, baseY + h * 0.04, w * 0.62, baseY - h * 0.06);
    ctx.bezierCurveTo(w * 0.8, baseY - h * 0.15, w * 0.9, baseY - h * 0.01, w, baseY - h * 0.08);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = th.night ? "#3b4a6e" : "#b8e3b5";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, baseY + h * 0.1);
    ctx.bezierCurveTo(w * 0.26, baseY + h * 0.02, w * 0.5, baseY + h * 0.16, w * 0.7, baseY + h * 0.08);
    ctx.bezierCurveTo(w * 0.85, baseY + h * 0.02, w * 0.94, baseY + h * 0.12, w, baseY + h * 0.06);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = th.night ? "#334163" : "#95cf9f";
    ctx.fill();

    // big flowers
    const fx = [w * 0.07, w * 0.16];
    const fy = [h * 0.78, h * 0.86];
    for (let i = 0; i < fx.length; i++) bigFlower(fx[i], fy[i], 38 + i * 7, i % 2 ? C.lav : C.coral, C.gold, i);
    drawBush(w * 0.28, h * 1.01, 55, th.night ? "#2a385c" : "#67a974", "transparent");
    drawBush(w * 0.72, h * 1.02, 60, th.night ? "#2a385c" : "#5f9f70", "transparent");

    // bunny platform
    if (menuRect.width > 0) {
      let bx = menuRect.left + menuRect.width * 0.4;
      const by = menuRect.top + menuRect.height * 0.9;
      const s = Math.max(20, Math.min(menuRect.width, menuRect.height) * 0.16);
      let mx = bx + s * 2.2;
      const my = by - s * 1.55;
      let fx2 = bx + s * 3.7;
      const fy2 = by - s * 1.75;
      const right = Math.max(mx + s * 1.1, fx2 + s * 1.0);
      if (right > w - 12) {
        const shift = w - 12 - right;
        bx += shift;
        mx += shift;
        fx2 += shift;
      }
      // mirror and beam vignette
      drawMirrorAt(mx, my, s * 0.82, Math.PI / 4, false, 0);
      drawFlowerAt(fx2, fy2, s * 1.05, "sun", true, 0.7, 0);
      ctx.save();
      ctx.strokeStyle = "rgba(255,208,90,0.7)";
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(255,208,90,0.8)";
      ctx.shadowBlur = s * 0.4;
      ctx.beginPath();
      ctx.moveTo(mx + s * 0.8, my - s * 0.2);
      ctx.lineTo(fx2 - s * 0.45, my - s * 0.2);
      ctx.stroke();
      ctx.restore();
      drawBunny(bx, by, s, "idle", 1);
      drawButterfly(bx - s * 2.2, by - s * 2.4, s * 0.32, 1.2);
      drawButterfly(bx + s * 1.6, by - s * 3.2, s * 0.24, 3.1);
    }
    drawFireflies(w, h);
    drawGardenSilhouette(w, h);
  }

  function drawMenuMeadow() {
    const r = menuRect;
    const x = r.left + 3;
    const y = r.top + 3;
    const w = r.width - 6;
    const h = r.height - 6;
    if (w < 60 || h < 50) return;
    const th = theme();

    ctx.save();
    ctx.translate(0, 6);
    fillRR(x, y, w, h, 26, "rgba(43,42,74,0.16)");
    ctx.restore();

    ctx.save();
    rr(x, y, w, h, 26);
    ctx.clip();

    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(0.58, th.skyBottom);
    g.addColorStop(1, "#ffe7bd");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // little sun
    const sx = x + w * 0.82;
    const sy = y + h * 0.22;
    const sr = Math.min(w, h) * 0.075;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t * 0.08);
    for (let i = 0; i < 10; i++) {
      ctx.rotate(Math.PI / 5);
      fillRR(sr * 1.1, -sr * 0.07, sr * 0.34, sr * 0.13, sr * 0.07, "rgba(255,208,90,0.6)");
    }
    ctx.restore();
    circle(sx, sy, sr, "#ffd86d");
    circle(sx - sr * 0.25, sy - sr * 0.05, sr * 0.07, C.ink);
    circle(sx + sr * 0.25, sy - sr * 0.05, sr * 0.07, C.ink);
    ctx.beginPath();
    ctx.arc(sx, sy + sr * 0.12, sr * 0.24, 0.25, Math.PI - 0.25);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1.2, sr * 0.08);
    ctx.lineCap = "round";
    ctx.stroke();

    // clouds
    ctx.globalAlpha = 0.6;
    ellipse(x + w * 0.2, y + h * 0.18, w * 0.14, h * 0.045, "#fffdf7");
    ellipse(x + w * 0.28, y + h * 0.15, w * 0.1, h * 0.04, "#fffdf7");
    ellipse(x + w * 0.62, y + h * 0.3, w * 0.12, h * 0.035, "#fffdf7");
    ctx.globalAlpha = 1;

    // meadow
    const base = y + h * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, base);
    ctx.bezierCurveTo(x + w * 0.24, base - h * 0.13, x + w * 0.46, base + h * 0.08, x + w * 0.62, base - h * 0.03);
    ctx.bezierCurveTo(x + w * 0.8, base - h * 0.12, x + w * 0.92, base + h * 0.03, x + w, base - h * 0.02);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fillStyle = "#b8e3b5";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, base + h * 0.12);
    ctx.bezierCurveTo(x + w * 0.3, base + h * 0.04, x + w * 0.56, base + h * 0.19, x + w * 0.76, base + h * 0.1);
    ctx.bezierCurveTo(x + w * 0.9, base + h * 0.04, x + w * 0.96, base + h * 0.12, x + w, base + h * 0.08);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fillStyle = "#95cf9f";
    ctx.fill();

    bigFlower(x + w * 0.1, y + h * 0.94, Math.min(w, h) * 0.13, C.coral, C.gold, 1);
    bigFlower(x + w * 0.94, y + h * 0.98, Math.min(w, h) * 0.12, C.lav, C.gold, 2);
    drawBush(x + w * 0.34, y + h * 1.03, h * 0.13, "#67a974", "transparent");
    drawBush(x + w * 0.74, y + h * 1.04, h * 0.12, "#5f9f70", "transparent");

    const s = Math.min(w, h) * 0.19;
    const bx = x + w * 0.43;
    const by = y + h * 0.81;
    const mx = bx + s * 1.75;
    const my = by - s * 1.35;
    const fx2 = bx + s * 3.2;
    const fy2 = by - s * 1.5;

    drawMirrorAt(mx, my, s * 0.78, Math.PI / 4, false, 0);
    drawFlowerAt(fx2, fy2, s * 0.95, "sun", true, 0.7, 0);
    ctx.save();
    ctx.strokeStyle = "rgba(255,208,90,0.72)";
    ctx.lineWidth = Math.max(2, s * 0.1);
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255,208,90,0.8)";
    ctx.shadowBlur = s * 0.35;
    ctx.beginPath();
    ctx.moveTo(mx + s * 0.75, my - s * 0.25);
    ctx.lineTo(fx2 - s * 0.4, my - s * 0.25);
    ctx.stroke();
    ctx.restore();
    drawBunny(bx, by, s, "idle", 1);
    drawButterfly(bx - s * 1.6, by - s * 2.1, s * 0.3, 1.2);
    drawButterfly(bx + s * 1.2, by - s * 2.5, s * 0.22, 3.1);

    drawFireflies(w, h, x, y);
    ctx.restore();

    strokeRR(x, y, w, h, 26, "rgba(43,42,74,0.18)", 2);
  }

  function bigFlower(x, y, s, petal, center, phase) {
    const sway = Math.sin(t * 0.8 + phase) * 0.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    ctx.strokeStyle = C.greenDeep;
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.08, -s * 1.4, s * 0.04, -s * 2.2);
    ctx.stroke();
    ellipse(-s * 0.24, -s * 0.8, s * 0.28, s * 0.14, C.green, -0.5);
    ellipse(s * 0.2, -s * 1.25, s * 0.26, s * 0.12, C.green, 0.5);
    const cx = s * 0.04, cy = -s * 2.2;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + t * 0.1;
      ellipse(cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.34, s * 0.26, s * 0.14, petal, a);
    }
    circle(cx, cy, s * 0.22, center);
    circle(cx - s * 0.06, cy - s * 0.06, s * 0.08, "rgba(255,255,255,0.5)");
    ctx.restore();
  }

  function drawLevelBackdrop() {
    const w = W, h = H;
    const th = theme();
    ctx.globalAlpha = 0.8;
    const rng = rand(88);
    for (let i = 0; i < 10; i++) {
      const x = rng() * w;
      const y = h * (0.65 + rng() * 0.35);
      const s = 10 + rng() * 26;
      drawBush(x, y, s, th.night ? "#2b385c" : "#78b886", "transparent");
    }
    ctx.globalAlpha = 1;
    drawFireflies(w, h);
  }

  function drawBoard() {
    const lv = scene.level;
    if (!lv) return;
    ensureAnimations();
    const { x, y, w, h, cell } = view;
    const pad = cell * 0.64;

    ctx.drawImage(ensureBoardCache(lv), 0, 0, W, H);

    // beams
    if (scene.trace) drawBeams();

    // portals below walls/elements
    for (let i = 0; i < (lv.portals || []).length; i++) {
      const p = lv.portals[i];
      drawPortal(p.x, p.y, i);
    }

    // walls
    for (const wl of lv.walls || []) drawWall(wl.x, wl.y, wl.kind);

    // splitters
    for (let i = 0; i < (lv.splitters || []).length; i++) {
      const s = lv.splitters[i];
      drawSplitter(s.x, s.y);
    }

    // mirrors
    for (let i = 0; i < (lv.mirrors || []).length; i++) {
      const m = lv.mirrors[i];
      const target = targetAngle(levelMirrorState(i));
      mirrorAngles[i] += (target - mirrorAngles[i]) * 0.16;
      const p = cellCenter(m.x, m.y);
      const hint = scene.hintIndex === i && performance.now() < scene.hintUntil;
      drawMirrorAt(p.x, p.y, cell * 0.38, mirrorAngles[i], !m.fixed, mirrorPulse[i], hint, i);
      mirrorPulse[i] *= 0.9;
    }

    // flowers
    for (let i = 0; i < (lv.flowers || []).length; i++) {
      const f = lv.flowers[i];
      const target = scene.lit.has(i) ? 1 : 0;
      flowerBloom[i] += (target - flowerBloom[i]) * 0.12;
      const p = cellCenter(f.x, f.y);
      drawFlowerAt(p.x, p.y, cell * 0.36, f.type || "sun", scene.lit.has(i), flowerBloom[i], i);
    }

    // sources
    for (let i = 0; i < lv.sources.length; i++) drawSource(lv.sources[i], i);

    // selected cell (keyboard / pointer focus)
    const selMirror = scene.selected && scene.selected.x >= 0
      ? lv.mirrors.findIndex((m) => m.x === scene.selected.x && m.y === scene.selected.y)
      : -1;
    const hintActive = scene.hintIndex >= 0 && performance.now() < scene.hintUntil;
    if (scene.selected && scene.selected.x >= 0 && !(hintActive && selMirror === scene.hintIndex)) {
      const p = cellCenter(scene.selected.x, scene.selected.y);
      ctx.save();
      ctx.setLineDash([cell * 0.09, cell * 0.07]);
      ctx.lineDashOffset = -t * 18;
      strokeRR(p.x - cell * 0.42, p.y - cell * 0.42, cell * 0.84, cell * 0.84, cell * 0.18, "rgba(142,119,214,0.9)", Math.max(2, cell * 0.03));
      ctx.restore();
    }

    // bunny peeking at the lower-left corner of the plot
    const bs = Math.max(14, cell * 0.72);
    const bx = x - pad * 0.35;
    const by = y + h + pad * 0.5;
    drawBunny(bx, by, bs, scene.solved ? "happy" : scene.paused ? "sleep" : "idle", 0.95);

    // goal label above board? kept in DOM
    drawParticles();
  }

  function ensureBoardCache(lv) {
    const key = [lv.id, view.x, view.y, view.cell, scene.chapter, DPR, W, H].join(":");
    if (boardCache && boardKey === key) return boardCache;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(W * DPR));
    c.height = Math.max(1, Math.round(H * DPR));
    const g = c.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const old = ctx;
    ctx = g;
    drawBoardStatic(lv);
    ctx = old;
    boardCache = c;
    boardKey = key;
    return c;
  }

  function drawBoardStatic(lv) {
    const { x, y, w, h, cell } = view;
    const pad = cell * 0.64;

    // board shadow
    ctx.save();
    ctx.translate(0, cell * 0.13);
    fillRR(x - pad * 0.28, y - pad * 0.28, w + pad * 0.56, h + pad * 0.56, cell * 0.5, "rgba(43,42,74,0.16)");
    ctx.restore();

    // stone frame
    fillRR(x - pad * 0.42, y - pad * 0.42, w + pad * 0.84, h + pad * 0.84, cell * 0.55, "#d7c8a8");
    strokeRR(x - pad * 0.42, y - pad * 0.42, w + pad * 0.84, h + pad * 0.84, cell * 0.55, C.ink, Math.max(2, cell * 0.035));
    fillRR(x - pad * 0.26, y - pad * 0.26, w + pad * 0.52, h + pad * 0.52, cell * 0.44, "#b9dfa9");

    // tiles
    for (let gy = 0; gy < lv.rows; gy++) {
      for (let gx = 0; gx < lv.cols; gx++) {
        const tx = x + gx * cell + cell * 0.035;
        const ty = y + gy * cell + cell * 0.035;
        const tw = cell * 0.93;
        const alt = (gx + gy) % 2 === 0;
        const base = theme().night ? (alt ? "#3f5b58" : "#395350") : (alt ? "#a8dba1" : "#9ed399");
        fillRR(tx, ty, tw, tw, cell * 0.16, base);
        fillRR(tx + cell * 0.035, ty + cell * 0.03, tw - cell * 0.07, tw * 0.4, cell * 0.13, "rgba(255,255,255,0.08)");
        if ((gx * 7 + gy * 11) % 9 === 0) {
          ctx.globalAlpha = 0.25;
          ellipse(tx + tw * 0.7, ty + tw * 0.7, cell * 0.09, cell * 0.045, C.greenDeep, 0.6);
          ctx.globalAlpha = 1;
        }
      }
    }

    // decor
    for (const d of lv.decor || []) {
      const p = cellCenter(d.x, d.y);
      if (d.kind === "grass") {
        ctx.strokeStyle = theme().night ? "#6f8c72" : "rgba(62,125,85,0.55)";
        ctx.lineWidth = Math.max(1.2, cell * 0.025);
        ctx.lineCap = "round";
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(p.x + i * cell * 0.1, p.y + cell * 0.22);
          ctx.quadraticCurveTo(p.x + i * cell * 0.18, p.y + cell * 0.05, p.x + i * cell * 0.22, p.y - cell * 0.08);
          ctx.stroke();
        }
      } else {
        ctx.globalAlpha = 0.5;
        ellipse(p.x, p.y + cell * 0.15, cell * 0.11, cell * 0.07, "#8b86a8");
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawBeams() {
    const lv = scene.level;
    if (!lv) return;
    const paths = scene.trace.paths || [];
    for (const path of paths) {
      if (!path.pts || path.pts.length < 1) continue;
      drawBeamPolyline(path.pts, path.type);
    }
    // source-to-entry beams
    for (const src of lv.sources) {
      const entry = src.dir === "R" ? { x: 0, y: src.y } : src.dir === "L" ? { x: lv.cols - 1, y: src.y } : src.dir === "D" ? { x: src.x, y: 0 } : { x: src.x, y: lv.rows - 1 };
      const e = cellCenter(entry.x, entry.y);
      let sx, sy;
      if (src.dir === "R") { sx = view.x - view.cell * 0.52; sy = e.y; }
      else if (src.dir === "L") { sx = view.x + view.w + view.cell * 0.52; sy = e.y; }
      else if (src.dir === "D") { sx = e.x; sy = view.y - view.cell * 0.52; }
      else { sx = e.x; sy = view.y + view.h + view.cell * 0.52; }
      drawBeamSegment(sx, sy, e.x, e.y, src.type);
    }
  }

  function beamColors(type) {
    if (type === "moon") return { core: "#e7efff", mid: "rgba(184,206,255,0.55)", glow: "rgba(160,190,255,0.2)", spark: "#dce8ff" };
    return { core: "#fff5c2", mid: "rgba(255,216,109,0.58)", glow: "rgba(255,199,69,0.2)", spark: "#ffe58a" };
  }

  function drawBeamSegment(x1, y1, x2, y2, type) {
    const col = beamColors(type);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = col.glow;
    ctx.lineWidth = Math.max(5, view.cell * 0.16);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = col.mid;
    ctx.lineWidth = Math.max(2.2, view.cell * 0.065);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = col.core;
    ctx.lineWidth = Math.max(1.1, view.cell * 0.025);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();

    // moving spark
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len > 12) {
      const k = ((t * 0.45 + (x1 + y1) * 0.002) % 1);
      sparkle(x1 + dx * k, y1 + dy * k, Math.max(2, view.cell * 0.055), col.spark, 0.8);
    }
  }

  function drawBeamPolyline(pts, type) {
    const col = beamColors(type);
    const centers = pts.map((p) => cellCenter(p.x, p.y));
    if (centers.length < 1) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = col.glow;
    ctx.lineWidth = Math.max(5, view.cell * 0.16);
    ctx.beginPath();
    ctx.moveTo(centers[0].x, centers[0].y);
    for (let i = 1; i < centers.length; i++) ctx.lineTo(centers[i].x, centers[i].y);
    ctx.stroke();
    ctx.strokeStyle = col.mid;
    ctx.lineWidth = Math.max(2.2, view.cell * 0.065);
    ctx.stroke();
    ctx.strokeStyle = col.core;
    ctx.lineWidth = Math.max(1.1, view.cell * 0.025);
    ctx.stroke();
    ctx.restore();

    // sparkles along the path
    let acc = 0;
    for (let i = 1; i < centers.length; i++) {
      const a = centers[i - 1], b = centers[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      acc += len;
      if (acc > view.cell * 0.9) {
        acc = 0;
        const k = (t * 0.3 + i * 0.37) % 1;
        sparkle(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, Math.max(1.5, view.cell * 0.045), col.spark, 0.55);
      }
    }
  }

  function drawSource(src, index) {
    const lv = scene.level;
    let x, y;
    if (src.dir === "R") { x = view.x - view.cell * 0.52; y = view.y + (src.y + 0.5) * view.cell; }
    else if (src.dir === "L") { x = view.x + view.w + view.cell * 0.52; y = view.y + (src.y + 0.5) * view.cell; }
    else if (src.dir === "D") { x = view.x + (src.x + 0.5) * view.cell; y = view.y - view.cell * 0.52; }
    else { x = view.x + (src.x + 0.5) * view.cell; y = view.y + view.h + view.cell * 0.52; }
    const s = view.cell * 0.3;
    if (src.type === "moon") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.5 + index) * 0.08);
      circle(0, 0, s, "#dfe8ff");
      circle(s * 0.34, -s * 0.16, s * 0.9, theme().skyTop);
      ctx.globalAlpha = 0.8;
      circle(-s * 0.3, s * 0.22, s * 0.1, "#b9c8ff");
      circle(s * 0.2, s * 0.45, s * 0.07, "#b9c8ff");
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.15 + index);
      for (let i = 0; i < 10; i++) {
        ctx.rotate(Math.PI / 5);
        fillRR(s * 1.05, -s * 0.07, s * 0.34, s * 0.14, s * 0.07, "rgba(255,208,90,0.55)");
      }
      ctx.restore();
      circle(x, y, s, "#ffd86d");
      circle(x - s * 0.22, y - s * 0.16, s * 0.7, "rgba(255,246,180,0.38)");
      circle(x - s * 0.24, y - s * 0.04, s * 0.07, C.ink);
      circle(x + s * 0.24, y - s * 0.04, s * 0.07, C.ink);
      ctx.beginPath();
      ctx.arc(x, y + s * 0.12, s * 0.25, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1.2, s * 0.08);
      ctx.stroke();
    }
  }

  function drawMirrorAt(x, y, s, angle, rotatable, pulse, hint, index) {
    // shadow & base
    ellipse(x, y + s * 0.92, s * 1.0, s * 0.28, "rgba(43,42,74,0.18)");
    fillRR(x - s * 0.7, y + s * 0.55, s * 1.4, s * 0.42, s * 0.2, "#b9a888");
    strokeRR(x - s * 0.7, y + s * 0.55, s * 1.4, s * 0.42, s * 0.2, C.ink, Math.max(1.2, s * 0.06));
    // frame
    circle(x, y, s, "#f5d67d");
    circle(x, y, s * 0.86, "#d9b45a");
    circle(x, y, s * 0.76, "#cfeeff");
    // glass
    circle(x, y, s * 0.76, "#cfeeff");
    ctx.globalAlpha = 0.55;
    circle(x - s * 0.22, y - s * 0.24, s * 0.42, "#ffffff");
    circle(x + s * 0.2, y + s * 0.28, s * 0.34, "#bfe8d0");
    ctx.globalAlpha = 1;
    // shine
    ctx.globalAlpha = 0.55;
    ellipse(x - s * 0.25, y - s * 0.28, s * 0.24, s * 0.13, "#fff", -0.6);
    ctx.globalAlpha = 1;
    // line
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = "#2b2a4a";
    ctx.lineWidth = Math.max(2.2, s * 0.13);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.52, 0);
    ctx.lineTo(s * 0.52, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(-s * 0.48, -s * 0.04);
    ctx.lineTo(s * 0.48, -s * 0.04);
    ctx.stroke();
    ctx.restore();
    // badge
    if (rotatable) {
      ctx.save();
      ctx.translate(x + s * 0.76, y - s * 0.68);
      circle(0, 0, s * 0.3, C.paper);
      circle(0, 0, s * 0.24, C.gold);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, s * 0.055);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.12, -2.2, 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.11, -s * 0.1);
      ctx.lineTo(s * 0.17, s * 0.02);
      ctx.lineTo(s * 0.03, s * 0.01);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x + s * 0.76, y - s * 0.68);
      circle(0, 0, s * 0.26, C.paper);
      fillRR(-s * 0.1, -s * 0.03, s * 0.2, s * 0.16, s * 0.04, C.inkSoft);
      ctx.strokeStyle = C.inkSoft;
      ctx.lineWidth = Math.max(1, s * 0.045);
      ctx.beginPath();
      ctx.arc(0, -s * 0.04, s * 0.1, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
    }
    if (pulse > 0.02) {
      ctx.save();
      ctx.globalAlpha = pulse * 0.6;
      circle(x, y, s * (1.1 + (1 - pulse) * 0.5), "rgba(255,255,255,0)");
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = s * 0.13 * pulse;
      ctx.beginPath();
      ctx.arc(x, y, s * (1.1 + (1 - pulse) * 0.34), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (hint) {
      const k = 0.5 + 0.5 * Math.sin(t * 4.5);
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = C.coral;
      ctx.lineWidth = Math.max(2, s * 0.1);
      ctx.beginPath();
      ctx.arc(x, y, s * (1.12 + k * 0.12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // little arrow
      const ay = y - s * (1.8 + k * 0.12);
      ctx.save();
      ctx.translate(x, ay);
      ctx.fillStyle = C.coral;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.28);
      ctx.lineTo(-s * 0.22, -s * 0.05);
      ctx.lineTo(-s * 0.08, -s * 0.05);
      ctx.lineTo(-s * 0.08, -s * 0.3);
      ctx.lineTo(s * 0.08, -s * 0.3);
      ctx.lineTo(s * 0.08, -s * 0.05);
      ctx.lineTo(s * 0.22, -s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlowerAt(x, y, s, type, lit, bloom, index) {
    const moon = type === "moon";
    const petal = moon ? (lit ? "#b9a9ff" : "#b9afd7") : (lit ? "#ff9b82" : "#d7a49d");
    const petal2 = moon ? (lit ? "#d8ccff" : "#cfc6e6") : (lit ? "#ffc09d" : "#e8b8ae");
    const center = moon ? (lit ? "#eef4ff" : "#e2e8f2") : (lit ? "#ffd05a" : "#e8dcc2");
    const stem = moon ? "#5f7390" : C.greenDeep;
    const sway = Math.sin(t * 1.1 + index) * 0.03;
    const b = lit ? Math.max(0.55, bloom) : 0.55;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    // shadow
    ellipse(0, s * 0.92, s * 0.5, s * 0.16, "rgba(43,42,74,0.18)");
    // stem
    ctx.strokeStyle = stem;
    ctx.lineWidth = Math.max(1.5, s * 0.11);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.quadraticCurveTo(-s * 0.06, s * 0.25, 0, -s * 0.2);
    ctx.stroke();
    // leaves
    ellipse(-s * 0.24, s * 0.55, s * 0.23, s * 0.1, moon ? "#7890a6" : C.green, -0.5);
    ellipse(s * 0.22, s * 0.68, s * 0.2, s * 0.09, moon ? "#6e859b" : C.green, 0.5);
    // glow
    if (lit) {
      const sprite = moon ? glowSprite("flowerMoon", 190, 210, 255, 0.5) : glowSprite("flowerSun", 255, 214, 109, 0.55);
      ctx.drawImage(sprite, -s * 1.6, -s * 1.9, s * 3.2, s * 3.2);
    }
    // petals
    const cy = -s * 0.35;
    ctx.translate(0, cy);
    ctx.scale(b, b);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.sin(t * 0.5 + index) * 0.02;
      ellipse(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36, s * 0.3, s * 0.16, i % 2 ? petal2 : petal, a);
    }
    // center
    circle(0, 0, s * 0.24, center);
    circle(-s * 0.06, -s * 0.07, s * 0.08, "rgba(255,255,255,0.55)");
    if (lit) {
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 3; i++) {
        const a = t * 0.8 + i * 2.1 + index;
        sparkle(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7, s * 0.08, moon ? "#e7efff" : "#fff5c2", 0.6);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawSplitter(gx, gy) {
    const p = cellCenter(gx, gy);
    const s = view.cell * 0.36;
    ctx.drawImage(glowSprite("splitter", 201, 182, 245, 0.42), p.x - s * 2.4, p.y - s * 2.4, s * 4.8, s * 4.8);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    fillRR(-s * 0.56, -s * 0.56, s * 1.12, s * 1.12, s * 0.18, "#a995ee");
    strokeRR(-s * 0.56, -s * 0.56, s * 1.12, s * 1.12, s * 0.18, C.ink, Math.max(1.4, s * 0.07));
    fillRR(-s * 0.34, -s * 0.34, s * 0.68, s * 0.68, s * 0.12, "rgba(255,255,255,0.34)");
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1, s * 0.07);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * s * 0.25, p.y + Math.sin(a) * s * 0.25);
      ctx.lineTo(p.x + Math.cos(a) * s * 0.75, p.y + Math.sin(a) * s * 0.75);
      ctx.stroke();
    }
  }

  function drawPortal(gx, gy, index) {
    const p = cellCenter(gx, gy);
    const s = view.cell * 0.34;
    const hue = "142,119,214";
    ctx.drawImage(glowSprite("portal", 142, 119, 214, 0.35), p.x - s * 2.2, p.y - s * 2.2, s * 4.4, s * 4.4);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(t * 0.6 + index);
    ctx.strokeStyle = "#8e77d6";
    ctx.lineWidth = Math.max(2, s * 0.13);
    ctx.setLineDash([s * 0.35, s * 0.18]);
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    circle(p.x, p.y, s * 0.68, "rgba(63,55,105,0.82)");
    ctx.strokeStyle = "#c9b6f5";
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath();
    ctx.arc(p.x, p.y, s * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-t * 0.9 + index);
    ctx.strokeStyle = "rgba(223,232,255,0.75)";
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.38, 0.2, Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.2, Math.PI, Math.PI * 2.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawWall(gx, gy, kind) {
    const p = cellCenter(gx, gy);
    const s = view.cell * 0.38;
    if (kind === "bush") {
      drawBush(p.x, p.y + s * 0.3, s * 0.9, theme().night ? "#416b58" : "#6fb47c", "transparent");
      ctx.globalAlpha = 0.55;
      circle(p.x - s * 0.3, p.y - s * 0.1, s * 0.09, C.coral);
      circle(p.x + s * 0.35, p.y + s * 0.08, s * 0.08, C.coral);
      ctx.globalAlpha = 1;
    } else {
      ctx.save();
      ctx.translate(p.x, p.y + s * 0.1);
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, s * 0.4);
      ctx.quadraticCurveTo(-s * 0.85, -s * 0.3, -s * 0.2, -s * 0.65);
      ctx.quadraticCurveTo(s * 0.55, -s * 0.8, s * 0.8, -s * 0.1);
      ctx.quadraticCurveTo(s * 0.9, s * 0.45, s * 0.25, s * 0.5);
      ctx.closePath();
      ctx.fillStyle = theme().night ? "#5a6484" : "#9b9bb5";
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1.3, s * 0.06);
      ctx.stroke();
      ellipse(-s * 0.2, -s * 0.3, s * 0.24, s * 0.12, "rgba(255,255,255,0.25)", -0.4);
      ellipse(s * 0.3, s * 0.22, s * 0.18, s * 0.08, theme().night ? "#546b63" : "#6f9a72", 0.3);
      ctx.restore();
    }
  }

  function drawBunny(x, y, s, mood, alpha) {
    const happy = mood === "happy";
    const sleep = mood === "sleep";
    const bounce = happy ? Math.abs(Math.sin(t * 5)) * s * 0.16 : Math.sin(t * 1.6) * s * 0.022;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.translate(x, y - bounce);
    ellipse(0, s * 0.13, s * 0.66, s * 0.18, "rgba(43,42,74,0.2)");

    // feet
    const foot = (fx, rot) => {
      ctx.save();
      ctx.translate(fx, s * 0.02);
      ctx.rotate(rot);
      ellipse(0, 0, s * 0.23, s * 0.13, "#fff6e3");
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.23, s * 0.13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };
    foot(-s * 0.29, -0.12);
    foot(s * 0.29, 0.12);

    // ears behind the head
    const earSwing = Math.sin(t * 1.2) * 0.05;
    const ear = (ex, rot, inner) => {
      ctx.save();
      ctx.translate(ex, -s * 0.98);
      ctx.rotate(rot);
      fillRR(-s * 0.15, -s * 1.02, s * 0.3, s * 1.08, s * 0.15, "#fff6e3");
      strokeRR(-s * 0.15, -s * 1.02, s * 0.3, s * 1.08, s * 0.15, C.ink, Math.max(1.2, s * 0.055));
      fillRR(-s * 0.08, -s * 0.89, s * 0.16, s * 0.75, s * 0.08, inner);
      ctx.restore();
    };
    ear(-s * 0.25, -0.16 + earSwing, "#ffc0bd");
    ear(s * 0.25, 0.15 - earSwing, "#ffc0bd");

    // body
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 0.7);
    ctx.bezierCurveTo(-s * 0.66, -s * 0.24, -s * 0.56, s * 0.06, 0, s * 0.12);
    ctx.bezierCurveTo(s * 0.56, s * 0.06, s * 0.66, -s * 0.24, s * 0.45, -s * 0.7);
    ctx.quadraticCurveTo(0, -s * 0.88, -s * 0.45, -s * 0.7);
    ctx.closePath();
    ctx.fillStyle = "#fff6e3";
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1.2, s * 0.055);
    ctx.stroke();
    // soft belly tint
    ctx.globalAlpha = 0.35;
    ellipse(0, -s * 0.2, s * 0.35, s * 0.3, "#ffe8c4");
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;

    // tail
    circle(s * 0.44, -s * 0.08, s * 0.11, "#fff6e3");
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.arc(s * 0.44, -s * 0.08, s * 0.11, 0, Math.PI * 2);
    ctx.stroke();

    // arms
    const arm = (ax, rot) => {
      ctx.save();
      ctx.translate(ax, -s * 0.38);
      ctx.rotate(rot);
      ellipse(0, 0, s * 0.13, s * 0.25, "#fff6e3");
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, s * 0.045);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.13, s * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };
    arm(-s * 0.5, 0.3);
    arm(s * 0.5, -0.3);

    // apron
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.56);
    ctx.lineTo(s * 0.35, -s * 0.56);
    ctx.lineTo(s * 0.3, s * 0.01);
    ctx.quadraticCurveTo(0, s * 0.13, -s * 0.3, s * 0.01);
    ctx.closePath();
    ctx.fillStyle = "#8ed3a6";
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.stroke();
    // straps
    ctx.strokeStyle = "#6bbd87";
    ctx.lineWidth = Math.max(1.2, s * 0.055);
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 0.54);
    ctx.lineTo(-s * 0.28, -s * 0.72);
    ctx.moveTo(s * 0.24, -s * 0.54);
    ctx.lineTo(s * 0.28, -s * 0.72);
    ctx.stroke();
    // pocket
    fillRR(-s * 0.13, -s * 0.26, s * 0.26, s * 0.2, s * 0.05, "#a9e0b9");
    ctx.strokeStyle = "#5e9e6d";
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.strokeRect(-s * 0.13, -s * 0.26, s * 0.26, s * 0.2);
    circle(0, -s * 0.16, s * 0.035, C.gold);
    ctx.restore();

    // scarf
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.72, s * 0.43, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.coral;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.25, -s * 0.67);
    ctx.quadraticCurveTo(s * 0.42, -s * 0.48, s * 0.32, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.42, s * 0.16, -s * 0.64);
    ctx.closePath();
    ctx.fillStyle = "#ff9184";
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.stroke();
    ctx.restore();

    // head
    circle(0, -s * 1.12, s * 0.56, "#fff6e3");
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1.2, s * 0.055);
    ctx.beginPath();
    ctx.arc(0, -s * 1.12, s * 0.56, 0, Math.PI * 2);
    ctx.stroke();
    // muzzle
    ellipse(0, -s * 1.01, s * 0.23, s * 0.16, "#fffdf7");
    // eyes
    const blink = Math.sin(t * 0.9 + 1) > 0.96 ? 0.15 : 1;
    if (sleep) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, s * 0.045);
      ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 1.2); ctx.quadraticCurveTo(-s * 0.18, -s * 1.15, -s * 0.1, -s * 1.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 1.2); ctx.quadraticCurveTo(s * 0.18, -s * 1.15, s * 0.26, -s * 1.2); ctx.stroke();
    } else {
      ellipse(-s * 0.21, -s * 1.18, s * 0.055, s * 0.09 * blink, C.ink);
      ellipse(s * 0.21, -s * 1.18, s * 0.055, s * 0.09 * blink, C.ink);
      if (blink > 0.5) {
        circle(-s * 0.19, -s * 1.21, s * 0.018, "#fff");
        circle(s * 0.23, -s * 1.21, s * 0.018, "#fff");
      }
    }
    // nose and mouth
    ctx.beginPath();
    ctx.moveTo(-s * 0.04, -s * 1.02);
    ctx.lineTo(s * 0.04, -s * 1.02);
    ctx.lineTo(0, -s * 0.97);
    ctx.closePath();
    ctx.fillStyle = "#ff9b8c";
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1, s * 0.032);
    ctx.beginPath();
    if (happy) ctx.arc(0, -s * 0.98, s * 0.1, 0.2, Math.PI - 0.2);
    else {
      ctx.moveTo(-s * 0.07, -s * 0.96);
      ctx.quadraticCurveTo(0, -s * 0.9, s * 0.07, -s * 0.96);
    }
    ctx.stroke();
    // cheeks
    ctx.globalAlpha = 0.5;
    ellipse(-s * 0.34, -s * 1.05, s * 0.09, s * 0.045, "#ffb2a8");
    ellipse(s * 0.34, -s * 1.05, s * 0.09, s * 0.045, "#ffb2a8");
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    // whiskers
    ctx.strokeStyle = "rgba(43,42,74,0.35)";
    ctx.lineWidth = Math.max(0.8, s * 0.022);
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 1.0); ctx.lineTo(-s * 0.46, -s * 1.02);
    ctx.moveTo(-s * 0.22, -s * 0.96); ctx.lineTo(-s * 0.46, -s * 0.94);
    ctx.moveTo(s * 0.22, -s * 1.0); ctx.lineTo(s * 0.46, -s * 1.02);
    ctx.moveTo(s * 0.22, -s * 0.96); ctx.lineTo(s * 0.46, -s * 0.94);
    ctx.stroke();
    // inner ear highlight
    ctx.globalAlpha = 0.4;
    ellipse(-s * 0.25, -s * 1.55, s * 0.05, s * 0.3, "#ffd7d4", -0.16);
    ellipse(s * 0.25, -s * 1.55, s * 0.05, s * 0.3, "#ffd7d4", 0.15);
    ctx.restore();
  }

  function drawPromoSun(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.12);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      fillRR(r * 1.08, -r * 0.09, r * 0.38, r * 0.17, r * 0.08, "rgba(255,208,90,0.62)");
    }
    ctx.restore();
    ctx.drawImage(glowSprite("promoSunGlow", 255, 225, 140, 0.4), x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    circle(x, y, r, "#ffd86d");
    circle(x - r * 0.28, y - r * 0.2, r * 0.72, "rgba(255,246,180,0.35)");
    circle(x - r * 0.26, y - r * 0.06, r * 0.07, C.ink);
    circle(x + r * 0.26, y - r * 0.06, r * 0.07, C.ink);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.1, r * 0.26, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function drawPromoBeam(pts, width) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = "rgba(255,199,69,0.24)";
    ctx.lineWidth = width * 2.6;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,220,120,0.55)";
    ctx.lineWidth = width * 1.15;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,250,215,0.95)";
    ctx.lineWidth = Math.max(2, width * 0.3);
    ctx.stroke();
    ctx.restore();
  }

  function drawPromoSparkles(w, h, seed) {
    const rng = rand(seed || 91);
    for (let i = 0; i < 9; i++) {
      const x = w * (0.12 + rng() * 0.78);
      const y = h * (0.12 + rng() * 0.72);
      const r = 1.6 + rng() * 3.4;
      ctx.globalAlpha = 0.45 + rng() * 0.4;
      sparkle(x, y, r, i % 3 === 0 ? "#fff1b8" : "#ffe58a", 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function drawPromo() {
    const mode = scene.promo;
    const w = W, h = H;
    if (mode === "icon" || mode === "icon-maskable") {
      const mask = mode === "icon-maskable";
      const k = mask ? 0.76 : 1;
      const cx = w / 2;
      const cy = h / 2;
      const X = (n) => cx + (n * w - cx) * k;
      const Y = (n) => cy + (n * h - cy) * k;

      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#dff4ff");
      g.addColorStop(0.55, "#fff0bd");
      g.addColorStop(1, "#ffb987");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // quiet meadow at the bottom
      ctx.fillStyle = "#b8e3b5";
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.82);
      ctx.bezierCurveTo(w * 0.24, h * 0.72, w * 0.52, h * 0.92, w * 0.74, h * 0.8);
      ctx.bezierCurveTo(w * 0.88, h * 0.73, w * 0.95, h * 0.84, w, h * 0.8);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(149,207,159,0.72)";
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.92);
      ctx.bezierCurveTo(w * 0.3, h * 0.84, w * 0.62, h * 0.98, w, h * 0.88);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      drawPromoSparkles(w, h, mask ? 17 : 11);

      const mx = X(0.24);
      const my = Y(0.68);
      const fx = X(0.76);
      const fy = Y(0.68);
      drawPromoBeam([[mx, my], [fx, my]], w * 0.019 * k);

      drawPromoSun(X(0.5), Y(0.32), w * 0.16 * k);
      drawMirrorAt(mx, my, w * 0.105 * k, -Math.PI / 4, true, 0, false, 0);
      drawFlowerAt(fx, fy, w * 0.11 * k, "sun", true, 1, 0);
      drawBunny(X(0.5), mask ? Y(0.9) : Y(0.95), w * (mask ? 0.09 : 0.09) * k, "happy", 1);
      return;
    }

    // cover / hero
    const hero = mode === "hero";
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#dff4ff");
    g.addColorStop(0.5, "#fff3cf");
    g.addColorStop(1, "#ffc59d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // hills
    ctx.fillStyle = "#b8e3b5";
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.72);
    ctx.bezierCurveTo(w * 0.22, h * 0.58, w * 0.5, h * 0.86, w * 0.7, h * 0.68);
    ctx.bezierCurveTo(w * 0.86, h * 0.54, w * 0.94, h * 0.74, w, h * 0.66);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#95cf9f";
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.86);
    ctx.bezierCurveTo(w * 0.28, h * 0.78, w * 0.54, h * 0.94, w * 0.74, h * 0.82);
    ctx.bezierCurveTo(w * 0.9, h * 0.73, w * 0.96, h * 0.88, w, h * 0.84);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    drawPromoSparkles(w, h, hero ? 31 : 23);
    drawPromoSun(w * 0.84, h * 0.19, Math.min(w, h) * 0.09);

    const mx = w * (hero ? 0.56 : 0.57);
    const my = h * 0.58;
    const fx = w * (hero ? 0.78 : 0.8);
    drawPromoBeam([[mx, my], [fx, h * 0.58]], h * 0.013);

    bigFlower(w * 0.09, h * 0.86, h * 0.14, C.coral, C.gold, 1);
    bigFlower(w * 0.93, h * 0.92, h * 0.12, C.lav, C.silver, 2);

    const bs = h * (hero ? 0.17 : 0.2);
    drawBunny(w * (hero ? 0.24 : 0.22), h * 0.92, bs, "happy", 1);
    drawMirrorAt(mx, my, h * 0.11, -Math.PI / 4, true, 0, false, 0);
    drawFlowerAt(fx, h * 0.58, h * 0.13, "sun", true, 1, 0);

    // title
    const titleSize = h * (hero ? 0.19 : 0.2);
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `900 ${titleSize}px Nunito, "Trebuchet MS", sans-serif`;
    ctx.save();
    ctx.shadowColor = "rgba(255,253,247,0.9)";
    ctx.shadowBlur = h * 0.02;
    ctx.fillText(promoTitle[0], w * 0.06, h * 0.1);
    ctx.fillStyle = "#d98314";
    ctx.fillText(promoTitle[1], w * 0.06, h * 0.1 + titleSize * 0.86);
    ctx.restore();
    const subSize = h * 0.035;
    ctx.font = `800 ${subSize}px Nunito, "Trebuchet MS", sans-serif`;
    ctx.fillStyle = C.inkSoft;
    ctx.fillText(promoSub, w * 0.062, h * 0.1 + titleSize * 1.78);
  }

  function frame(dt) {
    if (!ctx) return;
    t += dt;
    updateParticles(dt);
    ctx.clearRect(0, 0, W, H);
    if (scene.promo) {
      drawPromo();
      return;
    }
    drawSky(W, H);
    if (scene.screen === "menu") drawMenuScene();
    else if (scene.screen === "levels") drawLevelBackdrop();
    else if (scene.screen === "game") drawBoard();
    else drawLevelBackdrop();
  }

  function setPromo(mode, title, sub) {
    scene.promo = mode || null;
    if (title) promoTitle = title;
    if (sub) promoSub = sub;
  }

  function reset() {
    levelKey = "";
    mirrorAngles = [];
    mirrorPulse = [];
    flowerBloom = [];
    particles.length = 0;
  }

  window.GameRender = {
    init,
    reset,
    resize,
    setScene,
    setMenuRect,
    layout,
    getView,
    hitTest,
    pulseMirror,
    spawnBurst,
    setPromo,
    drawPromo,
    getViewState: () => view,
    getCanvas: () => canvas,
  };
})();
