#!/usr/bin/env node
// Adds Polish National Radicalism (ONR, 1934) to Third Position.
// Updates data.js, ideology_scores.json and changelog.html.
// Run: node tools/add_national_radicalism.js
// Then: node tools/check_scoring.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA = {
    label: "National Radicalism",
    group: "Third Position",
    after: "Revolutionary Nationalism",
    combo: "corporatism|reactionaryism|ethical_statism|ethnic_nationalism|totalism|centralism",
    color: "#008000",

    definition: "A Polish nationalist and authoritarian doctrine associated with the National Radical Camp (ONR), founded in 1934. It envisioned Poland as a Catholic national state, with public and economic life organized according to Catholic principles, hierarchy and corporatist structures. It rejected parliamentary democracy, liberalism and Marxism, advocating a strong state and the subordination of individual political interests to the national community. Its nationalism was ethnically exclusionary and explicitly antisemitic, promoting the marginalization and exclusion of Jews from national life. The movement emphasized Catholic traditionalism, national solidarity, social discipline and centralized political authority. The original ONR split in 1934 into ONR-ABC and ONR-Falanga, whose later programmes developed in different directions.",

    stances: {
        corporatism: 1.0,
        dirigisme: 0.7,
        state_capitalism: 0.3,

        religious_traditionalism: 1.0,
        traditionalist_conservatism: 0.9,
        reactionaryism: 0.8,

        ethical_statism: 1.0,
        autocracy: 0.9,
        representative_democracy: -1.0,
        anarchism: -1.0,

        ethnic_nationalism: 1.0,
        religious_nationalism: 0.9,
        civic_nationalism: -0.3,
        Cosmopolitanism: -1.0,
        multiculturalism: -1.0,

        Globalism: -0.7,
        Internationalism: -0.7,

        industrialism: 0.5,
        agrarianism: 0.3,

        totalism: 0.8,
        disciplinarianism: 0.9,

        centralism: 0.8,
        hypercentralism: 0.3


    },

    date: "21.11.2026"
};

const root = path.join(__dirname, '..');

const fail = message => {
    console.error('STOPPED, nothing was changed: ' + message);
    process.exit(1);
};

function load(file) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8');
    const crlf = raw.includes('\r\n');

    return {
        file,
        crlf,
        text: crlf ? raw.replace(/\r\n/g, '\n') : raw
    };
}

function editBlock(doc, blockStart, from, to, what) {
    const start = doc.text.indexOf(blockStart);
    const end = doc.text.indexOf('\n};', start);

    if (start < 0 || end < 0) {
        fail(what + ': block not found in ' + doc.file);
    }

    const block = doc.text.slice(start, end);
    const count = block.split(from).length - 1;

    if (count !== 1) {
        fail(what + ': expected one anchor, found ' + count);
    }

    doc.text =
        doc.text.slice(0, start) +
        block.replace(from, () => to) +
        doc.text.slice(end);
}

const data = load('data.js');
const scoresJson = load('ideology_scores.json');
const changelog = load('changelog.html');

if (data.text.includes(JSON.stringify(DATA.label))) {
    fail(DATA.label + ' is already in data.js');
}

const after = DATA.after;

// Add to Third Position.
editBlock(
    data,
    'const ideologyGroups',
    '        ' + JSON.stringify(after) + ',\n' +
    '        ' + JSON.stringify("Paetel's National Bolshevism") +
    '\n    ],\n    "Reactionary": [',

    '        ' + JSON.stringify(after) + ',\n' +
    '        ' + JSON.stringify(DATA.label) + ',\n' +
    '        ' + JSON.stringify("Paetel's National Bolshevism") +
    '\n    ],\n    "Reactionary": [',

    'ideologyGroups'
);

// Add value combination.
editBlock
{
    const start = data.text.indexOf('const labelMapping');
    const end = data.text.indexOf('\n};', start);

    if (start < 0 || end < 0) {
        fail('Could not find the labelMapping block.');
    }

    const block = data.text.slice(start, end);
    const lines = block.split('\n');

    const matches = lines
        .map((line, index) =>
            line.includes('"Revolutionary Nationalism"') ? index : -1
        )
        .filter(index => index !== -1);

    if (matches.length !== 1) {
        fail('Could not uniquely find Revolutionary Nationalism in labelMapping. Found: ' + matches.length);
    }

    lines.splice(
        matches[0] + 1,
        0,
        '    ' + JSON.stringify(DATA.combo) + ': ' +
        JSON.stringify(DATA.label) + ','
    );

    data.text =
        data.text.slice(0, start) +
        lines.join('\n') +
        data.text.slice(end);
}

// Add color.
{
    const colorAt = data.text.indexOf('const labelColors = {');
    const colorEnd = data.text.indexOf('\n};', colorAt);

    if (colorAt < 0 || colorEnd < 0) {
        fail('labelColors block not found');
    }

    const lines = data.text.slice(colorAt, colorEnd).split('\n');

    const matches = lines
        .map((line, i) =>
            line.startsWith('    ' + JSON.stringify(after) + ': "') ? i : -1
        )
        .filter(i => i >= 0);

    if (matches.length !== 1) {
        fail('labelColors anchor not unique');
    }

    lines.splice(
        matches[0] + 1,
        0,
        '    ' + JSON.stringify(DATA.label) + ': ' +
        JSON.stringify(DATA.color) + ','
    );

    data.text =
        data.text.slice(0, colorAt) +
        lines.join('\n') +
        data.text.slice(colorEnd);
}

