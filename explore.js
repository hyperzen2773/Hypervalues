// The explore page (explore.html): why you got a result, a link to it, comparing, the map, tensions, lenses, your saved
// versions and the ways to start. Nothing on it is explained in words: it uses the rings, tiles and bubbles of the
// results page. What it computes is in hvx.js. It never changes your answers unless you choose a way to start or answer
// a value yourself.
(function () {
    const view = document.getElementById('explore-view');
    const nav = document.getElementById('explore-nav');
    const custom = HVPack.isCustom();
    let answers = HV.loadAnswers();
    const pack = custom && HVPack.active && HVPack.active();
    if (pack && pack.name) document.getElementById('version').textContent += ' \u00b7 ' + pack.name;

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
    function tile(cat, value, options) {
        const o = options || {};
        const node = el('a', 'result-item' + (o.faded ? ' hv-faded' : ''));
        node.href = o.onClick ? '#' : `description.html?id=${encodeURIComponent(value)}&cat=${encodeURIComponent(cat)}`;
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
        node.href = onClick ? '#' : `description.html?id=${encodeURIComponent(label)}&type=ideology`;
        if (onClick) node.onclick = event => { event.preventDefault(); onClick(node); };
        if (small) { node.style.setProperty('--pill-color', color(label)); const name = el('span', 'cp-name'); setName(name, label); node.appendChild(name); }
        else { node.style.backgroundColor = color(label); node.style.textDecoration = 'none'; node.style.fontSize = '1.1rem'; node.style.margin = '6px'; node.style.padding = '8px 22px'; setName(node, label); }
        return node;
    }
    function section(icon, items) {
        if (!items.length) return null;
        const box = el('div', 'category-section');
        const title = el('h2', 'category-title');
        title.innerHTML = HVUI.svg(icon);
        title.firstChild.style.cssText = 'width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round';
        box.appendChild(title);
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
        const entry = list.find(item => item.value === value);
        if (agree === null) { if (entry) list.splice(list.indexOf(entry), 1); if (!list.length) delete answers[cat]; }
        else if (entry) entry.agree = agree; else list.push({ value, agree });
        HV.saveAnswers(answers);
    }
    function searchBox(onInput) {
        const box = el('input', 'hv-input hv-search');
        box.type = 'text';
        box.placeholder = 'Search';
        box.setAttribute('aria-label', 'Search');
        box.oninput = () => onInput(box.value.trim().toLowerCase());
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
        holder.appendChild(searchBox(draw));
        holder.appendChild(list);
        draw('');
        return holder;
    }
    function versionCards(onPick, withDelete, rerender) {
        const box = el('div', 'hv-versions');
        HVX.versions().forEach((v, index) => {
            const card = el('div', 'hv-card');
            const info = el('a', 'hv-card-main');
            info.href = '#';
            info.onclick = event => { event.preventDefault(); onPick(v); };
            info.appendChild(el('span', 'cp-score', when(v.t)));
            if (v.top) info.appendChild(bubble(v.top, true, () => onPick(v)));
            card.appendChild(info);
            if (withDelete) card.appendChild(HVUI.round('trash', 'Remove', () => { HVX.dropVersion(index); rerender(); }, true));
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
        if (!hasAnswers()) { location.hash = '#start'; return; }
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
        if (HVX.close(ranked)) top.appendChild(HVUI.round('compare', 'Close call', () => { picked = [ranked[0].label, ranked[1].label]; render(); }, true));
        view.appendChild(top);

        if (picked.length === 1) {
            const g = HVX.explain(answers, picked[0]);
            const t = (items, kind) => items.map(i => tile(i.cat, i.value, { ring: kind === 'missing' ? null : i.fit, sub: kind === 'missing' ? '' : HV.signed(i.fit), faded: kind === 'missing' || !i.listed }));
            [section('check', t(g.toward)), section('x', t(g.away)), section('minus', t(g.flat)), section('plus', t(g.missing, 'missing'))].forEach(s => { if (s) view.appendChild(s); });
        } else {
            const [a, b] = picked;
            const d = HVX.differences(answers, a, b);
            const head = row([bubble(a, false), bubble(b, false)]);
            view.appendChild(head);
            const cols = el('div', 'hv-two');
            ['a', 'b'].forEach(side => {
                const flex = el('div', 'values-flex-container');
                d.filter(x => x.favors === side).forEach(x => flex.appendChild(tile(x.cat, x.value, { ring: x[side], sub: HV.signed(x[side]) })));
                cols.appendChild(flex);
            });
            view.appendChild(cols);
            const decide = HVX.decider(answers, a, b);
            if (decide) {
                const flex = el('div', 'values-flex-container');
                flex.appendChild(tile(decide.cat, decide.value, { dashed: true, faded: true, onClick: () => openSheet(decide.cat, decide.value, 0, v => { setAnswer(decide.value, v); }, null) }));
                view.appendChild(flex);
            }
        }
        view.appendChild(row([HVUI.round('link', 'Link', copyLink)]));
        view.appendChild(srTable(ranked));
    }
    function copyLink() {
        const url = location.origin && location.origin !== 'null' ? location.origin + location.pathname : 'explore.html';
        const text = `${url}#r=${HVX.encode(answers)}`;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => HVUI.toast('\u2713'), () => HVUI.toast('\u2717', true));
        else HVUI.toast('\u2717', true);
    }
    function srTable(ranked) {
        const table = el('table', 'hv-sr');
        ranked.forEach(item => { const tr = el('tr'); tr.appendChild(el('td', '', item.label)); tr.appendChild(el('td', '', HV.percent(item.probability))); table.appendChild(tr); });
        return table;
    }

    // ---------------------------------------------------------------------------------------------
    // A link someone sent (explore.html#r=...): the results page of that person, read only
    // ---------------------------------------------------------------------------------------------
    function renderShared(code) {
        const shared = HVX.decode(code);
        if (!shared || !HVX.answeredCount(shared.answers)) { location.hash = '#start'; return; }
        store('hvx_other', { kind: 'link', answers: shared.answers, custom: shared.custom, name: shared.name });
        const ranked = HV.closestIdeologies(shared.answers, null, 1 + HV.CLOSEST_COUNT);
        if (shared.custom) view.appendChild(row([providence(shared)]));
        if (ranked[0]) {
            const best = bubble(ranked[0].label, false);
            best.style.display = 'inline-block';
            view.appendChild(row([best]));
            view.appendChild(row(ranked.slice(1).map(r => bubble(r.label, true))));
        }
        view.appendChild(row([
            HVUI.round('compare', 'Compare', () => { store('hvx_slot_b', null); location.hash = '#compare'; }),
            HVUI.round('check', 'Use', () => adopt(shared.answers))
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
    // The mark of data that is not the site's own: a pack, with its name
    function providence(source) {
        const node = el('span', 'closest-pill');
        node.style.setProperty('--pill-color', 'var(--text-dim)');
        node.appendChild(el('span', 'cp-name', source.name || '\u2022'));
        node.title = source.name || '';
        return node;
    }

    // ---------------------------------------------------------------------------------------------
    // Compare
    // ---------------------------------------------------------------------------------------------
    function sourceMe() { return hasAnswers() ? { kind: 'me', answers, custom, name: pack ? pack.name : '' } : null; }
    function slot(source, onClick) {
        const node = el('button', 'hv-slot' + (source ? '' : ' hv-dashed'));
        node.type = 'button';
        node.setAttribute('aria-label', 'Choose');
        node.onclick = onClick;
        if (!source) { node.innerHTML = HVUI.svg('plus'); return node; }
        if (source.kind === 'ideology') { node.style.backgroundColor = color(source.label); const n = el('span'); setName(n, source.label); node.appendChild(n); }
        else { node.innerHTML = HVUI.svg(source.kind === 'me' ? 'me' : source.kind === 'version' ? 'mine' : 'link'); }
        return node;
    }
    function choose(onPick) {
        openModal(box => {
            const body = el('div');
            const tabs = el('div', 'hv-tools');
            const show = kind => {
                body.textContent = '';
                if (kind === 'ideology') body.appendChild(ideologyList(label => { closeModal(); onPick({ kind: 'ideology', label, answers: HVX.answersOf(label), custom: false, name: '' }); }));
                else if (kind === 'link') {
                    const input = el('input', 'hv-input hv-search');
                    input.type = 'text';
                    input.setAttribute('aria-label', 'Link');
                    input.placeholder = '#r=';
                    input.onchange = () => {
                        const got = HVX.decode(HVX.codeFrom(input.value));
                        if (got && HVX.answeredCount(got.answers)) { closeModal(); onPick({ kind: 'link', answers: got.answers, custom: got.custom, name: got.name }); }
                        else input.classList.add('hv-bad');
                    };
                    body.appendChild(input);
                } else if (kind === 'version') body.appendChild(versionCards(v => { closeModal(); onPick({ kind: 'version', answers: v.a, custom: v.c, name: '' }); }, false));
            };
            const me = sourceMe();
            if (me) tabs.appendChild(HVUI.round('me', 'Me', () => { closeModal(); onPick(me); }));
            ['ideology', 'link', 'version'].forEach(kind => tabs.appendChild(HVUI.round(kind === 'ideology' ? 'tag' : kind === 'link' ? 'link' : 'mine', kind, () => show(kind))));
            box.appendChild(tabs);
            box.appendChild(body);
        });
    }
    let slotA = null, slotB = null;
    function renderCompare() {
        if (!slotA) slotA = sourceMe();
        if (!slotB) slotB = fetchStore('hvx_other');
        const pair = el('div', 'hv-slots');
        pair.appendChild(slot(slotA, () => choose(s => { slotA = s; render(); })));
        const mid = el('span');
        if (slotA && slotB && (slotA.custom !== slotB.custom || (slotA.name || '') !== (slotB.name || ''))) mid.appendChild(HVUI.round('palette', slotA.name + ' / ' + slotB.name, null, true));
        pair.appendChild(mid);
        pair.appendChild(slot(slotB, () => choose(s => { slotB = s; store('hvx_other', s); render(); })));
        view.appendChild(pair);
        if (!slotA || !slotB) return;
        const c = HVX.compare(slotA.answers, slotB.answers);
        const numbers = row([c.overlap === null ? null : bubbleText(Math.round(c.overlap * 100) + '%'), bubbleText(c.shared + '/' + c.union)]);
        view.appendChild(numbers);
        const make = state => c.tiles.filter(t => t.state === state).sort((x, y) => y.gap - x.gap).map(t => tile(t.cat, t.value, {
            ring: state === 'one' ? null : (state === 'same' ? 1 : -1),
            faded: state === 'one',
            sub: (t.a === undefined ? '\u00b7' : HV.signed(t.a)) + ' | ' + (t.b === undefined ? '\u00b7' : HV.signed(t.b))
        }));
        [section('check', make('same')), section('x', make('differ')), section('minus', make('one'))].forEach(s => { if (s) view.appendChild(s); });
        view.appendChild(row(c.both.map(l => bubble(l, false))));
        view.appendChild(row(c.onlyA.map(l => bubble(l, true)).concat(c.onlyB.map(l => bubble(l, true)))));
    }
    function bubbleText(text) {
        const node = el('span', 'label-bubble', text);
        node.style.cssText = 'font-size:1.6rem;padding:8px 26px;margin:6px;background-color:var(--card-bg);color:var(--text-primary);border:1px solid var(--card-border)';
        return node;
    }

    // ---------------------------------------------------------------------------------------------
    // Map: radar, plane and cube
    // ---------------------------------------------------------------------------------------------
    let mapKind = 'map', yaw = 0.6, pitch = 0.4, shown = null;
    const NS = 'http://www.w3.org/2000/svg';
    function svgNode(tag, attrs) { const n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); return n; }
    function renderMap() {
        view.appendChild(row([
            HVUI.round('radar', 'Radar', () => { mapKind = 'radar'; render(); }),
            HVUI.round('map', 'Map', () => { mapKind = 'map'; render(); }),
            HVUI.round('cube', 'Cube', () => { mapKind = 'cube'; render(); })
        ].map((b, i) => { if (['radar', 'map', 'cube'][i] === mapKind) b.classList.add('hv-on'); return b; })));
        if (mapKind === 'radar') return renderRadar();
        const sp = HVX.build3();
        const you = hasAnswers() ? HVX.placeOf(answers) : null;
        const pick = el('div', 'hv-pills');
        const dims = mapKind === 'cube' ? [0, 1, 2] : [0, 1];
        const xs = sp.labs.map(l => sp.pos[l][0]), ys = sp.labs.map(l => sp.pos[l][1]), zs = sp.labs.map(l => sp.pos[l][2]);
        const span = a => Math.max(1e-6, Math.max(...a.map(Math.abs)));
        const sx = span(xs), sy = span(ys), sz = span(zs);
        const norm = p => [p[0] / sx, p[1] / sy, p[2] / sz];
        const W = 600, H = 420;
        const svg = svgNode('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Map' });
        svg.style.cssText = 'width:100%;max-width:760px;height:auto;touch-action:none;background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius-lg)';
        const dots = [];
        const project = p => {
            const n = norm(p);
            if (mapKind === 'map') return [W / 2 + n[0] * (W / 2 - 40), H / 2 - n[1] * (H / 2 - 30), 0];
            const cy = Math.cos(yaw), sy2 = Math.sin(yaw), cp = Math.cos(pitch), sp2 = Math.sin(pitch);
            let x = n[0] * cy + n[2] * sy2, z = -n[0] * sy2 + n[2] * cy, y = n[1];
            const y2 = y * cp - z * sp2, z2 = y * sp2 + z * cp;
            const scale = 1 / (1 + 0.25 * z2);
            return [W / 2 + x * (W / 2 - 60) * scale, H / 2 - y2 * (H / 2 - 50) * scale, z2];
        };
        const draw = () => {
            svg.textContent = '';
            const items = sp.labs.map(l => ({ label: l, p: project(sp.pos[l]) })).sort((a, b) => b.p[2] - a.p[2]);
            items.forEach(item => {
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
            if (mapKind === 'map') [[0, 'low', 14, H / 2], [0, 'high', W - 14, H / 2]].forEach(([k, end, x, y]) => {
                const image = svgNode('image', { href: HVPack.iconUrl(HV.categoryOf[sp.ends[k][end]], sp.ends[k][end]), x: x - 16, y: y - 16, width: 32, height: 32 });
                const title = svgNode('title'); title.textContent = HV.nameOf(HV.categoryOf[sp.ends[k][end]], sp.ends[k][end]); image.appendChild(title);
                svg.appendChild(image);
            });
        };
        const label = () => { pick.textContent = ''; if (shown) pick.appendChild(bubble(shown, true)); };
        if (mapKind === 'cube') {
            let last = null;
            svg.addEventListener('pointerdown', e => { last = [e.clientX, e.clientY]; svg.setPointerCapture && svg.setPointerCapture(e.pointerId); });
            svg.addEventListener('pointermove', e => { if (!last) return; yaw += (e.clientX - last[0]) * 0.01; pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - last[1]) * 0.01)); last = [e.clientX, e.clientY]; draw(); });
            svg.addEventListener('pointerup', () => { last = null; });
        }
        draw(); label();
        view.appendChild(svg);
        view.appendChild(pick);
        const near = you ? sp.labs.slice().sort((a, b) => dist(sp.pos[a], you) - dist(sp.pos[b], you)).slice(0, 6) : [];
        view.appendChild(row(near.map(l => bubble(l, true))));
    }
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    function renderRadar() {
        if (!hasAnswers()) { location.hash = '#start'; return; }
        const ranked = HV.closestIdeologies(answers, null, 3);
        const r = HVX.radar(answers, ranked.map(x => x.label));
        if (r.cats.length < 3) return;
        const size = 420, mid = size / 2, rad = 150, n = r.cats.length;
        const svg = svgNode('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': 'Radar' });
        svg.style.cssText = 'width:100%;max-width:520px;height:auto';
        const at = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; const k = rad * (v + 1) / 2; return [mid + Math.cos(a) * k, mid + Math.sin(a) * k]; };
        [0, 0.5, 1].forEach(lvl => { const ring = svgNode('polygon', { points: r.cats.map((c, i) => at(i, lvl * 2 - 1).join(',')).join(' '), fill: 'none', stroke: 'var(--text-dim)', 'stroke-opacity': 0.35 }); svg.appendChild(ring); });
        r.cats.forEach((c, i) => { const p = at(i, 1.18); const t = svgNode('text', { x: p[0], y: p[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: 'currentColor', 'font-size': 12 }); t.textContent = categoryTitles[c] || c; svg.appendChild(t); });
        r.others.forEach(o => svg.appendChild(svgNode('polygon', { points: o.values.map((v, i) => at(i, v).join(',')).join(' '), fill: color(o.label), 'fill-opacity': 0.18, stroke: color(o.label), 'stroke-width': 2 })));
        svg.appendChild(svgNode('polygon', { points: r.you.map((v, i) => at(i, v).join(',')).join(' '), fill: 'none', stroke: 'var(--text-primary)', 'stroke-width': 3 }));
        view.appendChild(svg);
        view.appendChild(row(ranked.map(x => bubble(x.label, true))));
    }

    // ---------------------------------------------------------------------------------------------
    // Tensions
    // ---------------------------------------------------------------------------------------------
    function renderTension() {
        if (!hasAnswers()) { location.hash = '#start'; return; }
        const pairs = HVX.tensions(answers);
        if (!pairs.length) { view.appendChild(row([HVUI.round('check', 'None')])); return; }
        pairs.forEach(p => {
            const line = el('div', 'hv-tension');
            line.appendChild(tile(p.a.cat, p.a.value, { ring: p.a.agree, sub: HV.signed(p.a.agree) }));
            line.appendChild(HVUI.round('tension', 'Tension', null, true));
            line.appendChild(tile(p.b.cat, p.b.value, { ring: p.b.agree, sub: HV.signed(p.b.agree) }));
            view.appendChild(line);
            view.appendChild(row(p.holders.map(l => bubble(l, true))));
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Lens
    // ---------------------------------------------------------------------------------------------
    function renderLens() {
        const lens = HVX.loadLens();
        const save = () => { HVX.saveLens(lens); render(); };
        ['x', 'y'].forEach(axis => {
            const flex = el('div', 'values-flex-container');
            const sorted = lens[axis].slice().sort((a, b) => a.w - b.w);
            sorted.forEach(item => {
                const cat = HV.categoryOf[item.v];
                if (!cat) return;
                flex.appendChild(tile(cat, item.v, {
                    ring: item.w, sub: HV.signed(item.w),
                    onClick: () => openSheet(cat, item.v, item.w, w => { item.w = Math.round(w * 100) / 100; HVX.saveLens(lens); }, () => { lens[axis] = lens[axis].filter(i => i !== item); save(); })
                }));
            });
            const add = el('a', 'result-item');
            add.href = '#';
            add.setAttribute('aria-label', 'Add');
            add.onclick = event => { event.preventDefault(); pickValue(v => { if (!lens[axis].some(i => i.v === v)) lens[axis].push({ v, w: 0.5 }); save(); }); };
            add.appendChild(el('div', 'result-icon result-none add-icon'));
            flex.appendChild(add);
            view.appendChild(flex);
        });
        const W = 600, H = 420;
        const svg = svgNode('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Lens' });
        svg.style.cssText = 'width:100%;max-width:760px;height:auto;background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius-lg)';
        const labs = HVX.labels();
        const pts = labs.map(l => ({ l, p: HVX.lensOfIdeology(lens, l) }));
        const sx = Math.max(0.05, ...pts.map(i => Math.abs(i.p[0]))), sy = Math.max(0.05, ...pts.map(i => Math.abs(i.p[1])));
        const at = p => [W / 2 + p[0] / sx * (W / 2 - 30), H / 2 - p[1] / sy * (H / 2 - 30)];
        svg.appendChild(svgNode('line', { x1: 0, y1: H / 2, x2: W, y2: H / 2, stroke: 'var(--text-dim)', 'stroke-opacity': 0.4 }));
        svg.appendChild(svgNode('line', { x1: W / 2, y1: 0, x2: W / 2, y2: H, stroke: 'var(--text-dim)', 'stroke-opacity': 0.4 }));
        let chosen = null;
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
        view.appendChild(row([HVUI.round('undo', 'Reset', () => { try { localStorage.removeItem('hvx_lens'); } catch (e) { /* none */ } render(); })]));
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
    // Mine: the versions of you
    // ---------------------------------------------------------------------------------------------
    function renderMine() {
        const tools = [];
        if (hasAnswers()) tools.push(HVUI.round('save', 'Save', () => { HVX.keep(answers); render(); }));
        view.appendChild(row(tools));
        view.appendChild(versionCards(v => {
            openModal(box => {
                box.appendChild(row([
                    HVUI.round('check', 'Use', () => adopt(v.a)),
                    HVUI.round('compare', 'Compare', () => { slotA = sourceMe(); slotB = { kind: 'version', answers: v.a, custom: v.c, name: '' }; store('hvx_other', slotB); closeModal(); location.hash = '#compare'; })
                ]));
            });
        }, true, render));
    }

    // ---------------------------------------------------------------------------------------------
    // Start: the ways in
    // ---------------------------------------------------------------------------------------------
    let startKind = null;
    function renderStart() {
        const ways = [['start', 'Quiz', () => { location.href = custom ? 'results.html' : 'Instruction.html'; }], ['browse', 'Browse', () => { startKind = 'browse'; render(); }], ['link', 'Link', () => { startKind = 'link'; render(); }], ['tag', 'Ideology', () => { startKind = 'ideology'; render(); }], ['mine', 'Version', () => { startKind = 'version'; render(); }]];
        view.appendChild(row(ways.map(([icon, name, go]) => { const b = HVUI.round(icon, name, go); if (startKind === { browse: 'browse', link: 'link', tag: 'ideology', mine: 'version' }[icon]) b.classList.add('hv-on'); return b; })));
        if (startKind === 'browse') {
            const list = el('div', 'category-list');
            categories.forEach(cat => {
                const ids = Object.keys(resultsMapping[cat] || {});
                if (!ids.length) return;
                const s = el('div', 'category-section');
                s.appendChild(el('h2', 'category-title', categoryTitles[cat] || cat));
                const flex = el('div', 'values-flex-container');
                ids.forEach(id => {
                    const entry = (answers[cat] || []).find(i => i.value === id);
                    const node = tile(cat, id, {
                        ring: entry ? entry.agree : null, faded: !entry, sub: entry ? HV.signed(entry.agree) : '',
                        onClick: self => {
                            const now = (answers[cat] || []).find(i => i.value === id);
                            openSheet(cat, id, now ? now.agree : 0, v => {
                                setAnswer(id, v);
                                const img = self.querySelector('img');
                                img.style.boxShadow = `0 0 0 3px var(--bg-color), 0 0 0 6px ${HV.ringColor(v)}`;
                                self.classList.remove('hv-faded');
                                const sub = self.querySelector('.result-agree');
                                if (sub) sub.textContent = HV.signed(v);
                            }, () => { setAnswer(id, null); render(); });
                        }
                    });
                    flex.appendChild(node);
                });
                s.appendChild(flex);
                list.appendChild(s);
            });
            view.appendChild(list);
            if (hasAnswers()) view.appendChild(row([HVUI.round('check', 'Done', () => { location.href = 'results.html'; })]));
        } else if (startKind === 'link') {
            const input = el('input', 'hv-input hv-search');
            input.type = 'text';
            input.setAttribute('aria-label', 'Link');
            input.placeholder = '#r=';
            input.onchange = () => {
                const got = HVX.decode(HVX.codeFrom(input.value));
                if (got && HVX.answeredCount(got.answers)) adopt(got.answers); else input.classList.add('hv-bad');
            };
            view.appendChild(input);
        } else if (startKind === 'ideology') {
            view.appendChild(ideologyList(label => adopt(HVX.answersOf(label))));
        } else if (startKind === 'version') {
            view.appendChild(versionCards(v => adopt(v.a), false));
        }
    }

    // ---------------------------------------------------------------------------------------------
    const ROUTES = [['why', 'why', 'Why', renderWhy], ['compare', 'compare', 'Compare', renderCompare], ['map', 'map', 'Map', renderMap], ['tension', 'tension', 'Tension', renderTension], ['lens', 'lens', 'Lens', renderLens], ['mine', 'mine', 'Mine', renderMine], ['start', 'start', 'Start', renderStart]];
    function routeName() {
        const h = location.hash.slice(1);
        if (h.indexOf('r=') === 0) return 'shared';
        return ROUTES.some(r => r[0] === h) ? h : (hasAnswers() ? 'why' : 'start');
    }
    function render() {
        closeModal();
        closeSheet();
        view.textContent = '';
        nav.textContent = '';
        const name = routeName();
        ROUTES.forEach(([key, icon, label]) => {
            const b = HVUI.round(icon, label, () => { location.hash = '#' + key; });
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-selected', key === name ? 'true' : 'false');
            if (key === name) b.classList.add('hv-on');
            nav.appendChild(b);
        });
        if (name === 'shared') renderShared(location.hash.slice(3));
        else ROUTES.find(r => r[0] === name)[3]();
        fitNames(view);
    }
    window.addEventListener('hashchange', () => { answers = HV.loadAnswers(); render(); });
    window.addEventListener('pageshow', event => { if (event.persisted) { answers = HV.loadAnswers(); render(); } });
    render();
})();
