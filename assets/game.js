(function () {
  "use strict";

  const VERSION = "1.0.0";
  const SAVE_KEY = "gardenOfRays.save.v1";
  const LEVELS = window.LEVELS || [];
  const LEVEL_MAP = new Map(LEVELS.map((l) => [l.id, l]));
  const CHAPTERS = 4;
  const PER_CHAPTER = 10;
  const TOTAL_LEVELS = 40;
  const LEADERBOARD = "garden_stars";

  const PROMO_TITLES = {
    ru: ["Сад", "Лучей"],
    en: ["Garden", "of Rays"],
    tr: ["Işık", "Bahçesi"],
  };
  const PROMO_SUBS = {
    ru: "Уютная головоломка",
    en: "A cozy little puzzle",
    tr: "Huzurlu bir bulmaca",
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_LOCK = '<svg class="tab-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/></svg>';
  const ICON_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.2l6.2-.9L12 2.6Z"/></svg>';

  function starUnit(n) {
    if (S.lang === "ru") return I18N.count("ru", n, "звезда", "звёзды", "звёзд");
    if (S.lang === "tr") return "yıldız";
    return n === 1 ? "star" : "stars";
  }

  function flyUnit(n) {
    if (S.lang === "ru") return I18N.count("ru", n, "светлячок", "светлячка", "светлячков");
    if (S.lang === "tr") return "ateş böceği";
    return n === 1 ? "firefly" : "fireflies";
  }

  function t(key, vars) {
    return I18N.t(S.lang, key, vars);
  }

  function dateKey(d) {
    const x = d || new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }

  function defaultSave() {
    return {
      v: 1,
      unlocked: 1,
      levels: {},
      fireflies: 3,
      daily: { date: null, streak: 0 },
      achievements: [],
      settings: { lang: null, music: true, sfx: true },
      lastLevel: 1,
      resume: null,
      updatedAt: 0,
    };
  }

  const ACHIEVEMENTS = [
    { id: "first_light", icon: "✦", test: (s) => completedCount(s) >= 1, value: (s) => Math.min(completedCount(s), 1), target: 1 },
    { id: "meadow", icon: "❀", test: (s) => chapterDone(s, 0), value: (s) => chapterDoneCount(s, 0), target: 10 },
    { id: "creek", icon: "❋", test: (s) => chapterDone(s, 1), value: (s) => chapterDoneCount(s, 1), target: 10 },
    { id: "hill", icon: "✹", test: (s) => chapterDone(s, 2), value: (s) => chapterDoneCount(s, 2), target: 10 },
    { id: "glasshouse", icon: "☾", test: (s) => chapterDone(s, 3), value: (s) => chapterDoneCount(s, 3), target: 10 },
    { id: "stars30", icon: "★", test: (s) => totalStars(s) >= 30, value: (s) => Math.min(totalStars(s), 30), target: 30 },
    { id: "stars60", icon: "✧", test: (s) => totalStars(s) >= 60, value: (s) => Math.min(totalStars(s), 60), target: 60 },
    { id: "stars90", icon: "✶", test: (s) => totalStars(s) >= 90, value: (s) => Math.min(totalStars(s), 90), target: 90 },
    { id: "perfect10", icon: "◎", test: (s) => perfectCount(s) >= 10, value: (s) => Math.min(perfectCount(s), 10), target: 10 },
    { id: "nohint10", icon: "◈", test: (s) => noHintCount(s) >= 10, value: (s) => Math.min(noHintCount(s), 10), target: 10 },
    { id: "daily3", icon: "☀", test: (s) => (s.daily.streak || 0) >= 3, value: (s) => Math.min(s.daily.streak || 0, 3), target: 3 },
    { id: "collector", icon: "✿", test: (s) => completedCount(s) >= 40, value: (s) => Math.min(completedCount(s), 40), target: 40 },
  ];

  const S = {
    lang: "ru",
    screen: "menu",
    save: null,
    sdk: null,
    player: null,
    playerInfo: null,
    sdkSettled: false,
    readyCalled: false,
    loadingHidden: false,
    promo: null,
    current: null,
    activeChapter: 0,
    modal: null,
    lastFocus: null,
    adActive: false,
    paused: false,
    platformPaused: false,
    lastAdAt: 0,
    cloudTimer: 0,
    lastCloudAt: 0,
    lastScoreAt: 0,
    leaderboardBusy: false,
    gameplayActive: false,
    booted: false,
  };

  const D = {};

  const completedCount = (s) => Object.values(s.levels || {}).filter((v) => v && v.stars > 0).length;
  const totalStars = (s) => Object.values(s.levels || {}).reduce((sum, v) => sum + (v && v.stars > 0 ? v.stars : 0), 0);
  const perfectCount = (s) => Object.values(s.levels || {}).filter((v) => v && v.stars === 3).length;
  const noHintCount = (s) => Object.values(s.levels || {}).filter((v) => v && v.noHint).length;
  const chapterDoneCount = (s, ch) => {
    let n = 0;
    for (let i = 0; i < PER_CHAPTER; i++) {
      const lv = s.levels[ch * PER_CHAPTER + i + 1];
      if (lv && lv.stars > 0) n++;
    }
    return n;
  };
  const chapterDone = (s, ch) => chapterDoneCount(s, ch) === PER_CHAPTER;

  function sanitizeSave(raw) {
    const base = defaultSave();
    if (!raw || typeof raw !== "object") return base;
    const s = Object.assign(base, raw);
    s.unlocked = clamp(Number(s.unlocked) || 1, 1, TOTAL_LEVELS);
    s.fireflies = clamp(Math.floor(Number(s.fireflies) || 0), 0, 999999);
    s.levels = {};
    if (raw.levels && typeof raw.levels === "object") {
      for (const k of Object.keys(raw.levels)) {
        const id = Number(k);
        const v = raw.levels[k];
        if (!LEVEL_MAP.has(id) || !v) continue;
        const stars = clamp(Math.floor(Number(v.stars) || 0), 0, 3);
        if (stars < 1) continue;
        s.levels[id] = {
          stars,
          bestTaps: Math.max(1, Math.floor(Number(v.bestTaps) || LEVEL_MAP.get(id).par + 2)),
          noHint: !!v.noHint,
        };
      }
    }
    s.achievements = Array.isArray(raw.achievements)
      ? [...new Set(raw.achievements.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)))]
      : [];
    s.daily = { date: raw.daily && typeof raw.daily.date === "string" ? raw.daily.date : null, streak: clamp(Math.floor(Number(raw.daily && raw.daily.streak) || 0), 0, 9999) };
    s.settings = {
      lang: ["ru", "en", "tr"].includes(raw.settings && raw.settings.lang) ? raw.settings.lang : null,
      music: !(raw.settings && raw.settings.music === false),
      sfx: !(raw.settings && raw.settings.sfx === false),
    };
    s.lastLevel = clamp(Number(s.lastLevel) || 1, 1, TOTAL_LEVELS);
    s.resume = null;
    if (raw.resume && typeof raw.resume === "object") {
      const id = Number(raw.resume.id);
      const lv = LEVEL_MAP.get(id);
      if (lv && id <= s.unlocked && Array.isArray(raw.resume.bits) && raw.resume.bits.length === lv.mirrors.length) {
        s.resume = { id, bits: raw.resume.bits.map((b) => (b ? 1 : 0)), taps: Math.max(0, Math.floor(Number(raw.resume.taps) || 0)), usedHint: !!raw.resume.usedHint };
      }
    }
    s.updatedAt = Number(s.updatedAt) || 0;
    return s;
  }

  function loadLocalSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? sanitizeSave(JSON.parse(raw)) : defaultSave();
    } catch (e) {
      return defaultSave();
    }
  }

  function saveLocal() {
    try {
      S.save.updatedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(S.save));
    } catch (e) {}
  }

  function persist(cloud, flush) {
    saveLocal();
    if (cloud) queueCloud(!!flush);
  }

  function cacheDom() {
    const ids = [
      "app", "scene", "ui", "loading", "loading-title", "loading-text",
      "screen-menu", "screen-levels", "screen-game", "brand-name",
      "btn-profile", "profile-avatar", "btn-achievements", "btn-settings",
      "menu-eyebrow", "menu-logo", "menu-tagline", "menu-progress-label", "menu-progress-value",
      "menu-progress-bar", "progress-wrap", "menu-progress-wrap", "btn-play", "btn-play-label",
      "btn-levels", "btn-levels-label", "btn-howto", "btn-howto-label",
      "menu-stars", "menu-stars-label", "menu-flies", "menu-flies-label",
      "btn-daily", "daily-title", "daily-sub", "daily-badge", "menu-footnote",
      "screen-levels", "btn-levels-back", "levels-title", "levels-sub", "levels-stars",
      "chapter-tabs", "level-grid", "levels-hint", "btn-levels-reward", "levels-reward-label",
      "screen-game", "btn-game-back", "game-chapter", "game-level", "game-stars", "game-flies",
      "btn-game-pause", "board-frame", "game-panel", "goal-label", "goal-count", "goal-flowers",
      "game-tip", "moves-label", "moves-count", "best-label", "best-count", "par-label", "par-count",
      "btn-hint", "hint-label", "hint-cost", "btn-undo", "undo-label", "btn-reset", "reset-label",
      "game-hintline", "modal-layer", "toast-layer", "menu-scene-space",
    ];
    for (const id of ids) D[id] = $(id);
    D.screens = { menu: D["screen-menu"], levels: D["screen-levels"], game: D["screen-game"] };
    D.modalLayer = $("modal-layer");
    D.toastLayer = $("toast-layer");
  }

  function boot() {
    cacheDom();
    const params = new URLSearchParams(location.search);
    S.promo = params.get("promo");
    S.save = loadLocalSave();
    const urlLang = params.get("lang");
    const initial = urlLang ? I18N.resolveLang(urlLang) : (S.save.settings.lang || I18N.resolveLang(navigator.language));
    S.lang = initial;

    GameRender.init(D.scene);
    bindGlobalEvents();
    setupResizeObservers();
    applyLang(S.lang, true);

    if (S.promo) {
      setupPromo();
      return;
    }

    renderAll();
    requestAnimationFrame(() => {
      updateMenuRect();
      updateScene();
    });
    hideLoading();
    loadSDK().finally(() => {
      S.sdkSettled = true;
      maybeReady();
    });
    window.setTimeout(() => {
      S.sdkSettled = true;
      maybeReady();
    }, 6500);
  }

  function setupPromo() {
    S.promo = (S.promo || "").toLowerCase();
    document.body.classList.add("promo");
    D.loading.classList.add("done");
    S.loadingHidden = true;
    const title = PROMO_TITLES[S.lang] || PROMO_TITLES.ru;
    const sub = PROMO_SUBS[S.lang] || PROMO_SUBS.ru;
    GameRender.setPromo(S.promo, title, sub);
    GameAudio.suspend();
    window.addEventListener("resize", () => GameRender.resize());
  }

  function hideLoading() {
    const start = performance.now();
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => window.setTimeout(r, 900))]).then(() => {
      const wait = Math.max(0, 520 - (performance.now() - start));
      window.setTimeout(() => {
        D.loading.classList.add("done");
        S.loadingHidden = true;
        maybeReady();
      }, wait);
    });
  }

  function maybeReady() {
    if (S.readyCalled || !S.loadingHidden || !S.sdkSettled) return;
    S.readyCalled = true;
    try {
      if (S.sdk && S.sdk.features && S.sdk.features.LoadingAPI) S.sdk.features.LoadingAPI.ready();
    } catch (e) {}
  }

  function applyLang(lang, silent) {
    S.lang = I18N.resolveLang(lang);
    document.documentElement.lang = S.lang;
    document.title = t("brand");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("menu.tagline"));
    D["loading-title"].textContent = t("loading.title");
    D["loading-text"].textContent = t("loading.text");
    D["brand-name"].textContent = t("brand");
    D["menu-eyebrow"].textContent = t("menu.eyebrow");
    D["menu-logo"].innerHTML = t("menu.logo");
    D["menu-tagline"].textContent = t("menu.tagline");
    D["menu-progress-label"].textContent = t("menu.progress");
    D["btn-levels-label"].textContent = t("menu.levels");
    D["btn-howto-label"].textContent = t("menu.howto");
    D["daily-title"].textContent = t("menu.daily.title");
    D["menu-footnote"].textContent = t("menu.footnote");
    D["levels-title"].textContent = t("levels.title");
    D["levels-hint"].textContent = t("levels.hint");
    D["levels-reward-label"].textContent = t("levels.reward");
    D["goal-label"].textContent = t("game.goal");
    D["moves-label"].textContent = t("game.moves");
    D["best-label"].textContent = t("game.best");
    D["par-label"].textContent = t("game.par");
    D["hint-label"].textContent = t("game.hintLabel");
    D["undo-label"].textContent = t("game.undo");
    D["reset-label"].textContent = t("game.reset");
    D["game-hintline"].textContent = t("game.hintline");
    D["btn-profile"].setAttribute("aria-label", t("profile.title"));
    D["btn-achievements"].setAttribute("aria-label", t("ach.title"));
    D["btn-settings"].setAttribute("aria-label", t("common.settings"));
    D["btn-levels-back"].setAttribute("aria-label", t("common.back"));
    D["btn-game-back"].setAttribute("aria-label", t("common.levels"));
    D["btn-game-pause"].setAttribute("aria-label", t("common.pause"));
    D["btn-hint"].setAttribute("aria-label", t("game.hint"));
    if (S.promo) {
      GameRender.setPromo(S.promo, PROMO_TITLES[S.lang] || PROMO_TITLES.ru, PROMO_SUBS[S.lang] || PROMO_SUBS.ru);
    }
    if (!silent) {
      renderAll();
      refreshModal();
    }
  }

  function setLanguage(lang, manual) {
    const code = I18N.resolveLang(lang);
    S.lang = code;
    if (manual) {
      S.save.settings.lang = code;
      persist(true, false);
    }
    applyLang(code, false);
    if (S.screen === "menu") renderMenu();
    if (S.screen === "levels") renderLevels();
    if (S.screen === "game") renderGameUI();
  }

  function renderAll() {
    renderMenu();
    renderLevels();
    if (S.current && S.screen === "game") renderGameUI();
    updateScene();
  }

  function unitPair(n) {
    return { stars: starUnit(n), flies: flyUnit(n) };
  }

  function nextLevelToPlay() {
    const resume = S.save.resume;
    if (resume && LEVEL_MAP.has(resume.id) && resume.id <= S.save.unlocked) return resume.id;
    for (let i = 1; i <= S.save.unlocked; i++) {
      const lv = S.save.levels[i];
      if (!lv || !lv.stars) return i;
    }
    return S.save.unlocked;
  }

  function renderMenu() {
    const done = completedCount(S.save);
    const stars = totalStars(S.save);
    const unit = unitPair(S.save.fireflies);
    D["menu-stars"].textContent = stars;
    D["menu-stars-label"].textContent = starUnit(stars);
    D["menu-flies"].textContent = S.save.fireflies;
    D["menu-flies-label"].textContent = flyUnit(S.save.fireflies);
    const pct = Math.round((done / TOTAL_LEVELS) * 100);
    D["menu-progress-value"].textContent = pct + "%";
    D["menu-progress-bar"].style.width = pct + "%";
    const next = nextLevelToPlay();
    const hasProgress = done > 0 || (S.save.resume && !S.save.levels[S.save.resume.id]);
    if (hasProgress && done < TOTAL_LEVELS) {
      D["btn-play-label"].textContent = t("menu.continue") + (next ? " · " + next : "");
    } else if (done >= TOTAL_LEVELS) {
      D["btn-play-label"].textContent = t("menu.play");
    } else {
      D["btn-play-label"].textContent = t("menu.play");
    }
    const ready = dailyReady();
    D["btn-daily"].classList.toggle("ready", ready);
    D["daily-sub"].textContent = ready ? t("menu.daily.subReady") : t("menu.daily.subDone");
    D["daily-badge"].style.display = ready ? "block" : "none";
    renderProfilePill();
    if (S.screen === "menu") updateMenuRect();
  }

  function renderProfilePill() {
    const info = S.playerInfo;
    if (info && info.photo) {
      D["profile-avatar"].innerHTML = '<img alt="" src="' + escapeAttr(info.photo) + '">';
    } else if (info && info.name) {
      D["profile-avatar"].textContent = info.name.slice(0, 1).toUpperCase();
    } else {
      D["profile-avatar"].textContent = "Л";
    }
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function renderLevels() {
    const done = completedCount(S.save);
    const current = nextLevelToPlay();
    if (S.activeChapter < 0 || S.activeChapter >= CHAPTERS) S.activeChapter = 0;
    const chapterStart = S.activeChapter * PER_CHAPTER + 1;
    if (S.save.unlocked < chapterStart) S.activeChapter = 0;
    D["levels-sub"].textContent = t("levels.progress", { done, total: TOTAL_LEVELS });
    D["levels-stars"].textContent = totalStars(S.save);
    D["levels-hint"].textContent = t("levels.hint");
    D["levels-reward-label"].textContent = t("levels.reward");
    D["screen-levels"].classList.toggle("night", S.activeChapter === 3);

    D["chapter-tabs"].innerHTML = Array.from({ length: CHAPTERS }, (_, ch) => {
      const locked = S.save.unlocked < ch * PER_CHAPTER + 1;
      const active = ch === S.activeChapter;
      return '<button class="chapter-tab' + (active ? " active" : "") + (locked ? " locked" : "") + '" role="tab" aria-selected="' + active + '" data-ch="' + ch + '">' +
        (locked ? ICON_LOCK : "") + '<span>' + t("chapter." + ch) + "</span></button>";
    }).join("");

    const cells = [];
    for (let i = 0; i < PER_CHAPTER; i++) {
      const id = S.activeChapter * PER_CHAPTER + i + 1;
      const rec = S.save.levels[id];
      const locked = id > S.save.unlocked;
      const isDone = !!(rec && rec.stars);
      const isCurrent = !locked && id === current && !isDone;
      let starsHtml = "";
      if (!locked) {
        starsHtml = '<span class="level-stars">' + [1, 2, 3].map((n) => '<span class="' + (isDone && rec.stars >= n ? "on" : "") + '"></span>').join("") + "</span>";
      }
      cells.push('<button class="level-btn' + (isDone ? " done" : "") + (isCurrent ? " current" : "") + (locked ? " locked" : "") + '" data-level="' + id + '" ' + (locked ? "disabled" : "") + ' aria-label="' + t("common.level") + " " + id + (locked ? ", " + t("common.locked") : "") + '">' +
        (locked ? '<span class="level-lock">' + ICON_LOCK.replace('class="tab-lock" ', "") + "</span>" : '<span class="level-num">' + id + "</span>" + starsHtml) +
        "</button>");
    }
    D["level-grid"].innerHTML = cells.join("");
  }

  function showScreen(name) {
    S.screen = name;
    for (const key in D.screens) D.screens[key].classList.toggle("hidden", key !== name);
    if (name === "menu") {
      renderMenu();
      requestAnimationFrame(updateMenuRect);
    } else if (name === "levels") {
      renderLevels();
    } else if (name === "game") {
      requestAnimationFrame(layoutGame);
    }
    updateScene();
    syncGameplay();
  }

  function updateMenuRect() {
    if (!D["menu-scene-space"]) return;
    const r = D["menu-scene-space"].getBoundingClientRect();
    GameRender.setMenuRect(r);
    GameRender.setScene({ screen: S.screen });
  }

  function layoutGame() {
    if (S.screen !== "game" || !S.current) return;
    const r = D["board-frame"].getBoundingClientRect();
    if (r.width > 2 && r.height > 2) GameRender.layout(r, S.current.level);
    updateScene();
  }

  function updateScene() {
    const cur = S.current;
    const chapter = S.screen === "game" && cur ? cur.level.chapter : (S.screen === "levels" ? S.activeChapter : 0);
    GameRender.setScene({
      screen: S.screen,
      chapter,
      level: S.screen === "game" && cur ? cur.level : null,
      bits: cur ? cur.bits : [],
      trace: cur ? cur.trace : null,
      lit: cur ? cur.lit : new Set(),
      selected: cur && cur.selected ? cur.selected : { x: -1, y: -1 },
      hintIndex: cur ? cur.hintIndex : -1,
      hintUntil: cur ? cur.hintUntil : 0,
      solved: !!(cur && cur.solved),
      paused: S.paused,
      promo: null,
    });
  }

  function setupResizeObservers() {
    const onResize = () => {
      GameRender.resize();
      if (S.screen === "menu") updateMenuRect();
      if (S.screen === "game") {
        requestAnimationFrame(() => {
          layoutGame();
          updateScene();
        });
      } else {
        updateScene();
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", () => window.setTimeout(onResize, 180));
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (S.screen === "game") layoutGame();
        if (S.screen === "menu") updateMenuRect();
      });
      if (D["board-frame"]) ro.observe(D["board-frame"]);
      if (D["menu-scene-space"]) ro.observe(D["menu-scene-space"]);
    }
  }

  /* ---------------- game ---------------- */

  function levelById(id) {
    return LEVEL_MAP.get(Number(id));
  }

  function starsFor(taps, par) {
    if (taps <= par) return 3;
    if (taps <= par + 2) return 2;
    return 1;
  }

  function startLevel(id, opts) {
    const lv = levelById(id);
    if (!lv || id > S.save.unlocked) return;
    opts = opts || {};
    const resume = opts.resume && S.save.resume && S.save.resume.id === id ? S.save.resume : null;
    const bits = new Array(lv.mirrors.length).fill(0);
    let taps = 0;
    let usedHint = false;
    if (resume && resume.bits.length === bits.length) {
      for (let i = 0; i < bits.length; i++) bits[i] = resume.bits[i] ? 1 : 0;
      taps = resume.taps || 0;
      usedHint = !!resume.usedHint;
    }
    const selected = { x: -1, y: -1 };

    S.current = {
      level: lv,
      bits,
      taps,
      history: [],
      trace: null,
      lit: new Set(),
      solved: false,
      finishing: false,
      solvedAt: 0,
      usedHint,
      hintIndex: -1,
      hintUntil: 0,
      selected,
      startedAt: Date.now(),
      fromResume: !!resume,
    };
    S.paused = false;
    S.save.lastLevel = id;
    S.save.resume = { id, bits: bits.slice(), taps, usedHint };
    saveLocal();
    closeModal(false);
    showScreen("game");
    renderGameUI();
    updateScene();
    requestAnimationFrame(() => {
      GameRender.reset();
      layoutGame();
      updateScene();
      recompute(true);
      if (id === 1 && !S.save.levels[1] && !resume) {
        const idx = lv.mirrors.findIndex((m) => !m.fixed);
        if (idx >= 0) {
          S.current.hintIndex = idx;
          S.current.hintUntil = performance.now() + 9000;
          updateScene();
        }
      }
    });
    GameAudio.ensure();
  }

  function recompute(checkWin) {
    const cur = S.current;
    if (!cur) return;
    cur.trace = Puzzle.trace(cur.level, cur.bits);
    cur.lit = cur.trace.lit;
    updateScene();
    renderGameUI();
    if (!cur.solved) {
      S.save.resume = { id: cur.level.id, bits: cur.bits.slice(), taps: cur.taps, usedHint: cur.usedHint };
      saveLocal();
    }
    if (checkWin && !cur.solved && !cur.finishing && cur.level.flowers.every((f, i) => cur.lit.has(i))) {
      onSolved();
    }
  }

  function onSolved() {
    const cur = S.current;
    if (!cur || cur.solved) return;
    cur.solved = true;
    cur.finishing = true;
    cur.solvedAt = performance.now();
    cur.hintIndex = -1;
    S.save.resume = null;
    saveLocal();
    GameAudio.sfx("bloom");
    GameAudio.sfx("star");
    const view = GameRender.getView();
    if (view && view.cell) {
      cur.level.flowers.forEach((f) => {
        const x = view.x + (f.x + 0.5) * view.cell;
        const y = view.y + (f.y + 0.5) * view.cell;
        GameRender.spawnBurst(x, y, f.type === "moon" ? "#dfe8ff" : "#ffd86d", 12, 110);
      });
    }
    updateScene();
    renderGameUI();
    syncGameplay();
    const id = cur.level.id;
    window.setTimeout(() => {
      if (S.current && S.current.level.id === id && S.current.solved) finishLevel();
    }, 880);
  }

  function finishLevel() {
    const cur = S.current;
    if (!cur || !cur.solved) return;
    const lv = cur.level;
    const stars = starsFor(cur.taps, lv.par);
    const old = S.save.levels[lv.id] || { stars: 0, bestTaps: 0, noHint: false };
    const firstClear = !old.stars;
    S.save.levels[lv.id] = {
      stars: Math.max(old.stars || 0, stars),
      bestTaps: old.bestTaps ? Math.min(old.bestTaps, cur.taps) : cur.taps,
      noHint: !!(old.noHint || !cur.usedHint),
    };
    if (firstClear) S.save.fireflies += 1;
    const nextId = lv.id < TOTAL_LEVELS ? lv.id + 1 : null;
    if (nextId && nextId > S.save.unlocked) S.save.unlocked = nextId;
    S.save.lastLevel = lv.id;
    S.save.resume = null;
    S.save.completionsSinceAd = (S.save.completionsSinceAd || 0) + 1;
    const chDone = chapterDone(S.save, lv.chapter);
    const allDone = completedCount(S.save) >= TOTAL_LEVELS;
    const newAch = checkAchievements();
    persist(true, true);
    submitScore();
    cur.finishing = false;
    syncGameplay();
    renderMenu();
    renderLevels();
    const bestStars = S.save.levels[lv.id].stars;
    openModal("complete", {
      levelId: lv.id,
      nextId,
      stars,
      bestStars,
      firstClear,
      chapterDone: chDone,
      final: allDone && lv.id === TOTAL_LEVELS,
      taps: cur.taps,
      par: lv.par,
      newAch,
    }, { pauseGame: false, resume: false, dismiss: false });
  }

  function rotateMirror(index) {
    const cur = S.current;
    if (!cur || cur.solved || S.paused || S.adActive || S.modal) return;
    const lv = cur.level;
    const m = lv.mirrors[index];
    if (!m || m.fixed) {
      GameAudio.sfx("error");
      return;
    }
    cur.history.push({ i: index, bit: cur.bits[index], taps: cur.taps, usedHint: cur.usedHint });
    cur.bits[index] = cur.bits[index] ? 0 : 1;
    cur.taps++;
    cur.hintIndex = -1;
    updateSelectedOnMirror(index);
    GameAudio.sfx("tap");
    GameRender.pulseMirror(index);
    recompute(true);
  }

  function updateSelectedOnMirror(index) {
    const m = S.current.level.mirrors[index];
    if (m) S.current.selected = { x: m.x, y: m.y };
  }

  function undoMove() {
    const cur = S.current;
    if (!cur || cur.solved || S.paused || !cur.history.length) return;
    const h = cur.history.pop();
    cur.bits[h.i] = h.bit;
    cur.taps = h.taps;
    cur.usedHint = h.usedHint;
    GameAudio.sfx("ui");
    recompute(false);
    updateScene();
  }

  function resetLevel() {
    const cur = S.current;
    if (!cur) return;
    cur.bits.fill(0);
    cur.taps = 0;
    cur.history = [];
    cur.usedHint = false;
    cur.solved = false;
    cur.finishing = false;
    cur.hintIndex = -1;
    cur.hintUntil = 0;
    S.paused = false;
    GameAudio.sfx("ui");
    recompute(false);
    syncGameplay();
  }

  function useHint() {
    const cur = S.current;
    if (!cur || cur.solved || S.paused || S.adActive) return;
    if (S.save.fireflies < 1) {
      openModal("no-flies", {}, { dismiss: true });
      return;
    }
    const path = Puzzle.solvePath(cur.level, cur.bits);
    if (!path || !path.length) return;
    S.save.fireflies -= 1;
    cur.usedHint = true;
    cur.hintIndex = path[0];
    cur.hintUntil = performance.now() + 7000;
    GameAudio.sfx("reward");
    toast(t("toast.hint"), "✦");
    persist(true, false);
    updateScene();
    renderGameUI();
  }

  function moveSelection(dx, dy) {
    const cur = S.current;
    if (!cur) return;
    let x;
    let y;
    if (cur.selected.x < 0 || cur.selected.y < 0) {
      const first = cur.level.mirrors.find((m) => !m.fixed) || cur.level.mirrors[0];
      x = first ? first.x : 0;
      y = first ? first.y : 0;
    } else {
      x = clamp(cur.selected.x + dx, 0, cur.level.cols - 1);
      y = clamp(cur.selected.y + dy, 0, cur.level.rows - 1);
    }
    cur.selected = { x, y };
    updateScene();
    GameAudio.sfx("ui");
  }

  function rotateSelected() {
    const cur = S.current;
    if (!cur) return;
    const idx = cur.level.mirrors.findIndex((m) => m.x === cur.selected.x && m.y === cur.selected.y && !m.fixed);
    if (idx >= 0) rotateMirror(idx);
    else GameAudio.sfx("error");
  }

  function renderGameUI() {
    const cur = S.current;
    if (!cur) return;
    const lv = cur.level;
    const litCount = cur.lit ? cur.lit.size : 0;
    const total = lv.flowers.length;
    D["screen-game"].classList.toggle("night", lv.chapter === 3);
    D["game-chapter"].textContent = t("chapter." + lv.chapter);
    D["game-level"].textContent = t("common.level") + " " + lv.id;
    D["goal-count"].textContent = litCount + "/" + total;
    D["goal-flowers"].innerHTML = lv.flowers.map((f, i) => flowerIcon(f.type || "sun", cur.lit && cur.lit.has(i))).join("");
    D["moves-count"].textContent = cur.taps;
    const best = S.save.levels[lv.id] && S.save.levels[lv.id].bestTaps;
    D["best-count"].textContent = best || t("game.noMovesYet");
    D["par-count"].textContent = lv.par;
    D["game-flies"].textContent = S.save.fireflies;
    D["hint-cost"].textContent = "1";
    const potential = cur.solved ? starsFor(cur.taps, lv.par) : starsFor(cur.taps, lv.par);
    D["game-stars"].innerHTML = [1, 2, 3].map((n) => '<span class="' + (potential >= n ? "on" : "") + '"></span>').join("");
    D["game-tip"].textContent = lv.tip ? t("tip." + lv.tip) : t("game.tip");
    D["btn-hint"].disabled = cur.solved;
    D["btn-undo"].disabled = cur.solved || !cur.history.length;
    D["btn-reset"].disabled = cur.solved || (cur.taps === 0 && !cur.usedHint && !cur.history.length);
    D["hint-label"].textContent = t("game.hintLabel");
    D["undo-label"].textContent = t("game.undo");
    D["reset-label"].textContent = t("game.reset");
  }

  function flowerIcon(type, lit) {
    const moon = type === "moon";
    const petal = lit ? (moon ? "#b9a9ff" : "#ff9b82") : "#b9b4cc";
    const center = lit ? (moon ? "#eef4ff" : "#ffd05a") : "#d8d3e4";
    return '<svg class="goal-flower' + (lit ? " lit" : "") + '" viewBox="0 0 40 40" aria-hidden="true">' +
      '<path d="M20 24v11" stroke="' + (lit ? "#5e9e6d" : "#a9a4bc") + '" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="14" cy="31" rx="6" ry="3" fill="' + (lit ? "#5e9e6d" : "#a9a4bc") + '" transform="rotate(-25 14 31)"/>' +
      [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return '<ellipse cx="' + (20 + Math.cos(a) * 7).toFixed(1) + '" cy="' + (16 + Math.sin(a) * 7).toFixed(1) + '" rx="5.2" ry="3.4" fill="' + petal + '" transform="rotate(' + (a * 180 / Math.PI).toFixed(1) + ' ' + (20 + Math.cos(a) * 7).toFixed(1) + ' ' + (16 + Math.sin(a) * 7).toFixed(1) + ')"/>';
      }).join("") +
      '<circle cx="20" cy="16" r="4" fill="' + center + '"/>' +
      '</svg>';
  }

  function syncGameplay() {
    if (!S.sdk || !S.sdk.features || !S.sdk.features.GameplayAPI) return;
    const active = !!(S.screen === "game" && S.current && !S.current.solved && !S.paused && !S.modal && !S.adActive && !S.platformPaused);
    if (S.gameplayActive === active) return;
    S.gameplayActive = active;
    try {
      if (active) S.sdk.features.GameplayAPI.start();
      else S.sdk.features.GameplayAPI.stop();
    } catch (e) {
      S.gameplayActive = !active;
    }
  }

  /* ---------------- input ---------------- */

  function bindGlobalEvents() {
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("selectstart", (e) => e.preventDefault());
    document.addEventListener("dragstart", (e) => e.preventDefault());
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", () => {
      GameAudio.suspend();
    });
    window.addEventListener("focus", () => {
      if (!S.paused && !S.adActive && !S.modal) GameAudio.resume();
    });
    window.addEventListener("pagehide", () => {
      saveLocal();
    });

    D["btn-play"].addEventListener("click", () => {
      GameAudio.ensure();
      const id = nextLevelToPlay();
      startLevel(id, { resume: true });
    });
    D["btn-levels"].addEventListener("click", () => {
      S.activeChapter = Math.floor((nextLevelToPlay() - 1) / PER_CHAPTER);
      showScreen("levels");
      GameAudio.sfx("ui");
    });
    D["btn-howto"].addEventListener("click", () => openModal("howto", {}, { dismiss: true }));
    D["btn-settings"].addEventListener("click", () => openModal("settings", {}, { dismiss: true }));
    D["btn-achievements"].addEventListener("click", () => openModal("achievements", {}, { dismiss: true }));
    D["btn-profile"].addEventListener("click", () => openModal("profile", {}, { dismiss: true }));
    D["btn-daily"].addEventListener("click", () => openModal("daily", {}, { dismiss: true }));
    D["btn-levels-back"].addEventListener("click", () => {
      showScreen("menu");
      GameAudio.sfx("ui");
    });
    D["btn-levels-reward"].addEventListener("click", () => openModal("reward", {}, { dismiss: true }));
    D["btn-game-back"].addEventListener("click", () => {
      if (S.current && !S.current.solved) S.save.resume = { id: S.current.level.id, bits: S.current.bits.slice(), taps: S.current.taps, usedHint: S.current.usedHint };
      saveLocal();
      S.paused = false;
      showScreen("levels");
      GameAudio.sfx("ui");
    });
    D["btn-game-pause"].addEventListener("click", () => openPause());
    D["btn-hint"].addEventListener("click", () => useHint());
    D["btn-undo"].addEventListener("click", () => undoMove());
    D["btn-reset"].addEventListener("click", () => resetLevel());

    D["chapter-tabs"].addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ch]");
      if (!btn) return;
      const ch = Number(btn.dataset.ch);
      if (S.save.unlocked < ch * PER_CHAPTER + 1) {
        toast(t("levels.chapterLocked"), "🔒");
        GameAudio.sfx("error");
        return;
      }
      S.activeChapter = ch;
      GameAudio.sfx("ui");
      renderLevels();
    });
    D["level-grid"].addEventListener("click", (e) => {
      const btn = e.target.closest("[data-level]");
      if (!btn) return;
      const id = Number(btn.dataset.level);
      if (id > S.save.unlocked) return;
      startLevel(id);
      GameAudio.sfx("ui");
      GameAudio.ensure();
    });

    D.scene.addEventListener("pointerdown", onCanvasPointerDown, { passive: false });
    D.scene.addEventListener("pointermove", onCanvasPointerMove, { passive: true });
    D.scene.addEventListener("pointerleave", () => { D.scene.style.cursor = "default"; });
    D.scene.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

    D.modalLayer.addEventListener("click", (e) => {
      if (e.target === D.modalLayer && S.modal && S.modal.opts.dismiss !== false) {
        closeModal();
        return;
      }
      const el = e.target.closest("[data-act]");
      if (!el) return;
      modalAction(el.dataset.act, el.dataset.val, el);
    });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("fullscreenchange", () => {
      GameRender.resize();
      if (S.screen === "game") requestAnimationFrame(layoutGame);
    });
  }

  function onCanvasPointerDown(e) {
    if (S.screen !== "game" || !S.current || S.current.solved || S.paused || S.adActive || S.modal) return;
    e.preventDefault();
    GameAudio.ensure();
    const hit = GameRender.hitTest(e.clientX, e.clientY, S.current.level);
    if (!hit) return;
    S.current.selected = { x: hit.gx, y: hit.gy };
    if (hit.mirror >= 0 && !S.current.level.mirrors[hit.mirror].fixed) rotateMirror(hit.mirror);
    else {
      S.current.selected = { x: hit.gx, y: hit.gy };
      updateScene();
      renderGameUI();
    }
  }

  function onCanvasPointerMove(e) {
    if (S.screen !== "game" || !S.current) {
      D.scene.style.cursor = "default";
      return;
    }
    const hit = GameRender.hitTest(e.clientX, e.clientY, S.current.level);
    if (hit && hit.mirror >= 0 && !S.current.level.mirrors[hit.mirror].fixed) D.scene.style.cursor = "pointer";
    else D.scene.style.cursor = "default";
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      if (S.modal) {
        if (S.modal.opts.dismiss !== false) closeModal();
        return;
      }
      if (S.screen === "game" && !S.current?.solved) { e.preventDefault(); openPause(); return; }
      if (S.screen === "levels") { e.preventDefault(); showScreen("menu"); return; }
    }
    if (S.modal || S.screen !== "game" || !S.current || S.current.solved) return;
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "u", "r"].includes(k) || ["w", "a", "s", "d"].includes(k)) {
      e.preventDefault();
    }
    if (k === "arrowup" || k === "w") moveSelection(0, -1);
    else if (k === "arrowdown" || k === "s") moveSelection(0, 1);
    else if (k === "arrowleft" || k === "a") moveSelection(-1, 0);
    else if (k === "arrowright" || k === "d") moveSelection(1, 0);
    else if (k === " " || k === "enter") rotateSelected();
    else if (k === "u") undoMove();
    else if (k === "r") resetLevel();
  }

  function onVisibility() {
    if (document.hidden) {
      GameAudio.suspend();
      if (S.screen === "game" && S.current && !S.current.solved) {
        S.platformPaused = true;
        syncGameplay();
      }
    } else {
      if (!S.paused && !S.adActive && !S.modal) {
        S.platformPaused = false;
        GameAudio.resume();
        syncGameplay();
      }
    }
  }

  /* ---------------- modals ---------------- */

  function openPause() {
    if (S.screen !== "game" || !S.current || S.current.solved || S.adActive) return;
    openModal("pause", {}, { pauseGame: true, resume: true, dismiss: true });
  }

  function pauseForModal() {
    if (S.screen !== "game" || !S.current || S.current.solved || S.adActive) return;
    S.paused = true;
    GameAudio.suspend();
    syncGameplay();
  }

  function resumeFromModal() {
    if (S.screen !== "game" || !S.current || S.current.solved) return;
    S.paused = false;
    S.platformPaused = false;
    GameAudio.resume();
    syncGameplay();
  }

  function openModal(type, data, opts) {
    opts = opts || {};
    if (S.modal) {
      // replacing an existing modal: keep the pause state from the previous one
      if (S.modal.opts && S.modal.opts.resume) opts.resume = true;
    }
    S.lastFocus = document.activeElement;
    S.modal = { type, data: data || {}, opts };
    if (opts.pauseGame) pauseForModal();
    const html = renderModal(type, data || {});
    if (!html) { S.modal = null; return; }
    D.modalLayer.innerHTML = html;
    D.modalLayer.classList.remove("hidden");
    D.modalLayer.setAttribute("aria-hidden", "false");
    const focus = D.modalLayer.querySelector("[data-autofocus]") || D.modalLayer.querySelector("button");
    if (focus) window.setTimeout(() => { try { focus.focus({ preventScroll: true }); } catch (e) {} }, 30);
    syncGameplay();
  }

  function closeModal(restore) {
    const m = S.modal;
    if (!m) return;
    S.modal = null;
    D.modalLayer.classList.add("hidden");
    D.modalLayer.innerHTML = "";
    D.modalLayer.setAttribute("aria-hidden", "true");
    if (restore !== false && m.opts && m.opts.resume) resumeFromModal();
    if (S.lastFocus && S.lastFocus.focus) {
      try { S.lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    S.lastFocus = null;
    syncGameplay();
  }

  function refreshModal() {
    if (!S.modal) return;
    const m = S.modal;
    const html = renderModal(m.type, m.data);
    if (html) {
      D.modalLayer.innerHTML = html;
      const focus = D.modalLayer.querySelector("[data-autofocus]");
      if (focus) try { focus.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function modalShell(opts) {
    const closeBtn = opts.closable === false ? "" : '<button class="modal-close" data-act="close" aria-label="' + t("common.close") + '">' + ICON_X + "</button>";
    return '<div class="modal' + (opts.wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<div class="modal-head"><div class="modal-head-copy">' +
      (opts.kicker ? '<p class="modal-kicker">' + opts.kicker + "</p>" : "") +
      '<h3 class="modal-title" id="modal-title">' + opts.title + "</h3>" +
      (opts.sub ? '<p class="modal-sub">' + opts.sub + "</p>" : "") +
      "</div>" + closeBtn + "</div>" +
      '<div class="modal-body">' + (opts.body || "") + "</div>" +
      (opts.actions ? '<div class="modal-actions' + (opts.actionsRow ? " row" : "") + '">' + opts.actions + "</div>" : "") +
      "</div>";
  }

  function renderModal(type, data) {
    switch (type) {
      case "settings": return renderSettingsModal();
      case "reset": return renderResetModal();
      case "howto": return renderHowtoModal();
      case "about": return renderAboutModal();
      case "achievements": return renderAchievementsModal();
      case "profile": return renderProfileModal();
      case "auth": return renderAuthModal();
      case "daily": return renderDailyModal();
      case "reward": return renderRewardModal();
      case "no-flies": return renderNoFliesModal();
      case "leaderboard": return renderLeaderboardModal(data);
      case "pause": return renderPauseModal();
      case "complete": return renderCompleteModal(data);
      default: return "";
    }
  }

  function settingsRow(title, sub, control) {
    return '<div class="setting-row"><div class="setting-copy"><strong>' + title + "</strong>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>" + control + "</div>";
  }

  function renderSettingsModal() {
    const music = S.save.settings.music;
    const sfx = S.save.settings.sfx;
    const lang = S.lang;
    const body = '<div class="settings-list">' +
      settingsRow(t("settings.music"), t("settings.musicSub"), '<button class="switch' + (music ? " on" : "") + '" data-act="toggle-music" aria-pressed="' + music + '"></button>') +
      settingsRow(t("settings.sound"), t("settings.soundSub"), '<button class="switch' + (sfx ? " on" : "") + '" data-act="toggle-sfx" aria-pressed="' + sfx + '"></button>') +
      '<div class="setting-row"><div class="setting-copy"><strong>' + t("settings.lang") + "</strong></div><div class=\"segmented\">" +
      ["ru", "en", "tr"].map((l) => '<button class="' + (lang === l ? "active" : "") + '" data-act="set-lang" data-val="' + l + '">' + l.toUpperCase() + "</button>").join("") +
      "</div></div>" +
      '<button class="setting-row" data-act="fullscreen" style="text-align:left"><div class="setting-copy"><strong>' + t("settings.fullscreen") + "</strong><small>" + t("settings.fullscreenSub") + "</small></div><span style=\"font-size:18px\">⛶</span></button>" +
      '<button class="setting-row" data-act="about" style="text-align:left"><div class="setting-copy"><strong>' + t("settings.about") + "</strong></div><span style=\"font-size:18px\">›</span></button>" +
      '<button class="danger-btn" data-act="reset">' + t("settings.reset") + "</button>" +
      "</div>" +
      '<p style="text-align:center;margin:10px 0 0;font-size:11px;font-weight:700">' + t("settings.version", { v: VERSION }) + "</p>";
    return modalShell({
      title: t("settings.title"),
      sub: t("settings.sub"),
      body,
      actions: '<button class="btn btn-primary" data-act="close">' + t("common.close") + "</button>",
    });
  }

  function renderResetModal() {
    return modalShell({
      title: t("reset.title"),
      sub: t("reset.text"),
      body: "",
      actions: '<button class="btn btn-soft" data-act="close">' + t("reset.no") + '</button><button class="btn btn-coral" data-act="reset-confirm">' + t("reset.yes") + "</button>",
    });
  }

  function howRow(icon, title, desc) {
    return '<div class="how-row"><div class="how-ico">' + icon + '</div><div><strong>' + title + "</strong><span>" + desc + "</span></div></div>";
  }

  function renderHowtoModal() {
    const body = '<div class="how-grid">' +
      howRow("☀", t("howto.goal"), t("howto.goal.d")) +
      howRow("◒", t("howto.mirror"), t("howto.mirror.d")) +
      howRow("◇", t("howto.splitter"), t("howto.splitter.d")) +
      howRow("◎", t("howto.portal"), t("howto.portal.d")) +
      howRow("☾", t("howto.moon"), t("howto.moon.d")) +
      howRow("★", t("howto.stars"), t("howto.stars.d")) +
      howRow("⌨", t("howto.controls"), t("howto.controls.d")) +
      "</div>";
    return modalShell({
      title: t("howto.title"),
      sub: t("howto.sub"),
      body,
      actions: '<button class="btn btn-primary" data-act="close">' + t("common.close") + "</button>",
      wide: true,
    });
  }

  function renderAboutModal() {
    const body = "<p>" + t("about.p1") + "</p><p>" + t("about.p2") + "</p><p>" + t("about.p3") + "</p><p>" + t("about.p4") + "</p>" +
      '<div class="how-row"><div class="how-ico">⌨</div><div><strong>' + t("about.controls") + "</strong><span>" + t("about.controlsD") + "</span></div></div>" +
      '<p style="text-align:center;font-size:11px;margin-top:10px">' + t("settings.version", { v: VERSION }) + "</p>";
    return modalShell({
      title: t("about.title"),
      body,
      actions: '<button class="btn btn-primary" data-act="close">' + t("common.close") + "</button>",
      wide: true,
    });
  }

  function renderAchievementsModal() {
    const unlocked = new Set(S.save.achievements);
    const cards = ACHIEVEMENTS.map((a) => {
      const on = unlocked.has(a.id);
      const v = a.value(S.save);
      return '<div class="ach-card' + (on ? " on" : "") + '"><div class="ach-badge">' + a.icon + '</div><div class="ach-copy"><strong>' + t("ach." + a.id) + "</strong><small>" + t("ach." + a.id + ".d") + " · " + v + "/" + a.target + "</small></div></div>";
    }).join("");
    return modalShell({
      title: t("ach.title"),
      sub: t("ach.count", { done: unlocked.size, total: ACHIEVEMENTS.length }),
      body: '<div class="ach-grid">' + cards + "</div>",
      actions: '<button class="btn btn-primary" data-act="close">' + t("common.close") + "</button>",
    });
  }

  function renderProfileModal() {
    const info = S.playerInfo;
    const authorized = !!(S.player && S.player.isAuthorized && S.player.isAuthorized());
    const avatar = info && info.photo
      ? '<div class="lb-avatar" style="width:48px;height:48px"><img alt="" src="' + escapeAttr(info.photo) + '"></div>'
      : '<div class="lb-avatar" style="width:48px;height:48px;font-size:18px">' + (info && info.name ? info.name.slice(0, 1).toUpperCase() : "Л") + "</div>";
    const body = '<div class="settings-list">' +
      '<div class="setting-row">' + avatar + '<div class="setting-copy"><strong>' + (authorized && info ? info.name : t("profile.guest")) + "</strong><small>" + (authorized ? t("profile.sub") : t("profile.guestNote")) + "</small></div></div>" +
      '<div class="moves-card" style="margin:0"><div><span>' + t("menu.stars") + "</span><strong>" + totalStars(S.save) + "</strong></div><div><span>" + t("common.levels") + "</span><strong>" + completedCount(S.save) + "</strong></div><div><span>" + t("ach.title") + "</span><strong>" + S.save.achievements.length + "</strong></div></div>" +
      (authorized ? "" : '<button class="btn btn-primary" data-act="auth">' + t("profile.login") + "</button>") +
      '<button class="btn btn-soft" data-act="leaderboard">' + t("lb.title") + "</button>" +
      '<button class="btn btn-soft" data-act="achievements">' + t("ach.title") + "</button>" +
      "</div>";
    return modalShell({
      title: t("profile.title"),
      sub: t("profile.sub"),
      body,
      actions: '<button class="btn btn-primary" data-act="close">' + t("common.close") + "</button>",
    });
  }

  function renderAuthModal() {
    const body = '<div class="how-grid">' +
      howRow("☁", t("auth.b1"), "") +
      howRow("★", t("auth.b2"), "") +
      howRow("✓", t("auth.b3"), "") +
      "</div><p style=\"margin-top:12px;font-size:11px;opacity:.75\">" + t("auth.sub") + "</p>";
    return modalShell({
      title: t("auth.title"),
      sub: "",
      body,
      actions: '<button class="btn btn-primary" data-act="do-auth" data-autofocus>' + t("auth.button") + '</button><button class="btn btn-ghost" data-act="close">' + t("auth.later") + "</button>",
    });
  }

  function renderDailyModal() {
    const ready = dailyReady();
    const streak = S.save.daily.streak || 0;
    const body = '<div class="daily-hero"><div class="daily-hero-icon">' +
      '<svg viewBox="0 0 24 24"><path d="M12 3v3M4.2 7.2l2.1 2.1M19.8 7.2l-2.1 2.1M3 14h3M18 14h3M5.5 19.5l2-2M18.5 19.5l-2-2"/><circle cx="12" cy="13" r="4"/></svg>' +
      '</div><div class="daily-hero-copy"><strong>' + t(ready ? "daily.ready" : "daily.claimed") + "</strong><span>" + t("daily.cardSub") + "</span></div></div>" +
      '<div class="streak">' + Array.from({ length: 7 }, (_, i) => '<i class="' + (i < Math.min(streak, 7) ? "on" : "") + '"></i>').join("") + "</div>" +
      '<p style="text-align:center;font-weight:800;font-size:12px">' + t("daily.streak", { n: streak }) + "</p>" +
      '<p style="font-size:11.5px">' + t("daily.note") + "</p>";
    const actions = ready
      ? '<button class="btn btn-primary" data-act="claim-daily" data-autofocus>' + t("daily.claim") + '</button><button class="btn btn-ghost" data-act="close">' + t("ads.later") + "</button>"
      : '<button class="btn btn-soft" data-act="close">' + t("daily.tomorrow") + "</button>";
    return modalShell({
      title: t("daily.title"),
      sub: t("daily.sub"),
      body,
      actions,
    });
  }

  function renderRewardModal() {
    const body = '<div class="daily-hero"><div class="daily-hero-icon">✦</div><div class="daily-hero-copy"><strong>' + t("ads.rewardAmount") + "</strong><span>" + t("ads.rewardSub") + "</span></div></div>" +
      '<p style="text-align:center;font-size:12px;font-weight:800">' + t("daily.note") + "</p>";
    return modalShell({
      title: t("ads.rewardTitle"),
      body,
      actions: '<button class="btn btn-primary" data-act="watch-reward" data-autofocus>' + t("ads.rewardButton") + '</button><button class="btn btn-ghost" data-act="close">' + t("ads.later") + "</button>",
    });
  }

  function renderNoFliesModal() {
    const ready = dailyReady();
    const body = '<div class="daily-hero"><div class="daily-hero-icon">✦</div><div class="daily-hero-copy"><strong>' + t("ads.noFliesCard") + "</strong><span>" + t("ads.noFliesSub") + "</span></div></div>";
    const actions = '<button class="btn btn-primary" data-act="watch-reward" data-autofocus>' + t("ads.watch") + '</button>' +
      (ready ? '<button class="btn btn-soft" data-act="daily">' + t("daily.claim") + "</button>" : "") +
      '<button class="btn btn-ghost" data-act="close">' + t("ads.later") + "</button>";
    return modalShell({ title: t("ads.noFliesTitle"), body, actions });
  }

  function leaderboardRows(entries, meId) {
    if (!entries || !entries.length) return '<div class="lb-empty">' + t("lb.empty") + "</div>";
    return '<div class="lb-list">' + entries.map((e) => {
      const p = e.player || {};
      const name = p.publicName || t("profile.guest");
      const isMe = meId && p.uniqueID && p.uniqueID === meId;
      let avatar = '<div class="lb-avatar">' + (name.slice(0, 1) || "?") + "</div>";
      try {
        const src = p.getAvatarSrc && p.getAvatarSrc("small");
        if (src) avatar = '<div class="lb-avatar"><img alt="" src="' + escapeAttr(src) + '"></div>';
      } catch (err) {}
      return '<div class="lb-row' + (isMe ? " me" : "") + '"><div class="lb-rank">' + (e.rank || "") + "</div>" + avatar + '<div class="lb-name">' + escapeAttr(name) + '</div><div class="lb-score">' + (e.score || 0) + " ★</div></div>";
    }).join("") + "</div>";
  }

  function renderLeaderboardModal(data) {
    let body = "";
    if (data.loading) {
      body = '<div class="lb-empty">' + t("common.loading") + "</div>";
    } else if (data.error) {
      body = '<div class="lb-empty">' + t("lb.error") + "</div>";
    } else {
      body = leaderboardRows(data.entries, data.meId);
    }
    body += '<div class="moves-card" style="margin-top:10px"><div><span>' + t("lb.local") + "</span><strong>" + totalStars(S.save) + " ★</strong></div><div><span>" + t("common.levels") + "</span><strong>" + completedCount(S.save) + "</strong></div><div><span>" + t("ach.title") + "</span><strong>" + S.save.achievements.length + "</strong></div></div>";
    if (!S.player || !S.player.isAuthorized || !S.player.isAuthorized()) {
      body += '<p style="text-align:center;font-size:11.5px;margin-top:10px">' + t("lb.guest") + "</p>";
    }
    const authorized = S.player && S.player.isAuthorized && S.player.isAuthorized();
    const actions = '<button class="btn btn-soft" data-act="close">' + t("common.close") + "</button>" +
      (!authorized ? '<button class="btn btn-primary" data-act="auth">' + t("lb.login") + "</button>" : "");
    return modalShell({
      title: t("lb.title"),
      sub: t("lb.sub"),
      body,
      actions,
    });
  }

  function renderPauseModal() {
    return modalShell({
      kicker: t("common.pause"),
      title: t("pause.title"),
      sub: t("pause.sub"),
      body: "",
      actions: '<button class="btn btn-primary" data-act="resume" data-autofocus>' + t("pause.continue") + "</button>" +
        '<button class="btn btn-soft" data-act="restart">' + t("pause.restart") + "</button>" +
        '<button class="btn btn-ghost" data-act="howto">' + t("pause.howto") + "</button>" +
        '<div class="modal-actions row" style="padding:0;gap:8px"><button class="btn btn-ghost" data-act="levels">' + t("pause.levels") + '</button><button class="btn btn-ghost" data-act="menu">' + t("pause.menu") + "</button></div>",
      closable: true,
    });
  }

  function renderCompleteModal(data) {
    const starHtml = [1, 2, 3].map((n) => '<span class="' + (data.stars >= n ? "on pop-" + n : "") + '"></span>').join("");
    let title = t("complete.title");
    if (data.final) title = t("complete.final");
    else if (data.chapterDone) title = t("complete.chapter");
    const body = '<div class="complete-hero"><div class="complete-stars">' + starHtml + "</div>" +
      '<div class="complete-meta"><span class="meta-chip">' + t("complete.moves", { n: data.taps }) + '</span><span class="meta-chip">' + t("complete.par", { n: data.par }) + '</span><span class="meta-chip">' + t("complete.bestStars", { n: data.bestStars }) + "</span></div>" +
      (data.firstClear ? '<div class="reward-note">✦ ' + t("complete.rewardFirst") + "</div>" : '<div class="reward-note" style="color:var(--ink-soft)">' + t("complete.rewardReplay") + "</div>") +
      "</div>" +
      (data.chapterDone && !data.final ? '<div class="chapter-banner">' + t("common.chapter") + " " + (Math.floor((data.levelId - 1) / PER_CHAPTER) + 1) + " · " + t("chapter." + Math.floor((data.levelId - 1) / PER_CHAPTER)) + " ✓</div>" : "");
    const nextBtn = data.nextId
      ? '<button class="btn btn-primary" data-act="next-level" data-val="' + data.nextId + '" data-autofocus>' + t("complete.next") + "</button>"
      : '<button class="btn btn-primary" data-act="levels" data-autofocus>' + t("complete.toLevels") + "</button>";
    const actions = nextBtn +
      '<button class="btn btn-soft" data-act="replay">' + t("complete.again") + "</button>" +
      '<button class="btn btn-soft" data-act="watch-reward" style="font-size:13px">' + t("ads.rewardButton") + "</button>" +
      '<button class="btn btn-ghost" data-act="levels">' + t("complete.toLevels") + "</button>";
    return modalShell({
      kicker: t("complete.kicker"),
      title,
      body,
      actions,
      closable: false,
    });
  }

  function modalAction(act, val, el) {
    GameAudio.ensure();
    GameAudio.sfx("ui");
    switch (act) {
      case "close": closeModal(); break;
      case "settings": openModal("settings", {}, { dismiss: true }); break;
      case "achievements": openModal("achievements", {}, { dismiss: true }); break;
      case "profile": openModal("profile", {}, { dismiss: true }); break;
      case "leaderboard": openLeaderboard(); break;
      case "about": openModal("about", {}, { dismiss: true }); break;
      case "reset": openModal("reset", {}, { dismiss: true }); break;
      case "reset-confirm": resetProgress(); break;
      case "toggle-music":
        S.save.settings.music = !S.save.settings.music;
        GameAudio.setMusic(S.save.settings.music);
        persist(true, false);
        refreshModal();
        break;
      case "toggle-sfx":
        S.save.settings.sfx = !S.save.settings.sfx;
        GameAudio.setSfx(S.save.settings.sfx);
        persist(true, false);
        refreshModal();
        break;
      case "set-lang": setLanguage(val, true); break;
      case "fullscreen": toggleFullscreen(); break;
      case "auth": openModal("auth", {}, { dismiss: true }); break;
      case "do-auth": doAuth(); break;
      case "daily": openModal("daily", {}, { dismiss: true }); break;
      case "claim-daily": claimDaily(); break;
      case "watch-reward": showRewarded(); break;
      case "resume": closeModal(); break;
      case "restart":
        closeModal(false);
        S.paused = false;
        resetLevel();
        GameAudio.resume();
        syncGameplay();
        break;
      case "howto": openModal("howto", {}, { dismiss: true, pauseGame: true, resume: true }); break;
      case "levels":
        closeModal(false);
        showScreen("levels");
        break;
      case "menu":
        closeModal(false);
        showScreen("menu");
        break;
      case "next-level":
        closeModal(false);
        maybeShowInterstitial(() => startLevel(Number(val)));
        break;
      case "replay":
        closeModal(false);
        startLevel(S.current ? S.current.level.id : S.save.lastLevel);
        break;
      default: break;
    }
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().then(() => GameRender.resize()).catch(() => {});
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => GameRender.resize()).catch(() => toast(t("ads.unavailable"), "!"));
      } else {
        toast(t("ads.unavailable"), "!");
      }
    } catch (e) {
      toast(t("ads.unavailable"), "!");
    }
  }

  /* ---------------- daily ---------------- */

  function dailyReady() {
    return S.save.daily.date !== dateKey();
  }

  function claimDaily() {
    if (!dailyReady()) return;
    const today = dateKey();
    const yesterday = dateKey(new Date(Date.now() - 86400000));
    const streak = S.save.daily.date === yesterday ? (S.save.daily.streak || 0) + 1 : 1;
    S.save.daily = { date: today, streak };
    S.save.fireflies += 3;
    GameAudio.setSfx(S.save.settings.sfx);
    GameAudio.ensure();
    GameAudio.sfx("reward");
    checkAchievements();
    persist(true, true);
    toast(t("toast.daily"), "✦");
    renderMenu();
    if (S.modal && S.modal.type === "daily") refreshModal();
    else openModal("daily", {}, { dismiss: true });
  }

  /* ---------------- achievements ---------------- */

  function checkAchievements() {
    const unlocked = new Set(S.save.achievements);
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (!unlocked.has(a.id) && a.test(S.save)) {
        S.save.achievements.push(a.id);
        unlocked.add(a.id);
        newly.push(a.id);
      }
    }
    for (const id of newly) toast(t("toast.achievement", { name: t("ach." + id) }), "✦");
    if (newly.length) saveLocal();
    return newly;
  }

  /* ---------------- progress / reset ---------------- */

  function resetProgress() {
    const settings = { ...S.save.settings };
    S.save = defaultSave();
    S.save.settings = settings;
    S.current = null;
    S.screen = "menu";
    closeModal(false);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    saveLocal();
    queueCloud(true);
    try {
      if (S.player && S.player.isAuthorized && S.player.isAuthorized() && S.sdk && S.sdk.leaderboards && S.sdk.leaderboards.setScore) {
        S.sdk.leaderboards.setScore(LEADERBOARD, 0).catch(() => {});
      }
    } catch (e) {}
    toast(t("toast.reset"), "↺");
    showScreen("menu");
    renderAll();
    GameAudio.sfx("ui");
  }

  /* ---------------- ads ---------------- */

  function pauseForAd() {
    GameAudio.suspend();
    S.adActive = true;
    syncGameplay();
  }

  function endAd() {
    S.adActive = false;
    if (!S.paused && !S.modal) GameAudio.resume();
    syncGameplay();
  }

  function showRewarded() {
    if (S.adActive) return;
    if (!S.sdk || !S.sdk.adv || !S.sdk.adv.showRewardedVideo) {
      toast(t("toast.noAds"), "!");
      return;
    }
    pauseForAd();
    let rewarded = false;
    let closed = false;
    const finish = (ok) => {
      if (closed) return;
      closed = true;
      if (ok || rewarded) {
        S.save.fireflies += 5;
        checkAchievements();
        persist(true, false);
        renderMenu();
        renderGameUI();
        toast(t("toast.reward"), "✦");
        GameAudio.ensure();
        GameAudio.sfx("reward");
      } else {
        toast(t("toast.noAds"), "!");
      }
      endAd();
      if (S.modal) refreshModal();
    };
    try {
      S.sdk.adv.showRewardedVideo({
        onOpen: () => {},
        onRewarded: () => { rewarded = true; },
        onClose: () => finish(rewarded),
        onError: () => finish(false),
      });
      window.setTimeout(() => { if (!closed) finish(rewarded); }, 60000);
    } catch (e) {
      finish(false);
    }
  }

  function maybeShowInterstitial(next) {
    const now = Date.now();
    if (!S.sdk || !S.sdk.adv || !S.sdk.adv.showFullscreenAdv || (S.save.completionsSinceAd || 0) < 3 || now - S.lastAdAt < 120000) {
      next();
      return;
    }
    S.save.completionsSinceAd = 0;
    S.lastAdAt = now;
    saveLocal();
    pauseForAd();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      endAd();
      next();
    };
    try {
      S.sdk.adv.showFullscreenAdv({
        onOpen: () => {},
        onClose: () => finish(),
        onError: () => finish(),
      });
      window.setTimeout(() => { if (!done) finish(); }, 60000);
    } catch (e) {
      finish();
    }
  }

  /* ---------------- SDK / cloud ---------------- */

  function loadSDK() {
    if (S.promo) return Promise.resolve(null);
    if (location.protocol === "file:") return Promise.resolve(null);
    return new Promise((resolve) => {
      let settled = false;
      const finish = async () => {
        if (settled) return;
        settled = true;
        if (!window.YaGames) { resolve(null); return; }
        try {
          const sdk = await Promise.race([
            window.YaGames.init(),
            new Promise((r) => window.setTimeout(() => r(null), 5500)),
          ]);
          if (sdk) setupSDK(sdk);
          resolve(sdk || null);
        } catch (e) {
          resolve(null);
        }
      };
      const load = (src, next) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => { if (window.YaGames) finish(); else next(); };
        s.onerror = () => next();
        document.head.appendChild(s);
      };
      const local = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(location.hostname);
      if (local) load("/sdk.js", () => load("https://yandex.ru/games/sdk/v2", () => resolve(null)));
      else load("https://yandex.ru/games/sdk/v2", () => resolve(null));
      window.setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 8000);
    }).finally(() => {
      S.sdkSettled = true;
      maybeReady();
    });
  }

  function setupSDK(ysdk) {
    S.sdk = ysdk;
    const sdkLang = ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang;
    if (!S.save.settings.lang && sdkLang) {
      const resolved = I18N.resolveLang(sdkLang);
      if (resolved !== S.lang) applyLang(resolved, false);
    }
    try {
      ysdk.on("game_api_pause", () => {
        S.platformPaused = true;
        GameAudio.suspend();
        syncGameplay();
      });
      ysdk.on("game_api_resume", () => {
        S.platformPaused = false;
        if (!S.paused && !S.adActive && !S.modal) {
          GameAudio.resume();
          syncGameplay();
        }
      });
    } catch (e) {}
    initPlayer(ysdk);
    S.sdkSettled = true;
    maybeReady();
    syncGameplay();
  }

  async function initPlayer(ysdk) {
    try {
      const player = await ysdk.getPlayer();
      S.player = player;
      updatePlayerInfo();
      if (player.isAuthorized && player.isAuthorized()) {
        await loadCloud(player);
        submitScore();
      }
      renderMenu();
    } catch (e) {}
  }

  function updatePlayerInfo() {
    if (!S.player || !S.player.isAuthorized || !S.player.isAuthorized()) {
      S.playerInfo = null;
      return;
    }
    let name = "";
    let photo = "";
    try { name = S.player.getName() || ""; } catch (e) {}
    try { photo = S.player.getPhoto("medium") || ""; } catch (e) {}
    S.playerInfo = { name: name || t("profile.guest"), photo };
  }

  function cloudPayload() {
    const s = JSON.parse(JSON.stringify(S.save));
    delete s.resume;
    delete s.completionsSinceAd;
    return s;
  }

  function queueCloud(flush) {
    if (!S.player || !S.player.isAuthorized || !S.player.isAuthorized()) return;
    if (S.cloudTimer) window.clearTimeout(S.cloudTimer);
    const doSave = () => {
      S.cloudTimer = 0;
      const now = Date.now();
      if (now - S.lastCloudAt < 1500 && !flush) {
        S.cloudTimer = window.setTimeout(doSave, 1600);
        return;
      }
      S.lastCloudAt = now;
      try {
        S.player.setData({ save: cloudPayload() }, !!flush).catch(() => {});
      } catch (e) {}
    };
    if (flush) doSave();
    else S.cloudTimer = window.setTimeout(doSave, 1600);
  }

  async function loadCloud(player) {
    try {
      const data = await player.getData(["save"]);
      let cloud = data && data.save;
      if (typeof cloud === "string") {
        try { cloud = JSON.parse(cloud); } catch (e) { cloud = null; }
      }
      if (!cloud) {
        queueCloud(true);
        return;
      }
      const before = JSON.stringify(S.save);
      const merged = mergeSaves(S.save, sanitizeSave(cloud));
      S.save = merged;
      saveLocal();
      checkAchievements();
      if (JSON.stringify(S.save) !== before) {
        toast(t("toast.synced"), "☁");
        renderAll();
      } else {
        queueCloud(true);
      }
    } catch (e) {}
  }

  function mergeSaves(local, cloud) {
    const out = sanitizeSave(local);
    out.unlocked = Math.max(out.unlocked, cloud.unlocked || 1);
    for (const id in cloud.levels || {}) {
      const a = out.levels[id];
      const b = cloud.levels[id];
      if (!a) { out.levels[id] = { ...b }; continue; }
      out.levels[id] = {
        stars: Math.max(a.stars || 0, b.stars || 0),
        bestTaps: a.bestTaps && b.bestTaps ? Math.min(a.bestTaps, b.bestTaps) : (a.bestTaps || b.bestTaps || 0),
        noHint: !!(a.noHint || b.noHint),
      };
    }
    out.achievements = [...new Set([...(out.achievements || []), ...(cloud.achievements || [])])];
    out.fireflies = Math.max(out.fireflies || 0, cloud.fireflies || 0);
    if (cloud.daily && cloud.daily.date && (!out.daily.date || cloud.daily.date > out.daily.date)) {
      out.daily = { ...cloud.daily };
    } else if (cloud.daily && cloud.daily.date === out.daily.date) {
      out.daily.streak = Math.max(out.daily.streak || 0, cloud.daily.streak || 0);
    }
    if ((cloud.unlocked || 0) > (local.unlocked || 0)) out.lastLevel = cloud.lastLevel || out.lastLevel;
    out.updatedAt = Math.max(out.updatedAt || 0, cloud.updatedAt || 0);
    return sanitizeSave(out);
  }

  async function doAuth() {
    if (!S.sdk || !S.sdk.auth || !S.sdk.auth.openAuthDialog) {
      toast(t("auth.onlyYandex"), "!");
      return;
    }
    try {
      await S.sdk.auth.openAuthDialog();
      const player = await S.sdk.getPlayer();
      S.player = player;
      if (player.isAuthorized && player.isAuthorized()) {
        updatePlayerInfo();
        await loadCloud(player);
        submitScore();
        closeModal();
        toast(t("toast.login"), "✓");
        renderMenu();
      } else {
        toast(t("auth.fail"), "!");
      }
    } catch (e) {
      toast(t("auth.fail"), "!");
    }
  }

  function submitScore() {
    if (!S.player || !S.player.isAuthorized || !S.player.isAuthorized() || !S.sdk || !S.sdk.leaderboards || !S.sdk.leaderboards.setScore) return;
    const now = Date.now();
    if (now - S.lastScoreAt < 1500) return;
    S.lastScoreAt = now;
    try {
      S.sdk.leaderboards.setScore(LEADERBOARD, totalStars(S.save)).catch(() => {});
    } catch (e) {}
  }

  async function openLeaderboard() {
    openModal("leaderboard", { loading: true }, { dismiss: true });
    if (!S.sdk || !S.sdk.leaderboards || !S.sdk.leaderboards.getEntries) {
      openModal("leaderboard", { error: true }, { dismiss: true });
      return;
    }
    try {
      const authorized = S.player && S.player.isAuthorized && S.player.isAuthorized();
      let meId = "";
      try { meId = authorized && S.player.getUniqueID ? S.player.getUniqueID() : ""; } catch (e) {}
      const data = await S.sdk.leaderboards.getEntries(LEADERBOARD, {
        quantityTop: 10,
        includeUser: !!authorized,
        quantityAround: 3,
      });
      openModal("leaderboard", { entries: data.entries || [], meId, loading: false }, { dismiss: true });
    } catch (e) {
      openModal("leaderboard", { error: true }, { dismiss: true });
    }
  }

  /* ---------------- toasts ---------------- */

  function toast(text, icon) {
    const el = document.createElement("div");
    el.className = "toast";
    const ico = document.createElement("span");
    ico.className = "toast-ico";
    ico.textContent = icon || "✦";
    const msg = document.createElement("span");
    msg.textContent = text;
    el.appendChild(ico);
    el.appendChild(msg);
    D.toastLayer.appendChild(el);
    while (D.toastLayer.children.length > 3) D.toastLayer.firstElementChild.remove();
    window.setTimeout(() => {
      el.classList.add("out");
      window.setTimeout(() => el.remove(), 280);
    }, 2800);
  }

  /* ---------------- test api ---------------- */

  window.GardenGame = {
    state: S,
    levels: LEVELS,
    setProgress(max, stars) {
      stars = stars || 3;
      for (let i = 1; i <= Math.min(max, TOTAL_LEVELS); i++) {
        S.save.levels[i] = { stars, bestTaps: LEVEL_MAP.get(i).par + 1, noHint: true };
      }
      S.save.unlocked = Math.min(max, TOTAL_LEVELS);
      saveLocal();
      renderAll();
    },
    openLevel(id, resume) {
      if (id > S.save.unlocked) {
        S.save.unlocked = id;
        saveLocal();
      }
      startLevel(id, { resume: !!resume });
    },
    tapMirror(index) { rotateMirror(index); },
    setBits(bits) {
      if (!S.current) return;
      S.current.bits = bits.slice();
      S.current.taps = 0;
      S.current.history = [];
      recompute(true);
    },
    solveCurrent() {
      if (!S.current) return;
      const path = Puzzle.solvePath(S.current.level, S.current.bits);
      if (!path) return;
      for (const j of path) {
        const idx = Puzzle.rotatables(S.current.level)[j].i;
        S.current.bits[idx] = S.current.bits[idx] ? 0 : 1;
        S.current.taps++;
      }
      recompute(true);
    },
    showComplete() { if (S.current && S.current.solved) finishLevel(); },
    menu() { showScreen("menu"); },
    levels() { showScreen("levels"); },
    pause() { openPause(); },
    setLang(lang) { setLanguage(lang, true); },
    toast,
  };

  boot();
})();
