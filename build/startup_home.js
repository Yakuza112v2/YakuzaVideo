function yvObserveStartupBrowse(response) {
    const browse = response && response.contents && response.contents.tvBrowseRenderer;
    const surface = browse && browse.content && browse.content.tvSurfaceContentRenderer;
    const target = surface && surface.targetId;
    const tracking = response && response.responseContext && response.responseContext.serviceTrackingParams;
    const isSubscriptions = (typeof target === 'string' && target.includes('FEsubscriptions')) ||
        (Array.isArray(tracking) && tracking.some(service => service.service === 'GFEEDBACK' &&
            Array.isArray(service.params) && service.params.some(param => param.key === 'browse_id' && param.value === 'FEsubscriptions')));
    if (isSubscriptions && window.__yvStartupSubscriptionsLoaded) {
        window.__yvStartupSubscriptionsLoaded();
    }
}
function yvRefreshHomeOnStartup() {
    if (!Ma('reloadHomeOnStartup') || window.__yvStartupNavigationScheduled) return;
    function page() {
        const route = (location.hash || '').replace(/^#/, '');
        if (route === '' || route === '/') return 'home';
        if (/^\/browse\?/.test(route)) {
            const match = /[?&](?:c|browseId)=([^&]+)/.exec(route);
            if (match && ['FEtopics', 'FEwhat_to_watch'].includes(match[1])) return 'home';
            if (match && match[1] === 'FEsubscriptions') return 'subscriptions';
        }
        return 'other';
    }
    if (page() !== 'home') return;
    window.__yvStartupNavigationScheduled = true;
    let home = {browseEndpoint: {browseId: 'FEtopics'}};
    let subscriptions = {browseEndpoint: {browseId: 'FEsubscriptions'}};
    const configured = Ma('launchToOnStartup');
    if (configured) {
        try {const parsed = JSON.parse(configured); if (parsed && typeof parsed === 'object') home = parsed;}
        catch (error) {console.warn('YakuzaVideo: invalid startup page setting', error);}
    }
    const needsHome = home.browseEndpoint && ['FEtopics', 'FEwhat_to_watch'].includes(home.browseEndpoint.browseId);
    let phase = 'waiting', pollTimer, requestTimer, returnTimer, subscription, responseSeen = false;
    const deadline = Date.now() + 20000;
    function cleanup() {
        clearTimeout(pollTimer); clearTimeout(requestTimer); clearTimeout(returnTimer);
        window.removeEventListener('hashchange', routeChanged);
        window.removeEventListener('keydown', userInput, true);
        window.removeEventListener('pointerdown', userInput, true);
        delete window.__yvStartupSubscriptionsLoaded;
        if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    }
    function stop() {phase = 'done'; cleanup();}
    function returnHome() {
        if (phase !== 'subscriptions') return;
        // A watch link or manual navigation always takes priority.
        if (page() === 'other') {stop(); return;}
        stop(); po(home);
    }
    function maybeReturn() {
        if (phase === 'subscriptions' && page() === 'subscriptions' && responseSeen && !returnTimer) {
            // The response parser runs before the new screen has been committed.
            returnTimer = setTimeout(returnHome, 250);
        }
    }
    function routeChanged() {
        if (phase === 'subscriptions') {
            if (page() === 'other') stop(); else maybeReturn();
        } else if (page() !== 'home') stop();
    }
    function userInput() {stop();}
    function cycle() {
        if (phase !== 'guide' || page() !== 'home') return;
        clearTimeout(requestTimer);
        if (!needsHome) {stop(); po(home); return;}
        phase = 'subscriptions';
        window.__yvStartupSubscriptionsLoaded = () => {responseSeen = true; maybeReturn();};
        // This is a real route transition, not a request to the already active Home.
        requestTimer = setTimeout(returnHome, 8000);
        try {po(subscriptions);} catch (error) {returnHome();}
    }
    function fetchGuide(client) {
        if (phase !== 'identity' || page() !== 'home') return;
        clearTimeout(requestTimer); phase = 'guide';
        requestTimer = setTimeout(cycle, 5000);
        try {
            subscription = client.fetch({path: '/youtubei/v1/guide'}).subscribe(response => {
                if (phase !== 'guide' || !response || !Array.isArray(response.items)) return;
                function scan(value) {
                    if (!value || typeof value !== 'object') return;
                    const entry = value.guideEntryRenderer;
                    const endpoint = entry && entry.navigationEndpoint;
                    const id = endpoint && endpoint.browseEndpoint && endpoint.browseEndpoint.browseId;
                    if (needsHome && ['FEtopics', 'FEwhat_to_watch'].includes(id)) home = endpoint;
                    if (id === 'FEsubscriptions') subscriptions = endpoint;
                    for (const child of Object.values(value)) scan(child);
                }
                scan(response.items); cycle();
            }, cycle);
            if (phase === 'done' && subscription && subscription.unsubscribe) subscription.unsubscribe();
        } catch (error) {cycle();}
    }
    function poll() {
        if (phase !== 'waiting') return;
        if (page() !== 'home' || Date.now() >= deadline) {stop(); return;}
        const services = Object.values(window._yttv || {});
        const routerReady = services.some(service => service && service.instance && typeof service.instance.resolveCommand === 'function');
        const guide = document.querySelector('ytlr-guide-response');
        const guideReady = window.__yvGuideReady || (guide && guide.children && guide.children.length);
        let client, identity;
        for (const service of services) {
            if (!service || !service.mappings || typeof service.get !== 'function') continue;
            try {const candidate = service.get('KabukiInnerTubeClient'); if (candidate && candidate.fetch) client = candidate;} catch (error) {}
            try {const candidate = service.get('CurrentIdentityService'); if (candidate && candidate.get) identity = candidate;} catch (error) {}
        }
        if (!routerReady || !guideReady || !client) {pollTimer = setTimeout(poll, 200); return;}
        phase = 'identity';
        // Resolve the selected profile before the two account-aware browse calls.
        if (identity) {
            requestTimer = setTimeout(stop, 10000);
            try {Promise.resolve(identity.get()).then(() => fetchGuide(client), stop);} catch (error) {stop();}
        } else fetchGuide(client);
    }
    window.addEventListener('hashchange', routeChanged);
    window.addEventListener('keydown', userInput, true);
    window.addEventListener('pointerdown', userInput, true);
    poll();
}
