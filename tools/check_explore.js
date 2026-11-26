// Checks the systems of the explore page (hvx.js) against the site's data:  node tools/check_explore.js
// Exits with 1 if a check fails.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const store = {};
const ctx = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, console, atob: t => Buffer.from(t, 'base64').toString('binary'), Date, Math };
vm.createContext(ctx);
['data.js', 'scoring.js', 'hvx.js'].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8').replace(/^const /gm, 'var '), ctx, { filename: file }));
const HV = ctx.HV, X = ctx.HVX;
let failures = 0;
const check = (ok, message) => { if (!ok) { failures++; console.log('FAIL  ' + message); } else console.log('ok    ' + message); };

const labels = X.labels();
const values = X.valueIds();
check(labels.length > 200 && values.length > 100, `the table covers ${labels.length} ideologies and ${values.length} values`);
let outOfRange = 0, listedCount = 0;
labels.forEach(l => values.forEach(v => { const s = X.score(l, v); if (!(s >= -1 && s <= 1)) outOfRange++; if (X.isListed(l, v)) listedCount++; }));
check(outOfRange === 0, 'every score is between -1 and +1');
check(listedCount > 2000, `listed scores come from the definitions (${listedCount})`);
let bigGuess = 0;
labels.forEach(l => values.forEach(v => { if (!X.isListed(l, v) && Math.abs(X.score(l, v)) > 0.5 + 1e-9) bigGuess++; }));
check(bigGuess === 0, 'a guessed score is never above 0.5');

// the answers of an ideology rank it first or near it
let top3 = 0;
labels.forEach(l => { const r = HV.closestIdeologies(X.answersOf(l), null, 3); if (r.some(x => x.label === l)) top3++; });
check(top3 / labels.length > 0.8, `answers taken from an ideology put it in the first 3 for ${Math.round(100 * top3 / labels.length)}%`);

const sample = X.answersOf(labels[5]);
const flat = X.flat(sample);
check(flat.length > 3, 'answersOf gives answers');
const ranked = HV.closestIdeologies(sample, null, 4);
const why = X.explain(sample, ranked[0].label);
check(why.toward.length > why.away.length, 'the best match has more answers toward it than away');
const diff = X.differences(sample, ranked[0].label, ranked[1].label);
check(diff.every(d => d.favors === 'a' || d.favors === 'b'), 'differences name a side');
const half = X.build(flat.slice(0, Math.ceil(flat.length / 2)));
const r2 = HV.closestIdeologies(half, null, 2);
const dec = X.decider(half, r2[0].label, r2[1].label);
check(!dec || (!X.flat(half).some(i => i.value === dec.value) && dec.gap >= 0.4), 'the decider is an unanswered value that separates them');

// links
const code = X.encode(sample);
const back = X.decode(code);
check(back && JSON.stringify(X.flat(back.answers).map(i => [i.value, i.agree]).sort()) === JSON.stringify(flat.map(i => [i.value, Math.round(i.agree * 100) / 100]).sort()), 'a link gives the same answers back');
check(code.length < 700, `a link is short (${code.length} characters for ${flat.length} answers)`);
check(X.decode('garbage') === null && X.decode('') === null, 'a wrong link is refused');
const hashes = new Set(values.map(X.hashOf));
check(hashes.size === values.length, 'no two values share a link code');
check(X.codeFrom('https://x/explore.html#r=' + code) === code, 'a code is found in a pasted address');

// compare
const cmp = X.compare(X.answersOf(labels[0]), X.answersOf(labels[0]));
check(cmp.overlap === 1 && cmp.tiles.every(t => t.state === 'same'), 'the same answers compare as fully the same');
const cmp2 = X.compare(X.answersOf(labels[0]), X.answersOf(labels[100]));
check(cmp2.overlap === null || (cmp2.overlap >= 0 && cmp2.overlap <= 1), 'overlap is between 0 and 1');

// the space
const sp = X.build3();
check(sp.comps.length === 3 && labels.every(l => sp.pos[l].every(Number.isFinite)), 'every ideology has a place in 3 directions');
const place = X.placeOf(sample);
check(place && place.every(Number.isFinite), 'you have a place');
const radar = X.radar(sample, [labels[5]]);
check(radar.cats.length > 2 && radar.you.length === radar.cats.length, 'the radar has an axis for each category you answered');

// tensions and lenses
const tension = X.tensions(sample);
check(tension.every(t => t.strength > 0 && t.a.value !== t.b.value), 'tensions are pairs of different values');
const lens = X.loadLens();
check(lens.x.length === 5 && lens.y.length === 5 && lens.x.every(i => Math.abs(i.w) <= 1), 'the first lens has two axes of 5 values');
const spread = labels.map(l => X.lensOfIdeology(lens, l)[0]);
check(Math.max(...spread) - Math.min(...spread) > 0.3, 'a lens spreads the ideologies out');
check(X.lensOfAnswers(lens, sample).every(Number.isFinite), 'you land on a lens');

// versions
check(X.keep(sample) === true && X.keep(sample) === false && X.versions().length === 1, 'a version is kept once');
X.dropVersion(0);
check(X.versions().length === 0, 'a version can be dropped');
check(X.keep({}) === false, 'nothing is kept when there are no answers');

console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
