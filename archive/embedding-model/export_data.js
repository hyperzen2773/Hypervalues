// Exports what the trainer needs from data.js into tools/data.json.
// Usage (from the repo root):  node tools/export_data.js
const fs = require('fs');
const vm = require('vm');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('data.js', 'utf8') +
    ';this.D={categories,resultsMapping,labelMapping,ideologyScores,ideologyGroups};', ctx);
const { categories, resultsMapping, labelMapping, ideologyScores, ideologyGroups } = ctx.D;

const values = [];
const valueCat = [];
categories.forEach((cat, ci) => Object.keys(resultsMapping[cat]).forEach(id => {
    if (!values.includes(id)) { values.push(id); valueCat.push(ci); }
}));
const labels = [...new Set(Object.values(labelMapping))];
const groups = Object.keys(ideologyGroups);
const groupOf = labels.map(l => groups.findIndex(g => ideologyGroups[g].includes(l)));
const stances = {};
labels.forEach(l => {
    stances[l] = {};
    String(ideologyScores[l] || '').split('|').forEach(p => {
        const i = p.lastIndexOf(':');
        const v = p.slice(0, i), s = Number(p.slice(i + 1));
        if (values.includes(v) && s) stances[l][v] = s;
    });
});
fs.writeFileSync('tools/data.json', JSON.stringify({ categories, values, valueCat, labels, groups, groupOf, stances }));
console.log('values', values.length, '| ideologies', labels.length, '| groups', groups.length,
    '| ideologies without group', groupOf.filter(g => g < 0).length);
