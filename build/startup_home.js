function yvObserveStartupBrowse() {}
function yvHomeRefreshCommand() {
    for (const element of document.querySelectorAll('ytlr-tv-surface-content-renderer')) {
        const data = element.data;
        if (!data || !['browse-feedFEtopics', 'browse-feedFEwhat_to_watch'].includes(data.targetId)) continue;
        const seen = new WeakSet();
        function scan(value) {
            if (!value || typeof value !== 'object' || seen.has(value)) return null;
            seen.add(value);
            const button = value.gridButtonRenderer;
            const command = button && button.navigationEndpoint;
            const reload = command && command.loadReloadContinuationCommand;
            if (reload && reload.targetId === data.targetId && typeof reload.continuation === 'string' && reload.continuation) return command;
            for (const child of Object.values(value)) {const found = scan(child); if (found) return found;}
            return null;
        }
        const command = scan(data.content);
        if (command) return command;
    }
    return null;
}
function yvRefreshHomeOnStartup() {
    if (window.__yvHomeLifecycleInstalled) return;
    window.__yvHomeLifecycleInstalled = true;
    let session, hidden = document.visibilityState === 'hidden';
    function onHome() {
        const route = (location.hash || '').replace(/^#/, '');
        return route === '' || route === '/' || /^\/browse\?(?:.*&)?(?:c|browseId)=FE(?:topics|what_to_watch)(?:&|$)/.test(route);
    }
    function homeState() {
        const roots = Array.from(document.querySelectorAll('ytlr-tv-surface-content-renderer'));
        const root = roots.find(e => e.data && ['browse-feedFEtopics', 'browse-feedFEwhat_to_watch'].includes(e.data.targetId));
        let count = 0;
        function scan(v) {if (!v || typeof v !== 'object') return; if (v.tileRenderer && v.tileRenderer.contentType === 'TILE_CONTENT_TYPE_VIDEO') count++; for (const child of Object.values(v)) scan(child);}
        const content = root && root.data.content; scan(content);
        return {content, count};
    }
    function stop() {if (session) clearTimeout(session.timer); session = null;}
    function begin(initial) {
        if (!Ma('reloadHomeOnStartup') || !onHome() || session) return;
        let target;
        try {target = initial && Ma('launchToOnStartup') && JSON.parse(Ma('launchToOnStartup'));} catch (error) {}
        session = {deadline: Date.now() + 45000, attempts: 0, stableSince: Date.now(), identityReady: false, target};
        window.__yvStartupRefreshDone = false;
        window.__yvStartupNavigationScheduled = true;
        poll();
    }
    function poll() {
        const run = session;
        if (!run) return;
        clearTimeout(run.timer);
        if (!onHome() || Date.now() >= run.deadline || document.visibilityState === 'hidden') {stop(); return;}
        const later = ms => {run.timer = setTimeout(poll, ms);};
        if (document.querySelector('ytlr-overlay-panel-renderer, ytlr-menu-renderer')) {later(250); return;}
        const services = Object.values(window._yttv || {});
        if (!services.some(s => s && s.instance && typeof s.instance.resolveCommand === 'function')) {later(200); return;}
        if (!run.identityReady) {
            let identity;
            for (const service of services) {
                if (!service || !service.mappings || typeof service.get !== 'function') continue;
                try {const candidate = service.get('CurrentIdentityService'); if (candidate && candidate.get) {identity = candidate; break;}} catch (error) {}
            }
            if (!identity) {later(200); return;}
            if (!run.identityPending) {
                run.identityPending = true;
                Promise.resolve(identity.get()).then(() => {if (session === run) {run.identityReady = true; poll();}}, () => {if (session === run) stop();});
                later(10000);
            } else later(200);
            return;
        }
        const target = run.target;
        if (target && (!target.browseEndpoint || !['FEtopics', 'FEwhat_to_watch'].includes(target.browseEndpoint.browseId))) {stop(); po(target); return;}
        const state = homeState();
        if (run.sentAt !== undefined) {
            // Dispatch alone is not success: wait for the live Home model to be replaced.
            if (state.content !== run.before && state.count > 0 && Date.now() - run.sentAt >= 1500) {
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
        run.before = state.content; run.sentAt = Date.now(); run.attempts++;
        po(command); later(250);
    }
    window.addEventListener('hashchange', () => {if (!onHome()) stop();});
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {hidden = true; stop();}
        else if (hidden) {hidden = false; begin(false);}
    });
    window.addEventListener('pageshow', event => {if (event.persisted) begin(false);});
    // Remote navigation within Home must not silently cancel a pending refresh.
    begin(true);
}
