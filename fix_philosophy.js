
const fs = require("fs");

const files = {
  data: "data.js",
  scores: "ideology_scores.json",
  questions: "questions_tree.json"
};

const philosophy = {
  rationalism: {
    description: "Reason and logical thought are the primary foundations of knowledge. Truth should be established through coherent reasoning and principles, rather than relying only on sensory experience."
  },
  empiricism: {
    description: "Knowledge comes primarily from observation, sensory experience and evidence. Claims should be tested against what can be observed and experienced."
  },
  materialism: {
    description: "Physical matter and material conditions are fundamental to reality. Ideas, consciousness and social phenomena arise from or depend on material processes."
  },
  idealism: {
    description: "Ideas, consciousness or spiritual principles are fundamental to reality. The world cannot be understood entirely through physical matter alone."
  },
  pragmatism: {
    description: "Ideas should be evaluated through their practical consequences. The value of a belief is connected to how well it works in experience and practice."
  },
  existentialism: {
    description: "Individual existence, freedom, choice and responsibility are central. People create meaning through their choices rather than simply receiving a predetermined purpose."
  },
  nihilism: {
    description: "There is no inherent meaning, objective value or universally binding moral foundation. Established beliefs about meaning and morality can be questioned."
  },
  stoicism: {
    description: "A good life depends on reason, self-discipline and virtue. People should distinguish what they can control from what they cannot."
  },
  utilitarianism: {
    description: "Actions should be evaluated by their consequences, with the best action being the one that produces the greatest overall well-being."
  },
  deontology: {
    description: "Some duties, principles and moral rules must be respected regardless of whether breaking them would produce better consequences."
  }
};

const questionText =
  "Which perspective comes closest to how you understand reality, knowledge, meaning and what makes an action right?";

const answerTexts = {
  rationalism:
    "Logical reasoning and consistent principles are the most reliable foundations for understanding the world.",
  empiricism:
    "Observation, evidence and direct experience are the best ways to establish what is true.",
  materialism:
    "The physical world and material conditions are fundamental to everything that exists.",
  idealism:
    "Ideas, consciousness or spiritual principles are more fundamental than physical matter.",
  pragmatism:
    "The value of an idea depends on its practical results and whether it works in reality.",
  existentialism:
    "Individual freedom, personal responsibility and creating meaning through choices are central.",
  nihilism:
    "There is no inherent meaning or universally objective foundation for values and morality.",
  stoicism:
    "Reason, virtue, self-discipline and accepting what cannot be controlled are most important.",
  utilitarianism:
    "The right action is the one that produces the greatest overall well-being.",
  deontology:
    "Certain moral duties and principles must be followed regardless of the consequences."
};

const philosophyIds = Object.keys(philosophy);

// Only explicit references are classified automatically.
// Indirect or ambiguous references remain neutral (0).
function classifyExplicitly(description) {
  const text = description.toLowerCase();
  const result = {};

  for (const id of philosophyIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    const match = pattern.exec(text);

    let score = 0;

    if (match) {
      const before = text.slice(
        Math.max(0, match.index - 90),
        match.index
      );

      const isRejected =
        /\b(rejects?|opposes?|opposition to|against|denies?|criticizes?|criticises?)\s+(?:the\s+)?(?:idea of\s+)?$/i.test(before) ||
        new RegExp(`\\banti[- ]${escaped}\\b`, "i").test(text);

      score = isRejected ? -0.7 : 0.7;
    }

    result[id] = score;
  }

  return result;
}

function parseScores(scoreString) {
  const result = {};

  for (const item of (scoreString || "").split("|")) {
    const index = item.lastIndexOf(":");
    if (index < 1) continue;

    const key = item.slice(0, index);
    const value = Number(item.slice(index + 1));

    if (Number.isFinite(value)) result[key] = value;
  }

  return result;
}

