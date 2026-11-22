// Adds the value "Futurism" to the culture category: data.js, questions_tree.json, ideology_scores.json.
// Run from the repo root:  node tools/add_futurism.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ID = 'futurism';
const NAME = 'Futurism';
const DESC = 'A cultural and artistic outlook, launched by Filippo Tommaso Marinetti\'s 1909 manifesto, that glorifies speed, machines, youth, energy and the modern city, and rejects tradition, the past and reverence for inherited culture in favor of constant renewal.';
const OPTION = 'Sweep the past away: glorify speed, machines, youth and constant renewal, and treat tradition, museums and inherited reverence as obstacles';
const OLD_C1 = 'Reject the present order: return to the past, or advance an alternative modernity with technology against modern ethical norms';
const NEW_C1 = 'Reject the present order: return to the past, advance an alternative modernity with technology against modern ethical norms, or sweep the past away for constant renewal';
const ICON_SOURCE = '';   // put the link to the original dagger image here if you want it credited
const SCORES = {
    'Futurism': .9, 'Techno-Fascism': .6, 'Italian Fascism': .4, 'National Syndicalism': .4, 'Cosmist Vanguardism': .5,
    'Left-Accelerationism': .5, 'Effective Accelerationism': .5, 'Right-Accelerationism': .5,
    'Unconditional Accelerationism': .5, 'American Technocracy': .4, 'Democratic Transhumanism': .4,
    'Anarcho-Transhumanism': .4, 'Cybernetic Socialism': .4, 'Cyber-Communism': .4, 'Cybersyn Socialism': .3,
    'Neo-Absolutism': -.7, 'Anarcho-Primitivism': -.8, 'Carlism': -.6, 'Agrarian Conservatism': -.6,
    'Red Toryism': -.5, 'Integralism': -.5, 'Gandhian Socialism': -.4
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
    src = once(src, '        "amoralism": "Amoralism"\n',
        '        "amoralism": "Amoralism",\n        "' + ID + '": "' + NAME + '"\n', 'name in resultsMapping');
    const d = src.match(/^    "amoralism": "An egoist and anti-moralist[^\n]*\n/m);
    if (!d) throw new Error('cannot find the amoralism description');
    src = src.replace(d[0], () => d[0] + '    "' + ID + '": "' + DESC.replace(/"/g, '\\"') + '",\n');
    const i = src.match(/^    "amoralism": "https:[^\n]*\n/m);
    if (!i) throw new Error('cannot find the amoralism icon source');
    src = src.replace(i[0], () => i[0] + '    "' + ID + '": "' + ICON_SOURCE + '",\n');
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
const cul = tree.culture;
const brk = cul.find(x => x.id === 'c_break');
if (!brk) throw new Error('missing node c_break');
if (!brk.options.some(o => o.next === ID)) brk.options.push({ text: OPTION, next: ID });
const c1 = cul.find(x => x.id === 'c1');
const c1opt = c1 && c1.options.find(o => o.text === OLD_C1 || o.text === NEW_C1);
if (!c1opt) throw new Error('cannot find the c1 option about rejecting the present order');
c1opt.text = NEW_C1;
if (!cul.some(x => x.id === ID)) cul.push({ id: ID });
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
