const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(process.argv[2],'utf8');const a=script.indexOf('function yvObserveStartupBrowse('),b=script.indexOf('function yvInstallBrowseSettings(',a),code=script.slice(a,b);
const command={clickTrackingParams:'fixture-tracking',loadReloadContinuationCommand:{continuation:'server-issued-home-continuation',targetId:'browse-feedFEtopics'}};
function environment({ready=true,hash='#/',enabled=true,target=null,identity={get:()=>({})},respond=true}={}){
 let now=0,id=0;const timers=new Map(),windowListeners=new Map(),documentListeners=new Map(),commands=[];
 const content=()=>({sectionListRenderer:{contents:[{shelfRenderer:{content:{horizontalListRenderer:{items:[{gridButtonRenderer:{navigationEndpoint:command}}]}}}}]}});
 const root={data:{targetId:'browse-feedFEtopics',content:content()}};const state={ready,modal:false};const location={hash};
 function later(fn,delay){const n=++id;timers.set(n,{at:now+delay,fn});return n;}
 const window={_yttv:{router:{instance:{resolveCommand(){}}},registry:{mappings:{},get:n=>n==='CurrentIdentityService'?identity:null}},addEventListener:(n,f)=>windowListeners.set(n,f)};
 const document={visibilityState:'visible',querySelector:()=>state.modal?{}:null,querySelectorAll:()=>state.ready?[root]:[],addEventListener:(n,f)=>documentListeners.set(n,f)};
 const context={window,document,location,Date:{now:()=>now},Ma:k=>k==='reloadHomeOnStartup'?enabled:target,po:c=>{commands.push(c);if(respond&&c===command)later(()=>{root.data.content={...content(),videos:[{tileRenderer:{contentType:'TILE_CONTENT_TYPE_VIDEO',contentId:'fixture0001'}}]};},200);},setTimeout:later,clearTimeout:n=>timers.delete(n)};
 vm.createContext(context);vm.runInContext(code+';yvRefreshHomeOnStartup();',context);
 async function advance(ms){await Promise.resolve();await Promise.resolve();const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;timers.delete(next[0]);now=next[1].at;next[1].fn();await Promise.resolve();await Promise.resolve();}now=end;}
 function visibility(value){document.visibilityState=value;documentListeners.get('visibilitychange')();}
 return {state,root,location,window,document,context,commands,timers,windowListeners,documentListeners,advance,visibility};
}
(async()=>{
 let checks=0;async function check(name,fn){await fn();checks++;}
 await check('success requires a new populated Home model, not just command dispatch',async()=>{const e=environment();await e.advance(1100);assert.equal(e.commands[0],command);assert.equal(e.window.__yvStartupRefreshDone,false);await e.advance(1600);assert.equal(e.window.__yvStartupRefreshDone,true);assert.equal(e.window.__yvHomeRefreshResult.videos,1);});
 await check('refresh on every real background/foreground return, without page reload',async()=>{const e=environment();await e.advance(3000);for(let i=0;i<3;i++){e.visibility('hidden');e.visibility('visible');await e.advance(3000);}assert.equal(e.commands.length,4);assert.equal(e.window.__yvStartupRefreshDone,true);});
 await check('remote navigation within Home does not cancel pending work',async()=>{const e=environment({ready:false});assert.equal(e.windowListeners.has('keydown'),false);await e.advance(1000);e.state.ready=true;await e.advance(3000);assert.equal(e.commands.length,1);});
 await check('an open user dialog is never interrupted',async()=>{const e=environment();e.state.modal=true;await e.advance(5000);assert.equal(e.commands.length,0);e.state.modal=false;await e.advance(3000);assert.equal(e.commands.length,1);});
 await check('do not claim success for an unchanged or empty response; bounded retry',async()=>{const e=environment({respond:false});await e.advance(30000);assert.equal(e.commands.length,3);assert.equal(e.window.__yvStartupRefreshDone,false);assert.equal(e.window.__yvHomeRefreshResult.unconfirmed,true);assert.equal(e.timers.size,0);});
 await check('stop when user leaves Home and leave watching/deep links alone',async()=>{const e=environment({ready:false});e.location.hash='#/watch?v=fixture0001';e.windowListeners.get('hashchange')();e.state.ready=true;await e.advance(5000);assert.equal(e.commands.length,0);for(const opts of [{hash:'#/watch?v=fixture0001'},{enabled:false},{hash:'#/browse?c=FEsubscriptions'}]){const other=environment(opts);await other.advance(30000);assert.equal(other.commands.length,0);}});
 await check('wait for authenticated identity and live Home data',async()=>{let resolve;const e=environment({identity:{get:()=>new Promise(r=>resolve=r)}});await e.advance(1000);assert.equal(e.commands.length,0);resolve({});await e.advance(3000);assert.equal(e.commands.length,1);});
 await check('respect configured startup page once, not on every foreground return',async()=>{const e=environment({target:JSON.stringify({browseEndpoint:{browseId:'FEsubscriptions'}})});await e.advance(200);assert.equal(e.commands[0].browseEndpoint.browseId,'FEsubscriptions');vm.runInContext('yvRefreshHomeOnStartup()',e.context);assert.equal(e.commands.length,1);});
 console.log(checks+' Home lifecycle and confirmed refresh checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
