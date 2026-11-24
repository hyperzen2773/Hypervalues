const fs = require("fs");
const vm = require("vm");

const context = {};
const source = fs.readFileSync("data.js", "utf8");

vm.runInNewContext(
  source + `
    globalThis.__scores = ideologyScores;
    globalThis.__descriptions = descriptions;
  `,
  context
);

const json = JSON.parse(
  fs.readFileSync("ideology_scores.json", "utf8")
);

console.log("\n=== PROFILE MISMATCHES ===");

let mismatches = 0;

for (const [name, scores] of Object.entries(context.__scores)) {
  const jsonScores = json[name]?.s;

  if (scores !== jsonScores) {
    mismatches++;
    console.log("\n" + name);
    console.log("data.js:             ", scores);
    console.log("ideology_scores.json:", jsonScores ?? "MISSING");
  }
}

console.log("\nTotal mismatches:", mismatches);

console.log("\n=== NIHILIST ANARCHISM ===");
console.log(
  "Definition:",
  context.__descriptions["Nihilist Anarchism"] ?? "MISSING"
);

console.log("\n=== SOCIAL AUTONOMY ===");

const holders = Object.entries(context.__scores)
  .filter(([name, scores]) => /(?:^|\|)social_autonomy:-?\d*\.?\d+(?:\||$)/.test(scores))
  .map(([name]) => name);

console.log("Ideologies holding social_autonomy:", holders);
