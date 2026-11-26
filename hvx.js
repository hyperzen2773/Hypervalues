// Everything the explore page (explore.html) and its buttons use: one table of scores that all of it reads, the reasons
// behind a result, comparing, links, the maps, the tensions, the lenses, the saved versions of you and the history of
// a pack. It reads the site's data and ranking (data.js, scoring.js, and pack.js when it is there) and changes none of
// them: the answers, the ranking and Custom Pages work as before.
// An answer set looks like the one HV.loadAnswers() returns: { category: [{ value, agree }] }, agree from -1 to +1.
const HVX = (function () {
    const VERSION = 'v3.14.4';
    const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
    const labels = () => { const list = []; Object.keys(labelMapping).forEach(key => { if (!list.includes(labelMapping[key])) list.push(labelMapping[key]); }); return list; };
    const valueIds = () => Object.keys(HV.categoryOf);

    // ----- One table of scores: how much each ideology holds each value, from -1 to +1. The values its definition lists
    // are what they say (listed); for the others it is the guess of the ranking model, at most 0.5 and shown faded.
    const rows = {};
    function row(label) {
        if (rows[label]) return rows[label];
        const result = {};
        const listed = HV.stancesByCategory(label);
        Object.keys(listed).forEach(cat => listed[cat].forEach(item => { result[item.value] = { s: item.stance, listed: true }; }));
        HV.guessedValues(label, Infinity).forEach(guess => {
            if (!(guess.value in result)) result[guess.value] = { s: clamp(guess.net, -0.5, 0.5), listed: false };
        });
        rows[label] = result;
        return result;
    }
    const score = (label, value) => (row(label)[value] ? row(label)[value].s : 0);
    const isListed = (label, value) => !!(row(label)[value] && row(label)[value].listed);

    function flat(answers) {
        const list = [];
        Object.keys(answers || {}).forEach(cat => (answers[cat] || []).forEach(item => {
            if (item && HV.categoryOf[item.value] && Number.isFinite(Number(item.agree))) list.push({ value: item.value, cat: HV.categoryOf[item.value], agree: clamp(Number(item.agree), -1, 1) });
        }));
        return list;
    }
    function build(list) {
        const answers = {};
        list.forEach(item => {
            const cat = HV.categoryOf[item.value];
            if (cat) (answers[cat] = answers[cat] || []).push({ value: item.value, agree: round2(item.agree) });
        });
        return answers;
    }
    function round2(x) { return Math.round(x * 100) / 100; }
    const answeredCount = answers => flat(answers).length;

    // Answers that are what an ideology says (only the values it lists)
    function answersOf(label) {
        const list = [];
        const listed = HV.stancesByCategory(label);
        Object.keys(listed).forEach(cat => listed[cat].forEach(item => list.push({ value: item.value, agree: item.stance })));
        return build(list);
    }

    // ----- Why: how each answer of yours meets an ideology
    function explain(answers, label) {
        const done = new Set();
        const groups = { toward: [], away: [], flat: [], missing: [] };
        flat(answers).forEach(item => {
            done.add(item.value);
            const s = score(label, item.value);
            const fit = item.agree * s;
            const entry = { value: item.value, cat: item.cat, agree: item.agree, s, listed: isListed(label, item.value), fit };
            (fit >= 0.15 ? groups.toward : fit <= -0.15 ? groups.away : groups.flat).push(entry);
        });
        groups.toward.sort((a, b) => b.fit - a.fit);
        groups.away.sort((a, b) => a.fit - b.fit);
        groups.flat.sort((a, b) => Math.abs(b.s) - Math.abs(a.s));
        const listed = HV.stancesByCategory(label);
        Object.keys(listed).forEach(cat => listed[cat].forEach(item => {
            if (!done.has(item.value) && Math.abs(item.stance) >= 0.3) groups.missing.push({ value: item.value, cat, s: item.stance, listed: true, agree: 0, fit: 0 });
        }));
        groups.missing.sort((a, b) => Math.abs(b.s) - Math.abs(a.s));
        groups.missing = groups.missing.slice(0, 8);
        return groups;
    }
    // The answers that make two ideologies differ: [{ value, cat, agree, a, b, favors: 'a' | 'b' }]
    function differences(answers, a, b) {
        const list = [];
        flat(answers).forEach(item => {
            const fa = item.agree * score(a, item.value);
            const fb = item.agree * score(b, item.value);
            if (Math.abs(fa - fb) >= 0.15) list.push({ value: item.value, cat: item.cat, agree: item.agree, a: fa, b: fb, favors: fa > fb ? 'a' : 'b', size: Math.abs(fa - fb) });
        });
        return list.sort((x, y) => y.size - x.size);
    }
    // The value you have not answered that tells two ideologies apart the most
    function decider(answers, a, b) {
        const done = new Set(flat(answers).map(item => item.value));
        let best = null;
        valueIds().forEach(value => {
            if (done.has(value) || !(isListed(a, value) || isListed(b, value))) return;
            const gap = Math.abs(score(a, value) - score(b, value));
            if (gap >= 0.4 && (!best || gap > best.gap)) best = { value, cat: HV.categoryOf[value], gap, a: score(a, value), b: score(b, value) };
        });
        return best;
    }
    // Is the lead of the first ideology over the second thin?
    const close = ranked => ranked.length > 1 && ranked[0].probability > 0 && ranked[1].probability / ranked[0].probability > 0.6;

    // ----- Compare two answer sets
    function compare(a, b) {
        const A = {}, B = {};
        flat(a).forEach(item => { A[item.value] = item.agree; });
        flat(b).forEach(item => { B[item.value] = item.agree; });
        const tiles = [];
        let sum = 0, shared = 0;
        const all = new Set(Object.keys(A).concat(Object.keys(B)));
        all.forEach(value => {
            const cat = HV.categoryOf[value];
            if (value in A && value in B) {
                const gap = Math.abs(A[value] - B[value]);
                sum += 1 - gap / 2;
                shared++;
                tiles.push({ value, cat, a: A[value], b: B[value], state: gap < 0.35 ? 'same' : 'differ', gap });
            } else tiles.push({ value, cat, a: A[value], b: B[value], state: 'one', gap: 0 });
        });
        const pa = {}, pb = {};
        HV.rankIdeologies(a).forEach(item => { pa[item.label] = item.probability; });
        HV.rankIdeologies(b).forEach(item => { pb[item.label] = item.probability; });
        const names = Object.keys(pa);
        const both = names.slice().sort((x, y) => pa[y] * pb[y] - pa[x] * pb[x]).slice(0, 3);
        const onlyA = names.filter(n => !both.includes(n)).sort((x, y) => (pa[y] - pb[y]) - (pa[x] - pb[x])).slice(0, 2);
        const onlyB = names.filter(n => !both.includes(n)).sort((x, y) => (pb[y] - pa[y]) - (pb[x] - pa[x])).slice(0, 2);
        return { overlap: shared ? sum / shared : null, shared, union: all.size, tiles, both, onlyA, onlyB };
    }

    // ----- The space of all ideologies: three directions that spread them out the most, and a radar by category
    let space = null;
    function build3() {
        if (space) return space;
        const labs = labels();
        const vals = valueIds();
        const N = labs.length, V = vals.length;
        const X = labs.map(l => vals.map(v => score(l, v)));
        const mean = vals.map((v, j) => X.reduce((sum, r) => sum + r[j], 0) / N);
        X.forEach(r => r.forEach((x, j) => { r[j] = x - mean[j]; }));
        const Y = X.map(r => r.slice());
        const comps = [];
        for (let k = 0; k < 3; k++) {
            let v = vals.map((_, j) => Math.sin(j * 1.7 + k + 1));
            for (let it = 0; it < 70; it++) {
                const t = Y.map(r => r.reduce((s, x, j) => s + x * v[j], 0));
                const w = new Array(V).fill(0);
                Y.forEach((r, i) => r.forEach((x, j) => { w[j] += x * t[i]; }));
                const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1;
                v = w.map(x => x / norm);
            }
            let big = 0;
            v.forEach((x, j) => { if (Math.abs(x) > Math.abs(v[big])) big = j; });
            if (v[big] < 0) v = v.map(x => -x);
            comps.push(v);
            Y.forEach(r => { const d = r.reduce((s, x, j) => s + x * v[j], 0); r.forEach((x, j) => { r[j] = x - d * v[j]; }); });
        }
        const pos = {};
        labs.forEach((l, i) => { pos[l] = comps.map(c => X[i].reduce((s, x, j) => s + x * c[j], 0)); });
        space = { labs, vals, comps, pos, mean, ends: comps.map(c => { const order = vals.map((v, j) => [v, c[j]]).sort((a, b) => a[1] - b[1]); return { low: order[0][0], high: order[order.length - 1][0] }; }) };
        return space;
    }
    // Where you are: the average place of your closest ideologies
    function placeOf(answers) {
        const sp = build3();
        const top = HV.closestIdeologies(answers, null, 8);
        const total = top.reduce((s, t) => s + t.probability, 0);
        if (!top.length || !total) return null;
        return [0, 1, 2].map(k => top.reduce((s, t) => s + sp.pos[t.label][k] * t.probability, 0) / total);
    }
    // The category radar: for you the average of your answers, for an ideology the average of its listed stances
    function radar(answers, labelList) {
        const cats = Object.keys(resultsMapping).filter(cat => (answers[cat] || []).length);
        const you = cats.map(cat => answers[cat].reduce((s, i) => s + i.agree, 0) / answers[cat].length);
        const others = labelList.map(label => {
            const listed = HV.stancesByCategory(label);
            return { label, values: cats.map(cat => (listed[cat] && listed[cat].length) ? listed[cat].reduce((s, i) => s + i.stance, 0) / listed[cat].length : 0) };
        });
        return { cats, you, others };
    }

    // ----- Tensions among your own answers: pairs you hold that the ideologies seldom hold together
    function tensions(answers) {
        const mine = flat(answers).filter(item => item.agree >= 0.4);
        const labs = labels();
        const col = value => labs.map(l => score(l, value));
        const cols = {};
        mine.forEach(item => { cols[item.value] = col(item.value); });
        const corr = (x, y) => {
            const n = x.length;
            const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
            let sxy = 0, sxx = 0, syy = 0;
            for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
            return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
        };
        const pairs = [];
        for (let i = 0; i < mine.length; i++) {
            for (let j = i + 1; j < mine.length; j++) {
                const c = corr(cols[mine[i].value], cols[mine[j].value]);
                if (c <= -0.2) {
                    const holders = labs.filter(l => isListed(l, mine[i].value) && isListed(l, mine[j].value) && score(l, mine[i].value) >= 0.3 && score(l, mine[j].value) >= 0.3);
                    pairs.push({ a: mine[i], b: mine[j], strength: -c * Math.min(mine[i].agree, mine[j].agree), holders: holders.slice(0, 3), holderCount: holders.length });
                }
            }
        }
        return pairs.sort((x, y) => y.strength - x.strength).slice(0, 6);
    }

    // ----- Lenses: an axis you define from values and weights; an ideology or you lands at the weighted average
    const LENS_KEY = 'hvx_lens';
    function loadLens() {
        try { const lens = JSON.parse(localStorage.getItem(LENS_KEY) || 'null'); if (lens && Array.isArray(lens.x) && Array.isArray(lens.y)) return lens; } catch (e) { /* none saved */ }
        const sp = build3();
        const axis = k => {
            const order = sp.vals.map((v, j) => ({ v, w: sp.comps[k][j] })).sort((p, q) => Math.abs(q.w) - Math.abs(p.w)).slice(0, 5);
            const big = Math.abs(order[0].w) || 1;
            return order.map(i => ({ v: i.v, w: round2(i.w / big) }));
        };
        return { x: axis(0), y: axis(1) };
    }
    function saveLens(lens) { try { localStorage.setItem(LENS_KEY, JSON.stringify(lens)); } catch (e) { /* no storage */ } }
    function lensPosition(axis, get) {
        let sum = 0, weight = 0;
        axis.forEach(item => { const x = get(item.v); if (x === null) return; sum += item.w * x; weight += Math.abs(item.w); });
        return weight ? sum / weight : 0;
    }
    function lensOfIdeology(lens, label) { return [lensPosition(lens.x, v => (HV.categoryOf[v] ? score(label, v) : null)), lensPosition(lens.y, v => (HV.categoryOf[v] ? score(label, v) : null))]; }
    function lensOfAnswers(lens, answers) {
        const map = {};
        flat(answers).forEach(item => { map[item.value] = item.agree; });
        const get = v => (v in map ? map[v] : null);
        return [lensPosition(lens.x, get), lensPosition(lens.y, get)];
    }

    // ----- Links: your answers in the address, nothing stored anywhere
    function hashOf(id) {
        let h = 2166136261;
        for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
        return ((h >>> 0) % 1679616).toString(36).padStart(4, '0');
    }
    function encode(answers, meta) {
        const custom = typeof HVPack !== 'undefined' && HVPack.isCustom();
        const name = custom && HVPack.active && HVPack.active() && HVPack.active().name ? HVPack.active().name : '';
        let text = 'a' + (custom ? 'c' : 'n');
        flat(answers).forEach(item => { text += hashOf(item.value) + String(Math.round(item.agree * 100) + 100).padStart(3, '0'); });
        if (name) text += '~' + encodeURIComponent(name.slice(0, 40));
        return text;
    }
    function decode(text) {
        const body = String(text || '').trim();
        const match = /^a([cn])((?:[0-9a-z]{4}[0-9]{3})*)(?:~(.*))?$/.exec(body);
        if (!match) return null;
        const byHash = {};
        valueIds().forEach(id => { byHash[hashOf(id)] = id; });
        const list = [];
        let unknown = 0;
        const data = match[2];
        for (let i = 0; i < data.length; i += 7) {
            const id = byHash[data.slice(i, i + 4)];
            const agree = (Number(data.slice(i + 4, i + 7)) - 100) / 100;
            if (id && agree >= -1 && agree <= 1) list.push({ value: id, agree }); else unknown++;
        }
        let name = '';
        try { name = match[3] ? decodeURIComponent(match[3]) : ''; } catch (e) { name = ''; }
        return { answers: build(list), custom: match[1] === 'c', name, unknown };
    }
    // Finds a link's code in whatever was pasted (an address, or only the code)
    function codeFrom(text) {
        const s = String(text || '').trim();
        const at = s.indexOf('#r=');
        return at >= 0 ? s.slice(at + 3) : s;
    }

    // ----- The versions of you: kept when you clear your values, or when you save one
    const VERSIONS_KEY = 'hvx_versions';
    function versions() {
        try { const list = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch (e) { return []; }
    }
    function writeVersions(list) { try { localStorage.setItem(VERSIONS_KEY, JSON.stringify(list.slice(0, 12))); } catch (e) { /* no storage */ } }
    function keep(answers) {
        const list = flat(answers);
        if (!list.length) return false;
        const text = JSON.stringify(build(list));
        const all = versions();
        if (all.length && JSON.stringify(all[0].a) === text) return false;
        const top = HV.closestIdeologies(answers, null, 1)[0];
        all.unshift({ t: Date.now(), c: typeof HVPack !== 'undefined' && HVPack.isCustom(), a: JSON.parse(text), top: top ? top.label : '' });
        writeVersions(all);
        return true;
    }
    function dropVersion(index) { const all = versions(); all.splice(index, 1); writeVersions(all); }

    // ----- The history of a pack: the state before an edit session, and before an import or a reset
    const PACKS_KEY = 'hvx_packs';
    function packs() { try { const list = JSON.parse(localStorage.getItem(PACKS_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch (e) { return []; } }
    function snapshotPack(force) {
        if (typeof HVPack === 'undefined') return;
        let stored = null;
        try { stored = HVPack.storedPack(); } catch (e) { stored = null; }
        if (!stored) return;
        const text = JSON.stringify(stored);
        let all = packs();
        if (all.length && all[0].p === text) return;
        if (!force && all.length && Date.now() - all[0].t < 120000) return;
        all.unshift({ t: Date.now(), p: text });
        all = all.slice(0, 15);
        while (all.length > 1 && JSON.stringify(all).length > 1500000) all.pop();
        try { localStorage.setItem(PACKS_KEY, JSON.stringify(all)); } catch (e) { /* no storage */ }
    }
    function restorePack(index) {
        const all = packs();
        if (!all[index]) return false;
        snapshotPack(true);
        let pack = null;
        try { pack = JSON.parse(all[index].p); } catch (e) { return false; }
        return HVPack.savePack(pack);
    }
    if (typeof HVPack !== 'undefined' && HVPack.savePack && !HVPack.savePack.hvx) {
        const original = HVPack.savePack;
        const wrapped = function () { snapshotPack(false); return original.apply(this, arguments); };
        wrapped.hvx = true;
        HVPack.savePack = wrapped;
    }

    return {
        VERSION, labels, valueIds, row, score, isListed, flat, build, answeredCount, answersOf, explain, differences, decider, close, compare, build3,
        placeOf, radar, tensions, loadLens, saveLens, lensOfIdeology, lensOfAnswers, hashOf, encode, decode, codeFrom, versions, keep, dropVersion,
        packs, snapshotPack, restorePack
    };
})();
