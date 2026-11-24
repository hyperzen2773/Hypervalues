// Adds the quiz questions for deliberative, organic and productive democracy to questions_tree.json,
// and copies the stances in data.js into ideology_scores.json (keeps each entry's "d" and "low").
// Run from the repo root after replacing data.js:  node tools/apply_democracy_values.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

// 1. questions_tree.json
const treePath = path.join(root, 'questions_tree.json');
const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
const auth = tree.authority;
const node = id => { const n = auth.find(x => x.id === id); if (!n) throw new Error('missing node ' + id); return n; };
const addOption = (id, option) => {
    const n = node(id);
    if (!n.options.some(o => o.next === option.next)) n.options.push(option);
};
const aOther = node('a_direct').options.find(o => o.next === 'a_other');
if (!aOther) throw new Error('a_direct has no option leading to a_other');
aOther.text = 'Power beyond the ballot box: councils, guilds and producers, natural communities, lotteries or crowds';
addOption('a_direct', { text: 'Reasoned public deliberation: informed, structured debate among free and equal citizens, such as citizens\' assemblies and deliberative polls, before anything is decided', next: 'deliberative_democracy' });
addOption('a_other', { text: 'Natural communities, such as families, neighborhoods, churches, crafts and regions, each speaking for itself in a body that grows out of society instead of isolated voters or parties', next: 'organic_democracy' });
addOption('a_other', { text: 'Producers, such as workers, farmers, builders and entrepreneurs, whose political voice follows their productive contribution and whose decisions are judged by what they produce', next: 'productive_democracy' });
['deliberative_democracy', 'organic_democracy', 'productive_democracy'].forEach(id => {
    if (!auth.some(x => x.id === id)) auth.push({ id });
});
fs.writeFileSync(treePath, JSON.stringify(tree));
console.log('questions_tree.json updated');

// 2. ideology_scores.json: same stances as data.js
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8').replace(/^const /gm, 'var '), ctx);
const jsonPath = path.join(root, 'ideology_scores.json');
const copy = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
let changed = 0;
Object.keys(ctx.ideologyScores).forEach(label => {
    if (copy[label] && copy[label].s !== ctx.ideologyScores[label]) { copy[label].s = ctx.ideologyScores[label]; changed++; }
});
fs.writeFileSync(jsonPath, '{\n' + Object.keys(copy).map(k => JSON.stringify(k) + ':' + JSON.stringify(copy[k])).join(',\n') + '\n}\n');
console.log('ideology_scores.json updated: ' + changed + ' ideologies');
