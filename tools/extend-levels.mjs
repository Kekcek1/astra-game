import fs from "node:fs";
import vm from "node:vm";
import { solveLevel } from "./solve-levels.mjs";

const box = { window: {} };
vm.createContext(box);
vm.runInContext(fs.readFileSync(new URL("../assets/levels.js", import.meta.url), "utf8"), box);
vm.runInContext(fs.readFileSync(new URL("../assets/puzzle.js", import.meta.url), "utf8"), box);
const original = Array.from(box.window.LEVELS);
const profiles = [
  { source: [1, 10], turns: [1, 3], splitters: 0, moon: false },
  { source: [1, 15], turns: [2, 3], splitters: 0, moon: false },
  { source: [6, 20], turns: [2, 4], splitters: 0, moon: false },
  { source: [11, 20], turns: [3, 4], splitters: 0, moon: false },
  { source: [6, 25], turns: [2, 4], splitters: 1, moon: false },
  { source: [15, 30], turns: [3, 4], splitters: 1, moon: false },
  { source: [15, 30], turns: [3, 4], splitters: 1, moon: false },
  { source: [21, 35], turns: [4, 5], splitters: 1, moon: false },
  { source: [21, 40], turns: [4, 5], splitters: 1, moon: false },
  { source: [26, 40], turns: [4, 5], splitters: 1, moon: true },
  { source: [26, 40], turns: [4, 5], splitters: 1, moon: true },
  { source: [26, 40], turns: [4, 5], splitters: 1, moon: true },
];
const DIR = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };

