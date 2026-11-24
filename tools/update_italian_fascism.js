// Replaces the stances and the definition of "Italian Fascism" in data.js, and copies them into ideology_scores.json.
// Values that do not exist in your data.js (marked optional) are left out together with their sentences.
// Run from the repo root:  node tools/update_italian_fascism.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const LABEL = 'Italian Fascism';

// [value, stance, sentence ending in the bracketed name of the value, optional]
const ENTRIES = [
    ['totalism', 1, 'The state absorbs the individual, because no person, party, union or class may stand outside it, so that everything lies within the state, nothing outside it and nothing against it (Totalism).'],
    ['ethical_statism', 1, 'The state is a spiritual and ethical reality, a synthesis of all values, which gives the individual freedom and a higher purpose by raising him into the life of the nation (Ethical Statism).'],
    ['organic_statism', .7, 'The state is a living organism of the whole society, in which classes, regions and institutions are organs with duties under one authority, because the individual finds his purpose in serving the unity of the nation (Organic Statism).', true],
    ['corporatism', 1, 'Workers and employers are grouped by trade in syndicates and corporations recognized by the state, so that the struggle between classes gives way to the coordination of interests in the unity of the state (Corporatism).'],
    ['state_corporatism', .9, 'The syndicates and corporations are created and controlled by the state, which licenses one body per trade and holds its labour and its capital to national aims, because the state alone can unite their interests (State Corporatism).', true],
    ['syndicracy', .6, 'Delegates are drawn from the syndicates and corporations in place of party representatives, since the producers organized in their trades should form the national chamber (Syndicracy).'],
    ['romantic_nationalism', .8, 'The nation is a moral and historical community with a will and a mission of its own, whose destiny asks sacrifice of its people (Romantic Nationalism).'],
    ['cultural_nationalism', .6, 'The nation is carried by tradition, language and customs that link the generations, because outside history man is nothing (Cultural Nationalism).'],
    ['Imperialism', .9, 'A strong nation extends its power over other territories, since the will to empire is a sign of vitality and a people that does not expand declines (Imperialism).'],
    ['centralism', .8, 'Authority is concentrated in the national government, because a unitary state enforces one will uniformly over all provinces and sub-national divisions (Centralism).'],
    ['partocracy', .8, 'One party dominates the political process and the state apparatus, so that it directs the whole nation rather than competing representatives (Partocracy).'],
    ['autocracy', .8, 'One leader holds absolute power without external legal restraints, since decisive personal command is necessary to carry out the national will (Autocracy).'],
    ['regimentalism', .7, 'Civil life is organized and disciplined like a militia, because the citizen is a soldier of the nation and life is a duty and a struggle (Regimentalism).'],
    ['industrialism', .5, 'Modern industry and machines are embraced as the means of national power and renewal, since a strong state needs productive might (Industrialism).'],
    ['futurism', .4, 'The restless energy of speed, machines and youth is praised, because a vigorous nation renews itself without being bound by the habits of a tired order (Futurism).', true],
    ['representative_democracy', -.8, 'Voting for elected representatives who govern on behalf of citizens is rejected, because it equates the nation with the majority and splits it into quarrelling parties (against Representative Democracy).'],
    ['referendum_democracy', -.7, 'Direct votes on laws through referendums are rejected, since the crowd is not fit to decide the state\'s ends (against Referendum Democracy).'],
    ['civil_liberalism', -1, 'The protection of individual rights against the state is rejected, because liberty exists only in the state and for the individual within it (against Civil Liberalism).'],
    ['civil_libertarianism', -1, 'Safeguarding personal privacy and freedom of speech against the state is rejected, because individual rights cannot stand above the nation (against Civil Libertarianism).'],
    ['permissivism', -.8, 'Consensual adult conduct and private vices are not exempt from the state, which rejects moral neutrality because lifestyle choices shape the national character (against Permissivism).'],
    ['laissez_faire', -1, 'Free private transactions without government intervention are rejected since the economy must serve national power (against Laissez-Faire).'],
    ['state_socialism', -.8, 'State ownership run by central planning is rejected, because it ends private profit through class doctrine instead of through national unity (against State Socialism).'],
    ['communization', -1, 'An immediate abolition of the state and classes by revolution is rejected, since the nation must stay above class (against Communization).'],
    ['Cosmopolitanism', -1, 'Belonging to a single community of all human beings is rejected, because loyalty belongs to the nation and its morality does not transcend borders (against Cosmopolitanism).'],
    ['Internationalism', -1, 'Cooperation among nations through treaties is rejected since the national interest cannot be bound by joint commitments (against Internationalism).'],
    ['Non_Interventionism', -.8, 'Avoiding alliances and wars is rejected because a vigorous state should take part in wars of expansion (against Non-Interventionism).'],
    ['pacifism', -1, 'Disarmament and nonviolent resistance are rejected, since perpetual peace is neither possible nor useful and war alone raises all human energy to its highest tension (against Pacifism).'],
    ['reputationalism', -.6, 'Order kept by peer accountability and ostracism through community trust networks is rejected, because only the state\'s police and law enforce discipline (against Reputationalism).'],
    ['patchwork', -.7, 'Splitting territory into many seceding city-states is rejected, since the nation must remain one sovereign whole (against Patchwork).'],
    ['anti_organizationalism', -.7, 'Fluid, spontaneous association without permanent institutions is rejected because fixed structures and formal organization give the nation its form (against Anti-Organizationalism).'],
    ['panarchy', -.6, 'Several competing governments sharing one territory by free choice are rejected, because one sovereign state must hold the whole nation (against Panarchy).', true]
];
const fmt = x => (x < 0 ? '-' : '') + String(Math.abs(x)).replace(/^0\./, '.');
const q = s => JSON.stringify(s);

