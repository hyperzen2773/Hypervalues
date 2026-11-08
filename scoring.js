// Shared scoring helpers for results.html, quiz.html and description.html. Load data.js first, and
// embedding_weights.js (trained by tools/train_embedding.py) for the ranking.
//
// Your answers (see loadAnswers) map a category to the values you added in it, each with how much it matches you,
// from -1 (opposite) through 0 (neutral) to +1 (match). A category you did not touch is missing.
//
// The ideologies are ranked by an embedding model:
//   - your answers (128 agreements + a flag for each value saying its category was touched) go through a small
//     network and come out as a point u of 32 numbers;
//   - an ideology is a point e of 32 numbers too, made from its stances in ideologyScores (data.js, from -1 for
//     "opposes the value" to +1 for "matches it") times a matrix learned in training. An ideology has no
//     numbers of its own, so adding one to data.js is enough, no training needed (see tools/train_embedding.py);
//   - the logit of an ideology is scale * cos(u, e) and a softmax over all ideologies gives its probability p.
// The score shown is ln(p * n) / ln(n) for n ideologies, at least -1: 0 means no better than chance, +1 means
// certain. If the weights do not load, the ideologies are ranked by the plain cosine between your answers and
// their stances instead.
// Ties go to the ideology with more values you picked that it holds, then with more values listed, then to the
// order in data.js. closestIdeologies keeps only ideologies that hold at least one value you picked.
const HV = (function () {
    const categoryOf = {};
    Object.keys(resultsMapping).forEach(cat => {
        Object.keys(resultsMapping[cat]).forEach(id => {
            if (!(id in categoryOf)) categoryOf[id] = cat;
        });
    });

    // Order of the ideologies in data.js
    const labelOrder = {};
    Object.keys(labelMapping).forEach(key => {
        const label = labelMapping[key];
        if (!(label in labelOrder)) labelOrder[label] = Object.keys(labelOrder).length;
    });

    // Stances of every ideology: { label: { value: stance } }, parsed from "value:score|value:score"
    // An ideology without scores falls back to the first of its old value sets, every value at +1.
    const stancesOf = {};
    Object.keys(labelOrder).forEach(label => {
        const stances = {};
        const text = (typeof ideologyScores !== 'undefined' && ideologyScores[label]) || '';
        text.split('|').forEach(part => {
            const at = part.lastIndexOf(':');
            if (at < 1) return;
            const value = part.slice(0, at);
            const stance = Number(part.slice(at + 1));
            if (categoryOf[value] && stance >= -1 && stance <= 1 && stance !== 0) stances[value] = stance;
        });
        if (!Object.keys(stances).length) {
            const firstKey = Object.keys(labelMapping).find(key => labelMapping[key] === label);
            if (firstKey) firstKey.split('|').forEach(value => { if (categoryOf[value]) stances[value] = 1; });
        }
        stancesOf[label] = stances;
    });

    // What the user answered: { category: [{ value, agree }] }. Answers saved by an older version
    // (one value per category) count as agreement 1.
    function loadAnswers() {
        let answers = null;
        try { answers = JSON.parse(localStorage.getItem('quizAnswers') || 'null'); } catch (e) { answers = null; }
        if (answers && typeof answers === 'object') {
            Object.keys(answers).forEach(cat => {          // a category without values counts as not touched
                if (!Array.isArray(answers[cat]) || !answers[cat].length) delete answers[cat];
            });
            return answers;
        }
        let old = {};
        try { old = JSON.parse(localStorage.getItem('quizResults') || '{}') || {}; } catch (e) { old = {}; }
        answers = {};
        Object.keys(old).forEach(cat => {
            if (old[cat]) answers[cat] = [{ value: old[cat], agree: 1 }];
        });
        return answers;
    }

    // Saves your answers, and the value you agree with most in each category, in the browser
    function saveAnswers(answers) {
        const primary = {};
        Object.keys(answers).forEach(category => {
            const value = primaryOf(answers[category]);
            if (value) primary[category] = value;
        });
        try {
            localStorage.setItem('quizAnswers', JSON.stringify(answers));
            localStorage.setItem('quizResults', JSON.stringify(primary));
        } catch (e) { /* storage is not available: nothing to save */ }
    }

    // The value you agreed with most in a category (the first one if tied), or null if you agreed with none
    function primaryOf(list) {
        let best = null;
        (list || []).forEach(item => {
            if (item.agree > 0 && (!best || item.agree > best.agree)) best = item;
        });
        return best ? best.value : null;
    }

    // An agreement or a score as text: +0.60, 0.00, \u22120.40
    function signed(number) {
        const rounded = Math.round(number * 100) / 100;
        return (rounded > 0 ? '+' : (rounded < 0 ? '\u2212' : '')) + Math.abs(rounded).toFixed(2);
    }

    // Score of one value of an ideology against your answer for it, from -1 to +1 (0 if you did not add it):
    // your agreement times the ideology's stance, so matching a value it matches or opposing one it opposes is
    // positive and the other two cases are negative
    function valueScore(reqVal, answers, stance) {
        const list = answers[categoryOf[reqVal]];
        const entry = list && list.find(item => item.value === reqVal);
        if (!entry) return 0;
        const given = stance === undefined ? 1 : stance;
        return Math.max(-1, Math.min(1, (Number(entry.agree) || 0) * given));
    }

    // Ring color for a score: dark red at -1, gray at 0, dark green at +1
    const RING_RED = [168, 29, 29];
    const RING_GRAY = [139, 148, 158];
    const RING_GREEN = [26, 127, 55];
    function ringColor(score) {
        const t = Math.min(1, Math.abs(score));
        const end = score < 0 ? RING_RED : RING_GREEN;
        const rgb = RING_GRAY.map((from, i) => Math.round(from + (end[i] - from) * t));
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }

    // The values an ideology mentions, by category: { category: [{ value, stance }] }, strongest stance first
    function stancesByCategory(label) {
        const byCategory = {};
        const stances = stancesOf[label] || {};
        Object.keys(stances).forEach(value => {
            const cat = categoryOf[value];
            if (cat) (byCategory[cat] = byCategory[cat] || []).push({ value, stance: stances[value] });
        });
        Object.keys(byCategory).forEach(cat => {
            byCategory[cat].sort((a, b) => Math.abs(b.stance) - Math.abs(a.stance));
        });
        return byCategory;
    }

    // How your answers meet the definition of an ideology: values you picked that it holds, other values of its
    // that you answered, and how many values it lists
    function countsOf(answers, label) {
        const stances = stancesOf[label] || {};
        let identicalCount = 0;
        let mismatchCount = 0;
        Object.keys(stances).forEach(value => {
            const list = answers[categoryOf[value]];
            const entry = list && list.find(item => item.value === value);
            if (!entry) return;
            if (stances[value] > 0 && Number(entry.agree) > 0) identicalCount++;
            else mismatchCount++;
        });
        return { identicalCount, mismatchCount, totalRequired: Object.keys(stances).length };
    }

    const rounded = score => Math.round(score * 1e9);

    // Higher score first; then more values you picked that it holds; then more values listed.
    // Equal in all: the order in data.js decides.
    function compareItems(a, b) {
        return (rounded(b.score) - rounded(a.score)) ||
            (b.identicalCount - a.identicalCount) ||
            (b.totalRequired - a.totalRequired) ||
            (labelOrder[a.label] - labelOrder[b.label]);
    }

    // ---------------------------------------------------------------------------------------------
    // The embedding model (weights: embedding_weights.js)
    // ---------------------------------------------------------------------------------------------
    const net = (function () {
        if (typeof EMBEDDING_WEIGHTS === 'undefined') return null;
        try {
            const w = EMBEDDING_WEIGHTS;
            const V = w.values.length, D = w.dim, H = w.hidden;
            if (w.W1.length !== 2 * V || w.W1[0].length !== H || w.W2.length !== H || w.W2[0].length !== D ||
                w.Ws.length !== V || w.Ws[0].length !== D) return null;
            const valueIndex = {};
            w.values.forEach((value, i) => { valueIndex[value] = i; });
            const labels = Object.keys(labelOrder);
            const emb = {};
            labels.forEach(label => {                      // e = stances . Ws, scaled to length 1
                const e = new Array(D).fill(0);
                const stances = stancesOf[label] || {};
                Object.keys(stances).forEach(value => {
                    const j = valueIndex[value];
                    if (j === undefined) return;
                    for (let k = 0; k < D; k++) e[k] += stances[value] * w.Ws[j][k];
                });
                const length = Math.sqrt(e.reduce((sum, x) => sum + x * x, 0));
                emb[label] = length > 0 ? e.map(x => x / length) : e;
            });
            return { w, V, D, H, valueIndex, labels, emb };
        } catch (e) {
            return null;
        }
    })();

    // The 256 inputs of the user tower: your agreements, then 1 for every value whose category you touched
    function netInput(answers) {
        const V = net.V;
        const x = new Array(2 * V).fill(0);
        const touched = {};
        Object.keys(answers).forEach(cat => {
            (answers[cat] || []).forEach(item => {
                const j = net.valueIndex[item.value];
                if (j === undefined) return;
                x[j] = Math.max(-1, Math.min(1, Number(item.agree) || 0));
                if (x[j] !== 0) touched[categoryOf[item.value]] = true;
            });
        });
        net.w.values.forEach((value, j) => { if (touched[categoryOf[value]]) x[V + j] = 1; });
        return x;
    }

    // Your point u, scaled to length 1; null if you have answered nothing
    function userVector(answers) {
        const { w, H, D } = net;
        const x = netInput(answers);
        if (!x.some(v => v !== 0)) return null;
        const h = new Array(H);
        for (let k = 0; k < H; k++) {
            let sum = w.b1[k];
            for (let j = 0; j < x.length; j++) if (x[j] !== 0) sum += x[j] * w.W1[j][k];
            h[k] = sum > 0 ? sum : 0;
        }
        const u = new Array(D);
        for (let k = 0; k < D; k++) {
            let sum = w.b2[k];
            for (let m = 0; m < H; m++) if (h[m] !== 0) sum += h[m] * w.W2[m][k];
            u[k] = sum;
        }
        const length = Math.sqrt(u.reduce((sum, v) => sum + v * v, 0));
        return length > 0 ? u.map(v => v / length) : null;
    }

    // Every ideology, best first
    function rankIdeologiesNet(answers) {
        const u = userVector(answers);
        const labels = net.labels;
        const n = labels.length;
        const logits = {};
        labels.forEach(label => {
            let cosine = 0;
            if (u) for (let k = 0; k < net.D; k++) cosine += u[k] * net.emb[label][k];
            logits[label] = net.w.scale * cosine;
        });
        const top = Math.max.apply(null, labels.map(label => logits[label]));
        const sum = labels.reduce((total, label) => total + Math.exp(logits[label] - top), 0);
        return labels
            .map(label => {
                const probability = Math.exp(logits[label] - top) / sum;
                const score = Math.max(-1, Math.log(probability * n) / Math.log(n));
                return Object.assign(countsOf(answers, label), { key: label, label, score, logScore: logits[label], probability });
            })
            .sort(compareItems);
    }

    // All that is left if the weights did not load: the plain cosine between your agreements and the stances
    function rankIdeologiesSimple(answers) {
        const agree = {};
        Object.keys(answers).forEach(cat => (answers[cat] || []).forEach(item => {
            agree[item.value] = Math.max(-1, Math.min(1, Number(item.agree) || 0));
        }));
        const mine = Math.sqrt(Object.keys(agree).reduce((sum, value) => sum + agree[value] * agree[value], 0));
        return Object.keys(stancesOf)
            .map(label => {
                const stances = stancesOf[label];
                let dot = 0;
                let own = 0;
                Object.keys(stances).forEach(value => {
                    own += stances[value] * stances[value];
                    if (value in agree) dot += stances[value] * agree[value];
                });
                const score = mine > 0 && own > 0 ? dot / (mine * Math.sqrt(own)) : 0;
                return Object.assign(countsOf(answers, label), { key: label, label, score, logScore: score });
            })
            .sort(compareItems);
    }

    // Every ideology, best first
    function rankIdeologies(answers) {
        return net ? rankIdeologiesNet(answers) : rankIdeologiesSimple(answers);
    }

    // The best ideologies other than excludeLabel; each must have at least one of your values
    function closestIdeologies(answers, excludeLabel, count) {
        return rankIdeologies(answers)
            .filter(item => item.label !== excludeLabel && item.identicalCount > 0)
            .slice(0, count);
    }

    return {
        categoryOf, loadAnswers, saveAnswers, primaryOf, signed, stancesByCategory, rankIdeologies, closestIdeologies,
        valueScore, ringColor
    };
})();
