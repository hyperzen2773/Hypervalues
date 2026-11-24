#!/usr/bin/env node
/*
 * Add the value "Individualism" to the Nation category of Hypervalues.
 * Run from the project root:  node tools/add_individualism.js
 *
 * What it does
 *   - registers Individualism in resultsMapping.nation and adds its description,
 *   - adds an option and a leaf to the Nation question tree (n1, "Who should count as us?"),
 *   - sets its stance (-1 opposes ... +1 matches) for every ideology that has a clear one,
 *   - marks its icon as AI-made (put icons/nation/individualism.svg in place yourself).
 * Safe to re-run. Backups: *.backup-individualism-<time>. The scoring engine is not modified.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.cwd();
const dataPath = path.join(root, "data.js");
const treePath = path.join(root, "questions_tree.json");
const scoresPath = path.join(root, "ideology_scores.json");
for (const f of [dataPath, treePath, scoresPath]) if (!fs.existsSync(f)) throw new Error(`Not found: ${f}`);

const ID = "individualism";
const NAME = "Individualism";
const CATEGORY = "nation";
const DESCRIPTION = "The view that the individual is the basic unit of political life, and that each person's rights, choices and freedom come before the claims of any group, nation or collective. Individualists hold that communities should be formed by free association rather than imposed, and that no one owes their identity or loyalty to a state, class or people by birth. In politics it supports civil liberties, personal autonomy and limits on collective authority.";
const OPTION = { text: "The individual: each person's rights and freedom come before any group, so a community is whatever free individuals choose to join", next: ID };

// Stances for ideologies (-1 opposes, +1 matches). Edit freely and re-run.
const STANCES = {
  "National Syndicalism": -0.84,
  "Brazilian Integralism": -0.43,
  "Italian Fascism": -0.9,
  "Evolianism": -0.58,
  "National-Socialism": -0.95,
  "Neo-Nazism": -0.95,
  "Agrarian Fascism": -0.68,
  "Strasserism": -0.82,
  "Falangism": -0.84,
  "Sansepolcrismo": -0.2,
  "Ecofascism": -0.74,
  "Sorelianism": -0.46,
  "Legionarianism": -0.81,
  "Peronism": -0.52,
  "Techno-Fascism": -0.63,
  "National Solidarity": -0.4,
  "Clerical Fascism": -0.83,
  "Rexism": -0.79,
  "Ba'athism": -0.37,
  "Duginism": -0.69,
  "Fiumanism": -0.63,
  "Pekerism": -0.57,
  "Eneasism": -0.3,
  "Social Nationalism": -0.26,
  "Ethnocacerismo": -0.83,
  "National Primitivism": -0.59,
  "Social-Bonapartism": -0.64,
  "Nationalist Kemalism": -0.8,
  "National Collectivism": -0.85,
  "Nazi-Maoism": -0.85,
  "Savinkovism": -0.81,
  "Mosleyism": -0.84,
  "Revolutionary Nationalism": -0.34,
  "Volkism": -0.9,
  "Integralism": -0.79,
  "National Capitalism": 0.36,
  "Carlism": -0.77,
  "Autocratic Monarchism": -0.32,
  "Theocratic Distributism": -0.69,
  "Clerical Monarchism": -0.76,
  "Developmental Theocracy": -0.67,
  "Classical Eurasianism": -0.36,
  "Mladorossism": -0.74,
  "National Social Capitalism": -0.29,
  "Right-State Liberalism": 0.3,
  "Monarquia Syndicalista": -0.34,
  "Serenissimism": -0.47,
  "National Conservatism": -0.21,
  "Paternalistic Conservatism": -0.37,
  "Buchanan Paleoconservatism": -0.21,
  "Red Toryism": -0.5,
  "Clerical Conservatism": -0.73,
  "Free-Market Conservatism": 0.56,
  "Agrarian Conservatism": -0.39,
  "Bonapartist Gaullism": -0.27,
  "Conservative Technoliberalism": 0.23,
  "Right-Social Authoritarianism": -0.52,
  "Kjærsgaardism": -0.2,
  "Paleoconservatism": -0.24,
  "Putinism": -0.69,
  "Post-Soviet Autocracy": -0.62,
  "Radicalism": 0.74,
  "Democratic Transhumanism": 0.22,
  "Steppe Eurasianism": -0.3,
  "Classical Kemalism": 0.65,
  "Centrist Kemalism": 0.32,
  "Austro-Corporatism": -0.58,
  "Davos System": 0.46,
  "Conservative Social Democracy": -0.27,
  "Social Distributism": -0.41,
  "Eurocommunism": 0.39,
  "Liberal Socialism": 0.77,
  "Agrarian Social Democracy": -0.31,
  "Progressive Corporatism": -0.28,
  "Christian Social Democracy": -0.43,
  "Police Labourism": -0.36,
  "Ecevitism": 0.29,
  "Left-Social Authoritarianism": -0.2,
  "Left-Social Democracy": -0.31,
  "Left Kemalism": 0.3,
  "Longism": -0.4,
  "Classical Liberalism": 0.8,
  "Neoliberalism": 0.57,
  "Social Liberalism": 0.5,
  "Bleeding-Heart Liberalism": 0.53,
  "Bleeding-Heart Libertarianism": 0.73,
  "Geo-Liberalism": 0.38,
  "Green Liberalism": 0.35,
  "Whiggism": 0.29,
  "Liberal Atlanticism": 0.48,
  "New Deal Liberalism": -0.21,
  "Liberal Kemalism": 0.68,
  "Techno-Social Liberalism": 0.27,
  "Technoliberalism": 0.52,
  "American Model": 0.56,
  "Tsaingwenism": 0.27,
  "Liberal Imperialism": 0.77,
  "Liberal Meritocracy": 0.67,
  "Christian Socialism": -0.5,
  "National Bolshevism": -0.81,
  "Democratic Socialism": 0.52,
  "Conservative Socialism": -0.48,
  "Paleosocialism": -0.46,
  "Utopian Communitarianism": -0.55,
  "Syndicalist Republicanism": 0.35,
  "Left-Eurasianism": -0.57,
  "Socialist Technoliberalism": 0.51,
  "Mugabeism": -0.3,
  "Old Left-Populism": -0.27,
  "American Technocracy": -0.74,
  "Fabian Socialism": -0.27,
  "Ujamaa": -0.68,
  "Bordigism": -0.75,
  "Italian Left Communism": -0.74,
  "Juche": -0.85,
  "Mao Zedong Thought": -0.69,
  "Maoism Third Worldism": -0.61,
  "Marxism Leninism Maoism": -0.69,
  "Luxemburgism": -0.43,
  "Trotskyism": -0.69,
  "Marxism-Leninism": -0.6,
  "Stalinism": -0.9,
  "Titoism": -0.52,
  "Dengism": -0.4,
  "Hoxhaism": -0.74,
  "Castroism": -0.72,
  "Guevarism": -0.55,
  "Cyber-Communism": -0.66,
  "De Leonism": -0.53,
  "Marxism-Kemalism": -0.33,
  "National Communism": -0.75,
  "Libertarian Municipalism": -0.1,
  "Communalism": -0.2,
  "Libertarian Socialism": 0.4,
  "Council Communism": -0.2,
  "Guild Socialism": -0.38,
  "Eco-Socialism": -0.63,
  "Cybersyn Socialism": -0.54,
  "Fourierism": -0.41,
  "Gandhian Socialism": -0.38,
  "Geolibertarianism": 0.78,
  "Social Libertarianism": 0.57,
  "Helvetic Model": 0.23,
  "Pirate Politics": 0.56,
  "Agorist Minarchism": 0.8,
  "Communal Distributism": -0.46,
  "Libertarian Social Democracy": 0.56,
  "Cosmopolitan Distributism": 0.63,
  "Cyber-Federalism": 0.71,
  "Neolibertarianism": 0.55,
  "Libertarian Conservatism": 0.61,
  "National Libertarianism": 0.25,
  "Paleolibertarianism": 0.76,
  "Cyber-Libertarianism": 0.73,
  "Objectivism": 1,
  "Fusionism": 0.76,
  "Minarcho-Avaritionism": 0.71,
  "Libertarian Helveticism": 0.43,
  "Landianism": 0.69,
  "Anarcho-Syndicalism": 0.65,
  "Platformism": -0.36,
  "Left-Agorism": 0.72,
  "Lys Noir": -0.25,
  "Anarcho-Communism": 0.2,
  "Solarpunk Anarchism": 0.26,
  "Christian Anarchism": 0.36,
  "Insurrectionary Anarchism": 0.85,
  "Catholic Workerism": -0.27,
  "Mutualism": 0.23,
  "Market Anarchism": 0.84,
  "Panarchism": 0.82,
  "Geoanarchism": 0.63,
  "Green Anarchism": 0.27,
  "Anarcho-Primitivism": 0.3,
  "Post-Anarchism": 0.63,
  "Post-left": 0.8,
  "Anarcho-Transhumanism": 0.65,
  "Ego-Communism": 0.8,
  "National-Anarchism": -0.4,
  "Ego-Mutualism": 0.9,
  "Anarcho-Capitalism": 0.95,
  "Hoppeanism": 0.63,
  "Bleeding-Heart Anarcho-Capitalism": 0.75,
  "Crypto-Anarchism": 0.8,
  "Avaritionism": 0.9,
  "Autarchism": 0.95,
  "Free-Market Anarcho-Distributism": 0.6,
  "Agorism": 0.95,
  "Left-Accelerationism": -0.51,
  "Right-Accelerationism": 0.52,
  "Effective Accelerationism": 0.22,
  "Ingsoc": -0.95,
  "Neo-Bolshevism": -0.81,
  "Obliteration of the Self": -1,
  "World State Fordism": -0.8,
  "Gileadism": -0.9,
  "One State Benefactorism": -0.9,
  "Fireman Statism": -0.61,
  "Soylentism": -0.82,
  "Burgundian System": -0.85,
  "Russian Imperial Cult": -0.84,
  "Nihilist Anarchism": 0.8,
  "Paetel's National Bolshevism": -0.7,
  "National Radicalism": -0.85,
  "Anarcho-Fascism": -0.46
};

function findDeclaration(source, name) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=`);
  const match = re.exec(source);
  if (!match) throw new Error(`Could not find "const ${name} =" in data.js`);
  const start = match.index;
  const exprStart = source.indexOf("=", match.index) + 1;
  let quote = null, escaped = false, lineComment = false, blockComment = false, depth = 0, end = -1;
  for (let i = exprStart; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === quote) quote = null; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === ";" && depth === 0) { end = i + 1; break; }
  }
  if (end < 0) throw new Error(`Could not find the end of "${name}"`);
  const value = vm.runInNewContext(`(${source.slice(exprStart, end - 1).trim()})`);
  return { start, end, value };
}
function parseScoreString(s) {
  const out = {};
  String(s || "").split("|").forEach(part => {
    const at = part.lastIndexOf(":");
    if (at <= 0) return;
    const key = part.slice(0, at).trim(), val = Number(part.slice(at + 1));
    if (key && Number.isFinite(val)) out[key] = val;
  });
  return out;
}
const fmt = n => String(Number(n.toFixed(2)));

let source = fs.readFileSync(dataPath, "utf8");
const tree = JSON.parse(fs.readFileSync(treePath, "utf8"));
const jsonScores = JSON.parse(fs.readFileSync(scoresPath, "utf8"));

// registry
const mapDecl = findDeclaration(source, "resultsMapping");
const resultsMapping = mapDecl.value;
for (const [cat, values] of Object.entries(resultsMapping)) {
  if (cat !== CATEGORY && ID in values) throw new Error(`"${ID}" is already a value of "${cat}"`);
}
if (!resultsMapping[CATEGORY]) throw new Error(`data.js has no "${CATEGORY}" category`);
resultsMapping[CATEGORY][ID] = NAME;
source = source.slice(0, mapDecl.start) + `const resultsMapping = ${JSON.stringify(resultsMapping, null, 4)};` + source.slice(mapDecl.end);

// description and icon source
const descDecl = findDeclaration(source, "descriptions");
descDecl.value[ID] = descDecl.value[ID] || DESCRIPTION;
source = source.slice(0, descDecl.start) + `const descriptions = ${JSON.stringify(descDecl.value, null, 4)};` + source.slice(descDecl.end);
const iconDecl = findDeclaration(source, "iconSources");
if (!(ID in iconDecl.value)) iconDecl.value[ID] = "ai";
source = source.slice(0, iconDecl.start) + `const iconSources = ${JSON.stringify(iconDecl.value, null, 4)};` + source.slice(iconDecl.end);

// stances
const scoresDecl = findDeclaration(source, "ideologyScores");
const ideologyScores = scoresDecl.value;
const unknown = Object.keys(STANCES).filter(n => !(n in ideologyScores));
let set = 0;
for (const label of Object.keys(ideologyScores)) {
  const parsed = parseScoreString(ideologyScores[label]);
  delete parsed[ID];
  if (label in STANCES) { parsed[ID] = STANCES[label]; set++; }
  ideologyScores[label] = Object.entries(parsed).map(([k, v]) => `${k}:${fmt(v)}`).join("|");
  if (jsonScores[label]) jsonScores[label].s = ideologyScores[label];
}
source = source.slice(0, scoresDecl.start) + `const ideologyScores = ${JSON.stringify(ideologyScores, null, 4)};` + source.slice(scoresDecl.end);

// question tree: an option on the first Nation question, and the leaf
const nodes = tree[CATEGORY];
if (!Array.isArray(nodes)) throw new Error(`questions_tree.json has no "${CATEGORY}" tree`);
const root1 = nodes[0];
if (!root1.options.some(o => o.next === ID)) root1.options.splice(1, 0, OPTION);
if (!nodes.some(n => n.id === ID)) nodes.push({ id: ID });

const stamp = "backup-individualism-" + new Date().toISOString().replace(/[:.]/g, "-");
for (const f of [dataPath, treePath, scoresPath]) fs.copyFileSync(f, `${f}.${stamp}`);
fs.writeFileSync(dataPath, source, "utf8");
fs.writeFileSync(treePath, JSON.stringify(tree, null, 2) + "\n", "utf8");
fs.writeFileSync(scoresPath, JSON.stringify(jsonScores, null, 4) + "\n", "utf8");

console.log("Individualism added to the Nation category.");
console.log(`Ideologies with an individualism stance: ${set} of ${Object.keys(ideologyScores).length}.`);
console.log(`First Nation question now has ${root1.options.length} options.`);
if (unknown.length) console.log("Names in STANCES not found in data.js:", unknown.join(", "));
console.log(`Backups: *.${stamp}`);
console.log(`Remember to add icons/${CATEGORY}/${ID}.svg.`);
