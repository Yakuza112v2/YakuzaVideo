const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(process.argv[2],'utf8');
const a=script.indexOf('function yvObserveStartupBrowse('),b=script.indexOf('function po(e,t){',a),code=script.slice(a,b);
const command={clickTrackingParams:'fixture-tracking',loadReloadContinuationCommand:{continuation:'server-issued-home-continuation',targetId:'browse-feedFEtopics'}};
function environment({ready=true,hash='#/',enabled=true,target=null,identity=null}={}){
 let now=0,id=0;const timers=new Map(),listeners=new Map(),commands=[];
 const root={data:{targetId:'browse-feedFEtopics',content:{sectionListRenderer:{contents:[{shelfRenderer:{content:{horizontalListRenderer:{items:[{gridButtonRenderer:{navigationEndpoint:command}}]}}}}]}}}};
 const state={ready};const location={hash};const router={instance:{resolveCommand(){}}};const registry={mappings:{},get(name){return name==='CurrentIdentityService'?identity:null;}};
 const window={_yttv:{router,registry},addEventListener(n,f){listeners.set(n,f);},removeEventListener(n,f){if(listeners.get(n)===f)listeners.delete(n);}};
 const context={window,location,document:{querySelectorAll(){return state.ready?[root]:[];}},Date:{now:()=>now},Ma:k=>k==='reloadHomeOnStartup'?enabled:target,po:c=>commands.push(c),setTimeout(fn,delay){const n=++id;timers.set(n,{at:now+delay,fn});return n;},clearTimeout(n){timers.delete(n);}};
 vm.createContext(context);vm.runInContext(code+';yvRefreshHomeOnStartup();',context);
 function advance(ms){const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;timers.delete(next[0]);now=next[1].at;next[1].fn();}now=end;}
 return {state,root,location,window,context,commands,timers,listeners,advance};
}
let checks=0;function check(name,fn){fn();checks++;}
check('use the exact Refresh command from the actual Fire TV response layout',()=>{const e=environment();assert.equal(e.commands[0],command);assert.equal(e.commands.length,1);assert.equal(e.window.__yvStartupRefreshDone,true);assert.equal(e.listeners.size,0);e.advance(30000);assert.equal(e.commands.length,1);});
check('wait for the live component data, including an off-screen Refresh button',()=>{const e=environment({ready:false});e.advance(1000);assert.equal(e.commands.length,0);e.state.ready=true;e.advance(200);assert.equal(e.commands[0],command);});
check('do not reload a shelf or invent a Home continuation',()=>{const e=environment({ready:false});e.root.data.content.sectionListRenderer.contents[0].shelfRenderer.content.horizontalListRenderer.items=[{gridButtonRenderer:{navigationEndpoint:{loadReloadContinuationCommand:{targetId:'another-shelf',continuation:'other'}}}}];e.state.ready=true;e.advance(25000);assert.equal(e.commands.length,0);assert.equal(e.timers.size,0);});
check('manual navigation and real remote input cancel; diagnostic key zero does not',()=>{const e=environment({ready:false});e.listeners.get('keydown')({keyCode:0});e.state.ready=true;e.advance(200);assert.equal(e.commands.length,1);const manual=environment({ready:false});manual.listeners.get('keydown')({keyCode:13});manual.state.ready=true;manual.advance(1000);assert.equal(manual.commands.length,0);const other=environment({ready:false});other.location.hash='#/watch?v=fixture0001';other.listeners.get('hashchange')();other.state.ready=true;other.advance(1000);assert.equal(other.commands.length,0);});
check('leave deep links and disabled startup refresh alone',()=>{for(const opts of [{hash:'#/watch?v=fixture0001'},{enabled:false},{hash:'#/browse?c=FEsubscriptions'}]){const e=environment(opts);e.advance(25000);assert.equal(e.commands.length,0);}});
check('respect another configured startup page and one-time scheduling',()=>{const e=environment({target:JSON.stringify({browseEndpoint:{browseId:'FEsubscriptions'}})});assert.equal(e.commands[0].browseEndpoint.browseId,'FEsubscriptions');vm.runInContext('yvRefreshHomeOnStartup()',e.context);assert.equal(e.commands.length,1);});
(async()=>{let resolve;const e=environment({identity:{get:()=>new Promise(r=>resolve=r)}});assert.equal(e.commands.length,0);resolve({});await new Promise(setImmediate);assert.equal(e.commands[0],command);checks++;console.log(checks+' native Home refresh checks passed');})().catch(e=>{console.error(e);process.exitCode=1;});
