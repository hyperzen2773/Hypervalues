#!/usr/bin/env node
// Adds the ideology Anarcho-Fascism (after Jonas Nilsson's book) to the Third Position group: its value set, color,
// definition and stances in data.js, the same stances in ideology_scores.json, and a changelog entry.
//   node tools/add_anarcho_fascism.js
// Nothing is written unless every edit applies exactly once and the result runs. Then: node tools/check_scoring.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA = {
 "label": "Anarcho-Fascism",
 "group": "Dystopian",
 "after": "Revolutionary Nationalism",
 "combo": "reactionaryism|Tribalism|armed_neutrality|patchwork",
 "color": "#4a3b1f",
 "definition": "A decentralist doctrine from Jonas Nilsson's book Anarcho-Fascism: Nature Reborn (2017): government authority should be practiced in the smallest possible units able to keep their own sovereignty, beginning with the family, whose head is its authority both inside and out, and defended by a generally armed population and local militias instead of a central army or bureaucracy (patchwork, subsidiarity and confederalism, with centralism and hypercentralism rejected). The state exists only to defend its people in war and to help them flourish, and it serves the interests of its own kin and in-group (tribalism, ethnic nationalism and communitarianism) within a shared Western civilization (civilizationism) and an armed neutrality abroad. It holds that falsehoods contrary to nature, such as feminism and universal human rights, are the cause of Western decline, and it calls for a traditional, family-centered and masculine order (traditionalist conservatism and reactionaryism). It rejects cosmopolitanism, globalism, multiculturalism, progressivism, social progressivism and civil liberalism.",
  "stances": {
  "patchwork": 1.0,
  "subsidiarity": 0.9,
  "confederalism": 0.3,
  "centralism": -0.9,
  "hypercentralism": -1.0,
  "Tribalism": 1.0,
  "civilizationism": 0.8,
  "communitarianism": 0.7,
  "ethnic_nationalism": 0.7,
  "Cosmopolitanism": -0.8,
  "multiculturalism": -0.9,
  "armed_neutrality": 0.1,
  "Globalism": -0.5,
  "traditionalist_conservatism": 0.9,
  "reactionaryism": 0.7,
  "social_progressivism": -1.0,
  "progressivism": -0.8,
  "civil_liberalism": 0.3,
  "anarchism": 0.7,
  "ethical_statism": 0.7
 },
 "date": "21.11.2026",
 "book": "Jonas Nilsson's 2017 book Anarcho-Fascism: Nature Reborn"
};
const root = path.join(__dirname, '..');
const fail = message => { console.error('STOPPED, nothing was changed: ' + message); process.exit(1); };

function load(file) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8');
    const crlf = raw.includes('\r\n');
    return { file, crlf, text: crlf ? raw.replace(/\r\n/g, '\n') : raw };
}
// Edits only the part of the file between a block's start and its closing "\n};"
function editBlock(doc, blockStart, from, to, what) {
    const start = doc.text.indexOf(blockStart);
    const end = doc.text.indexOf('\n};', start);
    if (start < 0 || end < 0) fail(what + ': block "' + blockStart + '" not found in ' + doc.file);
    const block = doc.text.slice(start, end);
    const count = block.split(from).length - 1;
    if (count !== 1) fail(what + ': expected the anchor once in ' + blockStart + ', found ' + count + ' times');
    doc.text = doc.text.slice(0, start) + block.replace(from, () => to) + doc.text.slice(end);
}

const data = load('data.js');
const scoresJson = load('ideology_scores.json');
const changelog = load('changelog.html');
if (data.text.includes(JSON.stringify(DATA.label))) fail(DATA.label + ' is already in data.js');
const after = DATA.after;

// ---- data.js ----
editBlock(data, 'const ideologyGroups',
 '        ' + JSON.stringify(after) + ',\n        ' + JSON.stringify("Paetel's National Bolshevism") + '\n    ],\n    ' + JSON.stringify('Reactionary') + ': [',
'        ' + JSON.stringify(after) + ',\n        ' + JSON.stringify(DATA.label) + ',\n        ' + JSON.stringify("Paetel's National Bolshevism") + '\n    ],\n    ' + JSON.stringify('Reactionary') + ': [',   
    'ideologyGroups');
editBlock(data, 'const labelMapping',
    ': ' + JSON.stringify(after) + ',\n\n    /* 2. Reactionary */',
    ': ' + JSON.stringify(after) + ',\n    ' + JSON.stringify(DATA.combo) + ': ' + JSON.stringify(DATA.label) + ',\n\n    /* 2. Reactionary */',
    'labelMapping');
{
    const colorAt = data.text.indexOf('const labelColors = {');
    const colorEnd = data.text.indexOf('\n};', colorAt);
    const colorLines = data.text.slice(colorAt, colorEnd).split('\n');
    const matches = colorLines.map((line, i) => line.startsWith('    ' + JSON.stringify(after) + ': "') ? i : -1).filter(i => i >= 0);
    if (matches.length !== 1) fail('labelColors: expected one line for ' + after + ', found ' + matches.length);
    colorLines.splice(matches[0] + 1, 0, '    ' + JSON.stringify(DATA.label) + ': ' + JSON.stringify(DATA.color) + ',');
    data.text = data.text.slice(0, colorAt) + colorLines.join('\n') + data.text.slice(colorEnd);
}
editBlock(data, 'const descriptions',
    '\n\n    /* 2. Reactionary */',
    '\n    ' + JSON.stringify(DATA.label) + ': ' + JSON.stringify(DATA.definition) + ',\n\n    /* 2. Reactionary */',
    'descriptions');

