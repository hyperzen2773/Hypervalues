
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data.js");
const scoresPath = path.join(root, "ideology_scores.json");

const candidates = [
    "Classical Liberalism",
    "Social Liberalism",
    "Bleeding-Heart Liberalism",
    "Bleeding-Heart Libertarianism",
    "Liberal Atlanticism",
    "Liberal Kemalism",
    "Technoliberalism",
    "Techno-Social Liberalism",
    "American Model",
    "Tsaingwenism",
    "Liberal Imperialism",
    "Liberal Meritocracy",
    "Geolibertarianism",
    "Social Libertarianism",
    "Pirate Politics",
    "Agorist Minarchism",
    "Libertarian Social Democracy",
    "Cyber-Libertarianism",
    "Libertarian Conservatism",
    "Fusionism",
    "Libertarian Helveticism",
    "Cyber-Federalism",
    "Libertarian Socialism",
    "Democratic Confederalism",
    "Fourierism",
    "Cosmopolitan Distributism",
    "Anarcho-Syndicalism",
    "Left-Agorism",
    "Anarcho-Communism",
    "Solarpunk Anarchism",
    "Insurrectionary Anarchism",
    "Mutualism",
    "Market Anarchism",
    "Panarchism",
    "Geoanarchism",
    "Green Anarchism",
    "Post-Anarchism",
    "Post-left",
    "Anarcho-Transhumanism",
    "Ego-Communism",
    "Ego-Mutualism",
    "Anarcho-Capitalism",
    "Bleeding-Heart Anarcho-Capitalism",
    "Crypto-Anarchism",
    "Avaritionism",
    "Autarchism",
    "Free-Market Anarcho-Distributism",
    "Agorism"
];

const SCORE = 0.7;

function stop(message) {
    console.error("STOPPED:", message);
    process.exit(1);
}

if (!fs.existsSync(dataPath) || !fs.existsSync(scoresPath)) {
    stop("Could not find data.js or ideology_scores.json.");
}

const dataSource = fs.readFileSync(dataPath, "utf8");
const scores = JSON.parse(fs.readFileSync(scoresPath, "utf8"));

const missing = candidates.filter(name => !scores[name]);

if (missing.length) {
    stop("These ideology entries were not found:\n" + missing.join("\n"));
}

// Update score profiles.
let added = [];

for (const name of candidates) {
    const parts = (scores[name].s || "").split("|");
    const existing = parts.findIndex(
        part => part.slice(0, part.lastIndexOf(":")) === "social_autonomy"
    );

    if (existing !== -1) {
        parts[existing] = `social_autonomy:${SCORE}`;
    } else {
        parts.push(`social_autonomy:${SCORE}`);
    }

    scores[name].s = parts.filter(Boolean).join("|");
    added.push(name);
}

// Verify every candidate received the value.
for (const name of candidates) {
    if (!scores[name].s.split("|").some(
        part => part === `social_autonomy:${SCORE}`
    )) {
        stop("Verification failed for " + name);
    }
}

// Ensure data.js already registers the value.
if (!dataSource.includes('"social_autonomy"')) {
    stop("social_autonomy is missing from data.js. Register it first.");
}

// Save only after all checks pass.
fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 4) + "\n");

console.log("SUCCESS: Social Autonomy assigned to " + added.length + " ideologies.");
console.log("Score: " + SCORE);
console.log("data.js registration preserved.");
console.log("ideology_scores.json updated.");
