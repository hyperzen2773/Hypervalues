#!/usr/bin/env node
/*
 * Add a Philosophy category to Hypervalues.
 * Run from the project root: node tools/add_philosophy.js
 *
 * The script backs up all files before writing. It preserves existing scores
 * and only adds/replaces the ten Philosophy value IDs.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.cwd();
const dataPath = path.join(root, "data.js");
const treePath = path.join(root, "questions_tree.json");
const scoresPath = path.join(root, "ideology_scores.json");

for (const file of [dataPath, treePath, scoresPath]) {
  if (!fs.existsSync(file)) throw new Error(`Required file not found: ${file}`);
}

const dataText = fs.readFileSync(dataPath, "utf8");
const tree = JSON.parse(fs.readFileSync(treePath, "utf8"));
const jsonScores = JSON.parse(fs.readFileSync(scoresPath, "utf8"));

function findDeclaration(source, name) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=`);
  const match = re.exec(source);
  if (!match) throw new Error(`Could not find "const ${name} =" in data.js`);
  const start = match.index;
  const exprStart = source.indexOf("=", match.index) + 1;
  let quote = null, escaped = false, lineComment = false, blockComment = false;
  let depth = 0, end = -1;
  for (let i = exprStart; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === ";" && depth === 0) { end = i + 1; break; }
  }
  if (end < 0) throw new Error(`Could not find the end of declaration "${name}"`);
  const expression = source.slice(exprStart, end - 1).trim();
  let value;
  try { value = vm.runInNewContext(`(${expression})`); }
  catch (e) { throw new Error(`Could not read ${name} from data.js: ${e.message}`); }
  return { start, end, value };
}

const names = ["categories", "categoryTitles", "resultsMapping", "ideologyScores", "descriptions"];
const decl = {};
for (const name of names) decl[name] = findDeclaration(dataText, name);

const categories = decl.categories.value;
const categoryTitles = decl.categoryTitles.value;
const resultsMapping = decl.resultsMapping.value;
const ideologyScores = decl.ideologyScores.value;
const descriptions = decl.descriptions.value;

if (!Array.isArray(categories) || !categoryTitles || !resultsMapping || !ideologyScores) {
  throw new Error("One or more data.js registries have an unexpected structure.");
}

const values = {
  rationalism: "Rationalism",
  empiricism: "Empiricism",
  materialism: "Materialism",
  idealism: "Idealism",
  pragmatism: "Pragmatism",
  existentialism: "Existentialism",
  nihilism: "Nihilism",
  stoicism: "Stoicism",
  utilitarianism: "Utilitarianism",
  deontology: "Deontology"
};

const philosophyQuestions = [{
  id: "p1",
  text: "Which philosophical approach most closely represents your view of knowledge, reality, and ethics?",
  options: [
    { text: "Rationalism: reason and logical deduction are the primary foundations of knowledge", next: "rationalism" },
    { text: "Empiricism: knowledge should be grounded primarily in observation and experience", next: "empiricism" },
    { text: "Materialism: physical reality is fundamental, and ideas arise from material conditions", next: "materialism" },
    { text: "Idealism: ideas, consciousness, or spiritual principles are fundamental to reality", next: "idealism" },
    { text: "Pragmatism: judge ideas by their practical consequences and what works in experience", next: "pragmatism" },
    { text: "Existentialism: individuals confront freedom and responsibility and create meaning through choices", next: "existentialism" },
    { text: "Nihilism: reject the idea that life or morality has inherent, objective meaning", next: "nihilism" },
    { text: "Stoicism: emphasize virtue, reason, self-discipline, and accepting what is beyond one's control", next: "stoicism" },
    { text: "Utilitarianism: judge actions by their consequences for overall well-being", next: "utilitarianism" },
    { text: "Deontology: moral duties and principles can matter independently of consequences", next: "deontology" }
  ]
}, ...Object.keys(values).map(id => ({ id, text: values[id] }))];

/*
 * Conservative evidence rules. A score is added only when a description or
 * ideology name explicitly indicates the philosophical school/claim.
 * No score is inferred merely from broad policy positions (e.g. socialism
 * does not automatically mean materialism).
 */
