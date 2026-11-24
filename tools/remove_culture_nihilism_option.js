// Removes the quiz option "Reject the idea that existence has any inherent meaning, purpose or objective value"
// from the CULTURE category of questions_tree.json. Options in other categories (for example philosophy) are not touched.
// It keeps the file's own indentation and saves a backup first.
// Run from the repo root:  node tools/remove_culture_nihilism_option.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const TEXT = 'Reject the idea that existence has any inherent meaning, purpose or objective value';
const treePath = path.join(root, 'questions_tree.json');
const raw = fs.readFileSync(treePath, 'utf8');
const m = raw.match(/^\{\r?\n( +)"/);
const indent = m ? m[1].length : 0;
const tree = JSON.parse(raw);

// 1. find the option everywhere, and say where it is
const found = [];
Object.keys(tree).forEach(cat => tree[cat].forEach(node => (node.options || []).forEach((o, i) => {
    if (o.text === TEXT) found.push({ cat, node, i, next: o.next });
})));
if (!found.length) { console.log('That option is not in questions_tree.json (nothing to do).'); process.exit(0); }
found.forEach(f => console.log('found in category "' + f.cat + '", question "' + f.node.id + '", leading to "' + f.next + '"'));

// 2. remove only the ones in culture
const inCulture = found.filter(f => f.cat === 'culture');
if (!inCulture.length) { console.log('It is not in the culture category, so nothing was changed.'); process.exit(0); }
fs.copyFileSync(treePath, treePath + '.bak');
inCulture.forEach(f => { f.node.options = f.node.options.filter(o => o.text !== TEXT); });
inCulture.forEach(f => { if (f.node.options.length < 2) console.log('WARNING: question "' + f.node.id + '" now has only ' + f.node.options.length + ' option(s).'); });

// 3. drop the culture leaf if nothing in culture leads to it any more
inCulture.forEach(f => {
    const stillUsed = tree.culture.some(n => (n.options || []).some(o => o.next === f.next));
    if (!stillUsed) {
        const before = tree.culture.length;
        tree.culture = tree.culture.filter(n => n.id !== f.next || (n.options && n.options.length));
        if (tree.culture.length < before) console.log('removed the unused culture leaf "' + f.next + '"');
    }
});
fs.writeFileSync(treePath, JSON.stringify(tree, null, indent) + (raw.endsWith('\n') ? '\n' : ''));
console.log('questions_tree.json updated (backup: questions_tree.json.bak)');

// 4. information only: which category does data.js give that value?
try {
    const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8').replace(/^const /gm, 'var '), ctx);
    inCulture.forEach(f => {
        const cats = Object.keys(ctx.resultsMapping).filter(c => f.next in ctx.resultsMapping[c]);
        console.log('data.js lists "' + f.next + '" under: ' + (cats.join(', ') || 'no category'));
    });
} catch (e) { console.log('(could not read data.js: ' + e.message + ')'); }
