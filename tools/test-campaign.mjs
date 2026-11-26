import fs from "node:fs";
import vm from "node:vm";

function load(files) {
  const box = { window: {}, structuredClone };
  vm.createContext(box);
  for (const file of files) vm.runInContext(fs.readFileSync(file, "utf8"), box);
  return box.window;
}

const base = load(["assets/levels.js", "assets/puzzle.js"]);
const original = base.LEVELS.slice(0, 40);
const expanded = load(["assets/levels.js", "assets/puzzle.js", "assets/extra-levels.js"]);
const levels = [...expanded.LEVELS, ...expanded.EXTRA_LEVELS];
if (expanded.LEVELS.length !== 40 || levels.length !== 120) throw Error("campaign must retain 40 original levels and add 80 levels");
if (original.some((level, index) => JSON.stringify(level) !== JSON.stringify(expanded.LEVELS[index]))) throw Error("original levels or their progress identifiers changed");
for (let chapter = 0; chapter < 12; chapter++) {
  const group = levels.filter(level => level.chapter === chapter);
  if (group.length !== 10) throw Error("chapter " + (chapter + 1) + " must contain 10 levels");
}
for (const level of expanded.EXTRA_LEVELS) {
  const result = expanded.Puzzle.solve(level, 0);
  if (!result || result.taps !== level.par || expanded.Puzzle.isSolved(level, new Array(level.mirrors.length).fill(0))) throw Error("invalid level " + level.id);
  const cells = [...level.mirrors, ...level.splitters, ...level.portals, ...level.flowers, ...level.walls];
  if (new Set(cells.map(cell => cell.x + "," + cell.y)).size !== cells.length) throw Error("overlapping cells in level " + level.id);
}
console.log("PASS: 40 original levels unchanged; 80 added solvable levels; 12 chapters × 10 levels");

const endless = load(["assets/levels.js", "assets/extra-levels.js", "assets/puzzle.js", "assets/endless.js"]);
let previous = 0;
for (const stage of [1, 2, 3, 5, 10, 20, 30, 50, 100, 120, 250, 1000]) {
  const seed = 20261126;
  const first = endless.EndlessGarden.generate(seed, stage);
  const second = endless.EndlessGarden.generate(seed, stage);
  const solve = first && endless.Puzzle.solve(first, 0);
  if (!first || !second || JSON.stringify(first) !== JSON.stringify(second)) throw Error("daily challenge is not reproducible at stage " + stage);
  if (!solve || solve.taps !== first.par || solve.taps < previous) throw Error("invalid or easier late challenge at stage " + stage);
  if (!endless.Puzzle.isSolved(first, first.mirrors.map(mirror => mirror.fixed ? 0 : 0))) {
    console.log("PASS endless stage", stage, "par", first.par, "mirrors", first.mirrors.length);
  }
  previous = solve.taps;
}
console.log("PASS: reproducible endless puzzle generation through stage 1000");

const game = fs.readFileSync("assets/game.js", "utf8");
if (!game.includes("oldCampaignComplete") || !game.includes("Math.max(s.unlocked, 41)")) throw Error("legacy campaign unlock migration missing");
if (!game.includes("savedEndless.current") || !game.includes("resumeState: endless.current")) throw Error("endless checkpoint persistence missing");
console.log("PASS: old campaign completion migration and endless checkpoint persistence present");
