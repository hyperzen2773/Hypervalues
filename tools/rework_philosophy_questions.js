// Replaces the philosophy questions in questions_tree.json with indirect, scenario-based ones.
// The ten results (rationalism ... deontology) stay exactly as they are; only the questions leading to them change.
// Saves a backup and keeps the file's own indentation.
// Run from the repo root:  node tools/rework_philosophy_questions.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const treePath = path.join(root, 'questions_tree.json');
const raw = fs.readFileSync(treePath, 'utf8');
const m = raw.match(/^\{\r?\n( +)"/);
const indent = m ? m[1].length : 0;
const tree = JSON.parse(raw);
if (!tree.philosophy) throw new Error('there is no philosophy category in questions_tree.json');

const RESULTS = ['rationalism', 'empiricism', 'materialism', 'idealism', 'pragmatism', 'existentialism', 'nihilism', 'stoicism', 'utilitarianism', 'deontology'];
const leaves = tree.philosophy.filter(n => !n.options);
RESULTS.forEach(id => { if (!leaves.some(n => n.id === id)) throw new Error('missing result ' + id); });

const questions = [
    { id: 'p1', text: 'When a big question keeps you awake at night, which kind is it most likely to be?', options: [
        { text: 'How can anyone really be sure of what they know?', next: 'p_know' },
        { text: 'What is the world ultimately made of, and where does the mind fit in?', next: 'p_world' },
        { text: 'How should a person live when nobody hands out instructions?', next: 'p_life' },
        { text: 'What do people owe each other when a choice is hard?', next: 'p_ethics' }
    ] },
    { id: 'p_know', text: 'Someone makes a bold claim about the world at a dinner. What makes you take it seriously?', options: [
        { text: 'It follows step by step from starting points that no sensible person could doubt', next: 'rationalism' },
        { text: 'Someone has actually seen it, measured it or tested it, and you could do the same', next: 'empiricism' },
        { text: 'It keeps holding up whenever people rely on it, whatever the theory behind it', next: 'pragmatism' }
    ] },
    { id: 'p_world', text: 'Think of a vivid dream, a sudden idea or a feeling of love. What is it at bottom?', options: [
        { text: 'Something that arises from the body and brain, and from the matter and conditions around them', next: 'materialism' },
        { text: 'Something that belongs to a deeper layer of reality, where minds and meanings come before matter', next: 'idealism' }
    ] },
    { id: 'p_life', text: 'Imagine a day when nothing around you gives your life a clear purpose. What do you do?', options: [
        { text: 'Decide for yourself what it will stand for, and own whatever follows from that choice', next: 'existentialism' },
        { text: 'Admit that no purpose was ever waiting to be found, and carry on without inventing one', next: 'nihilism' },
        { text: 'Keep your head steady and put your effort only into what is in your own hands', next: 'stoicism' }
    ] },
    { id: 'p_ethics', text: 'A choice would help many people, but it means breaking a promise to one person. How do you weigh it?', options: [
        { text: 'Pick whatever leaves the most people better off and in the least pain', next: 'utilitarianism' },
        { text: 'Keep the promise, because some things are owed to a person whatever the outcome', next: 'deontology' }
    ] }
];

// checks: no philosophy name in any question or answer, every result reachable, every "next" exists
const banned = /rationalis|empiric|materialis|idealis|pragmati|existential|nihilis|stoic|utilitarian|deontolog/i;
const ids = new Set(questions.map(q => q.id).concat(leaves.map(l => l.id)));
const reached = new Set();
questions.forEach(q => {
    if (banned.test(q.text)) throw new Error('a philosophy name is in: ' + q.text);
    q.options.forEach(o => {
        if (banned.test(o.text)) throw new Error('a philosophy name is in: ' + o.text);
        if (!ids.has(o.next)) throw new Error('unknown next: ' + o.next);
        reached.add(o.next);
    });
});
RESULTS.forEach(id => { if (!reached.has(id)) throw new Error('result not reachable: ' + id); });

fs.copyFileSync(treePath, treePath + '.bak');
tree.philosophy = questions.concat(leaves);
fs.writeFileSync(treePath, JSON.stringify(tree, null, indent) + (raw.endsWith('\n') ? '\n' : ''));
console.log('questions_tree.json updated: ' + questions.length + ' questions, ' + leaves.length + ' results (backup: questions_tree.json.bak)');
