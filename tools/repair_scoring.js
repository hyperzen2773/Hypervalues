const fs = require("fs");
const vm = require("vm");

const DATA_FILE = "data.js";
const JSON_FILE = "ideology_scores.json";

const dataBackup = DATA_FILE + ".backup";
const jsonBackup = JSON_FILE + ".backup";

// Social Autonomy scores.
// Only assign it where individual or communal freedom from imposed
// social regulation is a meaningful part of the ideology.
const socialAutonomy = {
  "Classical Liberalism": 0.6,
  "Social Liberalism": 0.5,
  "Bleeding-Heart Libertarianism": 0.8,
  "Liberal Atlanticism": 0.5,
  "Techno-Social Liberalism": 0.5,
  "Technoliberalism": 0.5,
  "Geolibertarianism": 0.7,
  "Social Libertarianism": 0.8,
  "Pirate Politics": 0.7,
  "Agorist Minarchism": 0.8,
  "Libertarian Social Democracy": 0.6,
  "Cyber-Libertarianism": 0.8,
  "Libertarian Helveticism": 0.6,
  "Libertarian Socialism": 0.7,
  "Democratic Confederalism": 0.7,
  "Anarcho-Syndicalism": 0.7,
  "Left-Agorism": 0.8,
  "Anarcho-Communism": 0.7,
  "Solarpunk Anarchism": 0.7,
  "Mutualism": 0.7,
  "Market Anarchism": 0.8,
  "Panarchism": 0.9,
  "Geoanarchism": 0.8,
  "Green Anarchism": 0.7,
  "Post-Anarchism": 0.6,
  "Post-left": 0.6,
  "Anarcho-Transhumanism": 0.7,
  "Ego-Communism": 0.6,
  "Anarcho-Capitalism": 0.7,
  "Bleeding-Heart Anarcho-Capitalism": 0.7,
  "Crypto-Anarchism": 0.9,
  "Autarchism": 0.8,
  "Free-Market Anarcho-Distributism": 0.7,
  "Agorism": 0.8
};

const nihilistDefinition =
  "A tendency within anarchist thought that combines rejection of imposed political authority with philosophical nihilism. It questions or denies the existence of objective, binding moral and political foundations, and treats social institutions, hierarchies and conventions as lacking inherent legitimacy. Its positions on cooperation, organization and individual conduct can vary among proponents.";

function backup(file, destination) {
  if (!fs.existsSync(destination)) {
    fs.copyFileSync(file, destination);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Find and update a quoted ideology score string in data.js.
function updateProfile(source, name, scoreString) {
  const escaped = escapeRegex(name);

  const regex = new RegExp(
    `(^[\\t ]*(?:"${escaped}"|'${escaped}')\\s*:\\s*)(["'])([^"']*)\\2`,
    "m"
  );

  if (!regex.test(source)) {
    return { source, found: false };
  }

  return {
    source: source.replace(regex, (_, prefix) =>
      prefix + JSON.stringify(scoreString)
    ),
    found: true
  };
}

// Read the actual JavaScript objects from data.js.
function loadData(source) {
  const context = {};

  vm.runInNewContext(
    source + `
      globalThis.__scores = ideologyScores;
      globalThis.__descriptions = descriptions;
    `,
    context
  );

  return {
    scores: context.__scores,
    descriptions: context.__descriptions
  };
}

if (!fs.existsSync(DATA_FILE) || !fs.existsSync(JSON_FILE)) {
  throw new Error("Run this script from your project root directory.");
}

backup(DATA_FILE, dataBackup);
backup(JSON_FILE, jsonBackup);

let source = fs.readFileSync(DATA_FILE, "utf8");

// Add the Nihilist Anarchism definition if missing.
let data = loadData(source);

if (!data.descriptions["Nihilist Anarchism"]) {
  const descriptionsPattern =
    /(const\s+descriptions\s*=\s*\{)([\s\S]*?)(\n\};)/;

  if (!descriptionsPattern.test(source)) {
    throw new Error(
      "Could not safely locate the descriptions object in data.js. No changes completed."
    );
  }

  source = source.replace(
    descriptionsPattern,
    (_, start, contents, end) =>
      start +
      contents +
      '\n    "Nihilist Anarchism": ' +
      JSON.stringify(nihilistDefinition) +
      "," +
      end
  );

  console.log("Added definition: Nihilist Anarchism");
}

// Apply the selected Social Autonomy scores to data.js.
let addedSocialAutonomy = 0;
const missingSocialAutonomy = [];

for (const [name, value] of Object.entries(socialAutonomy)) {
  data = loadData(source);

  const existing = data.scores[name];

  if (typeof existing !== "string") {
    missingSocialAutonomy.push(name);
    continue;
  }

  if (/(?:^|\|)social_autonomy:/.test(existing)) {
    continue;
  }

  const updated = updateProfile(
    source,
    name,
    existing + "|social_autonomy:" + value
  );

  if (!updated.found) {
    missingSocialAutonomy.push(name);
    continue;
  }

  source = updated.source;
  addedSocialAutonomy++;
}

// Validate data.js before writing.
data = loadData(source);

for (const [name, scores] of Object.entries(data.scores)) {
  if (typeof scores !== "string") {
    throw new Error("Invalid score string for " + name);
  }

  for (const entry of scores.split("|")) {
    const match = entry.match(/^([^:]+):(-?\d*\.?\d+)$/);

    if (!match) {
      throw new Error("Invalid score entry in " + name + ": " + entry);
    }

    const value = Number(match[2]);

    if (!Number.isFinite(value) || value < -1 || value > 1 || value === 0) {
      throw new Error("Invalid score value in " + name + ": " + entry);
    }
  }
}

// Synchronize ideology_scores.json with data.js.
// Existing definitions and other JSON properties are preserved.
const json = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));

let synchronized = 0;
let created = 0;

for (const [name, scores] of Object.entries(data.scores)) {
  if (!json[name]) {
    const definition = data.descriptions[name];

    if (!definition) {
      throw new Error(
        "Cannot create JSON entry for " + name +
        ": its definition is missing from data.js."
      );
    }

    json[name] = {
      d: definition,
      s: scores
    };

    created++;
  } else {
    json[name].s = scores;
  }

  synchronized++;
}

// Write data.js and JSON only after validation succeeds.
fs.writeFileSync(DATA_FILE, source);
fs.writeFileSync(
  JSON_FILE,
  JSON.stringify(json, null, 2) + "\n"
);

console.log("\n=== REPAIR RESULTS ===");
console.log("Profiles synchronized:", synchronized);
console.log("New JSON profiles:", created);
console.log("Social Autonomy scores added:", addedSocialAutonomy);
console.log("Nihilist Anarchism definition:", "present");
console.log("Backups:", dataBackup, "and", jsonBackup);

if (missingSocialAutonomy.length) {
  console.log("\nSocial Autonomy profiles not found in data.js:");
  console.log(missingSocialAutonomy.join(", "));
}

console.log("\nRun: node tools/check_scoring.js");
