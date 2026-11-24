#!/usr/bin/env node
// Keeps only the strongest philosophy stances of every ideology (default 8) and fixes known typos in value names,
// in data.js and in ideology_scores.json.
//   node tools/trim_philosophy_stances.js        (keep the 8 strongest per ideology)
//   node tools/trim_philosophy_stances.js 5      (keep only 5; stricter)
// Why: with a stance on almost every philosophy value for every ideology, ideologies in the same family get nearly
// the same philosophy profile, and check_scoring.js ("its 3 strongest stances as answers ... first 3") falls below 90%.
// Nothing is written unless the result runs and the two files still agree. Then: node tools/check_scoring.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const keep = Number(process.argv[2] || 8);
if (!Number.isInteger(keep) || keep < 1) { console.error('Usage: node tools/trim_philosophy_stances.js [stances to keep per ideology, default 8]'); process.exit(1); }
const root = path.join(__dirname, '..');
const fail = message => { console.error('STOPPED, nothing was changed: ' + message); process.exit(1); };
const TYPOS = { furutism: 'futurism' };   // wrong value name -> right value name

function load(file) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8');
    const crlf = raw.includes('\r\n');
    return { file, crlf, text: crlf ? raw.replace(/\r\n/g, '\n') : raw };
}
function run(text) {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(text.replace(/^const /gm, 'var '), ctx, { filename: 'data.js' });
    return ctx;
}

const data = load('data.js');
const scoresJson = load('ideology_scores.json');
let before;
try { before = run(data.text); } catch (error) { fail('data.js does not run: ' + error.message); }
const known = {};
Object.keys(before.resultsMapping).forEach(cat => Object.keys(before.resultsMapping[cat]).forEach(id => { known[id] = cat; }));
if (!before.resultsMapping.philosophy) fail('there is no philosophy category in data.js');
const philosophy = {};
Object.keys(before.resultsMapping.philosophy).forEach(id => { philosophy[id] = true; });

// New stance text of every ideology
const changes = {};          // label -> { oldText, newText }
let removed = 0, fixed = 0, philosophyBefore = 0, philosophyAfter = 0;
Object.keys(before.ideologyScores).forEach(label => {
    const oldText = before.ideologyScores[label];
    let parts = oldText.split('|').filter(Boolean).map(part => {
        const at = part.lastIndexOf(':');
        let value = part.slice(0, at);
        if (TYPOS[value] && known[TYPOS[value]] && !known[value]) { fixed++; value = TYPOS[value]; }
        return { value, score: part.slice(at + 1) };
    });
    const mine = parts.filter(p => philosophy[p.value]);
    philosophyBefore += mine.length;
    const strongest = mine.map((p, index) => ({ p, index }))
        .sort((a, b) => Math.abs(Number(b.p.score)) - Math.abs(Number(a.p.score)) || a.index - b.index)
        .slice(0, keep).map(x => x.p);
    parts = parts.filter(p => !philosophy[p.value] || strongest.includes(p));
    removed += mine.length - strongest.length;
    philosophyAfter += strongest.length;
    const newText = parts.map(p => p.value + ':' + p.score).join('|');
    if (newText !== oldText) changes[label] = { oldText, newText };
});
if (!Object.keys(changes).length) { console.log('Nothing to change: no ideology has more than ' + keep + ' philosophy stances and no known typos were found.'); process.exit(0); }

// data.js: rewrite the lines of ideologyScores
const start = data.text.indexOf('const ideologyScores = {');
const end = data.text.indexOf('\n};', start);
if (start < 0 || end < 0) fail('ideologyScores block not found in data.js');
const seen = {};
const lines = data.text.slice(start, end).split('\n').map(line => {
    const m = line.match(/^(\s*)("(?:[^"\\]|\\.)*")\s*:\s*"((?:[^"\\]|\\.)*)"(,?)\s*$/);
    if (!m) return line;
    const label = JSON.parse(m[2]);
    if (!changes[label] || m[3] !== changes[label].oldText) return line;
    seen[label] = true;
    return m[1] + m[2] + ': ' + JSON.stringify(changes[label].newText) + m[4];
});
const missing = Object.keys(changes).filter(label => !seen[label]);
if (missing.length) fail('could not find the score line of: ' + missing.slice(0, 5).join(', '));
data.text = data.text.slice(0, start) + lines.join('\n') + data.text.slice(end);

// ideology_scores.json: same stances, so the two files keep agreeing
const jsonText = scoresJson.text;
let json;
try { json = JSON.parse(jsonText); } catch (error) { fail('ideology_scores.json is not valid JSON: ' + error.message); }
const jsonLines = jsonText.split('\n');
Object.keys(changes).forEach(label => {
    if (!json[label] || json[label].s !== changes[label].oldText) fail('ideology_scores.json does not agree with data.js for ' + label + ' (run node tools/check_scoring.js first)');
    const from = '"s": ' + JSON.stringify(changes[label].oldText);
    const compact = '"s":' + JSON.stringify(changes[label].oldText);
    let done = false;
    for (let i = 0; i < jsonLines.length && !done; i++) {
        if (jsonLines[i].includes(from)) { jsonLines[i] = jsonLines[i].replace(from, () => '"s": ' + JSON.stringify(changes[label].newText)); done = true; }
        else if (jsonLines[i].includes(compact)) { jsonLines[i] = jsonLines[i].replace(compact, () => '"s":' + JSON.stringify(changes[label].newText)); done = true; }
    }
    if (!done) fail('could not find the "s" line of ' + label + ' in ideology_scores.json');
});
scoresJson.text = jsonLines.join('\n');

// checks before anything is written
let after, afterJson;
try { after = run(data.text); afterJson = JSON.parse(scoresJson.text); } catch (error) { fail('the result would not run: ' + error.message); }
const disagree = Object.keys(after.ideologyScores).filter(label => !afterJson[label] || afterJson[label].s !== after.ideologyScores[label]);
if (disagree.length) fail('data.js and ideology_scores.json would disagree for ' + disagree.slice(0, 5).join(', '));
const unknown = [];
Object.keys(after.ideologyScores).forEach(label => after.ideologyScores[label].split('|').filter(Boolean).forEach(part => {
    const value = part.slice(0, part.lastIndexOf(':'));
    if (!known[value]) unknown.push(label + ': ' + value);
}));

[data, scoresJson].forEach(doc => fs.writeFileSync(path.join(root, doc.file), doc.crlf ? doc.text.replace(/\n/g, '\r\n') : doc.text));
console.log('Philosophy stances: ' + philosophyBefore + ' -> ' + philosophyAfter + ' (kept the ' + keep + ' strongest per ideology, removed ' + removed + ').');
console.log('Typos fixed: ' + fixed + '. Ideologies changed: ' + Object.keys(changes).length + '.');
if (unknown.length) console.log('WARNING, stances with a value that does not exist (fix these by hand): ' + unknown.slice(0, 8).join(', '));
console.log('Next: node tools/check_scoring.js');
