// Adds the value "Panarchy" to the territorial_organization category: data.js, questions_tree.json, ideology_scores.json.
// Run from the repo root:  node tools/add_panarchy.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ID = 'panarchy';
const NAME = 'Panarchy';
const DESC = 'A territorial doctrine that separates government from geography: instead of one monopoly state per territory, many governments with their own laws and services coexist and overlap in the same space, and each person freely chooses, joins or leaves the one that governs them, an idea first proposed by Paul Émile de Puydt in 1860.';
const OPTION = 'Not tied to territory at all: overlapping governments that people join or leave freely, wherever they live, each with its own laws and services';
const SCORES = {
    'Panarchism': .9, 'Anarcho-Capitalism': .6, 'Agorism': .6, 'Market Anarchism': .6, 'Avaritionism': .5,
    'Landianism': .4, 'Left-Agorism': .4,
    'National-Socialism': -.7, 'Neo-Nazism': -.7, 'Ingsoc': -.7, 'Obliteration of the Self': -.7,
    'One State Benefactorism': -.7, 'World State Fordism': -.7, 'Italian Fascism': -.6, 'Stalinism': -.6,
    'Falangism': -.6, 'Social-Bonapartism': -.5
};
const fmt = x => (x < 0 ? '-' : '') + String(Math.abs(x)).replace(/^0\./, '.');
function once(text, from, to, what) {
    const first = text.indexOf(from);
    if (first < 0 || text.indexOf(from, first + 1) >= 0) throw new Error('cannot find a single place for: ' + what);
    return text.replace(from, () => to);
}

// 1. data.js
const dataPath = path.join(root, 'data.js');
let src = fs.readFileSync(dataPath, 'utf8');
if (src.includes('"' + ID + '": "' + NAME + '"')) {
    console.log('data.js already has ' + ID);
} else {
    src = once(src, '        "patchwork": "Patchwork"\n',
        '        "patchwork": "Patchwork",\n        "' + ID + '": "' + NAME + '"\n', 'name in resultsMapping');
    const d = src.match(/^    "patchwork": "A territorial doctrine[^\n]*\n/m);
    if (!d) throw new Error('cannot find the patchwork description');
    src = src.replace(d[0], () => d[0] + '    "' + ID + '": "' + DESC.replace(/"/g, '\\"') + '",\n');
    src = once(src, '    "patchwork": "ai",\n', '    "patchwork": "ai",\n    "' + ID + '": "ai",\n', 'icon source');
    const s0 = src.indexOf('const ideologyScores = {'), s1 = src.indexOf('\n};', s0);
    let block = src.slice(s0, s1);
    Object.keys(SCORES).forEach(label => {
        const re = new RegExp('^(    "' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '": ")([^"\\n]*)(")', 'm');
        if (!re.test(block)) throw new Error('no ideology called ' + label);
        block = block.replace(re, (all, a, b, c) => a + b + '|' + ID + ':' + fmt(SCORES[label]) + c);
    });
    src = src.slice(0, s0) + block + src.slice(s1);
    fs.writeFileSync(dataPath, src);
    console.log('data.js updated');
}

// 2. questions_tree.json
const treePath = path.join(root, 'questions_tree.json');
const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
const small = tree.territorial_organization.find(x => x.id === 'to_small');
if (!small) throw new Error('missing node to_small');
if (!small.options.some(o => o.next === ID)) small.options.push({ text: OPTION, next: ID });
if (!tree.territorial_organization.some(x => x.id === ID)) tree.territorial_organization.push({ id: ID });
fs.writeFileSync(treePath, JSON.stringify(tree));
console.log('questions_tree.json updated');

// 3. ideology_scores.json: same stances as data.js
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dataPath, 'utf8').replace(/^const /gm, 'var '), ctx);
const jsonPath = path.join(root, 'ideology_scores.json');
const copy = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
let changed = 0;
Object.keys(ctx.ideologyScores).forEach(label => {
    if (copy[label] && copy[label].s !== ctx.ideologyScores[label]) { copy[label].s = ctx.ideologyScores[label]; changed++; }
});
fs.writeFileSync(jsonPath, '{\n' + Object.keys(copy).map(k => JSON.stringify(k) + ':' + JSON.stringify(copy[k])).join(',\n') + '\n}\n');
console.log('ideology_scores.json updated: ' + changed + ' ideologies');
