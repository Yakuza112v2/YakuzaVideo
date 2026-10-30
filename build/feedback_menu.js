function xo(card, items) {
    if (!Array.isArray(items)) return;
    const tile = card && card.tileRenderer;
    const lockup = card && card.lockupViewModel;
    const command = tile ? tile.onLongPressCommand : lockup && lockup.rendererContext &&
        lockup.rendererContext.commandContext && lockup.rendererContext.commandContext.onLongPress;
    const seen = new Set();
    function panelFrom(value) {
        if (!value || typeof value !== "object" || seen.has(value)) return null;
        seen.add(value);
        if (Array.isArray(value)) {
            for (const entry of value) { const panel = panelFrom(entry); if (panel) return panel; }
            return null;
        }
        const endpoint = value.showEngagementPanelEndpoint;
        if (endpoint && endpoint.identifier && typeof endpoint.identifier.tag === "string" &&
            endpoint.identifier.tag && endpoint.globalConfiguration &&
            typeof endpoint.globalConfiguration.params === "string" && endpoint.globalConfiguration.params) {
            return {panelId: endpoint.identifier.tag, params: endpoint.globalConfiguration.params};
        }
        // Follow command wrappers only; unrelated menu entries can open different panels.
        for (const key of ["innertubeCommand", "commandExecutorCommand", "commands", "signalServiceEndpoint", "actions"]) {
            const panel = panelFrom(value[key]); if (panel) return panel;
        }
        return null;
    }
    let panel = panelFrom(command);
    // Home cards do not always carry a panel command. Request the TV context menu
    // by video ID instead; params is a protobuf request, never a feedback token.
    const videoId = tile ? tile.contentId : lockup && lockup.contentId;
    const route = (location.hash || '').replace(/^#/, '');
    const home = route === '' || route === '/' ||
        /^\/browse\?(?:.*&)?(?:c|browseId)=FE(?:topics|what_to_watch)(?:&|$)/.test(route);
    if (!panel && home && /^[A-Za-z0-9_-]{11}$/.test(videoId || '')) {
        const bytes = '\xfa\x0a\x25\x0a\x0b' + videoId + '\x20\x9e\x01\x42\x13\x08\x02\x12\x0fFEwhat_to_watch';
        panel = {panelId: 'PAcontext_menu', params: btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_')};
    }
    if (!panel) return;
    function containsAction(value, action) {
        if (!value || typeof value !== "object") return false;
        if (value.customAction && value.customAction.action === action) return true;
        return Object.values(value).some(child => containsAction(child, action));
    }
    function normalized(text) { return String(text || "").trim().toLowerCase().replace(/\s+/g, " "); }
    const actions = [
        {action: "NOT_INTERESTED", key: "videoMenu.notInterested", labels: ["Not interested", "Kein Interesse"]},
        {action: "DONT_RECOMMEND_CHANNEL", key: "videoMenu.dontRecommendChannel", labels: ["Don't recommend channel", "Keine Videos von diesem Kanal empfehlen", "Kanal nicht empfehlen", "Kanal nicht mehr empfehlen"]}
    ];
    for (const action of actions) {
        const labels = action.labels.concat([ga(action.key)]).map(normalized);
        const existingIndex = items.findIndex(item => {
            if (containsAction(item, action.action)) return true;
            const renderer = item.menuServiceItemRenderer || item.menuNavigationItemRenderer || item.compactLinkRenderer;
            if (!renderer) return false;
            const endpoint = renderer.serviceEndpoint || renderer.navigationEndpoint;
            return !!so(endpoint) && labels.includes(normalized(bo(renderer.text || renderer.title)));
        });
        if (existingIndex >= 0 && /^[A-Za-z0-9_-]{11}$/.test(videoId || '')) {
            const item = items[existingIndex];
            const renderer = item.menuServiceItemRenderer || item.menuNavigationItemRenderer || item.compactLinkRenderer;
            if (renderer) {
                const endpointKey = renderer.navigationEndpoint ? 'navigationEndpoint' : 'serviceEndpoint';
                const endpoint = renderer[endpointKey];
                const existingAction = endpoint && (endpoint.customAction || endpoint.playlistEditEndpoint && endpoint.playlistEditEndpoint.customAction);
                if (existingAction && existingAction.action === action.action && existingAction.parameters) existingAction.parameters.videoId = videoId;
                else renderer[endpointKey] = {clickTrackingParams: null, playlistEditEndpoint: {customAction: {action: action.action, parameters: {...panel, videoId}}}};
            }
        }
        if (existingIndex < 0) items.push(qa(ga(action.key), {
            clickTrackingParams: null,
            playlistEditEndpoint: {customAction: {action: action.action, parameters: {...panel, videoId}}}
        }));
    }
}
