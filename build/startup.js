(function () {
    if (window.__yakuzaVideoIntroShown) return;
    window.__yakuzaVideoIntroShown = true;
    function showIntro() {
        const root = document.documentElement;
        if (!root) return;
        const overlay = document.createElement('div');
        overlay.id = 'yakuzavideo-startup';
        overlay.setAttribute('role', 'img');
        overlay.setAttribute('aria-label', 'YakuzaVideo wird gestartet');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#080808;display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity 300ms ease;';
        const style = document.createElement('style');
        style.textContent = '@keyframes yvLogoEnter{from{transform:scale(.88)}to{transform:scale(1)}}@keyframes yvLogoPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(255,0,45,0))}50%{filter:drop-shadow(0 0 22px rgba(255,0,45,.28))}}@keyframes yvWordmarkEnter{from{transform:translateY(8px);opacity:.65}to{transform:translateY(0);opacity:1}}#yakuzavideo-startup .yv-lockup{display:flex;align-items:center;justify-content:center;gap:3vw;padding:5vw}#yakuzavideo-startup img{width:24vmin;max-width:320px;min-width:100px;height:auto;animation:yvLogoEnter 500ms ease-out both,yvLogoPulse 1800ms ease-in-out 500ms infinite}#yakuzavideo-startup strong{font-family:Arial,sans-serif;font-size:6vw;font-weight:700;color:#fff;letter-spacing:-.04em;white-space:nowrap;animation:yvWordmarkEnter 600ms ease-out both}@media(prefers-reduced-motion:reduce){#yakuzavideo-startup img,#yakuzavideo-startup strong{animation:none}}';
        overlay.appendChild(style);
        const lockup = document.createElement('div');
        lockup.className = 'yv-lockup';
        const logo = document.createElement('img');
        logo.alt = '';
        const title = document.createElement('strong');
        title.textContent = 'YakuzaVideo';
        lockup.appendChild(logo); lockup.appendChild(title); overlay.appendChild(lockup);
        root.appendChild(overlay);
        let finished = false, started = false, timer;
        function blockInput(event) {
            if ([8, 27, 461].includes(event.keyCode)) return;
            event.preventDefault(); event.stopImmediatePropagation();
        }
        for (const type of ['keydown', 'keypress', 'keyup']) window.addEventListener(type, blockInput, true);
        function removeIntro() {
            if (finished) return;
            finished = true;
            for (const type of ['keydown', 'keypress', 'keyup']) window.removeEventListener(type, blockInput, true);
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
        function logoReady() {
            if (started) return;
            started = true;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                // Start the minimum display time after the logo has loaded and painted.
                timer = setTimeout(removeIntro, 3200);
            }));
        }
        logo.onload = logoReady;
        logo.onerror = logoReady;
        logo.src = 'data:image/png;base64,__YAKUZAVIDEO_LOGO_BASE64__';
        if (logo.complete) logoReady();
    }
    if (document.documentElement) showIntro();
    else document.addEventListener('DOMContentLoaded', showIntro, {once: true});
})();