// Add definition.
editBlock(
    data,
    'const descriptions',
    '\n\n    /* 2. Reactionary */',

    '\n    ' + JSON.stringify(DATA.label) + ': ' +
    JSON.stringify(DATA.definition) +
    ',\n\n    /* 2. Reactionary */',

    'descriptions'
);

// Format stance values.
const fmt = x =>
    (x < 0 ? '-' : '') +
    (Math.abs(x) === 1
        ? '1'
        : String(Math.abs(x)).replace(/^0/, ''));

const scoreText = Object.keys(DATA.stances)
    .map(value => value + ':' + fmt(DATA.stances[value]))
    .join('|');

// Add scores to data.js.
{
    const scoreAt = data.text.indexOf('const ideologyScores = {');
    const scoreEnd = data.text.indexOf('\n};', scoreAt);

    if (scoreAt < 0 || scoreEnd < 0) {
        fail('ideologyScores block not found');
    }

    const lines = data.text.slice(scoreAt, scoreEnd).split('\n');

    const afterLine = lines.findIndex(line =>
        line.startsWith('    ' + JSON.stringify(after) + ': "')
    );

    if (afterLine < 0) {
        fail('ideologyScores has no line for ' + after);
    }

    lines.splice(
        afterLine + 1,
        0,
        '    ' + JSON.stringify(DATA.label) + ': ' +
        JSON.stringify(scoreText) + ','
    );

    data.text =
        data.text.slice(0, scoreAt) +
        lines.join('\n') +
        data.text.slice(scoreEnd);
}

// Add scores to ideology_scores.json.
{
    const lines = scoresJson.text.split('\n');

    const jsonAt = lines.findIndex(line =>
        line.startsWith(JSON.stringify(after) + ':{')
    );

    if (jsonAt < 0) {
        fail('ideology_scores.json has no line for ' + after);
    }

    lines.splice(
        jsonAt + 1,
        0,
        JSON.stringify(DATA.label) + ':{' +
        '"d":' + JSON.stringify(DATA.definition) + ',' +
        '"s":' + JSON.stringify(scoreText) + '},'
    );

    scoresJson.text = lines.join('\n');
}

// Validate before writing anything.
try {
    JSON.parse(scoresJson.text);
} catch (error) {
    fail('Invalid ideology_scores.json: ' + error.message);
}

const ctx = {};
vm.createContext(ctx);

try {
    vm.runInContext(
        data.text.replace(/^const /gm, 'var '),
        ctx,
        { filename: 'data.js' }
    );
} catch (error) {
    fail('data.js would not run: ' + error.message);
}

const known = {};

Object.keys(ctx.resultsMapping).forEach(category => {
    Object.keys(ctx.resultsMapping[category]).forEach(id => {
        known[id] = true;
    });
});

const unknown = Object.keys(DATA.stances)
    .concat(DATA.combo.split('|'))
    .filter(value => !known[value]);

if (unknown.length) {
    fail('Unknown scoring values: ' + unknown.join(', '));
}

if (!ctx.ideologyGroups[DATA.group].includes(DATA.label)) {
    fail('Ideology group validation failed');
}

if (ctx.labelMapping[DATA.combo] !== DATA.label) {
    fail('Value combination validation failed');
}

if (
    !ctx.labelColors[DATA.label] ||
    !ctx.descriptions[DATA.label] ||
    ctx.ideologyScores[DATA.label] !== scoreText
) {
    fail('Definition, color or scores failed validation');
}

// Update changelog version.
const top = changelog.text.match(
    /<h3>(\d+)\.(\d+)(?:\.(\d+))?\s*-/
);

if (!top) {
    fail('No version found in changelog.html');
}

const version =
    top[1] + '.' + top[2] + '.' + ((Number(top[3]) || 0) + 1);

const entry =
    '        <div class="description-box">\n' +
    '            <h3>' + version + ' - ' + DATA.date + '</h3>\n' +
    '            <ul>\n' +
    '                <li>Added National Radicalism, referring to the Polish National Radical Camp (ONR, 1934), to Third Position. Added its historical description, value combination, color and ' +
    Object.keys(DATA.stances).length + ' estimated scoring positions.</li>\n' +
    '            </ul>\n' +
    '        </div>\n\n';

const marker = '<h1>Changelog</h1>\n\n';

if (changelog.text.split(marker).length !== 2) {
    fail('Changelog heading anchor not found exactly once');
}

changelog.text = changelog.text.replace(marker, marker + entry);

// Write only after all checks pass.
[data, scoresJson, changelog].forEach(doc => {
    fs.writeFileSync(
        path.join(root, doc.file),
        doc.crlf ? doc.text.replace(/\n/g, '\r\n') : doc.text
    );
});

console.log('Added ' + DATA.label + ' to ' + DATA.group + '.');
console.log('Next: node tools/check_scoring.js');
