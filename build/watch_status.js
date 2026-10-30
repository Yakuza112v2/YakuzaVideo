function yvInstallWatchStatus() {
    if (window.__yvWatchStatusInstalled) return;
    window.__yvWatchStatusInstalled = true;
    const watched = new Map(), positions = new Map();
    window.__yvWatchStatus = {percent: id => watched.get(id)};
    let storageKey, saveTimer, activeVideoId, resumeAttempted = false;
    let client, identityService, accountKey, accountGeneration = 0, fetching = false, renderTimer, lastFetch = 0;
    function onWatchPage() {return /^#\/watch\?/.test(location.hash || '');}
    function percentOf(card) {
        let percent = null;
        function scan(value) {
            if (!value || typeof value !== 'object') return;
            for (const [key, child] of Object.entries(value)) {
                if (['percentDurationWatched', 'startPercent'].includes(key) && typeof child === 'number') percent = Math.max(percent || 0, Math.min(100, Math.max(0, child)));
                else scan(child);
            }
        }
        scan(card.header || card.contentImage);
        return percent;
    }
    function remember(id, percent) {
        if (!/^[A-Za-z0-9_-]{11}$/.test(id || '') || percent === null || !Number.isFinite(percent)) return;
        const previous = watched.get(id);
        watched.set(id, Math.max(previous === undefined ? 0 : previous, Math.min(100, Math.max(0, percent))));
    }
    function savePositions() {
        if (!storageKey) return;
        try {localStorage.setItem(storageKey, JSON.stringify(Array.from(positions).slice(-1000)));} catch (error) {}
    }
    function queueSave() {if (!saveTimer) saveTimer = setTimeout(() => {saveTimer = null; savePositions();}, 1000);}
    function selectAccount(identity) {
        const key = identity && [identity.ownerObfuscatedGaiaId, identity.effectiveObfuscatedGaiaId].join(':');
        if (accountKey === key && storageKey) return;
        savePositions(); watched.clear(); positions.clear();
        accountKey = key; accountGeneration++; activeVideoId = null; resumeAttempted = false;
        storageKey = 'yakuzavideo.playback.v1:' + (key || 'signed-out');
        try {
            const entries = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (Array.isArray(entries)) for (const [id, state] of entries) {
                if (/^[A-Za-z0-9_-]{11}$/.test(id) && state && Number.isFinite(state.seconds) && state.seconds >= 0 && Number.isFinite(state.percent)) {
                    positions.set(id, state); remember(id, state.percent);
                }
            }
        } catch (error) {}
        scheduleRender();
    }
    function applyPosition(command, id, seconds) {
        if (!command || typeof command !== 'object') return;
        if (command.watchEndpoint && command.watchEndpoint.videoId === id) command.watchEndpoint.startTimeSeconds = Math.floor(seconds);
        // Feedback parameters contain copies of whole cards; only visit executable wrappers.
        for (const key of ['navigationEndpoint', 'command', 'innertubeCommand', 'commandExecutorCommand']) {
            if (command[key]) applyPosition(command[key], id, seconds);
        }
        if (Array.isArray(command.commands)) for (const child of command.commands) applyPosition(child, id, seconds);
    }
    function render() {
        renderTimer = null;
        for (const tile of document.querySelectorAll('ytlr-tile-renderer')) {
            const card = tile.data || (tile.__instance && tile.__instance.props && tile.__instance.props.data);
            const obsolete = tile.querySelector('.yakuzavideo-watch-status'); if (obsolete) obsolete.remove();
            let bar = tile.querySelector('.yakuzavideo-watch-progress');
            if (!card || card.contentType !== 'TILE_CONTENT_TYPE_VIDEO') {if (bar) bar.remove(); continue;}
            const nativePercent = percentOf(card);
            if (nativePercent !== null) remember(card.contentId, nativePercent);
            const state = positions.get(card.contentId);
            if (state) {
                const seconds = state.percent >= 100 ? 0 : state.seconds;
                applyPosition(card.onSelectCommand, card.contentId, seconds);
                const menu = card.onLongPressCommand && card.onLongPressCommand.showMenuCommand && card.onLongPressCommand.showMenuCommand.menu;
                const items = menu && menu.menuRenderer && menu.menuRenderer.items || [];
                for (const item of items) if (item.menuNavigationItemRenderer) applyPosition(item.menuNavigationItemRenderer, card.contentId, seconds);
            }
            const percent = watched.get(card.contentId);
            const header = tile.querySelector('ytlr-tile-header-renderer');
            if (!header || percent === undefined || percent <= 0) {if (bar) bar.remove(); continue;}
            if (!bar) {
                bar = document.createElement('div'); bar.className = 'yakuzavideo-watch-progress';
                Object.assign(bar.style, {position: 'absolute', bottom: '0', left: '0', right: '0', height: '0.3em', zIndex: '5', backgroundColor: 'rgba(255,255,255,0.4)', pointerEvents: 'none'});
                const fill = document.createElement('div'); fill.className = 'yakuzavideo-watch-progress-fill';
                Object.assign(fill.style, {height: '100%', backgroundColor: '#ff0033', minWidth: '2px'});
                bar.appendChild(fill); header.style.position = 'relative'; header.appendChild(bar);
                bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
            }
            bar.firstChild.style.width = percent + '%';
            bar.setAttribute('aria-valuenow', String(Math.round(percent)));
            bar.setAttribute('aria-label', percent >= 100 ? 'Angesehen' : 'Wiedergabefortschritt');
        }
    }
    function scheduleRender() {if (!renderTimer) renderTimer = setTimeout(render, 0);}
    function historyPage(response) {
        function scan(value) {
            if (!value || typeof value !== 'object') return;
            const card = value.tileRenderer || value.lockupViewModel;
            if (card && typeof card.contentId === 'string') {
                const percent = percentOf(card), previous = positions.get(card.contentId);
                const endpoint = card.onSelectCommand && card.onSelectCommand.watchEndpoint;
                const seconds = endpoint && Number(endpoint.startTimeSeconds);
                remember(card.contentId, percent);
                // A delayed history response must not undo a position just recorded on this device.
                if ((!previous || Date.now() - previous.updated > 120000) && (Number.isFinite(seconds) || percent >= 100)) {
                    positions.set(card.contentId, {seconds: percent >= 100 ? 0 : seconds, percent: percent || 0, updated: 0});
                    queueSave();
                }
                return;
            }
            for (const child of Object.values(value)) scan(child);
        }
        scan(response); window.__yvWatchHistorySize = watched.size; scheduleRender();
        const contents = response && response.contents;
        const surface = contents && contents.tvBrowseRenderer && contents.tvBrowseRenderer.content && contents.tvBrowseRenderer.content.tvSurfaceContentRenderer;
        const continuationContents = response && response.continuationContents;
        const container = continuationContents && (continuationContents.sectionListContinuation || continuationContents.gridContinuation || continuationContents.horizontalListContinuation) ||
            surface && surface.content && (surface.content.sectionListRenderer || surface.content.gridRenderer);
        const next = container && container.continuations && container.continuations.find(item => item.nextContinuationData);
        return next && next.nextContinuationData.continuation;
    }
    function fetchHistory(force) {
        if (!client || fetching || onWatchPage() || (!force && Date.now() - lastFetch < 15000)) return;
        fetching = true; lastFetch = Date.now();
        let pages = 0, timeout, subscription, finished = false, generation;
        function finish() {if (finished) return; finished = true; clearTimeout(timeout); if (subscription && subscription.unsubscribe) subscription.unsubscribe(); fetching = false;}
        function page(payload) {
            clearTimeout(timeout);
            timeout = setTimeout(finish, 10000);
            try {
                subscription = client.fetch({path: '/youtubei/v1/browse', payload}).subscribe(response => {
                    if (finished) return;
                    if (generation !== accountGeneration) {finish(); fetchHistory(true); return;}
                    clearTimeout(timeout);
                    const next = historyPage(response);
                    if (next && ++pages < 8) page({continuation: next}); else finish();
                }, finish);
                if (finished && subscription && subscription.unsubscribe) subscription.unsubscribe();
            } catch (error) {finish();}
        }
        function start(identity) {
            if (finished) return;
            selectAccount(identity);
            generation = accountGeneration;
            page({browseId: 'FEhistory'});
        }
        timeout = setTimeout(finish, 10000);
        if (identityService) Promise.resolve().then(() => identityService.get()).then(start, finish); else start(null);
    }
    function watchId() {const match = /[?&]v=([A-Za-z0-9_-]{11})(?:&|$)/.exec(location.hash || ''); return onWatchPage() && match ? match[1] : null;}
    function restorePlayback(event) {
        const id = watchId(), video = event.target;
        if (!id || !video || video.tagName !== 'VIDEO' || video.closest && video.closest('ytlr-playback-preview')) return false;
        if (activeVideoId !== id) {activeVideoId = id; resumeAttempted = false;}
        if (resumeAttempted || !Number.isFinite(video.duration) || video.duration <= 0) return false;
        const state = positions.get(id);
        if (video.readyState < 1) return false;
        resumeAttempted = true;
        if (state && state.percent < 100 && state.seconds >= 5 && state.seconds < video.duration - 2 && video.currentTime < state.seconds - 2) {
            try {video.currentTime = state.seconds; return true;} catch (error) {resumeAttempted = false;}
        }
        return false;
    }
    function recordPlayback(event) {
        if (!onWatchPage()) return; // Home previews must never mark videos as watched.
        const video = event.target, id = watchId();
        if (!id || !video || video.tagName !== 'VIDEO' || video.closest && video.closest('ytlr-playback-preview')) return;
        if (restorePlayback(event)) return;
        if (!Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime < 5) return;
        const percent = event.type === 'ended' ? 100 : Math.min(99, video.currentTime / video.duration * 100);
        remember(id, percent);
        positions.set(id, {seconds: event.type === 'ended' ? 0 : video.currentTime, percent, updated: Date.now()});
        queueSave(); scheduleRender();
    }
    for (const type of ['loadedmetadata', 'durationchange', 'canplay']) document.addEventListener(type, restorePlayback, true);
    for (const type of ['timeupdate', 'pause', 'ended']) document.addEventListener(type, recordPlayback, true);
    window.addEventListener('hashchange', () => {activeVideoId = null; resumeAttempted = false; savePositions(); scheduleRender(); if (!onWatchPage()) setTimeout(() => fetchHistory(true), 1500);});
    window.addEventListener('pagehide', savePositions);
    let observedBody;
    function observeBody() {if (document.body && document.body !== observedBody) {observedBody = document.body; new MutationObserver(scheduleRender).observe(document.body, {subtree: true, childList: true});} scheduleRender();}
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeBody, {once:true});
    observeBody();
    let checkingIdentity = false;
    async function checkIdentity() {
        if (identityService && !checkingIdentity) {
            checkingIdentity = true;
            try {const identity = await identityService.get(); const previous = accountKey; selectAccount(identity); if (previous !== accountKey && !onWatchPage()) fetchHistory(true);} catch (error) {} finally {checkingIdentity = false;}
        }
        setTimeout(checkIdentity, 2000);
    }
    checkIdentity();
    let attempts = 0;
    function attach() {
        for (const service of Object.values(window._yttv || {})) {
            if (!service || !service.mappings || typeof service.get !== 'function') continue;
            try {const candidate = service.get('KabukiInnerTubeClient'); if (candidate && candidate.fetch) client = candidate;} catch (error) {}
            try {const candidate = service.get('CurrentIdentityService'); if (candidate && candidate.get) identityService = candidate;} catch (error) {}
        }
        if (client) {fetchHistory(true); render();}
        else if (++attempts < 100) setTimeout(attach, 200);
    }
    attach();
}
