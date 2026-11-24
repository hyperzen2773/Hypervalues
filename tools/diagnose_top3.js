// Shows WHICH ideologies fail the check "its 3 strongest stances as answers: its own ideology is in the first 3".
// It reads data.js and scoring.js exactly like tools/check_scoring.js and changes nothing.
// Run from the repo root:  node tools/diagnose_top3.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console, atob: text => Buffer.from(text, 'base64').toString('binary') };
vm.createContext(ctx);
['data.js', 'scoring.js'].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8').replace(/^const /gm, 'var '), ctx, { filename: file }));
const HV = ctx.HV, categoryOf = HV.categoryOf;
const labels = [];
Object.keys(ctx.labelMapping).forEach(key => { if (!labels.includes(ctx.labelMapping[key])) labels.push(ctx.labelMapping[key]); });
const stances = {};
labels.forEach(label => {
    stances[label] = {};
    (ctx.ideologyScores[label] || '').split('|').forEach(part => {
        const at = part.lastIndexOf(':');
        if (at < 1) return;
        const value = part.slice(0, at), stance = Number(part.slice(at + 1));
        if (categoryOf[value] && stance >= -1 && stance <= 1 && stance !== 0) stances[label][value] = stance;
    });
});
function answersFrom(entries) {
    const answers = {};
    entries.forEach(([value, agree]) => { (answers[categoryOf[value]] = answers[categoryOf[value]] || []).push({ value, agree }); });
    return answers;
}
const strongest = count => label => Object.keys(stances[label])
    .sort((a, b) => Math.abs(stances[label][b]) - Math.abs(stances[label][a]) || (a < b ? -1 : 1))
    .slice(0, count).map(value => [value, stances[label][value]]);

const failing = [];
labels.forEach(label => {
    const entries = strongest(3)(label);
    if (!entries.length) return;
    const ranked = HV.rankIdeologies(answersFrom(entries));
    const position = ranked.findIndex(item => item.label === label);
    if (position >= 3) failing.push({ label, position: position + 1, entries, above: ranked.slice(0, 3).map(item => item.label) });
});
failing.sort((a, b) => b.position - a.position);
console.log(failing.length + ' of ' + labels.length + ' ideologies are not in the first 3 when answering their 3 strongest stances:\n');
failing.forEach(f => {
    console.log(f.label + '  (ranked ' + f.position + ')');
    console.log('   answers: ' + f.entries.map(e => e[0] + ':' + e[1]).join(', '));
    console.log('   ranked above: ' + f.above.join(', '));
});
// how many of the failing ones share their three strongest values with another ideology
const key = label => strongest(3)(label).map(e => e[0]).sort().join('|');
const groups = {};
labels.forEach(l => { const k = key(l); (groups[k] = groups[k] || []).push(l); });
const shared = failing.filter(f => groups[key(f.label)].length > 1);
console.log('\n' + shared.length + ' of them have the same three strongest values as at least one other ideology.');
