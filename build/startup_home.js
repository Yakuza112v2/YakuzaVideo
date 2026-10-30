function yvElementVisible(element) {
    if (!element || element.hidden || element.getAttribute && element.getAttribute('aria-hidden') === 'true') return false;
    if (element.closest && element.closest('[hidden], [aria-hidden="true"]')) return false;
    if (typeof element.getClientRects === 'function' && !element.getClientRects().length) return false;
    if (typeof getComputedStyle === 'function') {const style = getComputedStyle(element); if (style.display === 'none' || style.visibility === 'hidden') return false;}
    return true;
}
function yvHasOpenDialog() {
    return Array.from(document.querySelectorAll('ytlr-overlay-panel-renderer, ytlr-menu-renderer')).some(yvElementVisible);
}
function yvHomeSurface() {
    return Array.from(document.querySelectorAll('ytlr-tv-surface-content-renderer')).find(element => {
        const data = element.data || element.__instance && element.__instance.props && element.__instance.props.data;
        return yvElementVisible(element) && data && ['browse-feedFEtopics', 'browse-feedFEwhat_to_watch'].includes(data.targetId);
    });
}
function yvObserveStartupBrowse(response) {
    const seen = new WeakSet();
    function scan(value) {
        if (!value || typeof value !== 'object' || seen.has(value)) return false;
        seen.add(value);
        if (['browse-feedFEtopics', 'browse-feedFEwhat_to_watch'].includes(value.targetId)) return true;
        return Object.values(value).some(scan);
    }
    if (scan(response)) window.__yvHomeResponseSerial = (window.__yvHomeResponseSerial || 0) + 1;
}
function yvHomeRefreshCommand() {
    const element = yvHomeSurface();
    if (element) {
        const data = element.data || element.__instance && element.__instance.props && element.__instance.props.data;
        const seen = new WeakSet();
        function scan(value) {
            if (!value || typeof value !== 'object' || seen.has(value)) return null;
            seen.add(value);
            const button = value.gridButtonRenderer;
            const command = button && (button.navigationEndpoint || button.onSelectCommand || button.command);
            const reload = command && command.loadReloadContinuationCommand;
            if (reload && reload.targetId === data.targetId && typeof reload.continuation === 'string' && reload.continuation) return command;
            for (const child of Object.values(value)) {const found = scan(child); if (found) return found;}
            return null;
        }
        const command = scan(data);
        if (command) return command;
    }
    return null;
}
function yvRefreshHomeOnStartup() {
    if (window.__yvHomeLifecycleInstalled) return;
    window.__yvHomeLifecycleInstalled = true;
    let session, initialPending = true, hidden = document.visibilityState === 'hidden';
    function onHome() {
        const route = (location.hash || '').replace(/^#/, '');
        return route === '' || route === '/' || /^\/browse\?(?:.*&)?(?:c|browseId)=FE(?:topics|what_to_watch)(?:&|$)/.test(route);
    }
    function homeState() {
        const root = yvHomeSurface(), data = root && (root.data || root.__instance && root.__instance.props && root.__instance.props.data);
        const ids = [], seen = new WeakSet();
        function scan(v) {
            if (!v || typeof v !== 'object' || seen.has(v)) return;
            seen.add(v);
            const card = v.tileRenderer || v.lockupViewModel;
            if (card && ['TILE_CONTENT_TYPE_VIDEO', 'LOCKUP_CONTENT_TYPE_VIDEO'].includes(card.contentType)) {ids.push(card.contentId || 'video'); return;}
            for (const child of Object.values(v)) scan(child);
        }
        const content = data && data.content; scan(content);
        return {content, count: ids.length, signature: ids.join(',')};
    }
    function stop() {if (session) clearTimeout(session.timer); session = null;}
    function begin(initial) {
        if (!Ma('reloadHomeOnStartup') || !onHome() || session) return;
        let target;
        try {target = initial && Ma('launchToOnStartup') && JSON.parse(Ma('launchToOnStartup'));} catch (error) {}
        session = {deadline: Date.now() + 45000, attempts: 0, stableSince: Date.now(), identityReady: false, target};
        initialPending = false;
        window.__yvStartupRefreshDone = false;
        window.__yvStartupNavigationScheduled = true;
        poll();
    }
    function poll() {
        const run = session;
        if (!run) return;
        clearTimeout(run.timer);
        if (!onHome() || document.visibilityState === 'hidden') {stop(); return;}
        const later = ms => {run.timer = setTimeout(poll, ms);};
        if (yvHasOpenDialog()) {run.deadline = Date.now() + 45000; later(250); return;}
        if (Date.now() >= run.deadline) {stop(); return;}
        const services = Object.values(window._yttv || {});
        if (!services.some(s => s && s.instance && typeof s.instance.resolveCommand === 'function')) {later(200); return;}
        if (!run.identityReady) {
            let identity;
            for (const service of services) {
                if (!service || !service.mappings || typeof service.get !== 'function') continue;
                try {const candidate = service.get('CurrentIdentityService'); if (candidate && candidate.get) {identity = candidate; break;}} catch (error) {}
            }
            // The native reload command already carries the current session. Do not
            // make a missing, rejected or stalled identity service block it forever.
            if (!identity || run.identityStarted !== undefined && Date.now() - run.identityStarted >= 5000) run.identityReady = true;
            else {
            if (!run.identityPending) {
                run.identityPending = true; run.identityStarted = Date.now();
                Promise.resolve().then(() => identity.get()).then(() => {if (session === run) {run.identityReady = true; poll();}}, () => {if (session === run) {run.identityReady = true; poll();}});
                later(200);
            } else later(200);
            return;
            }
        }
        const target = run.target;
        if (target && (!target.browseEndpoint || !['FEtopics', 'FEwhat_to_watch'].includes(target.browseEndpoint.browseId))) {stop(); po(target); return;}
        const state = homeState();
        if (run.sentAt !== undefined) {
            // Dispatch alone is not success: wait for the live Home model to be replaced.
            if ((state.content !== run.before || state.signature !== run.beforeSignature || (window.__yvHomeResponseSerial || 0) > run.responseSerial) && state.count > 0 && Date.now() - run.sentAt >= 1500) {
                window.__yvStartupRefreshDone = true; window.__yvHomeRefreshResult = {videos: state.count, attempts: run.attempts}; stop(); return;
            }
            if (Date.now() - run.sentAt < 6500) {later(250); return;}
            if (run.attempts >= 3) {window.__yvHomeRefreshResult = {videos: state.count, attempts: run.attempts, unconfirmed: true}; stop(); return;}
        } else {
            // Do not let the initial cached paint overwrite the refresh result.
            if (state.content !== run.stableContent) {run.stableContent = state.content; run.stableSince = Date.now();}
            if (!state.content || Date.now() - run.stableSince < 1000) {later(250); return;}
        }
        const command = yvHomeRefreshCommand();
        if (!command) {later(250); return;}
        run.before = state.content; run.beforeSignature = state.signature; run.responseSerial = window.__yvHomeResponseSerial || 0; run.sentAt = Date.now(); run.attempts++;
        try {po(command);} catch (error) {console.error('YakuzaVideo: Startseite konnte noch nicht aktualisiert werden', error);}
        later(250);
    }
    window.addEventListener('hashchange', () => {if (!onHome()) stop(); else begin(initialPending);});
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {hidden = true; stop();}
        else if (hidden) {hidden = false; begin(false);}
    });
    window.addEventListener('pageshow', event => {if (event.persisted) begin(false);});
    window.addEventListener('blur', () => {hidden = true;});
    window.addEventListener('focus', () => {if (hidden && document.visibilityState !== 'hidden') {hidden = false; begin(initialPending);}});
    // Remote navigation within Home must not silently cancel a pending refresh.
    begin(true);
}

// Start independently of the legacy player setup, which waits for a video
// element. An empty Home feed may never create that element on its own.
yvRefreshHomeOnStartup();
