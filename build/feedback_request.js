function lo(panelId, params) {
    let client;
    for (const service of Object.values(window._yttv || {})) {
        if (!service || !service.mappings || typeof service.get !== 'function') continue;
        try { const candidate = service.get('KabukiInnerTubeClient'); if (candidate && candidate.fetch) {client = candidate; break;} }
        catch (error) { /* Registry still starting. */ }
    }
    if (!client) return Promise.reject(new Error('TV client unavailable'));
    return new Promise((resolve, reject) => {
        let settled = false, subscription;
        function finish(error, value) {
            if (settled) return;
            settled = true; clearTimeout(timer);
            if (subscription && subscription.unsubscribe) subscription.unsubscribe();
            if (error) reject(error); else resolve(value);
        }
        const timer = setTimeout(() => finish(new Error('Video menu timed out')), 10000);
        try {
            subscription = client.fetch({path: '/youtubei/v1/get_panel', payload: {panelId, params}}).subscribe(response => {
                const panel = response && response.content && response.content.engagementPanelSectionListRenderer;
                const list = panel && panel.content && panel.content.listViewModel;
                if (!list || !Array.isArray(list.listItems)) {finish(new Error('Video menu unavailable')); return;}
                const tokens = [null, null];
                function normalize(text) {return String(text || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();}
                const labels = [
                    ['Not interested', 'Kein Interesse', ga('videoMenu.notInterested')],
                    ["Don't recommend channel", 'Keine Videos von diesem Kanal empfehlen', 'Kanal nicht empfehlen', ga('videoMenu.dontRecommendChannel')]
                ].map(values => values.map(normalize));
                for (const item of list.listItems) {
                    const renderer = item && item.listItemViewModel;
                    if (!renderer) continue;
                    // Read only this row's tap command, not unrelated nested state.
                    const context = renderer.rendererContext && renderer.rendererContext.commandContext;
                    const token = so(context && context.onTap);
                    if (!token) continue;
                    const index = labels.findIndex(values => values.includes(normalize(bo(renderer.title))));
                    if (index >= 0) tokens[index] = token;
                }
                finish(null, tokens);
            }, error => finish(error));
            if (settled && subscription && subscription.unsubscribe) subscription.unsubscribe();
        } catch (error) {finish(error);}
    });
}
