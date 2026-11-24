
// Tests whether each ideology can be identified using its
// three most distinctive EXISTING stances.
//
// This is report-only. It does not modify project files or scores.
// Run: node tools/diagnose_discriminating.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

const ctx = {
    localStorage: {
        getItem() { return null; },
        setItem() {}
    },
    console,
    atob: text => Buffer.from(text, 'base64').toString('binary')
};

vm.createContext(ctx);

['data.js', 'scoring.js'].forEach(file => {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
        .replace(/^const /gm, 'var ');

    vm.runInContext(source, ctx, { filename: file });
});

const HV = ctx.HV;
const categoryOf = HV.categoryOf;

const labels = [];

Object.keys(ctx.labelMapping).forEach(key => {
    const label = ctx.labelMapping[key];
    if (!labels.includes(label)) labels.push(label);
});

// Extract existing nonzero ideology scores.
const stances = {};

labels.forEach(label => {
    stances[label] = {};

    (ctx.ideologyScores[label] || '').split('|').forEach(part => {
        const at = part.lastIndexOf(':');
        if (at < 1) return;

        const value = part.slice(0, at);
        const stance = Number(part.slice(at + 1));

        if (
            categoryOf[value] &&
            Number.isFinite(stance) &&
            stance >= -1 &&
            stance <= 1 &&
            stance !== 0
        ) {
            stances[label][value] = stance;
        }
    });
});

// Convert selected stances into the answer format expected by the ranker.
function answersFrom(entries) {
    const answers = {};

    entries.forEach(([value, agree]) => {
        const category = categoryOf[value];

        (answers[category] = answers[category] || []).push({
            value,
            agree
        });
    });

    return answers;
}

// Measure how distinctive each stance is.
//
// Only explicitly recorded scores are compared.
// Missing scores are NOT treated as zero.
//
// Higher coverage means more competing ideologies have an
// explicit score for this stance.
// Higher distance means their scores differ more from the target.
function distinctiveStances(label) {
    const candidates = [];

    Object.entries(stances[label]).forEach(([value, target]) => {
        const comparisons = [];

        labels.forEach(other => {
            if (other === label) return;

            const otherScore = stances[other][value];

            if (otherScore === undefined) return;

            comparisons.push(Math.abs(target - otherScore));
        });

        if (!comparisons.length) return;

        const coverage = comparisons.length / (labels.length - 1);

        const meanDistance =
            comparisons.reduce((sum, distance) => sum + distance, 0) /
            comparisons.length;

        // Balances separation with the amount of available evidence.
        const distinctiveness = meanDistance * Math.sqrt(coverage);

        candidates.push({
            value,
            target,
            coverage,
            meanDistance,
            distinctiveness
        });
    });

    return candidates.sort((a, b) =>
        b.distinctiveness - a.distinctiveness ||
        a.value.localeCompare(b.value)
    );
}

const failures = [];
const results = [];

labels.forEach(label => {
    const candidates = distinctiveStances(label);
    const selected = candidates.slice(0, 3);

    if (!selected.length) return;

    const entries = selected.map(item => [
        item.value,
        item.target
    ]);

    const ranked = HV.rankIdeologies(answersFrom(entries));
    const position = ranked.findIndex(item => item.label === label);

    const result = {
        label,
        position: position + 1,
        entries,
        above: ranked.slice(0, 3).map(item => item.label),
        candidates
    };

    results.push(result);

    if (position >= 3) failures.push(result);
});

failures.sort((a, b) => b.position - a.position);

const passed = results.length - failures.length;

console.log('DISTINCTIVE-STANCE TEST');
console.log('=======================');
console.log(
    passed + ' of ' + results.length +
    ' ideologies ranked in their own top 3.'
);

console.log(
    'Pass rate: ' +
    (100 * passed / results.length).toFixed(1) + '%\n'
);

console.log('FAILURES');
console.log('========');

failures.forEach(result => {
    console.log(
        '\n' + result.label +
        ' (ranked ' + result.position + ')'
    );

    console.log(
        '   answers: ' +
        result.entries.map(e => e[0] + ':' + e[1]).join(', ')
    );

    console.log(
        '   ranked above: ' + result.above.join(', ')
    );
});

console.log('\nMOST DISTINCTIVE STANCES');
console.log('========================');

results.forEach(result => {
    console.log('\n' + result.label);

    result.candidates.slice(0, 5).forEach(candidate => {
        console.log(
            '   ' + candidate.value +
            ':' + candidate.target +
            ' | distinction: ' +
            candidate.distinctiveness.toFixed(3) +
            ' | coverage: ' +
            (candidate.coverage * 100).toFixed(1) + '%'
        );
    });
});

console.log('\nOriginal strongest-stance failures: 32');
console.log('Distinctive-stance failures: ' + failures.length);

console.log('\nNo project files were modified.');
