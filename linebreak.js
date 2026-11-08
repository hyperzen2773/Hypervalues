/*
 * Line breaks for long names, like the original: a line breaks between words or at a hyphen whenever that is
 * enough. Only a word that cannot fit on a line by itself is broken inside, at a syllable or suffix, with no "-"
 * added (e.g. "ROMANTIC" / "NATIONALISM", but "ENVIRONMENTAL" / "ISM" in a very narrow column).
 *
 * Use setName(element, "Name") to put a name in an element, then fitNames() (also runs on load, resize and when
 * the fonts are ready) adds invisible break points (zero-width spaces) to the words that need them.
 */
(function () {
    const BREAK = '\u200B';
    const MIN_WORD = 8;   // shorter words are never split
    const MIN_CHUNK = 3;  // at least this many letters on each side of a break
    const SUFFIXES = [
        'ianism', 'ations', 'ation', 'ologies', 'ology', 'isms', 'ism',
        'ists', 'ist', 'ities', 'ity', 'ments', 'ment', 'ness', 'ian', 'ical', 'ship'
    ];
    const DIGRAPHS = ['th', 'ch', 'sh', 'ph', 'gh', 'ck', 'ng', 'qu', 'wh'];
    const isVowel = ch => 'aeiouy'.indexOf(ch) !== -1;
    const isLetter = ch => ch >= 'a' && ch <= 'z';

    function breakPoints(word) {
        const w = word.toLowerCase();
        const n = w.length;
        const candidates = new Set();
        let suffixAt = -1;

        for (const s of SUFFIXES) {
            if (w.endsWith(s) && n - s.length >= MIN_CHUNK + 1) {
                suffixAt = n - s.length;
                break;
            }
        }

        // Syllable-style breaks: V-CV and VC-CV (digraphs and stop+l/r clusters stay together)
        for (let i = MIN_CHUNK; i <= n - MIN_CHUNK; i++) {
            const a = w[i - 1], b = w[i], c = w[i + 1], d = w[i + 2];
            if (!isLetter(a) || !isLetter(b)) continue;
            if (isVowel(a) && !isVowel(b) && c && isVowel(c)) {
                candidates.add(i);
            } else if (isVowel(a) && !isVowel(b) && c && isLetter(c) && !isVowel(c) && d && isVowel(d)) {
                const pair = b + c;
                const together = DIGRAPHS.indexOf(pair) !== -1 || ('bcdfgpt'.indexOf(b) !== -1 && 'lr'.indexOf(c) !== -1);
                candidates.add(together ? i : i + 1);
            }
        }

        const accepted = [];
        if (suffixAt !== -1) accepted.push(suffixAt);
        Array.from(candidates).sort((x, y) => x - y).forEach(i => {
            if (i < MIN_CHUNK || n - i < MIN_CHUNK) return;
            if (accepted.some(p => Math.abs(p - i) < MIN_CHUNK)) return;
            accepted.push(i);
        });
        return accepted.sort((x, y) => x - y);
    }

    function insertBreaks(word) {
        if (word.length < MIN_WORD) return word;
        let out = '', last = 0;
        breakPoints(word).forEach(p => {
            out += word.slice(last, p) + BREAK;
            last = p;
        });
        return out + word.slice(last);
    }

    let context = null;
    function textWidth(el, text) {
        const cs = getComputedStyle(el);
        context = context || document.createElement('canvas').getContext('2d');
        context.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const shown = cs.textTransform === 'uppercase' ? text.toUpperCase() : text;
        return context.measureText(shown).width + (parseFloat(cs.letterSpacing) || 0) * shown.length;
    }

    // Width one line of the element's text can use
    function availableWidth(el) {
        const px = v => parseFloat(v) || 0;
        const cs = getComputedStyle(el);
        if (el.classList.contains('result-text')) {
            return el.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
        }
        const box = el.closest('.closest-pill, .label-bubble') || el;
        const parent = box.parentElement;
        if (!parent) return 0;
        const bs = getComputedStyle(box);
        const ps = getComputedStyle(parent);
        let room = parent.clientWidth - px(ps.paddingLeft) - px(ps.paddingRight);
        if (/%$/.test(bs.maxWidth)) room *= parseFloat(bs.maxWidth) / 100;
        return room - px(bs.marginLeft) - px(bs.marginRight) - px(bs.paddingLeft) - px(bs.paddingRight) -
            px(bs.borderLeftWidth) - px(bs.borderRightWidth);
    }

    function fitElement(el) {
        const original = el.dataset.name;
        const limit = availableWidth(el);
        if (!(limit > 0)) return;
        const pieces = original.match(/[^\s-]+[\s-]*/g) || [original];
        const out = pieces.map(piece => {
            const word = piece.match(/^[^\s-]+/)[0];
            const tail = piece.slice(word.length);
            const shown = tail.indexOf('-') !== -1 ? word + '-' : word;
            return textWidth(el, shown) <= limit - 1 ? piece : insertBreaks(word) + tail;
        }).join('');
        if (el.textContent !== out) el.textContent = out;
    }

    window.setName = function (el, name) {
        el.dataset.name = name;
        el.textContent = name;
    };

    window.fitNames = function (root) {
        (root || document).querySelectorAll('[data-name]').forEach(fitElement);
    };

    let pending = false;
    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; window.fitNames(); });
    }
    document.addEventListener('DOMContentLoaded', () => window.fitNames());
    window.addEventListener('load', () => window.fitNames());
    window.addEventListener('resize', schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => window.fitNames());
})();
