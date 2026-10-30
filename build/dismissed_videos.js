function yvInstallDismissedVideos() {
    if (window.__yvDismissedVideos) return;
    let activeScope, blocked = new Set(), timer, checking = false, refreshTimer;
    const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
    const keyFor = scope => 'yakuzavideo.dismissed.v1:' + scope;
    function read(scope) {
        try {const values = JSON.parse(localStorage.getItem(keyFor(scope)) || '[]'); return new Set(Array.isArray(values) ? values.filter(validId) : []);} catch (error) {return new Set();}
    }
    function home() {
        const route = (location.hash || '').replace(/^#/, '');
        return route === '' || route === '/' || /^\/browse\?(?:.*&)?(?:c|browseId)=FE(?:topics|what_to_watch)(?:&|$)/.test(route);
    }
    function blockedEntry(value) {
        if (!value || typeof value !== 'object') return false;
        const card = value.tileRenderer || value.lockupViewModel;
        return !!(card && blocked.has(card.contentId) && (!card.contentType || card.contentType === 'TILE_CONTENT_TYPE_VIDEO'));
    }
    function prune(value, seen = new WeakSet()) {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) {
            for (let i = value.length - 1; i >= 0; i--) {if (blockedEntry(value[i])) value.splice(i, 1); else prune(value[i], seen);}
        } else for (const [key, child] of Object.entries(value)) {
            // Feedback parameters contain copies of cards, not recommendation lists.
            if (!['onLongPressCommand', 'metadata', 'header', 'rendererContext'].includes(key)) prune(child, seen);
        }
    }
    function filter(response) {
        if (!response || typeof response !== 'object' || !blocked.size) return;
        const seen = new WeakSet();
        function scan(value) {
            if (!value || typeof value !== 'object' || seen.has(value)) return;
            seen.add(value);
            if (['browse-feedFEtopics', 'browse-feedFEwhat_to_watch'].includes(value.targetId)) {prune(value); return;}
            for (const child of Object.values(value)) scan(child);
        }
        // Do not filter ambiguous continuation responses: history is fetched on Home too.
        // Once attached to a Home surface they are filtered by render instead.
        scan(response);
    }
    function render() {
        timer = null;
        const onHome = home();
        for (const root of document.querySelectorAll('ytlr-tv-surface-content-renderer')) {
            const data = root.data;
            if (onHome && data && ['browse-feedFEtopics', 'browse-feedFEwhat_to_watch'].includes(data.targetId)) prune(data.content);
        }
        for (const tile of document.querySelectorAll('ytlr-tile-renderer')) {
            const card = tile.data || tile.__instance && tile.__instance.props && tile.__instance.props.data;
            if (!card || card.contentType !== 'TILE_CONTENT_TYPE_VIDEO') continue;
            if (onHome && blocked.has(card.contentId)) {
                if (!tile.__yvDismissed) tile.__yvDismissed = {display: tile.style.display, aria: tile.getAttribute('aria-hidden')};
                tile.style.display = 'none'; tile.setAttribute('aria-hidden', 'true');
            } else if (tile.__yvDismissed) {
                tile.style.display = tile.__yvDismissed.display;
                if (tile.__yvDismissed.aria === null) tile.removeAttribute('aria-hidden'); else tile.setAttribute('aria-hidden', tile.__yvDismissed.aria);
                delete tile.__yvDismissed;
            }
        }
    }
    function schedule() {if (!timer) timer = setTimeout(render, 0);}
    async function context() {
        let identityService;
        for (const registry of Object.values(window._yttv || {})) {
            if (!registry || !registry.mappings || typeof registry.get !== 'function') continue;
            try {const service = registry.get('CurrentIdentityService'); if (service && service.get) {identityService = service; break;}} catch (error) {}
        }
        if (!identityService) throw new Error('Profile unavailable');
        const identity = await identityService.get();
        const scope = identity && [identity.ownerObfuscatedGaiaId, identity.effectiveObfuscatedGaiaId].join(':') || 'signed-out';
        if (scope !== activeScope) {activeScope = scope; blocked = read(scope); schedule();}
        return scope;
    }
    function add(id, scope) {
        if (!validId(id) || !scope) return false;
        const values = read(scope); values.add(id);
        let persisted = true;
        try {localStorage.setItem(keyFor(scope), JSON.stringify(Array.from(values)));} catch (error) {persisted = false;}
        if (scope === activeScope) {blocked.add(id); render();}
        return persisted;
    }
    function refresh(scope) {
        if (refreshTimer || scope && scope !== activeScope) return;
        let attempts = 0;
        function poll() {
            refreshTimer = null;
            if (!home() || scope && scope !== activeScope || ++attempts > 240) return;
            // The user owns the open reason dialog: never close it to refresh Home.
            if (document.querySelector('ytlr-overlay-panel-renderer, ytlr-menu-renderer')) {refreshTimer = setTimeout(poll, 500); return;}
            const command = yvHomeRefreshCommand();
            if (command) po(command);
        }
        refreshTimer = setTimeout(poll, 500);
    }
    window.__yvDismissedVideos = {context, add, filter, render, refresh};
    if (document.body) new MutationObserver(schedule).observe(document.body, {subtree: true, childList: true});
    window.addEventListener('hashchange', schedule);
    async function checkProfile() {
        if (!checking) {
            checking = true;
            try {await context();} catch (error) {} finally {checking = false;}
        }
        setTimeout(checkProfile, 2000);
    }
    checkProfile();
}
