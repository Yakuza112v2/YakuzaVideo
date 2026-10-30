function Ao(items) {
    if (!Array.isArray(items) || !Ma('enableHideWatchedVideos')) return items;
    const pages = Ma('hideWatchedVideosPages');
    if (!Array.isArray(pages) || !pages.length) return items;
    const route = (location.hash || '').replace(/^#/, ''), query = new URLSearchParams(route.split('?')[1] || '');
    const browse = query.get('c') || query.get('browseId') || '';
    const page = route === '' || route === '/' || ['FEtopics','FEwhat_to_watch'].includes(browse) ? 'home' : route.startsWith('/search') ? 'search' : browse.replace(/^FE/, '').replace(/^topics_/, '');
    if (!pages.includes(page)) return items;
    const threshold = Number(Ma('hideWatchedVideosThreshold'));
    if (!Number.isFinite(threshold)) return items;
    return items.filter(item => {
        const card = item && (item.tileRenderer || item.lockupViewModel);
        if (!card) return true;
        let percent;
        const seen = new WeakSet();
        function scan(value) {
            if (!value || typeof value !== 'object' || seen.has(value)) return;
            seen.add(value);
            for (const [key, child] of Object.entries(value)) {
                if (['percentDurationWatched','startPercent'].includes(key) && Number.isFinite(child)) percent = Math.max(percent || 0, child);
                else scan(child);
            }
        }
        scan(card.header || card.contentImage);
        const local = window.__yvWatchStatus && window.__yvWatchStatus.percent(card.contentId);
        if (Number.isFinite(local)) percent = Math.max(percent || 0, local);
        return percent === undefined || percent <= 0 || percent < threshold;
    });
}
