const fs = require("fs");

const FILE = "ideology_scores.json";
const DIMENSIONS = [
  "rationalism",
  "empiricism",
  "materialism",
  "idealism",
  "pragmatism",
  "existentialism",
  "nihilism",
  "stoicism",
  "utilitarianism",
  "deontology"
];

// Add the reviewed scores for every ideology here.
// Every score must be between -1.00 and +1.00,
// with exactly two decimal places.
const philosophyScores = {
  // Example format only — replace with reviewed scores:
  //
  // "Evolianism": {
  //   rationalism: 0.20,
  //   empiricism: -0.30,
  //   materialism: -0.90,
  //   idealism: 0.90,
  //   pragmatism: 0.10,
  //   existentialism: 0.20,
  //   nihilism: -0.80,
  //   stoicism: 0.70,
  //   utilitarianism: -0.30,
  //   deontology: 0.60
  // }
};

const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const ideologyNames = Object.keys(data);

const missing = ideologyNames.filter(
  name => !philosophyScores[name]
);

const invalid = [];

for (const [name, scores] of Object.entries(philosophyScores)) {
  if (!data[name]) {
    invalid.push(`${name}: ideology does not exist`);
    continue;
  }

  for (const dimension of DIMENSIONS) {
    const score = scores[dimension];

    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < -1 ||
      score > 1 ||
      !Number.isInteger(score * 100)
    ) {
      invalid.push(`${name}.${dimension}: invalid score`);
    }
  }
}

if (missing.length || invalid.length) {
  console.error("No files were changed.");

  if (missing.length) {
    console.error("Missing ideologies:", missing);
  }

  if (invalid.length) {
    console.error("Invalid entries:", invalid);
  }

  process.exit(1);
}

// Preserve all non-philosophy scores.
for (const name of ideologyNames) {
  const parts = (data[name].s || "")
    .split("|")
    .filter(Boolean)
    .filter(part => {
      const key = part.slice(0, part.lastIndexOf(":"));
      return !DIMENSIONS.includes(key);
    });

  for (const dimension of DIMENSIONS) {
    const score = philosophyScores[name][dimension];
    const formatted = score.toFixed(2);
    parts.push(`${dimension}:${formatted}`);
  }

  data[name].s = parts.join("|");
}

const backup = `${FILE}.before_reviewed_philosophy.bak`;

fs.copyFileSync(FILE, backup);

fs.writeFileSync(
  FILE,
  JSON.stringify(data, null, 4) + "\n"
);

console.log(`Updated ${ideologyNames.length} ideologies.`);
console.log(`Applied ${DIMENSIONS.length} philosophy scores each.`);
console.log(`Total scores: ${ideologyNames.length * DIMENSIONS.length}`);
console.log(`Backup: ${backup}`);
