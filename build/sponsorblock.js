class Po {
    constructor(id) {this.videoID = id; this.active = true; this.segments = []; this.video = null; this.loaded = false; this.loading = false; this.nextSkipTimeout = null; this.retryAt = 0; this.overlay = null;}
    async init() {
        if (this.loading || !this.active) return;
        this.loading = true;
        const status = window.__yvFeatureStatus.sponsorblock;
        status.state = 'loading';
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const categories = ['sponsor', 'intro', 'outro', 'interaction', 'selfpromo', 'preview', 'filler', 'music_offtopic', 'poi_highlight'];
            const prefix = Do(this.videoID).slice(0, 4);
            const response = await fetch('https://sponsor.ajay.app/api/skipSegments/' + prefix + '?categories=' + encodeURIComponent(JSON.stringify(categories)), {signal: controller.signal});
            if (response.status !== 404 && !response.ok) throw new Error('HTTP ' + response.status);
            const data = response.status === 404 ? [] : await response.json();
            if (!Array.isArray(data)) throw new Error('Invalid segment response');
            if (!this.active) return;
            const match = data.find(row => row.videoID === this.videoID);
            this.segments = (match && Array.isArray(match.segments) ? match.segments : []).filter(row => Array.isArray(row.segment) && row.segment.length >= 2 && Number.isFinite(row.segment[0]) && Number.isFinite(row.segment[1]) && row.segment[0] >= 0 && row.segment[1] > row.segment[0] && (!row.actionType || row.actionType === 'skip'));
            this.loaded = true; status.state = this.segments.length ? 'ready' : 'no_data'; status.segments = this.segments.length;
            this.scheduleSkip(); this.drawOverlay();
        } catch (error) {
            if (!this.active) return;
            this.retryAt = Date.now() + 30000; status.state = 'error'; status.segments = 0;
            console.error('YakuzaVideo: SponsorBlock segment request failed', error);
            if (!status.errorShown) {status.errorShown = true; Va('SponsorBlock', 'Segmentdaten konnten nicht geladen werden. Ein neuer Versuch folgt automatisch.');}
        } finally {clearTimeout(timeout); this.loading = false;}
    }
    getSkippableCategories() {
        return Object.entries({sponsor:'enableSponsorBlockSponsor', intro:'enableSponsorBlockIntro', outro:'enableSponsorBlockOutro', interaction:'enableSponsorBlockInteraction', selfpromo:'enableSponsorBlockSelfPromo', preview:'enableSponsorBlockPreview', filler:'enableSponsorBlockFiller', music_offtopic:'enableSponsorBlockMusicOfftopic'}).filter(([,key]) => Ma(key)).map(([category]) => category);
    }
    attachVideo(video) {if (!video) {clearTimeout(this.nextSkipTimeout); this.video=null; if(this.overlay)this.overlay.remove(); this.overlay=null; return;} if (this.video !== video) {this.video = video; this.scheduleSkip(); this.drawOverlay();}}
    scheduleSkip() {
        clearTimeout(this.nextSkipTimeout); this.nextSkipTimeout = null;
        const video = this.video;
        if (!this.active || !Ma('enableSponsorBlock') || !video || video.paused || this.seeking || !Number.isFinite(video.currentTime)) return;
        const enabled = this.getSkippableCategories();
        const manual = Ma('sponsorBlockManualSkips') || [];
        const segments = this.segments.filter(row => enabled.includes(row.category) && !manual.includes(row.category)).sort((a,b) => a.segment[0] - b.segment[0]);
        const now = video.currentTime;
        const current = segments.find(row => row.segment[0] <= now + 0.03 && row.segment[1] > now + 0.1);
        if (current) {
            const end = Number.isFinite(video.duration) ? Math.min(current.segment[1], Math.max(0, video.duration - 0.05)) : current.segment[1];
            if (end > now + 0.1) {
                this.seeking = true;
                try {
                    video.currentTime = end;
                    window.__yvFeatureStatus.sponsorblock.skips++;
                    if (Ma('enableSponsorBlockToasts')) Va('SponsorBlock', ga('sponsorblock.toasts.skipping', {segment: ga('sponsorblock.segments.' + current.category)}));
                } finally {this.seeking = false;}
            }
        }
        const next = segments.find(row => row.segment[0] > video.currentTime + 0.03);
        if (next) this.nextSkipTimeout = setTimeout(() => this.scheduleSkip(), Math.max(10, (next.segment[0] - video.currentTime) * 1000 / (video.playbackRate > 0 ? video.playbackRate : 1)));
    }
    drawOverlay() {
        // Segment skipping never depends on this optional visual overlay.
        try {
            if (!this.active || !this.video || !(this.video.duration > 0)) return;
            const slider = document.querySelector('div[idomkey="slider"]');
            if (!slider) return;
            if (this.overlay && this.overlay.parentNode !== slider) {this.overlay.remove(); this.overlay = null;}
            if (!this.overlay) {
                this.overlay = document.createElement('div'); this.overlay.className = 'yakuzavideo-sponsor-segments';
                Object.assign(this.overlay.style, {position:'absolute', inset:'0', pointerEvents:'none', zIndex:'5'}); slider.appendChild(this.overlay);
            }
            const signature = this.video.duration + ':' + this.segments.map(row => row.UUID || row.segment.join(':')).join(',');
            if (this.overlay.__yvSignature === signature) return;
            this.overlay.__yvSignature = signature; this.overlay.textContent = '';
            for (const row of this.segments) {
                const mark = document.createElement('div'); const color = Eo[row.category] && Eo[row.category].color || '#00d400';
                Object.assign(mark.style, {position:'absolute', height:'100%', left:(100 * row.segment[0] / this.video.duration)+'%', width:(100 * (row.segment[1] - row.segment[0]) / this.video.duration)+'%', backgroundColor:color, opacity:'0.75'}); this.overlay.appendChild(mark);
            }
        } catch (error) {console.warn('YakuzaVideo: SponsorBlock overlay unavailable');}
    }
    destroy() {this.active = false; clearTimeout(this.nextSkipTimeout); if (this.overlay) this.overlay.remove(); this.overlay = null; this.video = null;}
}
function yvInstallSponsorBlock() {
    if (window.__yvSponsorBlockInstalled) return;
    window.__yvSponsorBlockInstalled = true;
    window.__yvFeatureStatus = window.__yvFeatureStatus || {};
    window.__yvFeatureStatus.sponsorblock = {state:'idle', segments:0, skips:0};
    window.sponsorblock = null;
    function watchId() {if (!/^#\/watch\?/.test(location.hash || '')) return null; const id = new URLSearchParams(location.hash.split('?')[1]).get('v'); return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;}
    function mainVideo() {
        const player=document.querySelector('.html5-video-player');
        if(player&&typeof player.getVideoData==='function') {
            let data;try{data=player.getVideoData();}catch(error){return null;}
            if(data&&/^[A-Za-z0-9_-]{11}$/.test(data.video_id||'')&&data.video_id!==watchId())return null;
        }
        const nested=player&&player.querySelector&&player.querySelector('video');
        return nested||Array.from(document.querySelectorAll('video')).find(video => !video.closest || !video.closest('ytlr-playback-preview'));
    }
    function reconcile() {
        const id = watchId(); let current = window.sponsorblock;
        if (current && (!id || id !== current.videoID || !Ma('enableSponsorBlock'))) {current.destroy(); window.sponsorblock = current = null;}
        if (!id || !Ma('enableSponsorBlock')) {window.__yvFeatureStatus.sponsorblock.state = Ma('enableSponsorBlock') ? 'idle' : 'disabled'; return;}
        if (!current) {current = window.sponsorblock = new Po(id); current.init();}
        current.attachVideo(mainVideo());
        if (!current.loaded && !current.loading && Date.now() >= current.retryAt) current.init();
        current.scheduleSkip(); current.drawOverlay();
    }
    function media(event) {
        if (!watchId() || !event.target || event.target.tagName !== 'VIDEO') return;
        if (event.target.closest && event.target.closest('ytlr-playback-preview')) return;
        reconcile();
    }
    for (const name of ['loadedmetadata', 'timeupdate', 'play', 'pause', 'seeked', 'ratechange', 'durationchange']) document.addEventListener(name, media, true);
    window.addEventListener('hashchange', reconcile);
    Ra.addEventListener('configChange', event => {if (/^(enableSponsorBlock|sponsorBlockManualSkips)/.test(event.detail.key)) reconcile();});
    function poll() {try{reconcile();}catch(error){console.warn('YakuzaVideo: SponsorBlock wartet auf den Player');}finally{setTimeout(poll,750);}}
    poll();
}
yvInstallSponsorBlock();
