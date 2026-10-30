function yvInstallFeedbackUi(prepareCards, enhance, translate, findToken) {
    if (window.__yvFeedbackUiInstalled) return;
    window.__yvFeedbackUiInstalled = true;
    function home() {
        const route = (location.hash || '').replace(/^#/, '');
        return route === '' || route === '/' || /^\/browse\?(?:.*&)?(?:c|browseId)=FE(?:topics|what_to_watch)(?:&|$)/.test(route);
    }
    const normalize = text => String(text || '').trim().toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ');
    const text = value => value && (value.simpleText || value.content || (value.runs || []).map(run => run.text || '').join(''));
    const labels = [
        [translate('videoMenu.notInterested'), 'Kein Interesse', 'Not interested'],
        [translate('videoMenu.dontRecommendChannel'), 'Keine Videos von diesem Kanal empfehlen', 'Kanal nicht empfehlen', "Don't recommend channel"]
    ].map(values => values.map(normalize));
    function priority(item) {
        const row = item.listItemViewModel || item.menuServiceItemRenderer || item.menuNavigationItemRenderer;
        if (!row) return -1;
        const context = row.rendererContext && row.rendererContext.commandContext;
        const command = (context && context.onTap) || row.serviceEndpoint || row.navigationEndpoint;
        if (!findToken(command) && !(command && (command.customAction || command.playlistEditEndpoint && command.playlistEditEndpoint.customAction))) return -1;
        return labels.findIndex(values => values.includes(normalize(text(row.title || row.text))));
    }
    function moveFeedbackFirst(items) {
        if (!Array.isArray(items)) return;
        const feedback = [[], []], rest = [];
        for (const item of items) {const index = priority(item); (index < 0 ? rest : feedback[index]).push(item);}
        if (feedback[0].length || feedback[1].length) items.splice(0, items.length, ...feedback[0], ...feedback[1], ...rest);
    }
    function repairRenderedMenus() {
        if (!home()) return;
        for (const element of document.querySelectorAll('ytlr-tile-renderer')) {
            const card = element.data || (element.__instance && element.__instance.props && element.__instance.props.data);
            if (!card || card.contentType !== 'TILE_CONTENT_TYPE_VIDEO') continue;
            if (card.onLongPressCommand && card.onLongPressCommand.showEngagementPanelEndpoint) {
                // The Home response can be cached before the JSON hooks are installed.
                // Prepare this exact live component data before its handler reads it.
                prepareCards([{tileRenderer: card}]);
            }
            const command = card.onLongPressCommand;
            const menu = command && command.showMenuCommand;
            const items = menu && menu.menu && menu.menu.menuRenderer && menu.menu.menuRenderer.items;
            if (!Array.isArray(items)) continue;
            enhance({tileRenderer: card}, items);
            moveFeedbackFirst(items);
        }
    }
    let repairTimer;
    function scheduleRepair() {if (!repairTimer) repairTimer = setTimeout(() => {repairTimer = null; repairRenderedMenus();}, 0);}
    if (document.body) new MutationObserver(scheduleRepair).observe(document.body, {subtree: true, childList: true});
    // Repair the component's live data before its long-press handler reads it.
    document.addEventListener('keydown', repairRenderedMenus, true);
    repairRenderedMenus();
}
