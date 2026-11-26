// A report of where the quiz is weak, to read before and after a change of the data:  node tools/report_blindspots.js
//   --save    writes the numbers to tools/blindspots_baseline.json (do this once a change is accepted)
//   --strict  exits with 1 if a number is worse than the baseline
// It lists ideologies that cannot be told apart, ideologies that do not come first even when answered with exactly
// their own stances, and values that few or no ideologies hold.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console, atob: t => Buffer.from(t, 'base64').toString('binary') };
vm.createContext(ctx);
['data.js', 'scoring.js', 'hvx.js'].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8').replace(/^const /gm, 'var '), ctx, { filename: file }));
const HV = ctx.HV, X = ctx.HVX;
const labels = X.labels();
const values = X.valueIds();

// 1. ideologies that do not come first with their own stances
const notFirst = [];
let first = 0, top3 = 0;
labels.forEach(label => {
    const ranked = HV.closestIdeologies(X.answersOf(label), null, 3);
    if (ranked[0] && ranked[0].label === label) first++; else notFirst.push(label + ' (first: ' + (ranked[0] ? ranked[0].label : 'none') + ')');
    if (ranked.some(r => r.label === label)) top3++;
});

// 2. ideologies that are nearly the same (similar stances over the values both list)
const listed = {};
labels.forEach(l => { listed[l] = {}; values.forEach(v => { if (X.isListed(l, v)) listed[l][v] = X.score(l, v); }); });
const alike = [];
for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
        const a = listed[labels[i]], b = listed[labels[j]];
        let dot = 0, na = 0, nb = 0, shared = 0;
        Object.keys(a).forEach(v => { na += a[v] * a[v]; if (v in b) { dot += a[v] * b[v]; shared++; } });
        Object.keys(b).forEach(v => { nb += b[v] * b[v]; });
        if (shared >= 4 && na && nb) { const cos = dot / Math.sqrt(na * nb); if (cos >= 0.97 && Object.keys(a).length === Object.keys(b).length) alike.push([labels[i], labels[j], cos]); }
    }
}

// 3. values few ideologies hold
const holders = {};
values.forEach(v => { holders[v] = labels.filter(l => X.isListed(l, v)).length; });
const none = values.filter(v => holders[v] === 0);
const one = values.filter(v => holders[v] === 1);

const numbers = { ideologies: labels.length, values: values.length, ownFirst: Math.round(1000 * first / labels.length) / 10, ownTop3: Math.round(1000 * top3 / labels.length) / 10, alikePairs: alike.length, heldByNone: none.length, heldByOne: one.length };
console.log(JSON.stringify(numbers));
const list = (title, items) => { console.log('\n' + title + ' (' + items.length + ')'); items.slice(0, 25).forEach(i => console.log('  ' + i)); if (items.length > 25) console.log('  ...'); };
list('Ideologies that do not come first with their own stances', notFirst);
list('Ideologies that are almost the same', alike.map(p => p[0] + ' / ' + p[1] + ' (' + p[2].toFixed(3) + ')'));
list('Values no ideology holds', none);
list('Values only one ideology holds', one.map(v => v + ' (' + labels.find(l => X.isListed(l, v)) + ')'));

const file = path.join(__dirname, 'blindspots_baseline.json');
if (process.argv.includes('--save')) { fs.writeFileSync(file, JSON.stringify(numbers, null, 2) + '\n'); console.log('\nsaved to tools/blindspots_baseline.json'); process.exit(0); }
if (fs.existsSync(file)) {
    const before = JSON.parse(fs.readFileSync(file, 'utf8'));
    const worse = [];
    if (numbers.ownFirst < before.ownFirst - 0.5) worse.push(`own first ${before.ownFirst}% -> ${numbers.ownFirst}%`);
    if (numbers.ownTop3 < before.ownTop3 - 0.5) worse.push(`own top 3 ${before.ownTop3}% -> ${numbers.ownTop3}%`);
    ['alikePairs', 'heldByNone'].forEach(k => { if (numbers[k] > before[k]) worse.push(`${k} ${before[k]} -> ${numbers[k]}`); });
    console.log('\nagainst the baseline: ' + (worse.length ? 'WORSE: ' + worse.join(', ') : 'not worse'));
    if (worse.length && process.argv.includes('--strict')) process.exit(1);
}
