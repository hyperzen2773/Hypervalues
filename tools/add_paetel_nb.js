// Adds or updates the ideology "Paetel's National Bolshevism" (Third Position group): data.js and ideology_scores.json.
// Safe to run again: if it is already there, its definition and stances are replaced by these.
// Run from the repo root:  node tools/add_paetel_nb.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const LABEL = "Paetel's National Bolshevism";
const COLOR = '#6b1f3a';
const KEY = 'state_socialism|collective_distribution|alternative_modernism|partocracy|cultural_nationalism|irredentism';
const SCORES = 'state_socialism:1|councilism:1|cultural_nationalism:1|alter_globalism:.8|collective_distribution:.5|alternative_modernism:.6|irredentism:.5|romantic_nationalism:.4|partocracy:.4|laissez_faire:-1|representative_democracy:-1|Cosmopolitanism:-.8|racial_nationalism:-.8|Globalism:-.7|civil_liberalism:-.7';
const DESC = [
    'The state socializes industry and land and plans the economy for the whole nation, because only common ownership can free the working people from capitalist exploitation (State Socialism).',
    'The state is built on councils of workers, peasants and soldiers, because the producing people should govern themselves and not be ruled through parliaments or corporations (Councilism).',
    'The nation is a community of shared language, culture and fate, and it is the highest value, because only a united people can carry out the socialist revolution (Cultural Nationalism).',
    'A military alliance with the revolutionary state to the east against the Western powers is sought, since the nation can free itself only by breaking the grip of the dominant capitalist states while staying sovereign (Alter-Globalism).',
    'Goods and services are shared by the community according to need, since the socialist nation owes every member a secure life (Collective Distribution).',
    'A path to modernity of its own, outside the model of the liberal and capitalist West, is followed because the renewal of the nation must come from its own revolution (Alternative Modernism).',
    'Lands and peoples of the nation that lie outside its borders are claimed back, because the settlement imposed on the defeated people is unjust (Irredentism).',
    'The nation is a living community with a youthful spirit of its own, since a renewed people draws strength from the ideals of its youth movement (Romantic Nationalism).',
    'A party of dedicated revolutionaries leads the struggle, because a disciplined vanguard must carry the revolution through (Partocracy).',
    'A market left free of regulation is rejected since capital enslaves the working people (against Laissez-Faire).',
    'Elected representatives who govern for rival parties are rejected because the democratic-capitalist system serves the owners of capital (against Representative Democracy).',
    'A single human community with no borders, as in world communism, is rejected, because the liberation of peoples begins with a sovereign socialist nation (against Cosmopolitanism).',
    'Defining the nation by race and descent is rejected since the national community is united by culture and shared fate, not by blood (against Racial Nationalism).',
    'Open borders and free exchange among all countries are rejected since global trade subjects the nation to foreign capital (against Globalism).',
    'The protection of individual rights and expression against the community is rejected, because bourgeois freedom dissolves the bonds of the people (against Civil Liberalism).'
].join(' ');
const q = s => JSON.stringify(s);   // a JS string literal with the needed escapes

function block(src, name) {
    const s = src.indexOf('const ' + name + ' = {');
    if (s < 0) throw new Error('cannot find ' + name);
    return { start: s, end: src.indexOf('\n};', s) };
}
function lineRange(src, name, lineStart, what) {
    const b = block(src, name);
    const at = src.indexOf(lineStart, b.start);
    if (at < 0 || at > b.end) throw new Error('cannot find ' + what);
    return { from: at, to: src.indexOf('\n', at) + 1 };
}
function insertAfterLine(src, name, lineStart, newLine, what) {
    const r = lineRange(src, name, lineStart, what);
    return src.slice(0, r.to) + newLine + src.slice(r.to);
}
function replaceLine(src, name, lineStart, newLine, what) {
    const r = lineRange(src, name, lineStart, what);
    return src.slice(0, r.from) + newLine + src.slice(r.to);
}

// 1. data.js
const dataPath = path.join(root, 'data.js');
let src = fs.readFileSync(dataPath, 'utf8');
if (src.includes('    ' + q(LABEL) + ': ')) {
    src = replaceLine(src, 'descriptions', '    ' + q(LABEL) + ': ', '    ' + q(LABEL) + ': ' + q(DESC) + ',\n', 'the old definition');
    src = replaceLine(src, 'ideologyScores', '    ' + q(LABEL) + ': ', '    ' + q(LABEL) + ': ' + q(SCORES) + ',\n', 'the old stances');
    fs.writeFileSync(dataPath, src);
    console.log('data.js: definition and stances replaced');
} else {
    const g = src.indexOf('    "Third Position": [');
    if (g < 0) throw new Error('cannot find the Third Position group');
    const close = src.indexOf('\n    ]', g);
    src = src.slice(0, close) + ',\n        ' + q(LABEL) + src.slice(close);
    if (src.includes(q(KEY))) throw new Error('the value set of the new ideology already belongs to another ideology');
    src = insertAfterLine(src, 'labelMapping', '    "state_socialism|collective_distribution|reactionary_modernism|partocracy|romantic_nationalism|Imperialism": "National Bolshevism"', '    ' + q(KEY) + ': ' + q(LABEL) + ',\n', 'the National Bolshevism entry in labelMapping');
    src = insertAfterLine(src, 'labelColors', '    "National Bolshevism": ', '    ' + q(LABEL) + ': ' + q(COLOR) + ',\n', 'the National Bolshevism color');
    src = insertAfterLine(src, 'descriptions', '    "National Bolshevism": ', '    ' + q(LABEL) + ': ' + q(DESC) + ',\n', 'the National Bolshevism definition');
    src = insertAfterLine(src, 'ideologyScores', '    "National Bolshevism": ', '    ' + q(LABEL) + ': ' + q(SCORES) + ',\n', 'the National Bolshevism stances');
    fs.writeFileSync(dataPath, src);
    console.log('data.js updated');
}

// 2. ideology_scores.json
const jsonPath = path.join(root, 'ideology_scores.json');
const copy = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dataPath, 'utf8').replace(/^const /gm, 'var '), ctx);
const hasD = 'd' in (copy[Object.keys(copy)[0]] || {});
let changed = 0;
Object.keys(ctx.ideologyScores).forEach(label => {
    if (!copy[label]) {
        if (label !== LABEL) return;
        copy[label] = hasD ? { d: ctx.descriptions[label] || '', s: ctx.ideologyScores[label] } : { s: ctx.ideologyScores[label] };
        changed++;
    } else {
        const wantD = label === LABEL && hasD && copy[label].d !== ctx.descriptions[label];
        if (copy[label].s !== ctx.ideologyScores[label] || wantD) {
            copy[label].s = ctx.ideologyScores[label];
            if (wantD) copy[label].d = ctx.descriptions[label];
            changed++;
        }
    }
});
fs.writeFileSync(jsonPath, '{\n' + Object.keys(copy).map(k => JSON.stringify(k) + ':' + JSON.stringify(copy[k])).join(',\n') + '\n}\n');
console.log('ideology_scores.json updated: ' + changed + ' entries');
