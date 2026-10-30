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
    if (!Ma('reloadHomeOnStartup') || window.__yvStartupNavigationScheduled) return;
    function onHome() {
        const route = (location.hash || '').replace(/^#/, '');
        return route === '' || route === '/' || /^\/browse\?(?:.*&)?(?:c|browseId)=FE(?:topics|what_to_watch)(?:&|$)/.test(route);
    }
    if (!onHome()) return;
    window.__yvStartupNavigationScheduled = true;
    let target;
    try {target = Ma('launchToOnStartup') && JSON.parse(Ma('launchToOnStartup'));} catch (error) {}
    const anotherPage = target && (!target.browseEndpoint || !['FEtopics', 'FEwhat_to_watch'].includes(target.browseEndpoint.browseId));
    let finished = false, timer, identityPending = false, identityReady = false;
    const deadline = Date.now() + 20000;
    function stop() {finished = true; clearTimeout(timer); window.removeEventListener('hashchange', routeChanged); window.removeEventListener('keydown', userInput, true);}
    function routeChanged() {if (!onHome()) stop();}
    function userInput(event) {if (event.keyCode) stop();}
    function poll() {
        if (finished) return;
        if (!onHome() || Date.now() >= deadline) {stop(); return;}
        const services = Object.values(window._yttv || {});
        const ready = services.some(service => service && service.instance && typeof service.instance.resolveCommand === 'function');
        if (!ready) {timer = setTimeout(poll, 200); return;}
        if (!identityReady) {
            let identity;
            for (const service of services) {
                if (!service || !service.mappings || typeof service.get !== 'function') continue;
                try {const candidate = service.get('CurrentIdentityService'); if (candidate && candidate.get) {identity = candidate; break;}} catch (error) {}
            }
            if (identity && !identityPending) {
                identityPending = true;
                Promise.resolve(identity.get()).then(() => {identityReady = true; poll();}, stop);
                timer = setTimeout(stop, 10000);
                return;
            }
            if (identityPending) return;
            identityReady = true;
        }
        clearTimeout(timer);
        if (anotherPage) {stop(); po(target); return;}
        const command = yvHomeRefreshCommand();
        if (!command) {timer = setTimeout(poll, 200); return;}
        stop();
        // Use exactly the server-issued command behind the working Refresh button.
        po(command);
        window.__yvStartupRefreshDone = true;
    }
    window.addEventListener('hashchange', routeChanged);
    window.addEventListener('keydown', userInput, true);
    poll();
}
