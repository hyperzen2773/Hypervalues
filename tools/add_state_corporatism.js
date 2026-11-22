// Adds the value "State Corporatism" to the economics category: data.js, questions_tree.json, ideology_scores.json.
// Run from the repo root:  node tools/add_state_corporatism.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ID = 'state_corporatism';
const NAME = 'State Corporatism';
const DESC = 'A form of corporatism imposed from above, in which the state itself creates, licenses and controls one compulsory corporation per trade or industry, subordinating business and labor to national goals, banning independent unions and strikes, and using the corporations as instruments of state economic direction, as in Mussolini\'s Italy and Salazar\'s Portugal.';
const OPTION = 'Compulsory corporations created and controlled by the state, one per trade, directing business and labor from above and banning independent unions and strikes';
const SCORES = {
    'Italian Fascism': .8, 'Falangism': .8, 'Clerical Fascism': .7, 'Austro-Corporatism': .6, 'Rexism': .6,
    'National Syndicalism': .6, 'Peronism': .5, 'Mosleyism': .5, 'Legionarianism': .5, 'Cyberpunk Corpostatism': .5,
    'National-Socialism': .5, 'Monarquia Syndicalista': .4, 'Nationalist Kemalism': .4, 'Social-Bonapartism': .4,
    'Right-Social Authoritarianism': .4,
    'Anarcho-Syndicalism': -.8, 'Libertarian Socialism': -.7, 'Syndicalist Republicanism': -.5, 'Guild Socialism': -.4,
    'Anarcho-Capitalism': -.8, 'Market Anarchism': -.8, 'Agorism': -.8, 'Classical Liberalism': -.6, 'Objectivism': -.7
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
    src = once(src, '        "social_corporatism": "Social-Corporatism",\n',
        '        "social_corporatism": "Social-Corporatism",\n        "' + ID + '": "' + NAME + '",\n', 'name in resultsMapping');
    const d = src.match(/^    "social_corporatism": "A framework where[^\n]*\n/m);
    if (!d) throw new Error('cannot find the social_corporatism description');
    src = src.replace(d[0], () => d[0] + '    "' + ID + '": "' + DESC.replace(/"/g, '\\"') + '",\n');
    src = once(src, '    "social_corporatism": "",\n', '    "social_corporatism": "",\n    "' + ID + '": "ai",\n', 'icon source');
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
const eco = tree.economics;
const bodies = eco.find(x => x.id === 'e_bodies');
if (!bodies) throw new Error('missing node e_bodies');
if (!bodies.options.some(o => o.next === ID)) bodies.options.push({ text: OPTION, next: ID });
if (!eco.some(x => x.id === ID)) eco.push({ id: ID });
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
