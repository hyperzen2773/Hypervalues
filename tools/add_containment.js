// Adds the value "Containment" to the foreign category: data.js, questions_tree.json, ideology_scores.json.
// Run from the repo root:  node tools/add_containment.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ID = 'containment';
const NAME = 'Containment';
const DESC = 'A foreign policy strategy of preventing a rival power or hostile ideology from spreading its influence, by means of alliances, military bases, economic aid, diplomatic pressure and deterrence, without seeking its conquest or open war. Associated with George Kennan and the Truman Doctrine, it accepts the rival\'s existence within its own borders while resisting every attempt to extend them.';
const OPTION = 'Hold a rival power in check: alliances, bases, aid and deterrence that stop its spread, without seeking its conquest or open war';
const SCORES = {
    'Liberal Atlanticism': .8, 'Conservative Atlanticism': .8, 'Labour Atlanticism': .8, 'Neoconservative Atlanticism': .6,
    'Transatlantic Federalism': .6, 'Mesoconservatism': .6, 'Rockefeller Republicanism': .6, 'American Model': .5,
    'Muscular Liberalism': .5, 'Neoconservatism': .4, 'Fusionism': .5, 'Tsaingwenism': .4,
    'Old Right Paleoconservatism': -.5, 'Buchanan Paleoconservatism': -.5, 'Hard Right Paleoconservatism': -.5,
    'Paleoconservatism': -.5, 'Paleolibertarianism': -.5, 'Agorism': -.5, 'Christian Anarchism': -.6,
    'Catholic Workerism': -.6, 'Gandhian Socialism': -.5, 'Duginism': -.8, 'Classical Eurasianism': -.7,
    'Putinism': -.7, 'Stalinism': -.7, 'Marxism-Leninism': -.7, 'Mao Zedong Thought': -.7, 'Castroism': -.7,
    'Guevarism': -.7, 'Juche': -.6, 'Hoxhaism': -.6
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const q = s => JSON.stringify(s);
function blockRange(src, name) {
    const s = src.indexOf('const ' + name + ' = {');
    if (s < 0) throw new Error('cannot find ' + name);
    return [s, src.indexOf('\n};', s)];
}
// adds a line after the anchor line inside one block, keeping the commas right
function addAfter(src, blockName, anchorStart, makeLine, what) {
    const [s, e] = blockRange(src, blockName);
    const at = src.indexOf(anchorStart, s);
    if (at < 0 || at > e) throw new Error('cannot find ' + what);
    const eol = src.indexOf('\n', at);
    const line = src.slice(at, eol);
    if (line.endsWith(',')) return src.slice(0, eol + 1) + makeLine(true) + src.slice(eol + 1);
    return src.slice(0, eol) + ',\n' + makeLine(false).replace(/\n$/, '') + src.slice(eol);
}

// 1. data.js
const dataPath = path.join(root, 'data.js');
let src = fs.readFileSync(dataPath, 'utf8');
if (src.includes('"' + ID + '": "' + NAME + '"')) {
    console.log('data.js already has ' + ID);
} else {
    src = addAfter(src, 'resultsMapping', '        "mercantilism": "Mercantilism"', c => '        ' + q(ID) + ': ' + q(NAME) + (c ? ',' : '') + '\n', 'mercantilism in resultsMapping');
    src = addAfter(src, 'descriptions', '    "mercantilism": ', c => '    ' + q(ID) + ': ' + q(DESC) + (c ? ',' : '') + '\n', 'mercantilism definition');
    src = addAfter(src, 'iconSources', '    "mercantilism": ', c => '    ' + q(ID) + ': "ai"' + (c ? ',' : '') + '\n', 'mercantilism icon source');
    const [s, e] = blockRange(src, 'ideologyScores');
    let block = src.slice(s, e);
    const lead0 = (block.match(/:0\./g) || []).length > (block.match(/:-?\.\d/g) || []).length;
    const fmt = x => (x < 0 ? '-' : '') + (lead0 ? String(Math.abs(x)) : String(Math.abs(x)).replace(/^0\./, '.'));
    Object.keys(SCORES).forEach(label => {
        const re = new RegExp('^(    ' + esc(q(label)) + ': ")([^"\\n]*)(")', 'm');
        if (!re.test(block)) throw new Error('no ideology called ' + label);
        block = block.replace(re, (all, a, b, c) => a + b + '|' + ID + ':' + fmt(SCORES[label]) + c);
    });
    src = src.slice(0, s) + block + src.slice(e);
    fs.writeFileSync(dataPath, src);
    console.log('data.js updated');
}

// 2. questions_tree.json
const treePath = path.join(root, 'questions_tree.json');
const rawTree = fs.readFileSync(treePath, 'utf8');
const im = rawTree.match(/^\{\r?\n( +)"/);
const tree = JSON.parse(rawTree);
const power = tree.foreign.find(x => x.id === 'f_power');
if (!power) throw new Error('missing node f_power');
if (!power.options.some(o => o.next === ID)) power.options.push({ text: OPTION, next: ID });
if (!tree.foreign.some(x => x.id === ID)) tree.foreign.push({ id: ID });
fs.writeFileSync(treePath, JSON.stringify(tree, null, im ? im[1].length : 0) + (rawTree.endsWith('\n') ? '\n' : ''));
console.log('questions_tree.json updated');

// 3. ideology_scores.json: same stances as data.js
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dataPath, 'utf8').replace(/^const /gm, 'var '), ctx);
const jsonPath = path.join(root, 'ideology_scores.json');
const rawJson = fs.readFileSync(jsonPath, 'utf8');
const jm = rawJson.match(/^\{\r?\n( +)"/);
const copy = JSON.parse(rawJson);
let changed = 0;
Object.keys(SCORES).forEach(label => {
    if (copy[label] && copy[label].s !== ctx.ideologyScores[label]) { copy[label].s = ctx.ideologyScores[label]; changed++; }
});
fs.writeFileSync(jsonPath, JSON.stringify(copy, null, jm ? jm[1].length : 0) + (rawJson.endsWith('\n') ? '\n' : ''));
console.log('ideology_scores.json updated: ' + changed + ' ideologies');
