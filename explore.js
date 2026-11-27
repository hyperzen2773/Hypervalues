// Explore: a panel of the results page (results.html) that takes the place of the lists of values while it is open.
// Why you got a result, comparing, the map, clashes, lenses, your saved sets and the ways to start. What it computes is
// in hvx.js. It never changes your answers unless you choose a way to start or answer a value yourself.
// A link someone sent (results.html?r=...) opens it on that person's values, read only.
const HVExplore = (function () {
    const DISCORD = 'https://discord.gg/Ba9Av3WSeG';
    const TABS = [
        ['why', 'why', 'Why', 'Tap an ideology to see which of your values pull you toward it and which pull you away.'],
        ['compare', 'compare', 'Compare', 'Put two sets of values side by side: yours, a friend\u2019s link, an ideology or a saved one.'],
        ['map', 'cube', 'Map', 'Where you stand among all the ideologies.'],
        ['clash', 'tension', 'Clashes', 'Pairs of your own values that few ideologies hold together.'],
        ['lens', 'lens', 'Lens', 'Build your own axes from values and see every ideology placed on them.'],
        ['saved', 'mine', 'Saved', 'Your earlier sets of values, kept when you clear them. Open, compare or delete one.'],
        ['start', 'start', 'Start', 'Begin from the quiz, by browsing values, from a link or from an ideology.']
    ];
    const SHARED_CAPTION = 'Someone else\u2019s values. Compare them with yours, or use them as yours.';
    let nav = null, caption = null, view = null, answers = {}, tab = 'why', sharedCode = null;
    const custom = HVPack.isCustom();
    const pack = custom && HVPack.active && HVPack.active();

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    const color = label => (labelColors[label] || '#7a7a7a').slice(0, 7);
    const hasAnswers = () => HVX.answeredCount(answers) > 0;
    const store = (key, value) => { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* no storage */ } };
    const fetchStore = key => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; } };
    const when = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

    // ---------------------------------------------------------------------------------------------
    // Parts
    // ---------------------------------------------------------------------------------------------
    function entry(icon, label, onClick, on) {
        const node = el('button', 'hv-entry' + (on ? ' hv-on' : ''));
        node.type = 'button';
        node.innerHTML = HVUI.svg(icon) + '<span></span>';
        node.lastChild.textContent = label;
        node.onclick = onClick;
        return node;
    }
    const note = text => el('p', 'hv-caption', text);
    function tile(cat, value, options) {
        const o = options || {};
        const node = el('a', 'result-item' + (o.faded ? ' hv-faded' : ''));
        // your own values open the page where you can change the answer, as on the results page
        node.href = o.onClick ? '#' : `description.html?id=${encodeURIComponent(value)}&cat=${encodeURIComponent(cat)}${tab !== 'shared' && !o.faded && o.ring !== undefined ? '&edit=1' : ''}`;
        node.style.textDecoration = 'none';
        node.style.color = 'inherit';
        if (o.onClick) node.onclick = event => { event.preventDefault(); o.onClick(node); };
        const img = el('img', 'result-icon');
        img.alt = '';
        img.src = HVPack.iconUrl(cat, value);
        img.style.borderRadius = '50%';
        if (o.ring !== undefined && o.ring !== null) img.style.boxShadow = `0 0 0 3px var(--bg-color), 0 0 0 6px ${HV.ringColor(o.ring)}`;
        if (o.dashed) img.style.outline = '3px dashed var(--text-dim)';
        img.onerror = () => { img.style.visibility = 'hidden'; };
        const name = el('p', 'result-text');
        setName(name, HV.nameOf(cat, value));
        node.appendChild(img);
        node.appendChild(name);
        if (o.sub !== undefined) node.appendChild(el('p', 'result-agree', o.sub));
        return node;
    }
    function bubble(label, small, onClick) {
        const node = el('a', small ? 'closest-pill' : 'label-bubble');
        // an ideology opens its page with how your values meet it, as on the results page
        node.href = onClick ? '#' : `description.html?id=${encodeURIComponent(label)}&type=ideology${tab !== 'shared' && hasAnswers() ? '&compare=1' : ''}`;
        if (onClick) node.onclick = event => { event.preventDefault(); onClick(node); };
        if (small) { node.style.setProperty('--pill-color', color(label)); const name = el('span', 'cp-name'); setName(name, label); node.appendChild(name); }
        else { node.style.backgroundColor = color(label); node.style.textDecoration = 'none'; node.style.fontSize = '1.1rem'; node.style.margin = '6px'; node.style.padding = '8px 22px'; setName(node, label); }
        return node;
    }
    function section(icon, title, items) {
        if (!items.length) return null;
        const box = el('div', 'category-section');
        const head = el('h2', 'category-title');
        head.innerHTML = HVUI.svg(icon) + '<span></span>';
        head.firstChild.style.cssText = 'width:24px;height:24px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round';
        head.lastChild.textContent = title;
        box.appendChild(head);
        const flex = el('div', 'values-flex-container');
        items.forEach(item => flex.appendChild(item));
        box.appendChild(flex);
        return box;
    }
    function row(items, className) {
        const box = el('div', className || 'hv-pills');
        items.forEach(item => { if (item) box.appendChild(item); });
        return box;
    }
    function stat(number, text) {
        const box = el('div', 'hv-stat');
        box.appendChild(el('strong', '', number));
        box.appendChild(el('span', '', text));
        return box;
    }
    let modal = null, sheet = null;
    function closeModal() { if (modal) { modal.remove(); modal = null; } }
    function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } document.body.classList.remove('hv-has-sheet'); }
    function openModal(build) {
        closeModal();
        const wrap = el('div', 'hv-modal');
        const box = el('div', 'hv-modal-body');
        wrap.onclick = event => { if (event.target === wrap) closeModal(); };
        box.appendChild(HVUI.round('x', 'Close', closeModal, true));
        build(box);
        wrap.appendChild(box);
        document.body.appendChild(wrap);
        modal = wrap;
        fitNames(box);
    }
    // a slider at the bottom for one value: onSet gets the number, onClear removes it
    function openSheet(cat, value, current, onSet, onClear) {
        closeSheet();
        sheet = el('div', 'hv-sheet');
        const name = el('p', 'result-text');
        setName(name, HV.nameOf(cat, value));
        sheet.appendChild(name);
        sheet.appendChild(makeSlider(current === undefined ? 0 : current, onSet));
        sheet.appendChild(HVUI.round('x', 'Close', closeSheet, true));
        if (onClear) { const trash = HVUI.round('trash', 'Remove', () => { closeSheet(); onClear(); }, true); trash.style.cssText = 'position:absolute;top:8px;left:12px'; sheet.appendChild(trash); }
        document.body.appendChild(sheet);
        document.body.classList.add('hv-has-sheet');
        fitNames(sheet);
    }
    function setAnswer(value, agree) {
        const cat = HV.categoryOf[value];
        const list = (answers[cat] || (answers[cat] = []));
        const found = list.find(item => item.value === value);
        if (agree === null) { if (found) list.splice(list.indexOf(found), 1); if (!list.length) delete answers[cat]; }
        else if (found) found.agree = agree; else list.push({ value, agree });
        HV.saveAnswers(answers);
    }
    function textInput(placeholder, label, onChange) {
        const box = el('input', 'hv-input hv-search');
        box.type = 'text';
        box.placeholder = placeholder;
        box.setAttribute('aria-label', label);
        box.onchange = () => onChange(box);
        return box;
    }
    function ideologyList(onPick) {
        const holder = el('div');
        holder.style.width = '100%';
        const list = el('div', 'hv-pills');
        const draw = query => {
            list.textContent = '';
            HVX.labels().filter(l => !query || l.toLowerCase().includes(query)).slice(0, 80).forEach(l => list.appendChild(bubble(l, false, () => onPick(l))));
            fitNames(list);
        };
        const box = el('input', 'hv-input hv-search');
        box.type = 'text';
        box.placeholder = 'Search';
        box.setAttribute('aria-label', 'Search');
        box.oninput = () => draw(box.value.trim().toLowerCase());
        holder.appendChild(box);
        holder.appendChild(list);
        draw('');
        return holder;
    }
    function versionCards(onPick, rerender) {
        const box = el('div', 'hv-versions');
        HVX.versions().forEach((v, index) => {
            const card = el('div', 'hv-card');
            const info = el('a', 'hv-card-main');
            info.href = '#';
            info.onclick = event => { event.preventDefault(); onPick(v); };
            info.appendChild(el('span', 'cp-score', when(v.t)));
            if (v.top) info.appendChild(bubble(v.top, true, () => onPick(v)));
            card.appendChild(info);
            if (rerender) card.appendChild(HVUI.round('trash', 'Remove', () => { HVX.dropVersion(index); rerender(); }, true));
            box.appendChild(card);
        });
        return box;
    }
    const adopt = list => { HVX.keep(answers); HV.saveAnswers(list); answers = list; location.href = 'results.html'; };

    // ---------------------------------------------------------------------------------------------
    // Why
    // ---------------------------------------------------------------------------------------------
    let picked = [];
    function renderWhy() {
        if (!hasAnswers()) { go('start'); return; }
        const ranked = HV.closestIdeologies(answers, null, 1 + HV.CLOSEST_COUNT);
        picked = picked.filter(l => ranked.some(r => r.label === l));
        if (!picked.length && ranked[0]) picked = [ranked[0].label];
        const top = el('div', 'hv-pills');
        ranked.forEach(item => {
            const node = bubble(item.label, true, () => {
                picked = picked.includes(item.label) ? picked.filter(l => l !== item.label) : picked.concat(item.label).slice(-2);
                if (!picked.length) picked = [item.label];
                render();
            });
            if (picked.includes(item.label)) node.style.background = 'var(--card-bg)';
            top.appendChild(node);
        });
        view.appendChild(top);
        if (HVX.close(ranked) && picked.length === 1) view.appendChild(row([entry('compare', 'Close call: see what separates them', () => { picked = [ranked[0].label, ranked[1].label]; render(); })]));

        if (picked.length === 1) {
            const g = HVX.explain(answers, picked[0]);
            const t = (items, missing) => items.map(i => tile(i.cat, i.value, { ring: missing ? null : i.fit, sub: missing ? '' : HV.signed(i.fit), faded: missing || !i.listed }));
            [section('check', 'Pulls toward', t(g.toward)), section('x', 'Pulls away', t(g.away)), section('minus', 'Doesn\u2019t matter', t(g.flat)), section('plus', 'Not answered yet', t(g.missing, true))].forEach(s => { if (s) view.appendChild(s); });
        } else {
            const [a, b] = picked;
            const d = HVX.differences(answers, a, b);
            view.appendChild(note('Under each: your values that fit it better than the other.'));
            const cols = el('div', 'hv-two');
            [[a, 'a'], [b, 'b']].forEach(([label, side]) => {
                const cell = el('div', 'hv-cell');
                cell.appendChild(bubble(label, true));
                const flex = el('div', 'values-flex-container');
                d.filter(x => x.favors === side).forEach(x => flex.appendChild(tile(x.cat, x.value, { ring: x[side], sub: HV.signed(x[side]) })));
                cell.appendChild(flex);
                cols.appendChild(cell);
            });
            view.appendChild(cols);
            const decide = HVX.decider(answers, a, b);
            if (decide) {
                view.appendChild(note('Answer this one to tell them apart.'));
                const flex = el('div', 'values-flex-container');
                flex.appendChild(tile(decide.cat, decide.value, { dashed: true, faded: true, onClick: () => openSheet(decide.cat, decide.value, 0, v => { setAnswer(decide.value, v); }, null) }));
                view.appendChild(flex);
            }
        }
    }
    function copyLink() {
        const base = location.origin && location.origin !== 'null' ? location.origin + location.pathname : 'results.html';
        const text = `${base}?r=${HVX.encode(answers)}`;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => HVUI.toast('\u2713'), () => HVUI.toast('\u2717', true));
        else HVUI.toast('\u2717', true);
    }

    // ---------------------------------------------------------------------------------------------
    // A link someone sent: that person's values, read only
    // ---------------------------------------------------------------------------------------------
    function renderShared() {
        const shared = HVX.decode(sharedCode);
        if (!shared || !HVX.answeredCount(shared.answers)) { go('start'); return; }
        store('hvx_other', { kind: 'link', answers: shared.answers, custom: shared.custom, name: shared.name });
        const ranked = HV.closestIdeologies(shared.answers, null, 1 + HV.CLOSEST_COUNT);
        if (shared.custom && shared.name) {
            const node = el('span', 'closest-pill');
            node.style.setProperty('--pill-color', 'var(--text-dim)');
            node.appendChild(el('span', 'cp-name', shared.name));
            view.appendChild(row([node]));
        }
        if (ranked[0]) {
            view.appendChild(row([bubble(ranked[0].label, false)]));
            view.appendChild(row(ranked.slice(1).map(r => bubble(r.label, true))));
        }
        const discord = el('a', 'hv-entry');
        discord.href = DISCORD;
        discord.target = '_blank';
        discord.rel = 'noopener noreferrer';
        discord.innerHTML = '<img src="discord.svg" alt="" width="22" height="22"><span>Discord</span>';
        view.appendChild(row([
            entry('compare', 'Compare', () => { slotA = null; slotB = fetchStore('hvx_other'); answers = HV.loadAnswers(); go('compare'); }),
            entry('check', 'Use these', () => adopt(shared.answers)),
            discord
        ]));
        const byCat = {};
        HVX.flat(shared.answers).sort((a, b) => b.agree - a.agree).forEach(i => (byCat[i.cat] = byCat[i.cat] || []).push(i));
        const list = el('div', 'category-list');
        categories.forEach(cat => {
            if (!byCat[cat]) return;
            const box = el('div', 'category-section');
            box.appendChild(el('h2', 'category-title', categoryTitles[cat] || cat));
            const flex = el('div', 'values-flex-container');
            byCat[cat].forEach(i => flex.appendChild(tile(cat, i.value, { ring: i.agree, sub: HV.signed(i.agree) })));
            box.appendChild(flex);
            list.appendChild(box);
        });
        view.appendChild(list);
    }

    // ---------------------------------------------------------------------------------------------
    // Compare
    // ---------------------------------------------------------------------------------------------
    let slotA = null, slotB = null;
    function sourceMe() { return hasAnswers() ? { kind: 'me', answers, custom, name: pack ? pack.name : '' } : null; }
    function slotNode(source, onClick) {
        const box = el('div', 'hv-slotbox');
        const node = el('button', 'hv-slot' + (source ? '' : ' hv-dashed'));
        node.type = 'button';
        node.onclick = onClick;
        let text = 'Choose';
        if (!source) node.innerHTML = HVUI.svg('plus');
        else if (source.kind === 'ideology') { node.style.backgroundColor = color(source.label); text = source.label; node.innerHTML = HVUI.svg('tag'); node.firstChild.style.color = '#fff'; }
        else { node.innerHTML = HVUI.svg(source.kind === 'me' ? 'me' : source.kind === 'version' ? 'mine' : 'link'); text = source.kind === 'me' ? 'Me' : source.kind === 'version' ? 'Saved' : 'Link'; }
        box.appendChild(node);
        box.appendChild(el('span', 'hv-slotname', text));
        return box;
    }
    function choose(onPick) {
        openModal(box => {
            const body = el('div');
            const show = kind => {
                body.textContent = '';
                if (kind === 'ideology') body.appendChild(ideologyList(label => { closeModal(); onPick({ kind: 'ideology', label, answers: HVX.answersOf(label), custom: false, name: '' }); }));
                else if (kind === 'link') body.appendChild(textInput('Paste a link', 'Link', input => {
                    const got = HVX.decode(HVX.codeFrom(input.value));
                    if (got && HVX.answeredCount(got.answers)) { closeModal(); onPick({ kind: 'link', answers: got.answers, custom: got.custom, name: got.name }); } else input.classList.add('hv-bad');
                }));
                else if (kind === 'version') body.appendChild(versionCards(v => { closeModal(); onPick({ kind: 'version', answers: v.a, custom: v.c, name: '' }); }, null));
            };
            const row2 = el('div', 'hv-pills');
            const me = sourceMe();
            if (me) row2.appendChild(entry('me', 'Me', () => { closeModal(); onPick(me); }));
            row2.appendChild(entry('tag', 'Ideology', () => show('ideology')));
            row2.appendChild(entry('link', 'Link', () => show('link')));
            row2.appendChild(entry('mine', 'Saved', () => show('version')));
            box.appendChild(row2);
            box.appendChild(body);
        });
    }
    function renderCompare() {
        if (!slotA) slotA = sourceMe();
        if (!slotB) slotB = fetchStore('hvx_other');
        const pair = el('div', 'hv-slots');
        pair.appendChild(slotNode(slotA, () => choose(s => { slotA = s; render(); })));
        const mid = el('span');
        if (slotA && slotB && (slotA.custom !== slotB.custom || (slotA.name || '') !== (slotB.name || ''))) { const warn = HVUI.round('palette', 'Different data', null, true); mid.appendChild(warn); }
        pair.appendChild(mid);
        pair.appendChild(slotNode(slotB, () => choose(s => { slotB = s; store('hvx_other', s); render(); })));
        view.appendChild(pair);
        if (!slotA || !slotB) return;
        const c = HVX.compare(slotA.answers, slotB.answers);
        view.appendChild(row([c.overlap === null ? null : stat(Math.round(c.overlap * 100) + '%', 'agree'), stat(c.shared + ' of ' + c.union, 'values both answered')], 'hv-stats'));
        const make = state => c.tiles.filter(t => t.state === state).sort((x, y) => y.gap - x.gap).map(t => tile(t.cat, t.value, {
            ring: state === 'one' ? null : (state === 'same' ? 1 : -1),
            faded: state === 'one',
            sub: (t.a === undefined ? '\u00b7' : HV.signed(t.a)) + ' | ' + (t.b === undefined ? '\u00b7' : HV.signed(t.b))
        }));
        [section('check', 'Agree', make('same')), section('x', 'Differ', make('differ')), section('minus', 'Only one answered', make('one'))].forEach(s => { if (s) view.appendChild(s); });
        if (c.both.length) { view.appendChild(note('Ideologies that fit both:')); view.appendChild(row(c.both.map(l => bubble(l, false)))); }
        if (c.onlyA.length) { view.appendChild(note('Closer to the first:')); view.appendChild(row(c.onlyA.map(l => bubble(l, true)))); }
        if (c.onlyB.length) { view.appendChild(note('Closer to the second:')); view.appendChild(row(c.onlyB.map(l => bubble(l, true)))); }
    }

    // ---------------------------------------------------------------------------------------------
    // Map: a radar by category, a plane and a cube of all the ideologies, and you
    // ---------------------------------------------------------------------------------------------
    let mapKind = 'cube', yaw = 0.6, pitch = 0.4, shown = null;
    const MAP_NOTES = {
        radar: 'Your average in each category, next to your three closest ideologies.',
        plane: 'Every ideology is a dot and the ring is you. Tap a dot to see which one it is.',
        cube: 'Every ideology is a dot in space and the ring is you. Drag to turn it.'
    };
    const NS = 'http://www.w3.org/2000/svg';
    function svgNode(tag, attrs) { const n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); return n; }
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    function renderMap() {
        view.appendChild(row([['radar', 'radar', 'Radar'], ['plane', 'map', 'Plane'], ['cube', 'cube', 'Cube']].map(([kind, icon, name]) => entry(icon, name, () => { mapKind = kind; render(); }, mapKind === kind))));
        view.appendChild(note(MAP_NOTES[mapKind]));
        if (mapKind === 'radar') { renderRadar(); return; }
        const sp = HVX.build3();
        const you = hasAnswers() ? HVX.placeOf(answers) : null;
        const span = k => Math.max(1e-6, Math.max(...sp.labs.map(l => Math.abs(sp.pos[l][k]))));
        const sc = [span(0), span(1), span(2)];
        const W = 600, H = 420;
        const svg = svgNode('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Map' });
        svg.style.cssText = 'width:100%;max-width:760px;height:auto;touch-action:none;background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius-lg)';
        const project = p => {
            const n = [p[0] / sc[0], p[1] / sc[1], p[2] / sc[2]];
            if (mapKind === 'plane') return [W / 2 + n[0] * (W / 2 - 40), H / 2 - n[1] * (H / 2 - 30), 0];
            const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp2 = Math.sin(pitch);
            const x = n[0] * cy + n[2] * sy, z = -n[0] * sy + n[2] * cy;
            const y2 = n[1] * cp - z * sp2, z2 = n[1] * sp2 + z * cp;
            const scale = 1 / (1 + 0.25 * z2);
            return [W / 2 + x * (W / 2 - 60) * scale, H / 2 - y2 * (H / 2 - 50) * scale, z2];
        };
        const tag = el('div', 'hv-pills');
        const label = () => { tag.textContent = ''; if (shown) tag.appendChild(bubble(shown, true)); };
        const draw = () => {
            svg.textContent = '';
            sp.labs.map(l => ({ label: l, p: project(sp.pos[l]) })).sort((a, b) => b.p[2] - a.p[2]).forEach(item => {
                const dot = svgNode('circle', { cx: item.p[0].toFixed(1), cy: item.p[1].toFixed(1), r: shown === item.label ? 8 : 4.5, fill: color(item.label), 'fill-opacity': mapKind === 'cube' ? 0.55 + 0.3 * (1 - (item.p[2] + 1) / 2) : 0.85 });
                dot.style.cursor = 'pointer';
                dot.addEventListener('click', event => { event.stopPropagation(); shown = item.label; draw(); label(); });
                svg.appendChild(dot);
            });
            if (you) {
                const p = project(you);
                svg.appendChild(svgNode('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 11, fill: 'none', stroke: 'var(--text-primary)', 'stroke-width': 3 }));
                svg.appendChild(svgNode('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3, fill: 'var(--text-primary)' }));
            }
        };
        if (mapKind === 'cube') {
            let last = null;
            svg.addEventListener('pointerdown', e => { last = [e.clientX, e.clientY]; if (svg.setPointerCapture && e.pointerId !== undefined) { try { svg.setPointerCapture(e.pointerId); } catch (err) { /* none */ } } });
            svg.addEventListener('pointermove', e => { if (!last) return; yaw += (e.clientX - last[0]) * 0.01; pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - last[1]) * 0.01)); last = [e.clientX, e.clientY]; draw(); });
            const stop = () => { last = null; };
            svg.addEventListener('pointerup', stop);
            svg.addEventListener('pointercancel', stop);
        }
        draw(); label();
        view.appendChild(svg);
        view.appendChild(tag);
        if (you) {
            view.appendChild(note('Closest to you:'));
            view.appendChild(row(sp.labs.slice().sort((a, b) => dist(sp.pos[a], you) - dist(sp.pos[b], you)).slice(0, 6).map(l => bubble(l, true))));
        }
    }
    function renderRadar() {
        if (!hasAnswers()) { go('start'); return; }
        const ranked = HV.closestIdeologies(answers, null, 3);
        const r = HVX.radar(answers, ranked.map(x => x.label));
        if (r.cats.length < 3) { view.appendChild(note('Answer values in at least three categories to see it.')); return; }
        const size = 440, mid = size / 2, rad = 140, n = r.cats.length;
        const svg = svgNode('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': 'Radar' });
        svg.style.cssText = 'width:100%;max-width:520px;height:auto';
        const at = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; const k = rad * (v + 1) / 2; return [mid + Math.cos(a) * k, mid + Math.sin(a) * k]; };
        [-1, 0, 1].forEach(lvl => svg.appendChild(svgNode('polygon', { points: r.cats.map((c, i) => at(i, lvl).join(',')).join(' '), fill: 'none', stroke: 'var(--text-dim)', 'stroke-opacity': 0.35 })));
        r.cats.forEach((c, i) => { const p = at(i, 1.22); const t = svgNode('text', { x: p[0], y: p[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: 'currentColor', 'font-size': 12 }); t.textContent = categoryTitles[c] || c; svg.appendChild(t); });
        r.others.forEach(o => svg.appendChild(svgNode('polygon', { points: o.values.map((v, i) => at(i, v).join(',')).join(' '), fill: color(o.label), 'fill-opacity': 0.18, stroke: color(o.label), 'stroke-width': 2 })));
        svg.appendChild(svgNode('polygon', { points: r.you.map((v, i) => at(i, v).join(',')).join(' '), fill: 'none', stroke: 'var(--text-primary)', 'stroke-width': 3 }));
        view.appendChild(svg);
        view.appendChild(row(ranked.map(x => bubble(x.label, true))));
    }

    // ---------------------------------------------------------------------------------------------
    // Clashes
    // ---------------------------------------------------------------------------------------------
    function renderClash() {
        if (!hasAnswers()) { go('start'); return; }
        const pairs = HVX.tensions(answers);
        if (!pairs.length) { view.appendChild(note('No clashes found in your values.')); return; }
        pairs.forEach(p => {
            const line = el('div', 'hv-tension');
            line.appendChild(tile(p.a.cat, p.a.value, { ring: p.a.agree, sub: HV.signed(p.a.agree) }));
            line.appendChild(HVUI.round('tension', 'Clash', null, true));
            line.appendChild(tile(p.b.cat, p.b.value, { ring: p.b.agree, sub: HV.signed(p.b.agree) }));
            view.appendChild(line);
            if (p.holders.length) { view.appendChild(note('Ideologies that hold both:')); view.appendChild(row(p.holders.map(l => bubble(l, true)))); }
            else view.appendChild(note('No ideology holds both.'));
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Lens
    // ---------------------------------------------------------------------------------------------
    function renderLens() {
        const lens = HVX.loadLens();
        const save = () => { HVX.saveLens(lens); render(); };
        [['x', 'Horizontal axis'], ['y', 'Vertical axis']].forEach(([axis, title]) => {
            view.appendChild(note(title + ' \u2014 tap a value to set its weight'));
            const flex = el('div', 'values-flex-container');
            lens[axis].slice().sort((a, b) => a.w - b.w).forEach(item => {
                const cat = HV.categoryOf[item.v];
                if (!cat) return;
                flex.appendChild(tile(cat, item.v, {
                    ring: item.w, sub: HV.signed(item.w),
                    onClick: () => openSheet(cat, item.v, item.w, w => { item.w = Math.round(w * 100) / 100; HVX.saveLens(lens); }, () => { lens[axis] = lens[axis].filter(i => i !== item); save(); })
                }));
            });
            const add = el('a', 'result-item');
            add.href = '#';
            add.style.textDecoration = 'none';
            add.style.color = 'inherit';
            add.onclick = event => { event.preventDefault(); pickValue(v => { if (!lens[axis].some(i => i.v === v)) lens[axis].push({ v, w: 0.5 }); save(); }); };
            add.appendChild(el('div', 'result-icon result-none add-icon'));
            add.appendChild(el('p', 'result-text', 'Add value'));
            flex.appendChild(add);
            view.appendChild(flex);
        });
        const W = 600, H = 420;
        const svg = svgNode('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Lens' });
        svg.style.cssText = 'width:100%;max-width:760px;height:auto;background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius-lg)';
        const pts = HVX.labels().map(l => ({ l, p: HVX.lensOfIdeology(lens, l) }));
        const sx = Math.max(0.05, ...pts.map(i => Math.abs(i.p[0]))), sy = Math.max(0.05, ...pts.map(i => Math.abs(i.p[1])));
        const at = p => [W / 2 + p[0] / sx * (W / 2 - 30), H / 2 - p[1] / sy * (H / 2 - 30)];
        svg.appendChild(svgNode('line', { x1: 0, y1: H / 2, x2: W, y2: H / 2, stroke: 'var(--text-dim)', 'stroke-opacity': 0.4 }));
        svg.appendChild(svgNode('line', { x1: W / 2, y1: 0, x2: W / 2, y2: H, stroke: 'var(--text-dim)', 'stroke-opacity': 0.4 }));
        const tag = el('div', 'hv-pills');
        pts.forEach(i => {
            const c = at(i.p);
            const dot = svgNode('circle', { cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: 4.5, fill: color(i.l), 'fill-opacity': 0.85 });
            dot.style.cursor = 'pointer';
            dot.addEventListener('click', () => { tag.textContent = ''; tag.appendChild(bubble(i.l, true)); });
            svg.appendChild(dot);
        });
        if (hasAnswers()) { const c = at(HVX.lensOfAnswers(lens, answers)); svg.appendChild(svgNode('circle', { cx: c[0], cy: c[1], r: 11, fill: 'none', stroke: 'var(--text-primary)', 'stroke-width': 3 })); }
        view.appendChild(svg);
        view.appendChild(tag);
        view.appendChild(row([entry('undo', 'Reset the lens', () => { try { localStorage.removeItem('hvx_lens'); } catch (e) { /* none */ } render(); })]));
    }
    function pickValue(onPick) {
        openModal(box => {
            const list = el('div', 'category-list');
            categories.forEach(cat => {
                const ids = Object.keys(resultsMapping[cat] || {});
                if (!ids.length) return;
                const s = el('div', 'category-section');
                s.appendChild(el('h2', 'category-title', categoryTitles[cat] || cat));
                const flex = el('div', 'values-flex-container');
                ids.forEach(id => flex.appendChild(tile(cat, id, { onClick: () => { closeModal(); onPick(id); } })));
                s.appendChild(flex);
                list.appendChild(s);
            });
            box.appendChild(list);
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Saved
    // ---------------------------------------------------------------------------------------------
    function renderSaved() {
        if (hasAnswers()) view.appendChild(row([entry('save', 'Save current values', () => { HVX.keep(answers); render(); })]));
        view.appendChild(versionCards(v => {
            openModal(box => {
                box.appendChild(row([
                    entry('check', 'Use these', () => adopt(v.a)),
                    entry('compare', 'Compare with mine', () => { slotA = sourceMe(); slotB = { kind: 'version', answers: v.a, custom: v.c, name: '' }; store('hvx_other', slotB); closeModal(); go('compare'); })
                ]));
            });
        }, render));
    }

    // ---------------------------------------------------------------------------------------------
    // Start
    // ---------------------------------------------------------------------------------------------
    let startKind = null;
    function renderStart() {
        const ways = [['start', 'Quiz', null, () => { location.href = custom ? 'results.html' : 'Instruction.html'; }], ['browse', 'Browse', 'browse', () => { startKind = 'browse'; render(); }], ['link', 'Link', 'link', () => { startKind = 'link'; render(); }], ['tag', 'Ideology', 'ideology', () => { startKind = 'ideology'; render(); }], ['mine', 'Saved', 'version', () => { startKind = 'version'; render(); }]];
        view.appendChild(row(ways.map(([icon, name, kind, run]) => entry(icon, name, run, kind && startKind === kind))));
        if (startKind === 'browse') {
            view.appendChild(note('Tap a value, then slide to say how much you agree.'));
            const list = el('div', 'category-list');
            categories.forEach(cat => {
                const ids = Object.keys(resultsMapping[cat] || {});
                if (!ids.length) return;
                const s = el('div', 'category-section');
                s.appendChild(el('h2', 'category-title', categoryTitles[cat] || cat));
                const flex = el('div', 'values-flex-container');
                ids.forEach(id => {
                    const found = (answers[cat] || []).find(i => i.value === id);
                    flex.appendChild(tile(cat, id, {
                        ring: found ? found.agree : null, faded: !found, sub: found ? HV.signed(found.agree) : '',
                        onClick: self => {
                            const now = (answers[cat] || []).find(i => i.value === id);
                            openSheet(cat, id, now ? now.agree : 0, v => {
                                setAnswer(id, v);
                                self.querySelector('img').style.boxShadow = `0 0 0 3px var(--bg-color), 0 0 0 6px ${HV.ringColor(v)}`;
                                self.classList.remove('hv-faded');
                                let sub = self.querySelector('.result-agree');
                                if (!sub) { sub = el('p', 'result-agree'); self.appendChild(sub); }
                                sub.textContent = HV.signed(v);
                            }, () => { setAnswer(id, null); render(); });
                        }
                    }));
                });
                s.appendChild(flex);
                list.appendChild(s);
            });
            view.appendChild(list);
        } else if (startKind === 'link') {
            view.appendChild(textInput('Paste a link', 'Link', input => {
                const got = HVX.decode(HVX.codeFrom(input.value));
                if (got && HVX.answeredCount(got.answers)) adopt(got.answers); else input.classList.add('hv-bad');
            }));
        } else if (startKind === 'ideology') {
            view.appendChild(note('Your values become what this ideology says. You can change them afterwards.'));
            view.appendChild(ideologyList(label => adopt(HVX.answersOf(label))));
        } else if (startKind === 'version') {
            view.appendChild(versionCards(v => adopt(v.a), null));
        }
    }

    // ---------------------------------------------------------------------------------------------
    const RENDER = { why: renderWhy, compare: renderCompare, map: renderMap, clash: renderClash, lens: renderLens, saved: renderSaved, start: renderStart, shared: renderShared };
    function go(name) { tab = name; render(); }
    function render() {
        closeModal();
        closeSheet();
        view.textContent = '';
        nav.textContent = '';
        if (tab !== 'shared') {
            TABS.forEach(([key, icon, label]) => nav.appendChild(entry(icon, label, () => { startKind = null; go(key); }, key === tab)));
            if (hasAnswers()) nav.appendChild(HVUI.round('link', 'Copy link', copyLink, true));
        }
        const found = TABS.find(t => t[0] === tab);
        caption.textContent = found ? found[3] : SHARED_CAPTION;
        RENDER[tab]();
        fitNames(view);
    }
    function mount(panel) {
        panel.textContent = '';
        nav = el('div', 'hv-tabs2');
        nav.setAttribute('role', 'tablist');
        caption = el('p', 'hv-caption');
        view = el('div', 'hv-view');
        panel.appendChild(nav);
        panel.appendChild(caption);
        panel.appendChild(view);
    }
    function open() { answers = HV.loadAnswers(); sharedCode = null; tab = hasAnswers() ? 'why' : 'start'; render(); }
    function openShared(code) { answers = HV.loadAnswers(); sharedCode = code; tab = 'shared'; render(); }
    return { mount, open, openShared };
})();
