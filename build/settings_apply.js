function yvInstallBrowseSettings() {
    if (window.__yvBrowseSettingsInstalled) return;
    window.__yvBrowseSettingsInstalled = true;
    let pending=false, timer, attempts=0;
    const keys=new Set(['enableAdBlock','enableShorts','enablePreviews','enableHqThumbnails','enableLongPress','enableHideWatchedVideos','hideWatchedVideosThreshold','hideWatchedVideosPages','enableDeArrow','enableDeArrowThumbnails']);
    function home() {const route=(location.hash||'').replace(/^#/,'');return route===''||route==='/'||/^\/browse\?(?:.*&)?(?:c|browseId)=FE(?:topics|what_to_watch)(?:&|$)/.test(route);}
    function apply() {
        timer=null;if(!pending||!home())return;
        if(document.querySelector('ytlr-overlay-panel-renderer, ytlr-menu-renderer')){timer=setTimeout(apply,500);return;}
        const command=yvHomeRefreshCommand();
        if(command){pending=false;po(command);}else if(++attempts<40)timer=setTimeout(apply,500);
    }
    function schedule() {if(!timer)timer=setTimeout(apply,500);}
    Ra.addEventListener('configChange',event=>{if(keys.has(event.detail.key)){pending=true;attempts=0;schedule();}});
    window.addEventListener('hashchange',()=>{if(pending)schedule();});
}
yvInstallBrowseSettings();