const rules = [
  ["rationalism", /\b(rationalism|rationalist philosophy|primacy of reason|reason as the (?:primary|chief|sole) source of knowledge|knowledge through reason|logical deduction)\b/i, 0.85],
  ["empiricism", /\b(empiricism|empiricist|knowledge (?:is|comes|derives) from (?:observation|experience)|experience as the (?:primary|chief|sole) source of knowledge)\b/i, 0.85],
  ["materialism", /\b(dialectical materialism|historical materialism|philosophical materialism|materialist philosophy|metaphysical materialism)\b/i, 0.95],
  ["idealism", /\b(philosophical idealism|metaphysical idealism|idealist philosophy|objective idealism|subjective idealism)\b/i, 0.95],
  ["pragmatism", /\b(pragmatism|pragmatist philosophy|pragmatic philosophy|practical consequences as the (?:test|criterion) of truth)\b/i, 0.9],
  ["existentialism", /\b(existentialism|existentialist philosophy|authenticity and the creation of meaning|existential freedom)\b/i, 0.95],
  ["nihilism", /\b(nihilism|nihilist philosophy|inherent (?:or objective )?meaninglessness|denial of inherent meaning|rejection of objective meaning)\b/i, 0.95],
  ["stoicism", /\b(stoicism|stoic philosophy|stoic ethics|stoic virtue ethics)\b/i, 0.95],
  ["utilitarianism", /\b(utilitarianism|utilitarian ethics|utilitarian philosophy|greatest happiness principle|maximi[sz]e(?:s|d)? overall (?:utility|well-being|welfare))\b/i, 0.95],
  ["deontology", /\b(deontology|deontological ethics|deontologist|categorical imperative|duty-based ethics|moral duties independent of consequences)\b/i, 0.95]
];

function scoresFor(label, description) {
  const text = `${label || ""}. ${description || ""}`;
  const out = {};
  for (const [id, pattern, score] of rules) {
    if (pattern.test(text)) out[id] = score;
  }
  return out;
}

function parseScoreString(s) {
  const out = {};
  String(s || "").split("|").forEach(part => {
    const at = part.lastIndexOf(":");
    if (at <= 0) return;
    const key = part.slice(0, at).trim();
    const val = Number(part.slice(at + 1));
    if (key && Number.isFinite(val)) out[key] = val;
  });
  return out;
}
function formatScore(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}
function mergeScoreString(oldString, additions) {
  const parsed = parseScoreString(oldString);
  for (const id of Object.keys(values)) delete parsed[id];
  Object.assign(parsed, additions);
  return Object.entries(parsed).map(([k, v]) => `${k}:${formatScore(v)}`).join("|");
}

if (!Array.isArray(tree.philosophy)) tree.philosophy = philosophyQuestions;
else {
  const oldIds = new Set(tree.philosophy.map(q => q.id));
  const additions = philosophyQuestions.filter(q => !oldIds.has(q.id));
  tree.philosophy.push(...additions);
}

if (!categories.includes("philosophy")) categories.push("philosophy");
categoryTitles.philosophy = "Philosophy";
resultsMapping.philosophy = values;

let matched = 0;
for (const label of Object.keys(ideologyScores)) {
  const extra = scoresFor(label, descriptions && descriptions[label]);
  ideologyScores[label] = mergeScoreString(ideologyScores[label], extra);
  if (Object.keys(extra).length) matched++;
}

// Keep the JSON profile descriptions intact and synchronize score strings.
for (const label of Object.keys(ideologyScores)) {
  if (!jsonScores[label]) {
    jsonScores[label] = { d: (descriptions && descriptions[label]) || "", s: ideologyScores[label] };
  } else {
    jsonScores[label].s = ideologyScores[label];
    if (typeof jsonScores[label].d !== "string") {
      jsonScores[label].d = (descriptions && descriptions[label]) || "";
    }
  }
}

let updated = dataText;
for (const name of names) {
  const item = decl[name];
  updated = updated.slice(0, item.start) +
    `const ${name} = ${JSON.stringify(
      name === "categories" ? categories :
      name === "categoryTitles" ? categoryTitles :
      name === "resultsMapping" ? resultsMapping :
      name === "ideologyScores" ? ideologyScores : descriptions,
      null, 4
    )};` +
    updated.slice(item.end);
  // Subsequent declaration offsets shift after replacement. Re-find each
  // remaining declaration from the current source on the next iteration.
  for (let j = names.indexOf(name) + 1; j < names.length; j++) {
    decl[names[j]] = findDeclaration(updated, names[j]);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const file of [dataPath, treePath, scoresPath]) {
  fs.copyFileSync(file, `${file}.backup-${stamp}`);
}

fs.writeFileSync(dataPath, updated, "utf8");
fs.writeFileSync(treePath, JSON.stringify(tree, null, 4) + "\n", "utf8");
fs.writeFileSync(scoresPath, JSON.stringify(jsonScores, null, 4) + "\n", "utf8");

console.log("Philosophy category added successfully.");
console.log(`Existing ideology profiles with at least one explicit philosophical match: ${matched}`);
console.log("Backups created beside data.js, questions_tree.json, and ideology_scores.json.");
console.log("The scoring engine was not modified.");
