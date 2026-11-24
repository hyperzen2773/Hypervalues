// 1. Restores 34 ideology colors in labelColors that were overwritten by stance text (e.g. "laissez_faire:.9|civil_liberalism:1|...").
//    A color is only restored if the entry is not a valid hex color right now.
// 2. Sets Social Autonomy for the ideologies whose stance was missing or contradicted their own definition.
// 3. Copies the changed stances into ideology_scores.json (keeping its indentation and the "d" and "low" fields).
// Run from the repo root:  node tools/fix_social_autonomy.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

const COLORS = {
    'Classical Liberalism': '#71beebff', 'Social Liberalism': '#4B92DB', 'Liberal Atlanticism': '#3a75a4',
    'Technoliberalism': '#3399b8', 'Techno-Social Liberalism': '#368ebf', 'Libertarian Socialism': '#ac3232ff',
    'Democratic Confederalism': '#387a38ff', 'Geolibertarianism': '#709e3cff', 'Social Libertarianism': '#eebb2fff',
    'Bleeding-Heart Libertarianism': '#887f00ff', 'Pirate Politics': '#5d43a6ff', 'Agorist Minarchism': '#73802eff',
    'Libertarian Social Democracy': '#e07a38', 'Cyber-Libertarianism': '#3b8094ff', 'Libertarian Helveticism': '#70d4dbff',
    'Anarcho-Syndicalism': '#941313', 'Left-Agorism': '#632f2fff', 'Anarcho-Communism': '#a11111ff',
    'Solarpunk Anarchism': '#428a47ff', 'Mutualism': '#db4804ff', 'Market Anarchism': '#C74A0A', 'Panarchism': '#7f73bdff',
    'Geoanarchism': '#8cb148ff', 'Green Anarchism': '#1f6b2aff', 'Post-Anarchism': '#520000ff', 'Post-left': '#700000',
    'Anarcho-Transhumanism': '#3a6073ff', 'Ego-Communism': '#005a5aff', 'Anarcho-Capitalism': '#D4CB20',
    'Bleeding-Heart Anarcho-Capitalism': '#faca47ff', 'Free-Market Anarcho-Distributism': '#c49823ff',
    'Crypto-Anarchism': '#3f7a8cff', 'Autarchism': '#c2a632ff', 'Agorism': '#8c821e'
};
// Social Autonomy: independence from imposed social regulation; voluntary arrangements and norms of individuals and communities
const AUTONOMY = {
    'Minarcho-Socialism': 0.5,        // minimal state, voluntary cooperative ownership (was 0)
    'Minarcho-Distributism': 0.5,     // minimal government, community life (was 0)
    'Solarpunk Anarchism': 0.75,      // anarchism with sustainable communities (was 0.16; Green Anarchism has 0.75)
    'Catholic Workerism': 0.6,        // voluntary communities, anarchist and pacifist (was 0.14)
    'Gandhian Socialism': 0.6         // village self-rule, decentralized decisions (was -0.9, against its own definition)
};

const q = s => JSON.stringify(s);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function blockRange(src, name) {
    const s = src.indexOf('const ' + name + ' = {');
    if (s < 0) throw new Error('cannot find ' + name);
    return [s, src.indexOf('\n};', s)];
}

const dataPath = path.join(root, 'data.js');
let src = fs.readFileSync(dataPath, 'utf8');

// 1. colors
let restored = 0;
{
    const [s, e] = blockRange(src, 'labelColors');
    let block = src.slice(s, e);
    Object.keys(COLORS).forEach(label => {
        const re = new RegExp('^(    ' + esc(q(label)) + ': ")([^"\\n]*)(")', 'm');
        const m = block.match(re);
        if (!m) return;
        if (/^#[0-9a-fA-F]{3,8}$/.test(m[2])) return;           // already a color: leave it alone
        block = block.replace(re, (all, a, b, c) => a + COLORS[label] + c);
        restored++;
    });
    src = src.slice(0, s) + block + src.slice(e);
}
console.log('colors restored: ' + restored);

// 2. social autonomy
let changed = 0;
{
    const [s, e] = blockRange(src, 'ideologyScores');
    let block = src.slice(s, e);
    Object.keys(AUTONOMY).forEach(label => {
        const re = new RegExp('^(    ' + esc(q(label)) + ': ")([^"\\n]*)(")', 'm');
        const m = block.match(re);
        if (!m) throw new Error('no ideology called ' + label);
        const token = 'social_autonomy:' + AUTONOMY[label];
        let next;
        if (/(^|\|)social_autonomy:-?[\d.]+/.test(m[2])) next = m[2].replace(/(^|\|)social_autonomy:-?[\d.]+/, (all, p) => p + token);
        else next = m[2] + '|' + token;
        if (next !== m[2]) { block = block.replace(re, (all, a, b, c) => a + next + c); changed++; }
    });
    src = src.slice(0, s) + block + src.slice(e);
}
fs.writeFileSync(dataPath, src);
console.log('social autonomy stances changed: ' + changed);

// 3. ideology_scores.json
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(src.replace(/^const /gm, 'var '), ctx);
const jsonPath = path.join(root, 'ideology_scores.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const m = raw.match(/^\{\r?\n( +)"/);
const indent = m ? m[1].length : 0;
const copy = JSON.parse(raw);
let synced = 0;
Object.keys(AUTONOMY).forEach(label => {
    if (copy[label] && copy[label].s !== ctx.ideologyScores[label]) { copy[label].s = ctx.ideologyScores[label]; synced++; }
});
fs.writeFileSync(jsonPath, JSON.stringify(copy, null, indent) + (raw.endsWith('\n') ? '\n' : ''));
console.log('ideology_scores.json updated: ' + synced + ' entries');
