function yvRefreshHomeOnStartup() {
    if (!Ma('reloadHomeOnStartup') || window.__yvStartupNavigationScheduled) return;
    function onHome() {
        const route = (location.hash || '').replace(/^#/, '');
        return route === '' || route === '/' ||
            (route.startsWith('/browse?') && /[?&](?:c|browseId)=FEtopics(?:&|$)/.test(route));
    }
    if (!onHome()) return;
    window.__yvStartupNavigationScheduled = true;
    let target = {browseEndpoint: {browseId: 'FEtopics'}};
    const configured = Ma('launchToOnStartup');
    if (configured) {
        try { const parsed = JSON.parse(configured); if (parsed && typeof parsed === 'object') target = parsed; }
        catch (error) { console.warn('YakuzaVideo: invalid startup page setting', error); }
    }
    const needsHome = !!target.browseEndpoint && target.browseEndpoint.browseId === 'FEtopics';
    let finished = false, subscription, pollTimer, requestTimer;
    const deadline = Date.now() + 15000;
    function cleanup() {
        clearTimeout(pollTimer); clearTimeout(requestTimer);
        window.removeEventListener('hashchange', routeChanged);
        if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
    }
    function stop() { if (!finished) {finished = true; cleanup();} }
    function routeChanged() { if (!onHome()) stop(); }
    function navigate() {
        if (finished) return;
        if (!onHome()) {stop(); return;}
        finished = true; cleanup();
        po(target);
    }
    function readyServices() {
        const services = Object.values(window._yttv || {});
        if (!services.some(service => service && service.instance && typeof service.instance.resolveCommand === 'function')) return null;
        for (const service of services) {
            if (!service || !service.mappings || typeof service.get !== 'function') continue;
            try {
                const client = service.get('KabukiInnerTubeClient');
                if (client && typeof client.fetch === 'function') return client;
            } catch (error) { /* The service registry can exist before its client is ready. */ }
        }
        return null;
    }
    function poll() {
        if (finished) return;
        if (!onHome() || Date.now() >= deadline) {stop(); return;}
        const guide = document.querySelector('ytlr-guide-response');
        const guideReady = window.__yvGuideReady || (guide && guide.children && guide.children.length > 0);
        const client = readyServices();
        if (!client || !guideReady) {pollTimer = setTimeout(poll, 200); return;}
        if (!needsHome) {navigate(); return;}
        // Refresh account-aware guide data before issuing a real Home browse command.
        requestTimer = setTimeout(navigate, 5000);
        try {
            subscription = client.fetch({path: '/youtubei/v1/guide'}).subscribe(response => {
                if (response && response.items && response.items.some(item => item && item.guideSectionRenderer)) navigate();
            }, navigate);
            if (finished && subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
        } catch (error) {navigate();}
    }
    window.addEventListener('hashchange', routeChanged);
    poll();
}
