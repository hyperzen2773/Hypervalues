// Small parts shared by the pages of Custom Pages (the results page and the editor): round icon buttons, a short
// message, a button that needs a second tap, and importing a pack file. Needs pack.js.
const HVUI = (function () {
    const ICONS = {
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        import: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
        export: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 20h16"/>',
        copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
        trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 14h10l1-14"/>',
        check: '<path d="m5 12 5 5L20 7"/>',
        x: '<path d="M6 6l12 12M18 6 6 18"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        go: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
        flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
        image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
        undo: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
        back: '<path d="m15 5-7 7 7 7"/>',
        palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.4-2.1-.6-1.2.1-2.4 1.5-2.4H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="11" r="1"/>',
        why: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        compare: '<path d="M7 7h13"/><path d="m16 3 4 4-4 4"/><path d="M17 17H4"/><path d="m8 13-4 4 4 4"/>',
        map: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
        tension: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
        lens: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
        mine: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        start: '<path d="m7 4 13 8-13 8Z"/>',
        me: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        tag: '<path d="M3 12 12 3h9v9l-9 9Z"/><circle cx="16.5" cy="7.5" r="1"/>',
        radar: '<path d="m12 3 8 6-3 10H7L4 9Z"/>',
        cube: '<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
        save: '<path d="M5 3h12l2 2v16H5Z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
        minus: '<path d="M5 12h14"/>',
        browse: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        questions: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><path d="M12 17h.01"/>'
    };
    function svg(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
    // a round button with an icon; the words are only for screen readers and the tooltip
    function round(name, label, onClick, small) {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'hv-round' + (small ? ' hv-small' : '');
        node.innerHTML = svg(name);
        node.setAttribute('aria-label', label);
        node.title = label;
        if (onClick) node.onclick = onClick;
        return node;
    }
    function setIcon(node, name) { node.innerHTML = svg(name); }

    let toastNode = null, toastTimer = 0;
    // a short message (a mistake, in red); it goes away by itself
    function toast(message, bad) {
        if (!toastNode) {
            toastNode = document.createElement('div');
            toastNode.setAttribute('role', 'status');
            toastNode.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastNode);
        }
        toastNode.className = 'hv-toast' + (bad ? ' hv-bad' : '');
        toastNode.textContent = message;
        toastNode.style.display = '';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastNode.style.display = 'none'; }, bad ? 5000 : 2500);
    }

    // a button that does its action on the second tap (the icon turns into a check mark in between)
    function arm(node, name, action) {
        let timer = 0;
        node.addEventListener('click', event => {
            if (node.classList.contains('hv-armed')) {
                clearTimeout(timer);
                node.classList.remove('hv-armed');
                setIcon(node, name);
                return;       // the action below runs from this same click
            }
            event.stopImmediatePropagation();
            node.classList.add('hv-armed');
            setIcon(node, 'check');
            timer = setTimeout(() => { node.classList.remove('hv-armed'); setIcon(node, name); }, 3000);
        }, true);
        node.addEventListener('click', action);
        return node;
    }

    // asks for a pack file, checks it and saves it as the pack in use (then the page is loaded again)
    function importPack() {
        const file = document.createElement('input');
        file.type = 'file';
        file.accept = '.json,application/json';
        file.onchange = () => {
            const chosen = file.files && file.files[0];
            if (!chosen) return;
            const reader = new FileReader();
            reader.onerror = () => toast('The file could not be read.', true);
            reader.onload = () => {
                const result = HVPack.parseText(String(reader.result));
                if (result.errors.length) { toast(result.errors[0], true); return; }
                if (typeof HVX !== 'undefined') HVX.snapshotPack(true);
                if (!HVPack.savePack(result.pack)) { toast('The pack could not be saved in this browser.', true); return; }
                location.reload();
            };
            reader.readAsText(chosen);
        };
        file.click();
    }
    // true when the pack in use has changes that an import would replace
    function hasChanges() {
        const stored = HVPack.storedPack();
        return !!stored && HVPack.summary(stored) !== 'no changes';
    }
    function copyPack(pack) {
        if (!pack) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(HVPack.text(pack)).then(() => toast('\u2713'), () => toast('This browser did not allow copying.', true));
        } else {
            toast('This browser did not allow copying.', true);
        }
    }
    return { svg, round, setIcon, toast, arm, importPack, hasChanges, copyPack };
})();
