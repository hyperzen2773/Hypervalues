// Adds the value "organic statism" to the authority category: data.js, questions_tree.json, ideology_scores.json.
// Run from the repo root (after the three democracy values are in):  node tools/add_organic_statism.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ID = 'organic_statism';
const NAME = 'Organic Statism';
const DESC = 'A conception of the state as a living organism of the whole society, in which classes, estates, regions and institutions are organs with their own duties and places under a guiding central authority, so that individuals find their purpose in serving the organic unity of the nation, as developed by thinkers such as Hegel, Adam Müller and Othmar Spann.';
const OPTION = 'A state conceived as a living organism, in which classes, estates, regions and institutions are organs with fixed duties under a guiding central authority';
const SCORES = {
    'Italian Fascism': .6, 'Falangism': .7, 'Brazilian Integralism': .7, 'Integralism': .5, 'Austro-Corporatism': .5,
    'Clerical Fascism': .5, 'Rexism': .5, 'Evolianism': .6, 'Volkism': .7, 'Legionarianism': .4, 'Strasserism': .5,
    'Mosleyism': .5, 'Peronism': .5, 'National Syndicalism': .6, 'Classical Eurasianism': .4, 'Mladorossism': .4,
    'Aristocratic Cameralism': .4, 'Fiumanism': .4, 'Anarcho-Capitalism': -.8, 'Market Anarchism': -.8, 'Agorism': -.8,
    'Anarcho-Communism': -.7, 'Anarcho-Syndicalism': -.6, 'Objectivism': -.7
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
    src = once(src, '        "productive_democracy": "Productive Democracy"\n',
        '        "productive_democracy": "Productive Democracy",\n        "' + ID + '": "' + NAME + '"\n', 'name in resultsMapping');
    const d = src.match(/^    "productive_democracy": "A democratic model[^\n]*\n/m);
    if (!d) throw new Error('cannot find the productive_democracy description');
    src = src.replace(d[0], () => d[0] + '    "' + ID + '": "' + DESC.replace(/"/g, '\\"') + '",\n');
    src = once(src, '    "productive_democracy": "ai",\n', '    "productive_democracy": "ai",\n    "' + ID + '": "ai",\n', 'icon source');
    const s0 = src.indexOf('const ideologyScores = {'), s1 = src.indexOf('\n};', s0);
    let block = src.slice(s0, s1);
    Object.keys(SCORES).forEach(label => {
        const re = new RegExp('^(    "' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '": ")([^"\\n]*)(")', 'm');
        const m = block.match(re);
        if (!m) throw new Error('no ideology called ' + label);
        block = block.replace(re, (all, a, b, c) => a + b + '|' + ID + ':' + fmt(SCORES[label]) + c);
    });
    src = src.slice(0, s0) + block + src.slice(s1);
    fs.writeFileSync(dataPath, src);
    console.log('data.js updated');
}

// 2. questions_tree.json
const treePath = path.join(root, 'questions_tree.json');
const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
const single = tree.authority.find(x => x.id === 'a_single');
if (!single) throw new Error('missing node a_single');
if (!single.options.some(o => o.next === ID)) single.options.push({ text: OPTION, next: ID });
if (!tree.authority.some(x => x.id === ID)) tree.authority.push({ id: ID });
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
