const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/dismissed_videos.js','utf8');
function card(id){return {tileRenderer:{contentId:id,contentType:'TILE_CONTENT_TYPE_VIDEO'}};}
function surface(target='browse-feedFEtopics'){return {targetId:target,content:{items:[card('fixture0001'),card('fixture0002')]}};}
async function harness(storage={}){
 let n=0,now=0;const timers=new Map(),events={},state={profile:'A',modal:false};const commands=[];
 const tiles=['fixture0001','fixture0002'].map(id=>({data:card(id).tileRenderer,style:{display:''},attrs:{},getAttribute(k){return this.attrs[k]??null},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}}));
 const root={data:surface()},location={hash:'#/'};
 const window={_yttv:{registry:{mappings:{},get:k=>k==='CurrentIdentityService'?{get:async()=>({ownerObfuscatedGaiaId:'owner',effectiveObfuscatedGaiaId:state.profile})}:null}},addEventListener:(n,f)=>events[n]=f};
 const context={yvHasOpenDialog:()=>state.modal,window,location,localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},document:{body:{},querySelectorAll:s=>s==='ytlr-tv-surface-content-renderer'?[root]:tiles,querySelector:()=>state.modal?{}:null},MutationObserver:class{observe(){}},setTimeout(f,ms){const id=++n;timers.set(id,{f,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),yvHomeRefreshCommand:()=>({refresh:true}),po:c=>commands.push(c)};
 vm.createContext(context);vm.runInContext(code+';yvInstallDismissedVideos()',context);
 async function advance(ms=0){await Promise.resolve();await Promise.resolve();await Promise.resolve();const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;timers.delete(next[0]);now=next[1].at;next[1].f();await Promise.resolve();await Promise.resolve();}now=end;}
 await advance();return {api:window.__yvDismissedVideos,window,state,storage,root,tiles,location,commands,advance,context};
}
(async()=>{
 const h=await harness();const scope=await h.api.context();assert.equal(scope,'owner:A');
 assert.equal(h.api.add('fixture0001',scope),true);assert.equal(h.tiles[0].style.display,'none','immediate removal from visible recommendation tiles');assert.equal(h.tiles[1].style.display,'');assert.equal(h.root.data.content.items.length,1);
 const fresh=surface();h.api.filter(fresh);assert.equal(fresh.content.items.length,1);assert.equal(fresh.content.items[0].tileRenderer.contentId,'fixture0002');
 const restarted=await harness(h.storage);assert.equal(restarted.tiles[0].style.display,'none','dismissal survives a full app restart');
 const history=surface('browse-feedFEhistory'),subs=surface('browse-feedFEsubscriptions');h.api.filter(history);h.api.filter(subs);assert.equal(history.content.items.length,2);assert.equal(subs.content.items.length,2,'do not remove videos from subscriptions/history');
 h.location.hash='#/browse?c=FEsubscriptions';h.api.render();assert.equal(h.tiles[0].style.display,'','restore a recycled tile outside Home');h.location.hash='#/';
 h.state.profile='B';await h.api.context();await h.advance();const other=surface();h.api.filter(other);assert.equal(other.content.items.length,2,'profile B does not inherit A dismissal');assert.equal(h.tiles[0].style.display,'');
 h.state.profile='A';await h.api.context();await h.advance();assert.equal(h.tiles[0].style.display,'none');
 h.state.modal=true;h.api.refresh();await h.advance(2000);assert.equal(h.commands.length,0,'leave the user reason dialog open');h.state.modal=false;await h.advance(500);assert.equal(h.commands.length,1,'replace the recommendation model after user closes dialog');
 const before=Object.values(h.storage)[0];assert.equal(h.api.add('invalid!',scope),false);assert.equal(Object.values(h.storage)[0],before);
 console.log('Dismissed videos verified: immediate hide, incoming Home model filtering, persistence, profile isolation, history/subscriptions preserved and user dialog untouched');
})().catch(e=>{console.error(e);process.exitCode=1});