function makeScoreString(oldString, description) {
  const scores = parseScores(oldString);

  // Remove all old philosophy scores, including the fake +0.1 defaults.
  for (const id of philosophyIds) {
    delete scores[id];
  }

  // Keep all existing non-philosophy scores.
  const classified = classifyExplicitly(description);

  // Add all ten philosophy dimensions.
  for (const id of philosophyIds) {
    scores[id] = classified[id];
  }

  return Object.entries(scores)
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

function backup(path) {
  fs.copyFileSync(path, `${path}.before_philosophy_fix.bak`);
}

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing file: ${path}`);
  }
}

const dataJs = fs.readFileSync(files.data, "utf8");
const profiles = JSON.parse(fs.readFileSync(files.scores, "utf8"));
const tree = JSON.parse(fs.readFileSync(files.questions, "utf8"));

const start = dataJs.indexOf("const ideologyScores = {");
if (start === -1) {
  throw new Error("Could not find ideologyScores in data.js");
}

const objectStart = dataJs.indexOf("{", start);
const objectEnd = dataJs.indexOf("\n};", objectStart);

if (objectEnd === -1) {
  throw new Error("Could not find the end of ideologyScores");
}

let explicitMatches = 0;

for (const [name, profile] of Object.entries(profiles)) {
  if (!profile.d) {
    throw new Error(`Missing ideology description: ${name}`);
  }

  profile.s = makeScoreString(profile.s, profile.d);

  const classified = classifyExplicitly(profile.d);
  explicitMatches += Object.values(classified).filter(v => v !== 0).length;
}

// Rebuild the canonical ideologyScores object.
const entries = Object.entries(profiles);
const newObject =
  "const ideologyScores = {\n" +
  entries.map(([name, profile], index) =>
    `    ${JSON.stringify(name)}: ${JSON.stringify(profile.s)}${index < entries.length - 1 ? "," : ""}`
  ).join("\n") +
  "\n};";

let updatedData = dataJs.slice(0, start) +
  newObject +
  dataJs.slice(objectEnd + 3);

// Add or replace the philosophical value descriptions.
const descriptionsObject =
  "const philosophyDescriptions = " +
  JSON.stringify(
    Object.fromEntries(
      Object.entries(philosophy).map(([id, item]) => [id, item.description])
    ),
    null,
    4
  ) +
  ";";

const descStart = updatedData.indexOf("const philosophyDescriptions =");

if (descStart !== -1) {
  const descEnd = updatedData.indexOf("\n};", descStart);
  if (descEnd === -1) throw new Error("Could not replace philosophyDescriptions");

  updatedData =
    updatedData.slice(0, descStart) +
    descriptionsObject +
    updatedData.slice(descEnd + 3);
} else {
  const insertAt = updatedData.indexOf("const ideologyScores =");
  updatedData =
    updatedData.slice(0, insertAt) +
    descriptionsObject +
    "\n\n" +
    updatedData.slice(insertAt);
}

// Update the Philosophy question.
if (!Array.isArray(tree.philosophy)) {
  throw new Error("Philosophy category is missing from questions_tree.json");
}

const question = tree.philosophy.find(node => node.id === "p1");

if (!question) {
  throw new Error("Could not find Philosophy question p1");
}

question.text = questionText;

for (const option of question.options) {
  if (answerTexts[option.next]) {
    option.text = answerTexts[option.next];
  }
}

// Create backups before writing.
for (const path of Object.values(files)) backup(path);

// Save all updated files.
fs.writeFileSync(files.data, updatedData);
fs.writeFileSync(files.scores, JSON.stringify(profiles, null, 4) + "\n");
fs.writeFileSync(files.questions, JSON.stringify(tree, null, 4) + "\n");

// Verify that every profile contains all ten dimensions.
for (const [name, profile] of Object.entries(profiles)) {
  const scores = parseScores(profile.s);

  for (const id of philosophyIds) {
    if (!(id in scores)) {
      throw new Error(`${name} is missing ${id}`);
    }
  }
}

console.log("Philosophy files updated.");
console.log(`Ideologies processed: ${entries.length}`);
console.log(`Philosophy dimensions per ideology: ${philosophyIds.length}`);
console.log(`Explicit references detected: ${explicitMatches}`);
console.log("Unsupported positions are set to 0.");
console.log("Backups created.");
