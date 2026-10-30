function yvInstallDeArrow() {
    if (window.__yvDeArrow) return;
    const cache = new Map(), originals = new WeakMap(), failedImages = new Map(), queue = [];
    let active = 0, renderTimer;
    window.__yvFeatureStatus = window.__yvFeatureStatus || {};
    const status = window.__yvFeatureStatus.dearrow = {state:'idle', titles:0, thumbnails:0, requests:0};
    const validId = id => /^[A-Za-z0-9_-]{11}$/.test(id || '');
    function videoCard(value) {
        const card = value && (value.tileRenderer || value.lockupViewModel || value);
        return card && validId(card.contentId) && (!card.contentType || ['TILE_CONTENT_TYPE_VIDEO','LOCKUP_CONTENT_TYPE_VIDEO'].includes(card.contentType)) ? card : null;
    }
    function fields(card) {
        if (card.metadata && card.metadata.tileMetadataRenderer) return {kind:'tile', metadata:card.metadata.tileMetadataRenderer, image:card.header && card.header.tileHeaderRenderer && card.header.tileHeaderRenderer.thumbnail};
        if (card.metadata && card.metadata.lockupMetadataViewModel) return {kind:'lockup', metadata:card.metadata.lockupMetadataViewModel, image:card.contentImage && card.contentImage.thumbnailViewModel && card.contentImage.thumbnailViewModel.image};
        return null;
    }
    const text = value => value && (value.simpleText || value.content || (value.runs || []).map(row => row.text || '').join('')) || '';
    function best(rows, predicate) {return (Array.isArray(rows) ? rows : []).filter(row => predicate(row) && (row.locked || row.votes === undefined || row.votes >= 0)).sort((a,b) => Number(!!b.locked)-Number(!!a.locked) || (b.votes || 0)-(a.votes || 0))[0];}
    function schedule() {if (!renderTimer) renderTimer = setTimeout(render, 0);}
    function request(id) {
        const previous = cache.get(id);
        if (previous && (previous.state !== 'error' || previous.retryAt > Date.now())) return previous;
        const record = {state:'queued', data:null}; cache.set(id, record); queue.push({id, record}); pump(); return record;
    }
    function pump() {
        if (!Ma('enableDeArrow')) {for (const job of queue) cache.delete(job.id); queue.length = 0; return;}
        while (active < 4 && queue.length) {
            const {id,record} = queue.shift(); active++; status.requests++; status.state='loading';
            const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),10000);
            fetch('https://sponsor.ajay.app/api/branding?videoID=' + id, {signal:controller.signal}).then(async response => {
                if (response.status !== 404 && !response.ok) throw new Error('HTTP ' + response.status);
                const data = response.status === 404 ? {titles:[], thumbnails:[]} : await response.json();
                if (!data || !Array.isArray(data.titles) || !Array.isArray(data.thumbnails)) throw new Error('Invalid branding response');
                record.state='ready'; record.data=data; status.state='ready';
            }).catch(error => {
                record.state='error';record.retryAt=Date.now()+30000;status.state='error';
                console.error('YakuzaVideo: DeArrow request failed',error);
                if (!status.errorShown) {status.errorShown=true;Va('DeArrow','Titel und Vorschaubilder konnten nicht geladen werden. Ein neuer Versuch folgt automatisch.');}
            }).finally(() => {clearTimeout(timeout);active--;schedule();pump();});
        }
    }
    function apply(card) {
        const field = fields(card); if (!field) return null;
        let original = originals.get(card);
        if (!original || original.id !== card.contentId) {
            original = {id:card.contentId, title:field.metadata.title, images:field.image && (field.kind==='tile'?field.image.thumbnails:field.image.sources)};
            originals.set(card,original);
        }
        if (!original.titleApplied) original.title=field.metadata.title;
        if (!original.imageApplied && field.image) original.images=field.kind==='tile'?field.image.thumbnails:field.image.sources;
        const enabled=!!Ma('enableDeArrow');
        const record=enabled?request(card.contentId):null, data=record&&record.data;
        const title=data&&best(data.titles,row=>typeof row.title==='string'&&row.title.trim());
        const thumbnail=data&&Ma('enableDeArrowThumbnails')&&best(data.thumbnails,row=>row.original===true || Number.isFinite(row.timestamp)&&row.timestamp>=0);
        const replacement=title&&!title.original?title.title:text(original.title);
        let thumbnailUrl=thumbnail&&!thumbnail.original?'https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID='+card.contentId+'&time='+thumbnail.timestamp:null;
        if (thumbnailUrl && (failedImages.get(thumbnailUrl) || 0) > Date.now()) thumbnailUrl=null;
        if (title&&!title.original) {field.metadata.title=field.kind==='tile'?{simpleText:replacement}:{...original.title,content:replacement}; original.titleApplied=true;}
        else if (original.titleApplied) {field.metadata.title=original.title; original.titleApplied=false;}
        if (field.image && (thumbnailUrl || original.imageApplied)) {
            const images=thumbnailUrl?[{url:thumbnailUrl,width:1280,height:720}]:original.images;
            if (field.kind==='tile') field.image.thumbnails=images;else field.image.sources=images;
            original.imageApplied=!!thumbnailUrl;
        }
        return {title:replacement, titleChanged:replacement!==text(original.title),thumbnailUrl};
    }
    function prepare(items) {
        if (!Array.isArray(items)) return;
        if (Ma('enableAdBlock')) for(let i=items.length-1;i>=0;i--)if(items[i]&&items[i].adSlotRenderer)items.splice(i,1);
        for(const item of items){const card=videoCard(item);if(card)apply(card);}
    }
    function render() {
        renderTimer=null;let titles=0,thumbnails=0;
        for(const tile of document.querySelectorAll('ytlr-tile-renderer')) {
            const card=videoCard(tile.data || tile.__instance&&tile.__instance.props&&tile.__instance.props.data);if(!card)continue;
            const result=apply(card);if(!result)continue;
            const titleElement=tile.querySelector('ytlr-tile-metadata-renderer yt-formatted-string, ytlr-lockup-metadata-view-model yt-formatted-string');
            if(titleElement&&titleElement.textContent!==result.title)titleElement.textContent=result.title;
            if(result.titleChanged)titles++;
            const header=tile.querySelector('ytlr-tile-header-renderer');let image=tile.querySelector('.yakuzavideo-dearrow-image');
            if(result.thumbnailUrl&&header) {
                if(!image){image=document.createElement('img');image.onload=()=>{image.style.visibility='visible';};image.onerror=()=>{const url=image.getAttribute('src');if(url)failedImages.set(url,Date.now()+30000);status.imageErrors=(status.imageErrors||0)+1;if(!status.imageErrorShown){status.imageErrorShown=true;Va('DeArrow','Ein Vorschaubild konnte nicht geladen werden. Das ursprüngliche Bild bleibt erhalten.');}schedule();};image.className='yakuzavideo-dearrow-image';image.alt='';Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none',zIndex:'1',visibility:'hidden'});header.style.position='relative';header.appendChild(image);}
                if(image.getAttribute('src')!==result.thumbnailUrl)image.setAttribute('src',result.thumbnailUrl);thumbnails++;
            } else if(image)image.remove();
        }
        status.titles=titles;status.thumbnails=thumbnails;
        if(!Ma('enableDeArrow'))status.state='disabled';
    }
    window.__yvDeArrow={prepare,render};
    let observedBody;
    function observeBody(){if(document.body&&document.body!==observedBody){observedBody=document.body;new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});}schedule();}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeBody,{once:true});
    observeBody();
    Ra.addEventListener('configChange',event=>{if(/^enableDeArrow/.test(event.detail.key))schedule();});
    window.addEventListener('hashchange',schedule);
    schedule();
}
function To(items) {if(window.__yvDeArrow)window.__yvDeArrow.prepare(items);}
yvInstallDeArrow();
function yvFeatureSummary(name) {
    const sponsor = name === 'sponsorblock';
    if (!Ma(sponsor ? 'enableSponsorBlock' : 'enableDeArrow')) return 'Ausgeschaltet';
    const state = window.__yvFeatureStatus && window.__yvFeatureStatus[name];
    if (!state || state.state === 'idle') return sponsor ? 'Aktiv · Video öffnen' : 'Aktiv';
    if (state.state === 'error') return 'Aktiv · Daten konnten nicht geladen werden';
    if (state.state === 'loading') return 'Aktiv · Daten werden geladen';
    if (sponsor) {
        const manual = Ma('sponsorBlockManualSkips') || [];
        return 'Aktiv · ' + (state.segments || 0) + ' Segmente' + (manual.length ? ' · Manuell: ' + manual.map(category => ga('sponsorblock.segments.' + category)).join(', ') : ' · Automatisches Überspringen');
    }
    return 'Aktiv · ' + (state.titles || 0) + ' Titel und ' + (state.thumbnails || 0) + ' Bilder ersetzt' + (Ma('enableDeArrowThumbnails') && state.imageErrors ? ' · Bildabruf fehlgeschlagen' : '');
}