function rngFor(seed) {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let n = Math.imul(value ^ value >>> 15, 1 | value);
    n = (n + Math.imul(n ^ n >>> 7, 61 | n)) ^ n;
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function reflect(level) {
  const mirror = { R: "L", L: "R", U: "U", D: "D" };
  for (const list of [level.mirrors, level.flowers, level.splitters, level.portals, level.walls, level.decor]) {
    for (const cell of list || []) cell.x = level.cols - 1 - cell.x;
  }
  for (const source of level.sources) {
    source.x = level.cols - 1 - source.x;
    source.dir = mirror[source.dir];
  }
  for (const mirror of level.mirrors) mirror.state ^= 1;
}

function freeCells(level, used) {
  const cells = [];
  for (let y = 0; y < level.rows; y++) for (let x = 0; x < level.cols; x++) {
    if (!used.has(x + "," + y)) cells.push({ x, y });
  }
  return cells;
}

function rotateToSolution(level) {
  const solution = solveLevel(level);
  if (!solution) return false;
  for (const index of solution) level.mirrors[index].state ^= 1;
  return true;
}

function addSplitters(level, target) {
  for (let count = 0; count < target; count++) {
    const solved = Array(level.mirrors.length).fill(0);
    const before = box.window.Puzzle.trace(level, solved);
    const tracedCells = new Set(before.paths.flatMap(ray => ray.pts.map(cell => cell.x + "," + cell.y)));
    const occupied = new Set([...level.mirrors, ...level.splitters, ...level.portals, ...level.flowers, ...level.walls].map(c => c.x + "," + c.y));
    const candidates = before.paths.flatMap(ray => ray.pts).filter(cell => !occupied.has(cell.x + "," + cell.y));
    let added = false;
    for (const cell of candidates) {
      level.splitters.push({ x: cell.x, y: cell.y });
      const branchCells = box.window.Puzzle.trace(level, solved).paths.flatMap(ray => ray.pts.map(point => ({ ...point, type: ray.type })))
        .filter(point => !tracedCells.has(point.x + "," + point.y) && !occupied.has(point.x + "," + point.y));
      for (const point of branchCells) {
        if (level.flowers.some(f => Math.abs(f.x - point.x) + Math.abs(f.y - point.y) < 2)) continue;
        level.flowers.push({ x: point.x, y: point.y, type: point.type || "sun" });
        if (box.window.Puzzle.isSolved(level, solved)) {
          added = true;
          break;
        }
        level.flowers.pop();
      }
      if (added) break;
      level.splitters.pop();
    }
    if (!added) return;
  }
}

function scramble(level, profile, rng) {
  const solution = solveLevel(level);
  if (!solution) return false;
  for (const index of solution) level.mirrors[index].state ^= 1;
  if (!box.window.Puzzle.isSolved(level, Array(level.mirrors.length).fill(0))) return false;
  let free = level.mirrors.filter(m => !m.fixed).length;
  const target = profile.turns[0] + Math.floor(rng() * (profile.turns[1] - profile.turns[0] + 1));
  const ids = level.mirrors.map((m, i) => m.fixed ? -1 : i).filter(i => i >= 0);
  const taps = Math.min(target, ids.length);
  if (taps < profile.turns[0]) return false;
  for (let attempt = 0; attempt < 24; attempt++) {
    const mask = new Set();
    while (mask.size < taps) mask.add(Math.floor(rng() * ids.length));
    for (const bit of mask) level.mirrors[ids[bit]].state ^= 1;
    const solution = solveLevel(level);
    if (solution && solution.length === taps && solution.length >= profile.turns[0] && solution.length <= profile.turns[1]) {
      level.par = solution.length;
      return !box.window.Puzzle.isSolved(level, Array(level.mirrors.length).fill(0));
    }
    for (const bit of mask) level.mirrors[ids[bit]].state ^= 1;
  }
  return false;
}

function buildLevel(id, chapter, profile, seed, signatures) {
  const rng = rngFor(seed);
  const [lo, hi] = profile.source;
  const source = original[lo - 1 + Math.floor(rng() * (hi - lo + 1))];
  const level = structuredClone(source);
  level.id = id;
  level.chapter = chapter;
  level.tip = chapter >= 8 ? 31 : chapter >= 6 ? 21 : undefined;
  const signature = (value) => JSON.stringify(value.mirrors.map(m => [m.x, m.y, m.fixed]));
  for (let tries = 0; tries < 4; tries++) {
    if (rng() < .5) reflect(level);
    if (!signatures.has(signature(level))) break;
  }
  if (profile.moon && !level.sources.some(s => s.type === "moon")) {
    for (const source of level.sources) source.type = "moon";
    for (const flower of level.flowers) flower.type = "moon";
  }
  if (!rotateToSolution(level)) return null;
  addSplitters(level, profile.splitters);
  if (!scramble(level, profile, rng)) return null;
  const key = JSON.stringify([level.sources, level.flowers, level.mirrors, level.splitters, level.portals]);
  if (signatures.has(key)) return null;
  signatures.add(key);
  return level;
}

const signatures = new Set(original.map(level => JSON.stringify([level.sources, level.flowers, level.mirrors, level.splitters, level.portals])));
const extra = [];
for (let chapter = 4; chapter < profiles.length; chapter++) {
  let attempt = 0;
  while (extra.filter(level => level.chapter === chapter).length < 10 && attempt < 6000) {
    const id = 41 + (chapter - 4) * 10 + extra.filter(level => level.chapter === chapter).length;
    const level = buildLevel(id, chapter, profiles[chapter], 20261031 + chapter * 100003 + attempt++ * 13, signatures);
    if (level) extra.push(level);
  }
  const count = extra.filter(level => level.chapter === chapter).length;
  if (count !== 10) throw Error("chapter " + (chapter + 1) + " produced " + count + " / 10 levels");
  console.log("Chapter " + (chapter + 1) + ": levels " + (chapter * 10 + 1) + "-" + (chapter + 1) * 10);
}

const all = [...original, ...extra];
for (const level of extra) {
  const solution = solveLevel(level);
  if (!solution || solution.length !== level.par || box.window.Puzzle.isSolved(level, Array(level.mirrors.length).fill(0))) throw Error("invalid puzzle " + level.id);
}
fs.writeFileSync(new URL("../assets/extra-levels.js", import.meta.url), "window.EXTRA_LEVELS = " + JSON.stringify(extra, null, 2) + ";\n");
console.log("PASS: " + extra.length + " additional solvable levels; total " + all.length);
