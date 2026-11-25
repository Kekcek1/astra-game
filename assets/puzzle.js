(function () {
  "use strict";
  const DIR = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };
  const TURN = {
    R: { "/": "U", "\\": "D" },
    L: { "/": "D", "\\": "U" },
    U: { "/": "R", "\\": "L" },
    D: { "/": "L", "\\": "R" },
  };

  function mirrorNext(dir, shape) {
    return TURN[dir][shape === 0 ? "/" : "\\"];
  }

  function sourceStart(level, src) {
    let x = src.x, y = src.y;
    if (src.dir === "R") x = 0;
    if (src.dir === "L") x = level.cols - 1;
    if (src.dir === "D") y = 0;
    if (src.dir === "U") y = level.rows - 1;
    return { x, y };
  }

  function buildCellMaps(level) {
    const elem = new Map();
    const flower = new Map();
    const wall = new Map();
    (level.mirrors || []).forEach((m, i) => elem.set(m.x + "," + m.y, { kind: "mirror", i }));
    (level.splitters || []).forEach((s, i) => elem.set(s.x + "," + s.y, { kind: "splitter", i }));
    (level.portals || []).forEach((p, i) => elem.set(p.x + "," + p.y, { kind: "portal", i, pair: p.pair }));
    (level.walls || []).forEach((w) => wall.set(w.x + "," + w.y, w.kind || "rock"));
    (level.flowers || []).forEach((f, i) => flower.set(f.x + "," + f.y, { kind: "flower", i }));
    return { elem, flower, wall };
  }

  function trace(level, mirrorStates) {
    const { elem, flower, wall } = buildCellMaps(level);
    const lit = new Set();
    const paths = [];
    const used = new Set();
    const totalCells = level.cols * level.rows;
    const stateOf = (i) => {
      const m = level.mirrors[i];
      const init = m.state | 0;
      if (m.fixed) return init;
      return init ^ ((mirrorStates && mirrorStates[i]) | 0);
    };

    for (const src of level.sources) {
      let { x, y } = sourceStart(level, src);
      let dir = src.dir;
      const seen = new Set();
      const queue = [{ x, y, dir, pts: [] }];
      while (queue.length) {
        const b = queue.shift();
        x = b.x; y = b.y; dir = b.dir;
        let seg = b.pts;
        let steps = 0;
        while (steps++ < totalCells * 4 + 20) {
          if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) {
            if (seg.length) paths.push({ type: src.type || "sun", pts: seg });
            break;
          }
          const key = x + "," + y;
          const sKey = key + "," + dir + "," + (src.type || "sun");
          if (seen.has(sKey)) {
            if (seg.length) paths.push({ type: src.type || "sun", pts: seg });
            break;
          }
          seen.add(sKey);
          seg.push({ x, y });
          used.add("cell:" + key);

          if (wall.has(key)) {
            paths.push({ type: src.type || "sun", pts: seg });
            break;
          }

          const f = flower.get(key);
          if (f && (level.flowers[f.i].type || "sun") === (src.type || "sun")) lit.add(f.i);

          const e = elem.get(key);
          if (e) {
            used.add(e.kind + ":" + e.i);
            if (e.kind === "mirror") {
              dir = mirrorNext(dir, stateOf(e.i));
              const d = DIR[dir];
              x += d[0]; y += d[1];
              continue;
            }
            if (e.kind === "splitter") {
              paths.push({ type: src.type || "sun", pts: seg });
              const left = dir === "R" ? "U" : dir === "L" ? "D" : dir === "U" ? "L" : "R";
              const right = dir === "R" ? "D" : dir === "L" ? "U" : dir === "U" ? "R" : "L";
              for (const nd of [dir, left, right]) {
                const dd = DIR[nd];
                queue.push({ x: x + dd[0], y: y + dd[1], dir: nd, pts: [{ x, y }] });
              }
              break;
            }
            if (e.kind === "portal") {
              const pair = level.portals.find((p, i) => i !== e.i && p.pair === e.pair);
              if (pair) {
                paths.push({ type: src.type || "sun", pts: seg });
                x = pair.x; y = pair.y;
                const d = DIR[dir];
                x += d[0]; y += d[1];
                seg = [{ x: pair.x, y: pair.y }];
                used.add("cell:" + pair.x + "," + pair.y);
                continue;
              }
            }
          }

          const d = DIR[dir];
          x += d[0]; y += d[1];
        }
      }
    }
    return { lit, paths: paths.filter((p) => p.pts.length > 0), used };
  }

  function isSolved(level, mirrorStates) {
    const { lit } = trace(level, mirrorStates);
    return (level.flowers || []).every((f, i) => lit.has(i));
  }

  function rotatables(level) {
    return (level.mirrors || []).map((m, i) => ({ m, i })).filter(({ m }) => !m.fixed);
  }

  function stateWithBits(level, bits) {
    const states = new Array((level.mirrors || []).length).fill(0);
    rotatables(level).forEach((r, j) => { states[r.i] = (bits >> j) & 1; });
    return states;
  }

  function solve(level, startBits) {
    const n = rotatables(level).length;
    if (n > 16) return null;
    const start = (startBits || 0) & ((1 << n) - 1);
    const seen = new Set([start]);
    let frontier = [start];
    let depth = 0;
    if (isSolved(level, stateWithBits(level, start))) return { taps: 0, bits: start };
    while (frontier.length && depth < n) {
      depth++;
      const next = [];
      for (const bits of frontier) {
        for (let j = 0; j < n; j++) {
          const nb = bits ^ (1 << j);
          if (seen.has(nb)) continue;
          seen.add(nb);
          if (isSolved(level, stateWithBits(level, nb))) return { taps: depth, bits: nb };
          next.push(nb);
        }
      }
      frontier = next;
    }
    return null;
  }

  function solvePath(level, startBits) {
    const n = rotatables(level).length;
    if (n > 16) return null;
    const start = (startBits || 0) & ((1 << n) - 1);
    const prev = new Map([[start, null]]);
    const queue = [start];
    if (isSolved(level, stateWithBits(level, start))) return [];
    while (queue.length) {
      const bits = queue.shift();
      for (let j = 0; j < n; j++) {
        const nb = bits ^ (1 << j);
        if (prev.has(nb)) continue;
        prev.set(nb, { from: bits, j });
        if (isSolved(level, stateWithBits(level, nb))) {
          const path = [];
          let cur = nb;
          while (prev.get(cur)) {
            const p = prev.get(cur);
            path.push(p.j);
            cur = p.from;
          }
          return path.reverse();
        }
        queue.push(nb);
      }
    }
    return null;
  }

  window.Puzzle = { trace, isSolved, solve, solvePath, rotatables, mirrorNext };
})();
