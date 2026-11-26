// Checks that the pages hold together after a change:  node tools/check_pages.js
// Every script is valid, every file a page loads is there, every round icon button has a name for screen readers,
// and every page that loads a script that needs another one loads that one first. Exits with 1 if a check fails.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let failures = 0;
const check = (ok, message) => { if (!ok) { failures++; console.log('FAIL  ' + message); } else console.log('ok    ' + message); };

const files = fs.readdirSync(root);
const pages = files.filter(f => f.endsWith('.html'));
const scripts = files.filter(f => f.endsWith('.js'));

let bad = [];
scripts.forEach(f => { try { new vm.Script(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }); } catch (e) { bad.push(f + ': ' + e.message); } });
check(!bad.length, `all ${scripts.length} scripts are valid` + (bad.length ? ' (' + bad.join('; ') + ')' : ''));

let missing = [];
let refs = 0;
pages.forEach(page => {
    const text = fs.readFileSync(path.join(root, page), 'utf8');
    (text.match(/(?:src|href)="[^"#?:]+"/g) || []).forEach(attr => {
        const file = attr.slice(attr.indexOf('"') + 1, -1);
        refs++;
        if (!fs.existsSync(path.join(root, file))) missing.push(page + ' -> ' + file);
    });
});
check(!missing.length, `${refs} files loaded by the pages exist` + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''));

// order of scripts: a script that needs another must come after it
const needs = { 'scoring.js': ['data.js'], 'hvx.js': ['scoring.js'], 'explore.js': ['hvx.js', 'custom_ui.js', 'slider.js'], 'editor.js': ['custom_ui.js', 'hvx.js'], 'custom_bar.js': ['custom_ui.js'], 'slider.js': [] };
let order = [];
pages.forEach(page => {
    const loaded = (fs.readFileSync(path.join(root, page), 'utf8').match(/<script src="([^"]+)"/g) || []).map(s => s.slice(13, -1));
    loaded.forEach((file, i) => (needs[file] || []).forEach(need => { if (loaded.indexOf(need) < 0 || loaded.indexOf(need) > i) order.push(`${page}: ${file} needs ${need} first`); }));
});
check(!order.length, 'scripts are loaded after the ones they need' + (order.length ? ' (' + order.join('; ') + ')' : ''));

// a round icon button always gets a name
let unnamed = [];
scripts.forEach(f => {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    let at = text.indexOf('HVUI.round(');
    while (at >= 0) {
        let depth = 0, commas = 0, i = at + 10, quote = '';
        for (; i < text.length; i++) {
            const c = text[i];
            if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
            if (c === "'" || c === '"' || c === '`') quote = c;
            else if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) break; }
            else if (c === ',' && depth === 1) commas++;
        }
        if (commas < 1) unnamed.push(f + ': ' + text.slice(at, at + 50));
        at = text.indexOf('HVUI.round(', at + 10);
    }
});
check(!unnamed.length, 'every round icon button has a name' + (unnamed.length ? ' (' + unnamed.slice(0, 3).join('; ') + ')' : ''));
const textless = [];
pages.forEach(page => { const text = fs.readFileSync(path.join(root, page), 'utf8'); (text.match(/<button[^>]*>\s*<svg[^>]*>[\s\S]*?<\/svg>\s*<\/button>/g) || []).forEach(b => { if (!/aria-label=/.test(b)) textless.push(page); }); });
check(!textless.length, 'every icon-only button in the pages has a name');

// one version everywhere
const versions = new Set();
pages.forEach(page => { const m = fs.readFileSync(path.join(root, page), 'utf8').match(/class="version-text"[^>]*>(v[0-9.]+)</); if (m) versions.add(m[1]); });
check(versions.size === 1, 'the version shown is the same on every page (' + Array.from(versions).join(', ') + ')');

console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
