// The editor of Custom Pages (editor.html): create and change values, ideologies, categories and questions and save
// the changes as a pack (see pack.js). It shows the site's own data (data.js, loaded without the pack) with the pack's
// changes on top, and every change goes through HVPack.validate before it is saved, so what it saves is always a
// valid pack. Everything is saved as you edit; a mistake is shown for a moment (custom_ui.js) and nothing is kept.
(function () {
    if (!HVPack.isCustom()) { location.replace('index.html'); return; }

    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const clone = x => JSON.parse(JSON.stringify(x));
    const round2 = n => Math.round(n * 100) / 100;
    const fmt = n => { const r = round2(n); return (r > 0 ? '+' : (r < 0 ? '\u2212' : '')) + Math.abs(r).toFixed(2); };


    let draft = HVPack.storedPack() || HVPack.emptyPack('My pack');
    let baseTree = null;          // questions_tree.json as the site has it (read once)
    let baseTreeFailed = false;

    const tabsHolder = document.getElementById('editor-tabs');
    const body = document.getElementById('editor-body');

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function say(message, bad) { if (bad) HVUI.toast(message, true); }

    // ---------------------------------------------------------------------------------------------
    // Making a change: on a copy, checked, then saved. Returns false (and says why) if it is not allowed.
    // ---------------------------------------------------------------------------------------------
    function prune(pack) {
        Object.keys(pack.values.add).forEach(cat => { if (!Object.keys(pack.values.add[cat]).length) delete pack.values.add[cat]; });
        Object.keys(pack.values.edit).forEach(id => { if (!Object.keys(pack.values.edit[id]).length) delete pack.values.edit[id]; });
        Object.keys(pack.tree).forEach(cat => {
            const part = pack.tree[cat];
            if (!Object.keys(part.questions).length && !part.remove.length && !part.root) delete pack.tree[cat];
        });
        Object.keys(pack.ideologies.edit).forEach(label => {
            const item = pack.ideologies.edit[label];
            if (item.stances && !Object.keys(item.stances).length) delete item.stances;
            if (!Object.keys(item).length) delete pack.ideologies.edit[label];
        });
    }
    function change(mutate, rerender) {
        const copy = clone(draft);
        mutate(copy);
        prune(copy);
        const result = HVPack.validate(copy);
        if (result.errors.length) { say(result.errors[0], true); return false; }
        if (!HVPack.savePack(result.pack)) { say('The pack could not be saved in this browser.', true); return false; }
        draft = result.pack;
        if (rerender !== false) render();
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // The data as it is with the pack's changes
    // ---------------------------------------------------------------------------------------------
    const baseCategories = categories.slice();
    const baseValueCategory = {};
    baseCategories.forEach(cat => Object.keys(resultsMapping[cat] || {}).forEach(id => { baseValueCategory[id] = cat; }));
    const baseLabels = (function () {
        const labels = [];
        const seen = new Set();
        const add = label => { if (!seen.has(label)) { seen.add(label); labels.push(label); } };
        Object.keys(ideologyGroups).forEach(group => ideologyGroups[group].forEach(add));
        Object.keys(labelMapping).forEach(key => add(labelMapping[key]));
        return labels;
    })();
    const baseGroupOf = {};
    Object.keys(ideologyGroups).forEach(group => ideologyGroups[group].forEach(label => { baseGroupOf[label] = group; }));

    const isCatRemoved = cat => draft.categories.remove.includes(cat);
    const allCategories = () => baseCategories.concat(Object.keys(draft.categories.add));
    const effCategories = () => allCategories().filter(cat => !isCatRemoved(cat));
    function catTitle(cat) {
        if (own(draft.categories.rename, cat)) return draft.categories.rename[cat];
        if (own(draft.categories.add, cat)) return draft.categories.add[cat];
        return categoryTitles[cat] || cat;
    }
    // Every value (also the removed ones) with the category it is in now: { id, cat, baseCat (null for a new value), ... }
    function allValues() {
        const list = [];
        baseCategories.forEach(baseCat => Object.keys(resultsMapping[baseCat] || {}).forEach(id => {
            const edit = draft.values.edit[id] || {};
            list.push({
                id, baseCat, cat: edit.category !== undefined ? edit.category : baseCat, custom: false,
                removed: draft.values.remove.includes(id),
                name: edit.name !== undefined ? edit.name : resultsMapping[baseCat][id],
                definition: edit.definition !== undefined ? edit.definition : (descriptions[id] || ''),
                icon: edit.icon || null,
                changed: Object.keys(edit).length > 0
            });
        }));
        Object.keys(draft.values.add).forEach(cat => Object.keys(draft.values.add[cat]).forEach(id => {
            const item = draft.values.add[cat][id];
            list.push({ id, baseCat: null, cat, custom: true, removed: draft.values.remove.includes(id), name: item.name, definition: item.definition, icon: item.icon || null, changed: false });
        }));
        return list;
    }
    // The values of a category in the order a page shows them: the site's own, then new ones, then those moved in
    function effValues(cat) {
        const rank = v => (v.custom ? 1 : (v.baseCat === cat ? 0 : 2));
        return allValues().filter(v => v.cat === cat).map((v, i) => ({ v, i })).sort((x, y) => rank(x.v) - rank(y.v) || x.i - y.i).map(x => x.v);
    }
    function valueIdTaken(id) {
        if (own(baseValueCategory, id) || id in Object.prototype) return true;
        return Object.keys(draft.values.add).some(cat => own(draft.values.add[cat], id));
    }
    function slug(text, fallback) {
        let base = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/, '');
        if (!base) base = fallback;
        if (!/^[a-z]/.test(base)) base = 'v_' + base;
        return base;
    }
    function newValueId(name) {
        const base = slug(name, 'value');
        let id = base, n = 2;
        while (valueIdTaken(id)) id = base + '_' + (n++);
        return id;
    }
    function newCategoryId(title) {
        const base = slug(title, 'category');
        let id = base, n = 2;
        while (own(resultsMapping, id) || own(draft.categories.add, id) || id in Object.prototype) id = base + '_' + (n++);
        return id;
    }

    // A picture is an SVG file. It is not kept as it is: HVPack.cleanSvg rebuilds it from a short list of safe
    // parts (shapes, colors, gradients, clip paths and color filters) and drops the rest (scripts, links, images,
    // style sheets, animations, Inkscape's own data), so what is saved cannot run anything
    function readSvgFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('The file could not be read.'));
            reader.onload = () => {
                const result = HVPack.cleanSvg(String(reader.result));
                if (result.svg) resolve(result); else reject(new Error(result.error));
            };
            reader.readAsText(file);
        });
    }

    const isCustomLabel = label => own(draft.ideologies.add, label);
    // The name an ideology shows (an official one can be renamed in the pack; its key stays the official label)
    const shownName = label => (!isCustomLabel(label) && (draft.ideologies.edit[label] || {}).rename) || label;
    const isRemovedLabel = label => draft.ideologies.remove.includes(label);
    function effLabels() { return baseLabels.concat(Object.keys(draft.ideologies.add)); }
    function parseBaseStances(label) {
        const map = new Map();
        String(ideologyScores[label] || '').split('|').forEach(part => {
            const i = part.lastIndexOf(':');
            const n = Number(part.slice(i + 1));
            if (i > 0 && Number.isFinite(n) && n !== 0) map.set(part.slice(0, i), n);
        });
        return map;
    }
    function effStances(label) {
        if (isCustomLabel(label)) return new Map(Object.entries(draft.ideologies.add[label].stances || {}));
        const map = parseBaseStances(label);
        const edit = (draft.ideologies.edit[label] || {}).stances || {};
        Object.keys(edit).forEach(id => { if (edit[id] === null) map.delete(id); else map.set(id, edit[id]); });
        return map;
    }
    function effGroup(label) {
        if (isCustomLabel(label)) return draft.ideologies.add[label].group || 'Custom';
        const edit = draft.ideologies.edit[label] || {};
        return edit.group !== undefined ? edit.group : (baseGroupOf[label] || 'Other');
    }
    function effColor(label) {
        const item = isCustomLabel(label) ? draft.ideologies.add[label] : (draft.ideologies.edit[label] || {});
        return item.color !== undefined ? item.color : (labelColors[label] || '#7a7a7a');
    }
    function effDefinition(label) {
        const item = isCustomLabel(label) ? draft.ideologies.add[label] : (draft.ideologies.edit[label] || {});
        return item.definition !== undefined ? item.definition : (descriptions[label] || '');
    }
    function groupNames() {
        const names = new Set(Object.keys(ideologyGroups));
        effLabels().forEach(label => names.add(effGroup(label)));
        return Array.from(names);
    }

    // ---------------------------------------------------------------------------------------------
    // Deleting only adds the id of what is deleted to a list of removals in the pack. Nothing else in the pack is
    // changed or deleted: what is deleted keeps its edits, its stances and the answers that lead to it, and so does
    // everything that names it, so Restore brings all of it back and nothing else is affected.
    // Changes to the pack (each takes the copy of the pack that change() hands over)
    // ---------------------------------------------------------------------------------------------
    function saveValueFields(pack, value, name, definition, icon, category) {
        if (value.custom) {
            const entry = { name, definition };
            if (icon) entry.icon = icon;
            delete pack.values.add[value.cat][value.id];
            (pack.values.add[category] || (pack.values.add[category] = {}))[value.id] = entry;
            return;
        }
        const edit = pack.values.edit[value.id] || (pack.values.edit[value.id] = {});
        if (name === resultsMapping[value.baseCat][value.id]) delete edit.name; else edit.name = name;
        if (definition === (descriptions[value.id] || '')) delete edit.definition; else edit.definition = definition;
        if (icon) edit.icon = icon; else delete edit.icon;
        if (category === value.baseCat) delete edit.category; else edit.category = category;
    }
    function setStance(pack, label, id, stance) {      // stance: a number from -1 to 1, or null for none
        if (isCustomLabel(label)) {
            const item = pack.ideologies.add[label];
            item.stances = item.stances || {};
            if (stance === null) delete item.stances[id]; else item.stances[id] = stance;
            return;
        }
        const edit = pack.ideologies.edit[label] || (pack.ideologies.edit[label] = {});
        edit.stances = edit.stances || {};
        const base = parseBaseStances(label).get(id);
        if (stance === null) {
            if (base === undefined) delete edit.stances[id]; else edit.stances[id] = null;
        } else if (base !== undefined && round2(base) === stance) {
            delete edit.stances[id];
        } else {
            edit.stances[id] = stance;
        }
    }
    function setIdeologyField(pack, label, name, value) {
        if (isCustomLabel(label)) { pack.ideologies.add[label][name] = value; return; }
        const edit = pack.ideologies.edit[label] || (pack.ideologies.edit[label] = {});
        const base = name === 'group' ? (baseGroupOf[label] || 'Other')
            : name === 'rename' ? label
            : name === 'color' ? (labelColors[label] || '#7a7a7a').slice(0, 7)
            : (descriptions[label] || '');
        const same = name === 'color' ? value.toLowerCase() === base.toLowerCase() : value === base;
        if (same) delete edit[name]; else edit[name] = value;
    }

    const liveValueIds = () => new Set(allValues().filter(v => !v.removed && effCategories().includes(v.cat)).map(v => v.id));
    // The questions of a category as the quiz will play them, the first one first
    function effQuestions(cat) {
        const merged = HVPack.mergeQuestions((baseTree && baseTree[cat]) || [], draft.tree[cat] || {});
        const live = liveValueIds();
        return HVPack.normalizeQuestions(merged, id => live.has(id));
    }
    const baseQuestion = (cat, id) => ((baseTree && baseTree[cat]) || []).find(n => n.id === id && n.options) || null;
    const sameQuestion = (a, b) => a.text === b.text && JSON.stringify(a.options.map(o => ({ text: o.text, next: o.next, color: o.color }))) ===
        JSON.stringify(b.options.map(o => ({ text: o.text, next: o.next, color: o.color })));
    const treePart = (pack, cat) => pack.tree[cat] || (pack.tree[cat] = { questions: {}, remove: [] });
    function storeQuestion(pack, cat, q) {
        const part = treePart(pack, cat);
        const base = baseQuestion(cat, q.id);
        if (base && sameQuestion(base, q)) delete part.questions[q.id];
        else part.questions[q.id] = { text: q.text, options: q.options.map(o => { const entry = { text: o.text, next: o.next }; if (o.color) entry.color = o.color; return entry; }) };
        part.remove = part.remove.filter(id => id !== q.id);
    }
    function deleteQuestion(pack, cat, id) {
        const part = treePart(pack, cat);
        if (!part.remove.includes(id)) part.remove.push(id);
    }
    function setRoot(pack, cat, id) {
        const part = treePart(pack, cat);
        const first = ((baseTree && baseTree[cat]) || []).find(n => n.options);
        if (first && first.id === id) delete part.root; else part.root = id;
    }
    function takenIds() {
        const ids = new Set(allValues().map(v => v.id));
        Object.keys(baseTree || {}).forEach(cat => baseTree[cat].forEach(n => ids.add(n.id)));
        Object.keys(draft.tree).forEach(cat => Object.keys(draft.tree[cat].questions).forEach(id => ids.add(id)));
        return ids;
    }
    function newQuestionId(text) {
        const taken = takenIds();
        const base = slug(text, 'question');
        let id = base, n = 2;
        while (taken.has(id) || id in Object.prototype) id = base + '_' + (n++);
        return id;
    }
    function updateQuestion(cat, id, mutate, rerender) {
        return change(pack => {
            const q = effQuestions(cat).find(x => x.id === id);
            if (!q) return;
            mutate(q);
            storeQuestion(pack, cat, q);
        }, rerender);
    }
    const shorten = (text, n) => (text.length > n ? text.slice(0, n - 1) + '\u2026' : text);

    // ---------------------------------------------------------------------------------------------
    // The page: a title, tabs, and what the tab shows. It is made of the site's own parts (the tiles and category
    // titles of the results page, the bubbles of the ideologies page, the description box, the slider, the question
    // card and answer buttons of the quiz). Everything is saved as you type, so there is nothing to confirm.
    // ---------------------------------------------------------------------------------------------
    const TABS = [['values', 'Values'], ['ideologies', 'Ideologies'], ['questions', 'Questions'], ['pack', 'Pack']];
    const titleBox = document.querySelector('.title-container');
    let view = { tab: TABS.some(t => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'values', open: null };
    let depth = 0;
    let search = '';
    let qCat = null, qNode = null, qStack = [], qFocus = null;
    let modal = null, sheet = null, pending = null, pendingTimer = 0;

    function saveScroll() { history.replaceState({ view, depth, y: window.scrollY }, ''); }
    function show(next, push) {
        flush();
        if (push) { saveScroll(); depth++; history.pushState({ view: next, depth, y: 0 }, '', '#' + next.tab); }
        else history.replaceState({ view: next, depth, y: 0 }, '', '#' + next.tab);
        view = next;
        render();
        window.scrollTo(0, 0);
    }
    const openPage = open => show({ tab: view.tab, open }, true);
    const switchTab = tab => show({ tab, open: null }, false);
    function goBack() {
        flush();
        if (depth > 0) history.back(); else show({ tab: view.tab, open: null }, false);
    }
    window.addEventListener('popstate', event => {
        flush();
        const state = event.state;
        if (!state || !state.view) return;
        view = state.view;
        depth = state.depth || 0;
        render();
        window.scrollTo(0, state.y || 0);
    });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeModal(); closeSheet(); } });
    history.replaceState({ view, depth, y: 0 }, '', '#' + view.tab);

    // saves what is waiting (a slider that was moved, a text that is still being edited)
    function flush() {
        const active = document.activeElement;
        if (active && active !== document.body && active.blur && /^(TEXTAREA|INPUT)$/.test(active.tagName)) active.blur();
        if (pending) { const run = pending; pending = null; clearTimeout(pendingTimer); run(); }
    }
    function later(run) { pending = run; clearTimeout(pendingTimer); pendingTimer = setTimeout(flush, 150); }

    // ---------------------------------------------------------------------------------------------
    // Small parts
    // ---------------------------------------------------------------------------------------------
    function grow(node) { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px'; }
    function fitText() { body.querySelectorAll('textarea.hv-edit-text').forEach(grow); }
    window.addEventListener('resize', fitText);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitText);
    // a text edited where it stands: one line unless it is a definition; Enter finishes it
    function editText(value, label, oneLine, onCommit) {
        const node = el('textarea', 'hv-edit-text');
        node.rows = 1;
        node.value = value;
        node.setAttribute('aria-label', label);
        node.oninput = () => grow(node);
        if (oneLine) node.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); node.blur(); } };
        node.onchange = () => onCommit(node.value.trim(), node);
        return node;
    }
    function pill(text, on, onClick, extra) {
        const node = el('button', 'hv-pill' + (on ? ' hv-on' : '') + (extra ? ' ' + extra : ''), text);
        node.type = 'button';
        node.onclick = onClick;
        return node;
    }
    function pills(items, selected, onPick) {
        const row = el('div', 'hv-pills');
        items.forEach(item => row.appendChild(pill(item.text, item.id === selected, () => onPick(item.id))));
        return row;
    }
    function actions(buttons) {
        const row = el('div', 'button-container');
        buttons.forEach(b => row.appendChild(b));
        return row;
    }
    function textButton(text, onClick) {
        const node = el('button', '', text);
        node.type = 'button';
        node.onclick = onClick;
        return node;
    }
    const doneButton = () => textButton('Done', () => { flush(); location.href = 'results.html'; });
    const backButton = () => textButton('Back', goBack);

    function letterIcon(name) {
        const letter = (Array.from(name.trim())[0] || '?').toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return HVPack.svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#8b949e"/>' +
            '<text x="50" y="50" font-family="sans-serif" font-size="52" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">' + letter + '</text></svg>');
    }
    function iconSrc(v) {
        if (v.icon) return HVPack.svgUri(v.icon);
        if (!v.custom) return 'icons/' + v.baseCat + '/' + v.id + '.svg';
        return letterIcon(v.name || '?');
    }
    function tile(src, name, onClick, extra) {
        const node = el('a', 'result-item' + (extra ? ' ' + extra : ''));
        node.href = '#';
        node.style.textDecoration = 'none';
        node.style.color = 'inherit';
        node.onclick = event => { event.preventDefault(); onClick(node); };
        const img = el('img', 'result-icon');
        img.alt = '';
        img.src = src;
        img.style.borderRadius = '50%';
        img.onerror = () => { img.style.visibility = 'hidden'; };
        const text = el('p', 'result-text');
        setName(text, name);
        node.appendChild(img);
        node.appendChild(text);
        return node;
    }
    function addTile(label, onClick) {
        const node = el('a', 'result-item');
        node.href = '#';
        node.title = label;
        node.setAttribute('aria-label', label);
        node.onclick = event => { event.preventDefault(); onClick(); };
        node.appendChild(el('div', 'result-icon result-none add-icon'));
        return node;
    }

    function closeModal() { if (modal) { modal.remove(); modal = null; } }
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
    function closeSheet() {
        flush();
        if (sheet) { sheet.remove(); sheet = null; }
        document.body.classList.remove('hv-has-sheet');
        body.querySelectorAll('.hv-sel').forEach(node => node.classList.remove('hv-sel'));
    }

    // ---------------------------------------------------------------------------------------------
    // Values: every category as on the results page, each value a tile, and a tile with a plus to add one
    // ---------------------------------------------------------------------------------------------
    function renderValues() {
        const list = el('div', 'category-list');
        list.id = 'values-container';
        effCategories().forEach(cat => {
            const section = el('div', 'category-section');
            const title = el('h2', 'category-title');
            title.appendChild(editText(catTitle(cat), 'Title of the category', true, (text, node) => {
                if (!text) { node.value = catTitle(cat); grow(node); return; }
                change(pack => {
                    if (own(pack.categories.add, cat)) pack.categories.add[cat] = text;
                    else if (text === categoryTitles[cat]) delete pack.categories.rename[cat];
                    else pack.categories.rename[cat] = text;
                }, false);
            }));
            title.appendChild(HVUI.round('x', 'Remove category', () => removeCategory(cat), true));
            section.appendChild(title);
            const flex = el('div', 'values-flex-container');
            effValues(cat).forEach(v => {
                const node = tile(iconSrc(v), v.name, () => openPage({ type: 'value', id: v.id }), v.removed ? 'hv-removed' : '');
                flex.appendChild(node);
            });
            flex.appendChild(addTile('Add value', () => openPage({ type: 'newvalue', cat })));
            section.appendChild(flex);
            list.appendChild(section);
        });
        body.appendChild(list);

        const add = el('input', 'hv-input hv-dashed hv-search');
        add.type = 'text';
        add.placeholder = '+';
        add.setAttribute('aria-label', 'New category');
        add.onchange = () => {
            const text = add.value.trim();
            if (text) change(pack => { pack.categories.add[newCategoryId(text)] = text; });
        };
        body.appendChild(add);
        const gone = allCategories().filter(isCatRemoved);
        if (gone.length) {
            const row = el('div', 'hv-pills');
            gone.forEach(cat => row.appendChild(pill(catTitle(cat), false, () => change(pack => { pack.categories.remove = pack.categories.remove.filter(id => id !== cat); }), 'hv-removed')));
            body.appendChild(row);
        }
    }

    // Removing a category only hides it. The questions of a category that has some can be kept: they are copied into
    // another category, and an answer that leads to them can be added there.
    function removeCategory(cat) {
        const questions = baseTree ? effQuestions(cat) : [];
        const targets = effCategories().filter(c => c !== cat);
        const hide = () => change(pack => { if (!pack.categories.remove.includes(cat)) pack.categories.remove.push(cat); });
        if (!questions.length || !targets.length) { hide(); return; }
        const received = {};
        allValues().forEach(v => { if (v.baseCat === cat && v.cat !== cat && !v.removed && targets.includes(v.cat)) received[v.cat] = (received[v.cat] || 0) + 1; });
        let target = Object.keys(received).sort((a, b) => received[b] - received[a])[0] || targets[0];
        let link = false;
        openModal(box => {
            box.appendChild(el('h2', 'category-title', catTitle(cat)));
            const holder = el('div');
            box.appendChild(holder);
            const draw = () => {
                holder.textContent = '';
                const row = el('div', 'hv-pills');
                const none = pill('', target === null, () => { target = null; draw(); });
                none.innerHTML = HVUI.svg('x');
                none.setAttribute('aria-label', 'Do not keep the questions');
                row.appendChild(none);
                targets.forEach(c => row.appendChild(pill(catTitle(c), c === target, () => { target = c; draw(); })));
                holder.appendChild(row);
                if (target !== null) {
                    const line = el('div', 'hv-form-row');
                    const toggle = HVUI.round('link', 'Add an answer that leads to them', () => { link = !link; draw(); });
                    if (link) toggle.classList.add('hv-on');
                    line.appendChild(toggle);
                    if (link) {
                        const text = el('input', 'hv-input');
                        text.type = 'text';
                        text.value = linkText;
                        text.setAttribute('aria-label', 'Text of the answer');
                        text.oninput = () => { linkText = text.value; };
                        line.appendChild(text);
                    }
                    holder.appendChild(line);
                }
            };
            let linkText = 'More questions';
            draw();
            box.appendChild(actions([textButton('Remove', () => {
                const ok = change(pack => {
                    if (target !== null) {
                        const first = effQuestions(target)[0];
                        questions.forEach(q => storeQuestion(pack, target, q));
                        if (link && first) storeQuestion(pack, target, { id: first.id, text: first.text, options: first.options.concat({ text: linkText.trim() || 'More questions', next: questions[0].id }) });
                    }
                    if (!pack.categories.remove.includes(cat)) pack.categories.remove.push(cat);
                }, false);
                if (ok) { closeModal(); render(); }
            })]));
        });
    }

    // The page of a value (it looks like the description page of a value). With no id it is a new value, which is
    // created when it gets a name.
    function renderValuePage(open) {
        const isNew = open.type === 'newvalue';
        const state = { cat: open.cat, definition: '', icon: null, name: '' };
        const find = () => allValues().find(x => x.id === open.id);
        if (!isNew && !find()) { show({ tab: 'values', open: null }, false); return; }
        const now = () => (isNew ? { id: '', custom: true, baseCat: null, removed: false, name: state.name, definition: state.definition, icon: state.icon, cat: state.cat } : find());
        const save = fields => change(pack => {
            const v = find();
            saveValueFields(pack, v, 'name' in fields ? fields.name : v.name, 'definition' in fields ? fields.definition : v.definition,
                'icon' in fields ? fields.icon : v.icon, 'category' in fields ? fields.category : v.cat);
        }, false);

        const wrap = el('div', 'hv-icon-edit');
        const img = el('img', 'desc-icon');
        img.alt = '';
        const file = el('input', 'hv-hidden-file');
        file.type = 'file';
        file.accept = '.svg,image/svg+xml';
        file.setAttribute('aria-label', 'Picture');
        const refreshIcon = () => { img.style.visibility = ''; img.src = iconSrc(now()); undo.style.display = now().icon ? '' : 'none'; };
        const setIcon = svg => {
            if (isNew) { state.icon = svg; refreshIcon(); } else if (save({ icon: svg })) refreshIcon();
        };
        const choose = () => file.click();
        img.onclick = choose;
        img.onerror = () => { img.style.visibility = 'hidden'; };
        file.onchange = () => {
            const chosen = file.files && file.files[0];
            file.value = '';
            if (chosen) readSvgFile(chosen).then(result => setIcon(result.svg), error => say(error.message, true));
        };
        const undo = HVUI.round('undo', 'Original picture', () => setIcon(null), true);
        const buttons = el('div', 'hv-icon-buttons');
        buttons.appendChild(HVUI.round('image', 'Picture', choose, true));
        buttons.appendChild(undo);
        wrap.appendChild(img);
        wrap.appendChild(buttons);
        body.appendChild(wrap);
        body.appendChild(file);

        const heading = el('h1', 'hv-title');
        heading.style.width = '100%';
        const name = editText(now().name, 'Name', true, (text, node) => {
            if (isNew) {
                state.name = text;
                if (!text) return;
                let newId = null;
                const ok = change(pack => {
                    newId = newValueId(text);
                    const entry = { name: text, definition: definition.value.trim() };
                    if (state.icon) entry.icon = state.icon;
                    (pack.values.add[state.cat] || (pack.values.add[state.cat] = {}))[newId] = entry;
                }, false);
                if (ok) show({ tab: 'values', open: { type: 'value', id: newId } }, false);
            } else if (!text) { node.value = now().name; grow(node); } else if (save({ name: text })) refreshIcon();
        });
        heading.appendChild(name);
        body.appendChild(heading);

        const cats = effCategories().map(cat => ({ id: cat, text: catTitle(cat) }));
        const row = el('div');
        row.style.width = '100%';
        const drawCats = () => {
            row.textContent = '';
            row.appendChild(pills(cats, now().cat, id => {
                if (isNew) state.cat = id; else if (!save({ category: id })) return;
                drawCats();
            }));
        };
        drawCats();
        body.appendChild(row);

        const box = el('div', 'description-box');
        const definition = editText(now().definition, 'Definition', false, text => { if (isNew) state.definition = text; else save({ definition: text }); });
        box.appendChild(definition);
        body.appendChild(box);
        refreshIcon();

        const list = [];
        if (!isNew) {
            const v = find();
            list.push(v.removed
                ? textButton('Restore', () => { change(pack => { pack.values.remove = pack.values.remove.filter(id => id !== v.id); }, false); render(); })
                : textButton('Remove', () => { if (change(pack => { if (!pack.values.remove.includes(v.id)) pack.values.remove.push(v.id); }, false)) goBack(); }));
        }
        list.push(backButton());
        body.appendChild(actions(list));
        if (isNew) setTimeout(() => name.focus(), 0);
    }

    // ---------------------------------------------------------------------------------------------
    // Ideologies: the bubbles of the ideologies page, and a page for each one with its stances
    // ---------------------------------------------------------------------------------------------
    function groupsDatalist() {
        const datalist = el('datalist');
        datalist.id = 'hv-groups';
        groupNames().forEach(name => { const option = document.createElement('option'); option.value = name; datalist.appendChild(option); });
        return datalist;
    }
    function bubble(label, color, onClick, extra) {
        const node = el('a', 'label-bubble' + (extra ? ' ' + extra : ''));
        node.href = '#';
        node.onclick = event => { event.preventDefault(); onClick(); };
        node.style.backgroundColor = color;
        node.style.textDecoration = 'none';
        node.style.fontSize = '1.1rem';
        node.style.margin = '8px';
        node.style.padding = '10px 25px';
        if (label) setName(node, label);
        return node;
    }
    function renderIdeologies() {
        const find = el('input', 'hv-input hv-search');
        find.type = 'text';
        find.placeholder = 'Search';
        find.value = search;
        find.setAttribute('aria-label', 'Search');
        body.appendChild(find);
        const holder = el('div');
        holder.id = 'ideologies-container';
        holder.style.width = '100%';
        body.appendChild(holder);
        const draw = () => {
            holder.textContent = '';
            const query = search.trim().toLowerCase();
            const groups = {};
            groupNames().forEach(name => { groups[name] = []; });
            effLabels().forEach(label => {
                if (query && !shownName(label).toLowerCase().includes(query)) return;
                (groups[effGroup(label)] || (groups[effGroup(label)] = [])).push(label);
            });
            Object.keys(groups).forEach(name => {
                if (!groups[name].length && query) return;
                const section = el('div', 'category-section');
                section.appendChild(el('h2', 'category-title', name));
                const flex = el('div', 'values-flex-container');
                groups[name].forEach(label => {
                    const node = bubble(shownName(label), effColor(label).slice(0, 7), () => openPage({ type: 'ideology', label }), isRemovedLabel(label) ? 'hv-removed' : '');
                    flex.appendChild(node);
                });
                if (!query) {
                    const plus = bubble('', 'transparent', () => openPage({ type: 'newideology', group: name }), 'hv-dashed hv-add-bubble');
                    plus.setAttribute('aria-label', 'Add ideology');
                    flex.appendChild(plus);
                }
                section.appendChild(flex);
                holder.appendChild(section);
            });
            if (!query && !groups.Custom) {
                const section = el('div', 'category-section');
                const flex = el('div', 'values-flex-container');
                const plus = bubble('', 'transparent', () => openPage({ type: 'newideology', group: 'Custom' }), 'hv-dashed hv-add-bubble');
                plus.setAttribute('aria-label', 'Add ideology');
                flex.appendChild(plus);
                section.appendChild(flex);
                holder.appendChild(section);
            }
            fitNames(holder);
        };
        find.oninput = () => { search = find.value; draw(); };
        draw();
    }

    function paintStance(node, stance) {
        const img = node.querySelector('img');
        const text = node.querySelector('.result-agree');
        if (stance === undefined) { node.style.opacity = '0.5'; img.style.boxShadow = ''; text.textContent = ''; return; }
        node.style.opacity = '';
        img.style.boxShadow = '0 0 0 3px var(--bg-color), 0 0 0 6px ' + HV.ringColor(stance);
        text.textContent = HV.signed(stance);
    }
    function openSheet(label, v, current, node, remember) {
        closeSheet();
        node.classList.add('hv-sel');
        sheet = el('div', 'hv-sheet');
        const text = el('p', 'result-text');
        setName(text, v.name);
        sheet.appendChild(text);
        sheet.appendChild(makeSlider(current === undefined ? 0 : current, value => {
            const stance = round2(value);
            paintStance(node, stance === 0 ? undefined : stance);
            remember(stance === 0 ? undefined : stance);
            later(() => change(pack => setStance(pack, label, v.id, stance === 0 ? null : stance), false));
        }));
        sheet.appendChild(HVUI.round('x', 'Close', closeSheet, true));
        document.body.appendChild(sheet);
        document.body.classList.add('hv-has-sheet');
        fitNames(sheet);
    }

    // The page of an ideology; with open.type 'newideology' it is created when it gets a name
    function renderIdeologyPage(open) {
        const isNew = open.type === 'newideology';
        const state = { group: open.group || 'Custom', color: '#2a9d8f', definition: '' };
        let label = open.label;
        const known = () => isNew || effLabels().includes(label);
        if (!known()) { show({ tab: 'ideologies', open: null }, false); return; }
        const removed = !isNew && isRemovedLabel(label);
        const custom = !isNew && isCustomLabel(label);
        const colorNow = () => (isNew ? state.color : effColor(label).slice(0, 7));

        const top = el('div');
        top.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-bottom: 6px;';
        const bubbleNode = el('div', 'label-bubble');
        bubbleNode.style.backgroundColor = colorNow();
        bubbleNode.style.width = 'min(100%, 560px)';
        const name = editText(isNew ? '' : shownName(label), 'Name', true, (text, node) => {
            if (isNew) {
                if (!text) return;
                if (effLabels().some(k => shownName(k) === text)) { say('An ideology with this name already exists.', true); return; }
                const ok = change(pack => {
                    pack.ideologies.add[text] = { group: group.value.trim() || 'Custom', color: state.color, definition: definition.value.trim(), stances: {} };
                }, false);
                if (ok) show({ tab: 'ideologies', open: { type: 'ideology', label: text } }, false);
                return;
            }
            if (!text || text === shownName(label)) { node.value = shownName(label); grow(node); return; }
            if (effLabels().some(k => k !== label && shownName(k) === text)) { say('An ideology with this name already exists.', true); node.value = shownName(label); grow(node); return; }
            if (custom) {
                if (change(pack => { pack.ideologies.add[text] = pack.ideologies.add[label]; delete pack.ideologies.add[label]; }, false)) {
                    label = text;
                    view = { tab: 'ideologies', open: { type: 'ideology', label } };
                    history.replaceState({ view, depth, y: window.scrollY }, '');
                } else node.value = shownName(label);
            } else if (!change(pack => setIdeologyField(pack, label, 'rename', text), false)) node.value = shownName(label);
        });
        name.style.textAlign = 'center';
        name.style.fontWeight = '700';
        bubbleNode.appendChild(name);
        top.appendChild(bubbleNode);
        const swatch = el('span', 'hv-colorwrap');
        swatch.appendChild(HVUI.round('palette', 'Color', null, true));
        const color = el('input');
        color.type = 'color';
        color.value = colorNow();
        color.setAttribute('aria-label', 'Color');
        color.oninput = () => { bubbleNode.style.backgroundColor = color.value; };
        color.onchange = () => {
            if (isNew) state.color = color.value; else if (!change(pack => setIdeologyField(pack, label, 'color', color.value), false)) bubbleNode.style.backgroundColor = colorNow();
        };
        swatch.appendChild(color);
        top.appendChild(swatch);
        body.appendChild(top);

        const row = el('div', 'hv-form-row');
        const group = el('input', 'hv-input');
        group.type = 'text';
        group.value = isNew ? state.group : effGroup(label);
        group.setAttribute('list', 'hv-groups');
        group.setAttribute('aria-label', 'Group');
        group.style.textAlign = 'center';
        group.onchange = () => {
            const text = group.value.trim();
            if (!text) { group.value = isNew ? state.group : effGroup(label); return; }
            if (isNew) state.group = text; else change(pack => setIdeologyField(pack, label, 'group', text), false);
        };
        row.appendChild(group);
        body.appendChild(row);
        body.appendChild(groupsDatalist());

        const box = el('div', 'description-box');
        const definition = editText(isNew ? '' : effDefinition(label), 'Definition', false, text => {
            if (isNew) state.definition = text; else change(pack => setIdeologyField(pack, label, 'definition', text), false);
        });
        box.appendChild(definition);
        body.appendChild(box);

        if (!isNew && !removed) {
            const stances = effStances(label);
            const list = el('div', 'category-list');
            list.id = 'values-container';
            effCategories().forEach(cat => {
                const values = effValues(cat).filter(v => !v.removed);
                if (!values.length) return;
                const section = el('div', 'category-section');
                section.appendChild(el('h2', 'category-title', catTitle(cat)));
                const flex = el('div', 'values-flex-container');
                values.forEach(v => {
                    const node = tile(iconSrc(v), v.name, self => {
                        if (self.classList.contains('hv-sel')) { closeSheet(); return; }
                        openSheet(label, v, stances.get(v.id), self, stance => { if (stance === undefined) stances.delete(v.id); else stances.set(v.id, stance); });
                    });
                    node.appendChild(el('p', 'result-agree'));
                    paintStance(node, stances.get(v.id));
                    flex.appendChild(node);
                });
                section.appendChild(flex);
                list.appendChild(section);
            });
            body.appendChild(list);
        }

        const buttons = [];
        if (!isNew) {
            buttons.push(removed
                ? textButton('Restore', () => { change(pack => { pack.ideologies.remove = pack.ideologies.remove.filter(x => x !== label); }, false); render(); })
                : textButton('Remove', () => { if (change(pack => { if (!pack.ideologies.remove.includes(label)) pack.ideologies.remove.push(label); }, false)) goBack(); }));
        }
        buttons.push(backButton());
        body.appendChild(actions(buttons));
        if (isNew) setTimeout(() => name.focus(), 0);
    }

    // ---------------------------------------------------------------------------------------------
    // Questions: the quiz of a category, played with the pencil. The question and its answers are edited where they
    // stand; an answer leads to another question or to a value, picked from a list.
    // ---------------------------------------------------------------------------------------------
    function firstLiveValue(cat) {
        const live = effValues(cat).filter(v => !v.removed);
        if (live.length) return live[0].id;
        for (const c of effCategories()) { const any = effValues(c).filter(v => !v.removed); if (any.length) return any[0].id; }
        return null;
    }
    function pickTarget(cat, selfId, current, onChoose) {
        openModal(box => {
            const choose = id => { closeModal(); onChoose(id); };
            const list = el('div', 'hv-modal-list');
            const add = el('button', 'hv-dashed hv-plus');
            add.type = 'button';
            add.setAttribute('aria-label', 'New question');
            add.title = 'New question';
            add.onclick = () => choose('__new__');
            list.appendChild(add);
            effQuestions(cat).filter(q => q.id !== selfId).forEach(q => {
                const node = textButton(shorten(q.text, 90), () => choose(q.id));
                if (q.id === current) node.classList.add('hv-on');
                list.appendChild(node);
            });
            box.appendChild(list);
            const lists = el('div', 'category-list');
            effCategories().forEach(c => {
                const values = effValues(c).filter(v => !v.removed);
                if (!values.length) return;
                const section = el('div', 'category-section');
                section.appendChild(el('h2', 'category-title', catTitle(c)));
                const flex = el('div', 'values-flex-container');
                values.forEach(v => flex.appendChild(tile(iconSrc(v), v.name, () => choose(v.id), v.id === current ? 'hv-sel' : '')));
                section.appendChild(flex);
                lists.appendChild(section);
            });
            box.appendChild(lists);
        });
    }
    function targetPill(cat, id, onClick) {
        const node = el('button', 'hv-pill');
        node.type = 'button';
        node.onclick = onClick;
        const q = effQuestions(cat).find(x => x.id === id);
        const v = q ? null : allValues().find(x => x.id === id);
        if (v) {
            const img = el('img', 'hv-qvalue');
            img.alt = '';
            img.src = iconSrc(v);
            node.appendChild(img);
            node.appendChild(document.createTextNode(' ' + v.name));
        } else node.textContent = q ? shorten(q.text, 40) : id;
        return node;
    }
    function reachable(cat) {
        const list = effQuestions(cat);
        const seen = new Set();
        const walk = id => {
            if (seen.has(id)) return;
            const q = list.find(x => x.id === id);
            if (!q) return;
            seen.add(id);
            q.options.forEach(o => walk(o.next));
        };
        if (list.length) walk(list[0].id);
        return seen;
    }

    function renderQuestions() {
        if (!baseTree) return;
        const cats = effCategories();
        if (!cats.length) return;
        if (!cats.includes(qCat)) { qCat = cats[0]; qNode = null; qStack = []; }
        const cat = qCat;
        body.appendChild(pills(cats.map(c => ({ id: c, text: catTitle(c) })), cat, id => { qCat = id; qNode = null; qStack = []; render(); }));

        const questions = effQuestions(cat);
        const part = draft.tree[cat];
        const gone = part ? part.remove.filter(id => baseQuestion(cat, id) || own(part.questions, id)) : [];
        const newQuestion = () => {
            const target = firstLiveValue(cat);
            if (!target) { say('There is no value to lead to.', true); return null; }
            return { id: newQuestionId('question'), text: 'New question', options: [{ text: 'New answer', next: target }] };
        };
        if (!questions.length) {
            body.appendChild(addTile('Add question', () => {
                const q = newQuestion();
                if (q && change(pack => storeQuestion(pack, cat, q), false)) { qNode = q.id; qStack = []; qFocus = 'question'; render(); }
            }));
        } else {
            let q = questions.find(x => x.id === qNode) || questions[0];
            qNode = q.id;
            const isFirst = q.id === questions[0].id;
            const corner = el('div', 'hv-corner');
            const flag = HVUI.round('flag', 'First question', isFirst ? null : () => change(pack => setRoot(pack, cat, q.id)), true);
            if (isFirst) flag.classList.add('hv-on');
            corner.appendChild(flag);
            corner.appendChild(HVUI.round('x', 'Remove question', () => {
                if (change(pack => deleteQuestion(pack, cat, q.id), false)) { qNode = qStack.pop() || null; render(); }
            }, true));
            body.appendChild(corner);

            const holder = el('div', 'question-container');
            const card = el('div');
            card.id = 'question';
            const text = editText(q.text, 'Question', false, (value, node) => {
                if (!value) { node.value = q.text; grow(node); return; }
                updateQuestion(cat, q.id, f => { f.text = value; }, false);
            });
            card.appendChild(text);
            holder.appendChild(card);
            body.appendChild(holder);

            const buttonsBox = el('div', 'hv-edit');
            buttonsBox.id = 'buttons';
            q.options.forEach((option, index) => {
                const wrap = el('div', 'hv-option');
                const answer = el('input', 'hv-input');
                answer.type = 'text';
                answer.value = option.text;
                answer.setAttribute('aria-label', 'Answer');
                if (option.color) answer.style.backgroundColor = option.color;
                answer.onchange = () => {
                    const value = answer.value.trim();
                    if (!value) { answer.value = option.text; return; }
                    updateQuestion(cat, q.id, f => { f.options[index].text = value; }, false);
                };
                answer.onkeydown = event => { if (event.key === 'Enter') answer.blur(); };
                wrap.appendChild(answer);
                const line = el('div', 'hv-option-row');
                line.appendChild(targetPill(cat, option.next, () => pickTarget(cat, q.id, option.next, chosen => {
                    if (chosen !== '__new__') { updateQuestion(cat, q.id, f => { f.options[index].next = chosen; }); return; }
                    const fresh = newQuestion();
                    if (!fresh) return;
                    const ok = change(pack => {
                        storeQuestion(pack, cat, fresh);
                        const parent = effQuestions(cat).find(x => x.id === q.id);
                        parent.options[index].next = fresh.id;
                        storeQuestion(pack, cat, parent);
                    }, false);
                    if (ok) { qStack.push(q.id); qNode = fresh.id; qFocus = 'question'; render(); }
                })));
                if (effQuestions(cat).some(x => x.id === option.next)) {
                    line.appendChild(HVUI.round('go', 'Open', () => { qStack.push(q.id); qNode = option.next; render(); }, true));
                }
                const del = HVUI.round('x', 'Remove answer', () => updateQuestion(cat, q.id, f => { f.options.splice(index, 1); }), true);
                del.disabled = q.options.length <= 1;
                line.appendChild(del);
                wrap.appendChild(line);
                buttonsBox.appendChild(wrap);
            });
            const plus = el('button', 'hv-dashed hv-plus');
            plus.type = 'button';
            plus.setAttribute('aria-label', 'Add answer');
            plus.title = 'Add answer';
            plus.onclick = () => {
                const target = firstLiveValue(cat);
                if (!target) { say('There is no value to lead to.', true); return; }
                qFocus = 'answer';
                updateQuestion(cat, q.id, f => { f.options.push({ text: 'New answer', next: target }); });
            };
            buttonsBox.appendChild(plus);
            body.appendChild(buttonsBox);

            const lost = questions.filter(x => !reachable(cat).has(x.id));
            if (lost.length) {
                const row = el('div', 'hv-pills');
                lost.forEach(x => row.appendChild(pill(shorten(x.text, 40), false, () => { qStack = []; qNode = x.id; render(); })));
                body.appendChild(row);
            }
        }
        if (gone.length) {
            const row = el('div', 'hv-pills');
            gone.forEach(id => {
                const old = baseQuestion(cat, id) || part.questions[id];
                row.appendChild(pill(shorten(old.text, 40), false, () => change(pack => { const p = treePart(pack, cat); p.remove = p.remove.filter(x => x !== id); }), 'hv-removed'));
            });
            body.appendChild(row);
        }
        const bottom = [];
        if (qStack.length) bottom.push(textButton('Back', () => { qNode = qStack.pop(); render(); }));
        bottom.push(doneButton());
        body.appendChild(actions(bottom));
    }

    // ---------------------------------------------------------------------------------------------
    // Pack: its name and four round buttons
    // ---------------------------------------------------------------------------------------------
    function renderPack() {
        const name = el('input', 'hv-input hv-search');
        name.type = 'text';
        name.value = draft.name;
        name.setAttribute('aria-label', 'Name of the pack');
        name.onchange = () => {
            const text = name.value.trim();
            if (!text) { name.value = draft.name; return; }
            change(pack => { pack.name = text; }, false);
        };
        body.appendChild(name);
        const tools = el('div', 'hv-tools');
        tools.appendChild(HVUI.round('export', 'Export', () => HVPack.download(draft)));
        const importButton = HVUI.round('import', 'Import');
        if (HVUI.hasChanges()) HVUI.arm(importButton, 'import', HVUI.importPack); else importButton.onclick = HVUI.importPack;
        tools.appendChild(importButton);
        tools.appendChild(HVUI.round('copy', 'Copy', () => HVUI.copyPack(draft)));
        tools.appendChild(HVUI.round('mine', 'History', () => openModal(box => {
            const list = el('div', 'hv-versions');
            HVX.packs().forEach((entry, index) => {
                const card = el('div', 'hv-card');
                const info = el('a', 'hv-card-main', new Date(entry.t).toLocaleString());
                info.href = '#';
                info.onclick = event => { event.preventDefault(); if (HVX.restorePack(index)) location.reload(); };
                card.appendChild(info);
                list.appendChild(card);
            });
            box.appendChild(list);
        })));
        tools.appendChild(HVUI.arm(HVUI.round('trash', 'Remove all changes'), 'trash', () => { HVX.snapshotPack(true); change(pack => {
            const fresh = HVPack.emptyPack(pack.name);
            Object.keys(fresh).forEach(key => { pack[key] = fresh[key]; });
        }); }));
        body.appendChild(tools);
    }

    // ---------------------------------------------------------------------------------------------
    function renderTabs() {
        TABS.forEach(([key, text]) => {
            const node = textButton(text, () => switchTab(key));
            if (view.tab === key) node.classList.add('hv-on');
            node.setAttribute('role', 'tab');
            node.setAttribute('aria-selected', view.tab === key ? 'true' : 'false');
            tabsHolder.appendChild(node);
        });
    }
    function render() {
        closeModal();
        if (sheet) { sheet.remove(); sheet = null; }
        document.body.classList.remove('hv-has-sheet');
        tabsHolder.textContent = '';
        body.textContent = '';
        const open = view.open;
        titleBox.style.display = open ? 'none' : '';
        if (open) {
            if (open.type === 'value' || open.type === 'newvalue') renderValuePage(open);
            else renderIdeologyPage(open);
        } else {
            renderTabs();
            if (view.tab === 'values') renderValues();
            else if (view.tab === 'ideologies') renderIdeologies();
            else if (view.tab === 'questions') renderQuestions();
            else renderPack();
            if (view.tab !== 'questions') body.appendChild(actions([doneButton()]));
        }
        fitNames(body);
        fitText();
        if (qFocus) {
            const target = qFocus === 'question' ? body.querySelector('#question textarea') : Array.from(body.querySelectorAll('.hv-option input')).pop();
            qFocus = null;
            if (target) { target.focus(); target.select(); }
        }
    }
    render();
    HVPack.fetchBaseTree().then(tree => { baseTree = tree; if (view.tab === 'questions' && !view.open) render(); }, () => { baseTreeFailed = true; say('The questions could not be loaded.', true); });
})();
