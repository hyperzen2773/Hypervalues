/*
 * Line-break points for long names.
 * Inserts invisible zero-width spaces (U+200B) at syllable and suffix boundaries inside long
 * words, so a word that does not fit is broken there (e.g. "ENVIRONMENTAL" / "ISM") and no
 * "-" is added, like the original. Real hyphens ("Social-Progressivism") stay as they are and
 * are break points too. Short words are left alone, and words only break when they do not fit.
 */
(function () {
    const BREAK = '\u200B';
    const MIN_WORD = 8;   // shorter words are never split
    const MIN_CHUNK = 3;  // at least this many letters on each side of a hyphen
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

        const sorted = Array.from(candidates).sort((x, y) => x - y);
        const accepted = [];
        if (suffixAt !== -1) accepted.push(suffixAt);
        for (const i of sorted) {
            if (i < MIN_CHUNK || n - i < MIN_CHUNK) continue;
            if (accepted.some(p => Math.abs(p - i) < MIN_CHUNK)) continue;
            accepted.push(i);
        }
        return accepted.sort((x, y) => x - y);
    }

    function hyphenateWord(word) {
        if (word.length < MIN_WORD || /\u200B/.test(word)) return word;
        const points = breakPoints(word);
        if (!points.length) return word;
        let out = '', last = 0;
        for (const p of points) {
            out += word.slice(last, p) + BREAK;
            last = p;
        }
        return out + word.slice(last);
    }

    // Works word by word, so spaces and real hyphens ("Anarcho-Communism") are left untouched
    window.softBreak = function (text) {
        return String(text).replace(/[A-Za-z]+/g, hyphenateWord);
    };
})();