// stances
const fmt = x => (x < 0 ? '-' : '') + (Math.abs(x) === 1 ? '1' : String(Math.abs(x)).replace(/^0/, ''));
const scoreText = Object.keys(DATA.stances).map(value => value + ':' + fmt(DATA.stances[value])).join('|');
const scoreAt = data.text.indexOf('const ideologyScores = {');
const scoreEnd = data.text.indexOf('\n};', scoreAt);
const scoreLines = data.text.slice(scoreAt, scoreEnd).split('\n');
const afterLine = scoreLines.findIndex(line => line.startsWith('    ' + JSON.stringify(after) + ': "'));
if (afterLine < 0) fail('ideologyScores has no line for ' + after);
scoreLines.splice(afterLine + 1, 0, '    ' + JSON.stringify(DATA.label) + ': ' + JSON.stringify(scoreText) + ',');
data.text = data.text.slice(0, scoreAt) + scoreLines.join('\n') + data.text.slice(scoreEnd);

// ---- ideology_scores.json ----
const jsonLines = scoresJson.text.split('\n');
const jsonAt = jsonLines.findIndex(line => line.startsWith(JSON.stringify(after) + ':{'));
if (jsonAt < 0) fail('ideology_scores.json has no line for ' + after);
jsonLines.splice(jsonAt + 1, 0, JSON.stringify(DATA.label) + ':{"d":' + JSON.stringify(DATA.definition) + ',"s":' + JSON.stringify(scoreText) + '},');
scoresJson.text = jsonLines.join('\n');

// ---- checks on the result before anything is written ----
try { JSON.parse(scoresJson.text); } catch (error) { fail('ideology_scores.json would be invalid: ' + error.message); }
const ctx = {};
vm.createContext(ctx);
try { vm.runInContext(data.text.replace(/^const /gm, 'var '), ctx, { filename: 'data.js' }); } catch (error) { fail('data.js would not run: ' + error.message); }
const known = {};
Object.keys(ctx.resultsMapping).forEach(cat => Object.keys(ctx.resultsMapping[cat]).forEach(id => { known[id] = true; }));
const unknown = Object.keys(DATA.stances).concat(DATA.combo.split('|')).filter(value => !known[value]);
if (unknown.length) fail('values that do not exist in resultsMapping: ' + unknown.join(', '));
if (ctx.ideologyGroups[DATA.group].indexOf(DATA.label) < 0) fail(DATA.label + ' is not in the ' + DATA.group + ' group');
if (ctx.labelMapping[DATA.combo] !== DATA.label) fail('the value set of ' + DATA.label + ' is not in labelMapping (is the key a duplicate?)');
if (!ctx.labelColors[DATA.label] || !ctx.descriptions[DATA.label] || ctx.ideologyScores[DATA.label] !== scoreText) fail('the color, definition or stances did not register');
const labels = [];
Object.keys(ctx.labelMapping).forEach(key => { if (!labels.includes(ctx.labelMapping[key])) labels.push(ctx.labelMapping[key]); });
const held = Object.values(DATA.stances).filter(x => x > 0).length;
const opposed = Object.values(DATA.stances).length - held;

// ---- changelog.html: the top version with its last number raised ----
const top = changelog.text.match(/<h3>(\d+)\.(\d+)(?:\.(\d+))?\s*-/);
if (!top) fail('no version found in changelog.html');
const version = top[1] + '.' + top[2] + '.' + ((Number(top[3]) || 0) + 1);
const entry =
'        <div class="description-box">\n' +
'            <h3>' + version + ' - ' + DATA.date + '</h3>\n' +
'            <ul>\n' +
'                <li>1 ideology is added to Third Position: ' + DATA.label + ', after ' + DATA.book + ', with a definition written in the style of this project, a value set and ' + Object.keys(DATA.stances).length + ' stances (' + held + ' it holds, ' + opposed + ' it opposes). The sources are the author\'s own definition and published summaries and reviews of the book. There are now ' + labels.length + ' ideologies.</li>\n' +
'            </ul>\n' +
'        </div>\n\n';
const marker = '<h1>Changelog</h1>\n\n';
if (changelog.text.split(marker).length !== 2) fail('changelog.html: heading anchor not found exactly once');
changelog.text = changelog.text.replace(marker, () => marker + entry);

[data, scoresJson, changelog].forEach(doc => {
    fs.writeFileSync(path.join(root, doc.file), doc.crlf ? doc.text.replace(/\n/g, '\r\n') : doc.text);
});
console.log('Added ' + DATA.label + ' to ' + DATA.group + ' (' + labels.length + ' ideologies), ' + Object.keys(DATA.stances).length + ' stances, changelog ' + version + '.');
console.log('Next: node tools/check_scoring.js');
