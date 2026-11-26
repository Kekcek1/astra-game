import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadLevels(file = new URL("../assets/levels.js", import.meta.url)) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync(file, "utf8"), context);
  return Array.from(context.window.LEVELS);
}

function litFlowers(level, mask, rotatable) {
  const mirror = new Map(level.mirrors.map((m, i) => [m.x + "," + m.y, { ...m, i }]));
  const splits = new Map((level.splitters || []).map(s => [s.x + "," + s.y, s]));
  const flowers = new Map(level.flowers.map((f, i) => [f.x + "," + f.y, { ...f, i }]));
  const portals = new Map((level.portals || []).map((p, i) => [p.x + "," + p.y, { ...p, i }]));
  const walls = new Set((level.walls || []).map(w => w.x + "," + w.y));
  const lit = new Set();
  for (const src of level.sources) {
    let x = src.dir === "R" ? 0 : src.dir === "L" ? level.cols - 1 : src.x;
    let y = src.dir === "D" ? 0 : src.dir === "U" ? level.rows - 1 : src.y;
    let dir = src.dir;
    const queue = [{ x, y, dir }];
    const visited = new Set();
    while (queue.length) {
      ({ x, y, dir } = queue.pop());
      for (let steps = 0; steps < level.cols * level.rows * 4; steps++) {
        if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) break;
        const k = x + "," + y + "," + dir;
        if (visited.has(k)) break;
        visited.add(k);
        const cell = x + "," + y;
        if (walls.has(cell)) break;
        const flower = flowers.get(cell);
        if (flower && (flower.type || "sun") === (src.type || "sun")) lit.add(flower.i);
        const m = mirror.get(cell);
        if (m) {
          const bit = rotatable.indexOf(m.i);
          const shape = m.fixed ? m.state : m.state ^ ((mask >> bit) & 1);
          if (shape === 0) dir = ({ R: "U", L: "D", U: "R", D: "L" })[dir];
          else dir = ({ R: "D", L: "U", U: "L", D: "R" })[dir];
        }
        const split = splits.has(cell);
        if (split) {
          const side = ({ R: ["U", "D"], L: ["D", "U"], U: ["L", "R"], D: ["R", "L"] })[dir];
          for (const next of side) {
            const delta = ({ R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] })[next];
            queue.push({ x: x + delta[0], y: y + delta[1], dir: next });
          }
        }
        const portal = portals.get(cell);
        if (portal) {
          const pair = level.portals.find(p => p.pair === portal.pair && (p.x !== x || p.y !== y));
          if (pair) {
            x = pair.x;
            y = pair.y;
          }
        }
        const delta = ({ R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] })[dir];
        x += delta[0];
        y += delta[1];
      }
    }
  }
  return lit;
}

export function solveLevel(level) {
  const rotatable = level.mirrors.flatMap((m, i) => m.fixed ? [] : [i]);
  let frontier = [0];
  const seen = new Set(frontier);
  const previous = new Map();
  if (litFlowers(level, 0, rotatable).size === level.flowers.length) return [];
  while (frontier.length) {
    const next = [];
    for (const mask of frontier) {
      for (let bit = 0; bit < rotatable.length; bit++) {
        const candidate = mask ^ (1 << bit);
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        previous.set(candidate, [mask, bit]);
        if (litFlowers(level, candidate, rotatable).size === level.flowers.length) {
          const path = [];
          let at = candidate;
          while (previous.has(at)) {
            const [from, choice] = previous.get(at);
            path.push(rotatable[choice]);
            at = from;
          }
          return path.reverse();
        }
        next.push(candidate);
      }
    }
    frontier = next;
  }
  return null;
}
