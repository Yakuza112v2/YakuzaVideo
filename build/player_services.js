function Na() {
    if (window.__yvPlayerServicesReady) return;
    let player, preview;
    for (const registry of Object.values(window._yttv || {})) {
        if (!registry || !registry.mappings || typeof registry.get !== 'function') continue;
        try {player = player || registry.get('PlayerService');} catch (error) {}
        try {preview = preview || registry.get('PlaybackPreviewService');} catch (error) {}
    }
    if (player) Fa = player;
    if (!player || !preview || typeof preview.start !== 'function' || typeof preview.stop !== 'function') {
        setTimeout(Na, 500);
        return;
    }
    const start = preview.start, stop = preview.stop;
    preview.start = function() {if (!window.isPipPlaying) return start.apply(this, arguments);};
    preview.stop = function() {if (!window.isPipPlaying) return stop.apply(this, arguments);};
    window.__yvPlayerServicesReady = true;
}
