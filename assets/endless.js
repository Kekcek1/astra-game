(function () {
  "use strict";

  const DIRS = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };
  function random(seed) {
    let value = seed | 0;
    return function () {
      value = (value + 0x6D2B79F5) | 0;
      let n = Math.imul(value ^ (value >>> 15), 1 | value);
      n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  function reflect(level) {
    for (const list of [level.mirrors, level.flowers, level.splitters, level.portals, level.walls, level.decor]) {
      for (const cell of list || []) cell.x = level.cols - cell.x - 1;
    }
    for (const source of level.sources) {
      source.x = level.cols - source.x - 1;
      source.dir = ({ R: "L", L: "R", U: "U", D: "D" })[source.dir];
    }
    for (const mirror of level.mirrors) mirror.state ^= 1;
  }

  function rotate(level) {
    const map = { R: "D", D: "L", L: "U", U: "R" };
    for (const source of level.sources) {
      const x = source.dir === "R" ? 0 : source.dir === "L" ? level.cols - 1 : source.x;
      const y = source.dir === "D" ? 0 : source.dir === "U" ? level.rows - 1 : source.y;
      source.x = level.rows - y - 1;
      source.y = x;
      source.dir = map[source.dir];
    }
    for (const group of [level.mirrors, level.flowers, level.splitters, level.portals, level.walls, level.decor]) {
      for (const cell of group || []) {
        const x = cell.x;
        cell.x = level.rows - cell.y - 1;
        cell.y = x;
      }
    }
    const width = level.cols;
    level.cols = level.rows;
    level.rows = width;
    for (const mirror of level.mirrors) mirror.state ^= 1;
    for (const source of level.sources) {
      if (source.dir === "R") source.x = -1;
      else if (source.dir === "L") source.x = level.cols;
      else if (source.dir === "D") source.y = -1;
      else source.y = level.rows;
    }
  }

  function generate(seed, stage) {
    const stageSeed = (seed ^ Math.imul(stage >>> 0, 0x9E3779B9)) >>> 0;
    const rng = random(stageSeed);
    const levels = (window.LEVELS || []).filter(level => level.id >= 11);
    if (!levels.length) return null;
    const mirrorsNeeded = Math.min(7, 2 + Math.floor(Math.max(0, stage - 1) / 3));
    const targetPar = Math.min(6, Math.max(2, Math.floor(2 + stage * 0.38)));
    const start = Math.floor(rng() * levels.length);

    for (let offset = 0; offset < levels.length; offset++) {
      const level = structuredClone(levels[(start + offset) % levels.length]);
      const turns = Math.floor(rng() * 4);
      for (let turn = 0; turn < turns; turn++) rotate(level);
      if (rng() > 0.5) reflect(level);
      if (rng() > 0.65) {
        for (const flower of level.flowers) flower.type = flower.type === "moon" ? "sun" : "moon";
        for (const source of level.sources) source.type = source.type === "moon" ? "sun" : "moon";
      }
      for (const mirror of level.mirrors) mirror.fixed = false;
      const solution = window.Puzzle.solve(level, 0);
      if (!solution) continue;
      let bit = 0;
      for (const mirror of level.mirrors) mirror.state ^= (solution.bits >> bit++) & 1;
      if (rng() > 0.52) level.flowers.reverse();
      const rotatable = level.mirrors.map((m, i) => ({ m, i })).filter(({ m }) => !m.fixed).map(({ i }) => i);
      const count = Math.min(rotatable.length, mirrorsNeeded);
      for (let attempt = 0; attempt < 48; attempt++) {
        const scrambled = new Set();
        while (scrambled.size < count) scrambled.add(Math.floor(rng() * rotatable.length));
        for (const index of scrambled) level.mirrors[rotatable[index]].state ^= 1;
        const measured = window.Puzzle.solve(level, 0);
        if (measured && measured.taps >= targetPar - 1 && measured.taps <= targetPar + 3 && !window.Puzzle.isSolved(level, 0)) {
          level.par = measured.taps;
          level.endless = true;
          level.endlessStage = stage;
          level.id = 1000 + stage;
          return level;
        }
        for (const index of scrambled) level.mirrors[rotatable[index]].state ^= 1;
      }
    }
    return null;
  }

  function dailySeed() {
    const today = new Date();
    return today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  }

  window.EndlessGarden = { generate, dailySeed };
})();