const dataPath = path.join(root, 'data.js');
let src = fs.readFileSync(dataPath, 'utf8');
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(src.replace(/^const /gm, 'var '), ctx);
const names = {};
Object.keys(ctx.resultsMapping).forEach(cat => Object.keys(ctx.resultsMapping[cat]).forEach(v => { names[v] = ctx.resultsMapping[cat][v]; }));

const used = [];
ENTRIES.forEach(e => {
    if (!(e[0] in names)) {
        if (e[3]) return;                                      // an optional value your data.js does not have
        throw new Error('no value called ' + e[0]);
    }
    const bracket = '(' + (e[1] < 0 ? 'against ' : '') + names[e[0]] + ').';
    if (!e[2].endsWith(bracket)) throw new Error('the sentence for ' + e[0] + ' must end with ' + bracket);
    used.push(e);
});
const scores = used.map(e => e[0] + ':' + fmt(e[1])).join('|');
const desc = used.map(e => e[2]).join(' ');

const old = ctx.ideologyScores[LABEL];
if (!old) throw new Error('there is no ideology called ' + LABEL);
const oldValues = old.split('|').map(p => p.slice(0, p.lastIndexOf(':')));
const dropped = oldValues.filter(v => !used.some(e => e[0] === v));
if (dropped.length) console.log('Stances that were in data.js and are not in this list (they are removed): ' + dropped.join(', '));

function replaceLine(text, blockName, lineStart, newLine) {
    const s = text.indexOf('const ' + blockName + ' = {');
    const e = text.indexOf('\n};', s);
    const at = text.indexOf(lineStart, s);
    if (s < 0 || at < 0 || at > e) throw new Error('cannot find ' + lineStart + ' in ' + blockName);
    return text.slice(0, at) + newLine + text.slice(text.indexOf('\n', at) + 1);
}
src = replaceLine(src, 'descriptions', '    ' + q(LABEL) + ': ', '    ' + q(LABEL) + ': ' + q(desc) + ',\n');
src = replaceLine(src, 'ideologyScores', '    ' + q(LABEL) + ': ', '    ' + q(LABEL) + ': ' + q(scores) + ',\n');
fs.writeFileSync(dataPath, src);
console.log('data.js updated: ' + used.length + ' stances for ' + LABEL);

// ideology_scores.json
const jsonPath = path.join(root, 'ideology_scores.json');
const copy = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
if (!copy[LABEL]) throw new Error(LABEL + ' is not in ideology_scores.json');
copy[LABEL].s = scores;
if ('d' in copy[LABEL]) copy[LABEL].d = desc;
fs.writeFileSync(jsonPath, '{\n' + Object.keys(copy).map(k => JSON.stringify(k) + ':' + JSON.stringify(copy[k])).join(',\n') + '\n}\n');
console.log('ideology_scores.json updated');
