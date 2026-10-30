function uo(token) {
    if (typeof token !== 'string' || !token) return Promise.reject(new Error('Missing feedback token'));
    let client;
    for (const registry of Object.values(window._yttv || {})) {
        if (!registry || !registry.mappings || typeof registry.get !== 'function') continue;
        try {const candidate = registry.get('KabukiInnerTubeClient'); if (candidate && candidate.fetch) {client = candidate; break;}} catch (error) {}
    }
    if (!client) return Promise.reject(new Error('TV client unavailable'));
    return new Promise((resolve, reject) => {
        let settled = false, subscription;
        const timer = setTimeout(() => finish(new Error('Feedback timed out')), 10000);
        function finish(error, response) {
            if (settled) return;
            settled = true; clearTimeout(timer);
            if (subscription && subscription.unsubscribe) subscription.unsubscribe();
            if (error) reject(error); else resolve(response);
        }
        try {
            subscription = client.fetch({path:'/youtubei/v1/feedback',payload:{feedbackTokens:[token]}}).subscribe(response => finish(null,response), error => finish(error));
            if (settled && subscription && subscription.unsubscribe) subscription.unsubscribe();
        } catch (error) {finish(error);}
    });
}
