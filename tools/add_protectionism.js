#!/usr/bin/env node
// Adds Protectionism to data.js, questions_tree.json and ideology_scores.json.
// Run from the repository root:
// node tools/add_protectionism.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

const ID = 'protectionism';
const NAME = 'Protectionism';

const DESC = 'An economic policy that uses tariffs, import quotas, subsidies, regulations and other state measures to protect domestic industries and producers from foreign competition. It seeks to preserve domestic employment, encourage national industrial development and reduce dependence on foreign goods. Protectionism can be used by different economic systems and does not necessarily require mercantilism, state ownership or economic isolation.';

const OPTION = 'Protect domestic industries and producers through tariffs, import restrictions, subsidies and other trade barriers';

const SCORES = {
    'Italian Fascism': 0.8,
    'Falangism': 0.8,
    'Brazilian Integralism': 0.7,
    'Integralism': 0.6,
    'Austro-Corporatism': 0.6,
    'Clerical Fascism': 0.6,
    'Rexism': 0.6,
    'Strasserism': 0.8,
    'Mosleyism': 0.5,
    'Peronism': 0.7,
    'National Syndicalism': 0.7,
    'Classical Eurasianism': 0.8,
    'Mladorossism': 0.7,
    'Aristocratic Cameralism': 0.5,
    'Fiumanism': 0.5,
    'Anarcho-Capitalism': -0.8,
    'Market Anarchism': -0.8,
    'Agorism': -0.7,
    'Objectivism': -0.5
};

const fail = message => {
    console.error('STOPPED, nothing was changed: ' + message);
    process.exit(1);
};

function once(text, from, to, what) {
    const count = text.split(from).length - 1;
    if (count !== 1) {
        fail(what + ': expected one anchor, found ' + count);
    }
    return text.replace(from, () => to);
}

function load(file) {
    const filePath = path.join(root, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    return {
        path: filePath,
        text: raw.replace(/\r\n/g, '\n'),
        crlf: raw.includes('\r\n')
    };
}

function save(file) {
    const output = file.crlf
        ? file.text.replace(/\n/g, '\r\n')
        : file.text;
    fs.writeFileSync(file.path, output);
}

const data = load('data.js');
const treeFile = load('questions_tree.json');
const jsonFile = load('ideology_scores.json');

if (data.text.includes('"protectionism": "Protectionism"')) {
    fail('Protectionism already exists in data.js');
}

// --------------------------------------------------
// 1. data.js
// --------------------------------------------------

// Add Protectionism to the Resource Management values.
data.text = once(
    data.text,
    '        "tariff_funding": "Tariff-Based Funding",\n',
    '        "tariff_funding": "Tariff-Based Funding",\n' +
    '        "' + ID + '": "' + NAME + '",\n',
    'resultsMapping'
);

// Add its description.
data.text = once(
    data.text,
    '    "tariff_funding": "A nationalist fiscal policy that funds the state primarily through external customs duties, protective import tariffs, and trade excise taxes, eliminating direct domestic income and production taxes on citizens.",\n',
    '    "tariff_funding": "A nationalist fiscal policy that funds the state primarily through external customs duties, protective import tariffs, and trade excise taxes, eliminating direct domestic income and production taxes on citizens.",\n' +
    '    "' + ID + '": ' + JSON.stringify(DESC) + ',\n',
    'descriptions'
);

// Add an icon source.
data.text = once(
    data.text,
    '    "tariff_funding": "https://wiki.polcompball.co.uk/Protectionism",\n',
    '    "tariff_funding": "https://wiki.polcompball.co.uk/Protectionism",\n' +
    '    "' + ID + '": "ai",\n',
    'icon source'
);

// Add Protectionism to the ideology scores.
const scoreStart = data.text.indexOf('const ideologyScores = {');
const scoreEnd = data.text.indexOf('\n};', scoreStart);

if (scoreStart < 0 || scoreEnd < 0) {
    fail('Could not find the ideologyScores block');
}

let scoreBlock = data.text.slice(scoreStart, scoreEnd);

const fmt = x =>
    (x < 0 ? '-' : '') +
    (Math.abs(x) === 1
        ? '1'
        : String(Math.abs(x)).replace(/^0/, ''));

for (const [label, value] of Object.entries(SCORES)) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
        '^(    "' + escaped + '": ")([^"\\n]*)(")',
        'm'
    );

    const match = scoreBlock.match(re);

    if (!match) {
        fail('Could not find ideology: ' + label);
    }

    if (match[2].split('|').some(x => x.startsWith(ID + ':'))) {
        fail(label + ' already has a Protectionism score');
    }

    scoreBlock = scoreBlock.replace(
        re,
        (all, before, scores, after) =>
            before + scores + '|' + ID + ':' + fmt(value) + after
    );
}

data.text =
    data.text.slice(0, scoreStart) +
    scoreBlock +
    data.text.slice(scoreEnd);

// --------------------------------------------------
// 2. questions_tree.json
// --------------------------------------------------

const tree = JSON.parse(treeFile.text);

if (!Array.isArray(tree.resource_management)) {
    fail('Could not find the resource_management category in questions_tree.json');
}

// Find the question containing the existing Tariff-Based Funding option.
const parent = tree.resource_management.find(node =>
    Array.isArray(node.options) &&
    node.options.some(option => option.next === 'tariff_funding')
);

if (!parent) {
    fail('Could not find the question containing the tariff_funding option');
}

if (!parent.options.some(option => option.next === ID)) {
    parent.options.push({
        text: OPTION,
        next: ID
    });
}

if (!tree.resource_management.some(node => node.id === ID)) {
    tree.resource_management.push({ id: ID });
}

treeFile.text = JSON.stringify(tree, null, 2) + '\n';

// --------------------------------------------------
// 3. ideology_scores.json
// --------------------------------------------------

const ctx = {
    localStorage: {
        getItem() { return null; },
        setItem() {}
    },
    console
};

vm.createContext(ctx);

try {
    vm.runInContext(
        data.text.replace(/^const /gm, 'var '),
        ctx
    );
} catch (error) {
    fail('data.js validation failed: ' + error.message);
}

const copy = JSON.parse(jsonFile.text);

let changed = 0;

Object.keys(ctx.ideologyScores).forEach(label => {
    if (!copy[label]) return;

    if (copy[label].s !== ctx.ideologyScores[label]) {
        copy[label].s = ctx.ideologyScores[label];
        changed++;
    }
});

jsonFile.text =
    '{\n' +
    Object.keys(copy)
        .map(key => JSON.stringify(key) + ':' + JSON.stringify(copy[key]))
        .join(',\n') +
    '\n}\n';

// --------------------------------------------------
// 4. Final validation before writing anything
// --------------------------------------------------

try {
    JSON.parse(jsonFile.text);
    JSON.parse(treeFile.text);
} catch (error) {
    fail('JSON validation failed: ' + error.message);
}

if (ctx.resultsMapping.resource_management[ID] !== NAME) {
    fail('Protectionism was not registered in resultsMapping');
}

if (ctx.descriptions[ID] !== DESC) {
    fail('Protectionism description was not registered');
}

if (!ctx.ideologyScores || !Object.keys(SCORES).every(label =>
    ctx.ideologyScores[label].includes(ID + ':')
)) {
    fail('Protectionism scores did not register correctly');
}

// --------------------------------------------------
// 5. Write all files
// --------------------------------------------------

save(data);
save(treeFile);
save(jsonFile);

console.log('Protectionism successfully added!');
console.log('Updated: data.js');
console.log('Updated: questions_tree.json');
console.log('Updated: ideology_scores.json');
console.log('Ideologies updated: ' + changed);
