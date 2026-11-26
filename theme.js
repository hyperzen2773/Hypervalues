(function () {
    const savedTheme = localStorage.getItem('nv_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('nv_theme', newTheme);
}

window.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.theme-toggle-corner')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'theme-toggle-corner';
        toggleBtn.setAttribute('onclick', 'toggleTheme()');
        toggleBtn.setAttribute('aria-label', 'Toggle light/dark mode');
        toggleBtn.innerHTML = `
            <svg width="80" height="80" viewBox="0 0 250 250" aria-hidden="true">
                <path d="M0,0 L250,250 L250,0 Z"></path>
                <!-- Sun Icon (visible in dark mode) -->
                <g class="icon-sun" transform="translate(142, 52) scale(2.2)">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
                </g>
                <!-- Moon Icon (visible in light mode) -->
                <g class="icon-moon" transform="translate(142, 52) scale(2.2)">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </g>
            </svg>
        `;
        document.body.prepend(toggleBtn);
    }
});

// Keyboard: a link that skips to the page (shown only when focused), and in the quiz 1-9 pick an answer and
// Backspace or the left arrow go back
window.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('.main-container');
    if (main && !document.querySelector('.hv-skip')) {
        const skip = document.createElement('a');
        skip.className = 'hv-skip';
        skip.href = '#';
        skip.textContent = 'Skip';
        skip.onclick = event => { event.preventDefault(); main.setAttribute('tabindex', '-1'); main.focus(); };
        document.body.prepend(skip);
    }
});
window.addEventListener('keydown', event => {
    const buttons = document.getElementById('buttons');
    if (!buttons || !document.getElementById('question') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((event.target && event.target.tagName) || '')) return;
    const list = buttons.querySelectorAll('button');
    if (!list.length) return;
    if (/^[1-9]$/.test(event.key) && list[Number(event.key) - 1] && list.length > Number(event.key)) list[Number(event.key) - 1].click();
    else if (event.key === 'Backspace' || event.key === 'ArrowLeft') { event.preventDefault(); list[list.length - 1].click(); }
});
