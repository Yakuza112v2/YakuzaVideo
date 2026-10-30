const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(process.argv[2],'utf8'),start=script.indexOf('function yvInstallWatchStatus('),end=script.indexOf('yvInstallWatchStatus();',start),code=script.slice(start,end);
function card(id,percent,seconds){return {tileRenderer:{contentType:'TILE_CONTENT_TYPE_VIDEO',contentId:id,onSelectCommand:{watchEndpoint:{videoId:id,...(seconds===undefined?{}:{startTimeSeconds:seconds})}},header:{tileHeaderRenderer:{thumbnailOverlays:percent===undefined?[]:[{thumbnailOverlayResumePlaybackRenderer:{percentDurationWatched:percent}}]}}}};}
function harness(saved={},options={}){
 const listeners={},wl={},timers=[],location={hash:'#/'},storage={...saved};
 function el(){return {style:{},children:[],attrs:{},setAttribute(k,v){this.attrs[k]=v},appendChild(c){this.children.push(c);this.firstChild=this.children[0];c.remove=()=>{this.children=this.children.filter(x=>x!==c)};}}}
 const tiles=[card('watched0001'),card('partial0001'),card('unknown0001')].map(v=>{const t=el(),header=el();t.data=v.tileRenderer;t.querySelector=s=>s==='ytlr-tile-header-renderer'?header:s==='.yakuzavideo-watch-progress'?header.children.find(c=>c.className==='yakuzavideo-watch-progress'):null;t.header=header;return t;});
 const response={contents:{tvBrowseRenderer:{content:{tvSurfaceContentRenderer:{content:{sectionListRenderer:{contents:[card('watched0001',100),card('partial0001',40,40)]}}}}}}};
 const pending=[];const client={fetch(){return {subscribe(next){if(options.delayed)pending.push(next);else next(response);return {unsubscribe(){}};}};}};
 const context={window:{_yttv:{registry:{mappings:{},get:n=>n==='KabukiInnerTubeClient'?client:n==='CurrentIdentityService'?options.identity:null}},addEventListener:(n,f)=>wl[n]=f},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},location,document:{body:{},querySelectorAll:()=>tiles,createElement:el,addEventListener:(n,f)=>listeners[n]=f},MutationObserver:class{observe(){}},setTimeout:(fn,ms)=>{const t={fn,ms,active:true};timers.push(t);return t;},clearTimeout:t=>{if(t)t.active=false;},Date,console};
 function flush(){for(let i=0;i<timers.length;i++){const t=timers[i];if(t.active&&t.ms===0){t.active=false;t.fn();}}}
 vm.createContext(context);vm.runInContext(code+';yvInstallWatchStatus();',context);flush();
 return {listeners,wl,tiles,location,storage,flush,timers,pending,response,bar:i=>tiles[i].querySelector('.yakuzavideo-watch-progress')};
}
const h=harness();
assert.equal(h.bar(0).firstChild.style.width,'100%');assert.equal(h.bar(1).firstChild.style.width,'40%');assert.equal(h.bar(2),undefined);
assert.equal(h.tiles[1].data.onSelectCommand.watchEndpoint.startTimeSeconds,40,'history resume time copied to Home launch command');
const v={tagName:'VIDEO',duration:100,currentTime:25,readyState:4};
h.listeners.timeupdate({type:'timeupdate',target:v});h.flush();assert.equal(h.bar(2),undefined,'Home previews never count');
h.location.hash='#/watch?v=unknown0001';h.listeners.timeupdate({type:'timeupdate',target:v});h.flush();assert.equal(h.bar(2).firstChild.style.width,'25%');
h.location.hash='#/';h.wl.hashchange();h.flush();assert.equal(h.tiles[2].data.onSelectCommand.watchEndpoint.startTimeSeconds,25);
const restarted=harness(h.storage);restarted.location.hash='#/watch?v=unknown0001';const video={tagName:'VIDEO',duration:100,currentTime:0,readyState:1};restarted.listeners.loadedmetadata({target:video});assert.equal(video.currentTime,25,'resume survives a complete app restart');
video.currentTime=9;restarted.listeners.timeupdate({type:'timeupdate',target:video});assert.equal(video.currentTime,9,'user seeking backwards is respected');
h.location.hash='#/watch?v=unknown0001';v.currentTime=100;h.listeners.timeupdate({type:'timeupdate',target:v});h.flush();assert.equal(h.bar(2).firstChild.style.width,'99%','position alone does not prove completion');h.listeners.ended({type:'ended',target:v});h.flush();assert.equal(h.bar(2).firstChild.style.width,'100%');
console.log('Thumbnail progress and playback resume verified: server position, persistent local position, restart, manual seeking, completion and preview isolation');
const preview=harness();preview.location.hash='#/watch?v=unknown0001';preview.listeners.timeupdate({type:'timeupdate',target:{tagName:'VIDEO',duration:100,currentTime:50,readyState:4,closest:()=>({})}});preview.flush();assert.equal(preview.bar(2),undefined,'preview media cannot overwrite the main video position even while watch route is active');
(async()=>{
 let profile='A';const e=harness({}, {delayed:true,identity:{get:()=>Promise.resolve({ownerObfuscatedGaiaId:'owner',effectiveObfuscatedGaiaId:profile})}});
 const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();e.flush()};await settle();assert.equal(e.pending.length,1);
 profile='B';const poll=e.timers.find(t=>t.active&&t.ms===2000);poll.active=false;poll.fn();await settle();
 e.pending.shift()(e.response);await settle();assert.equal(e.bar(0),undefined,'late history from profile A must not leak into B');assert.equal(e.pending.length,1,'new profile receives its own history request');
 e.pending.shift()(e.response);await settle();assert.equal(e.bar(0).firstChild.style.width,'100%');console.log('Playback profile changes, late history isolation and preview events verified');
})().catch(error=>{console.error(error);process.exitCode=1});
