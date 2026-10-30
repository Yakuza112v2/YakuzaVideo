const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const input=process.argv[2]&&fs.readFileSync(process.argv[2],'utf8');const code=input?input.slice(input.indexOf('function yvInstallDeArrow('),input.indexOf('function wo(',input.indexOf('function yvInstallDeArrow('))):fs.readFileSync(__dirname+'/dearrow.js','utf8');
function card(id='fixture0001'){return {contentType:'TILE_CONTENT_TYPE_VIDEO',contentId:id,metadata:{tileMetadataRenderer:{title:{simpleText:'Ursprünglicher Titel'}}},header:{tileHeaderRenderer:{thumbnail:{thumbnails:[{url:'original.jpg'}]}}}};}
async function harness({enabled=true,thumbnail=true,data={titles:[{title:'Sachlicher Titel',votes:2,original:false}],thumbnails:[{timestamp:0,votes:2,original:false}]},error=false}={}){
 const timers=new Map(),settings={enableDeArrow:enabled,enableDeArrowThumbnails:thumbnail,enableAdBlock:true},events={},requests=[];let next=0;
 const title={textContent:'Ursprünglicher Titel'},header={style:{},appendChild(c){tile.image=c;c.remove=()=>tile.image=null}};
 const tile={data:card(),image:null,querySelector(s){return s.includes('metadata')?title:s==='ytlr-tile-header-renderer'?header:s==='.yakuzavideo-dearrow-image'?this.image:null;}};
 const window={addEventListener:(n,f)=>events[n]=f};const context={window,Ma:k=>settings[k],Ra:{addEventListener:(n,f)=>events.config=f},Va(){},ga:k=>k,AbortController,Date,console:{...console,error(){}},document:{body:{},querySelectorAll:()=>[tile],createElement:()=>({style:{},attrs:{},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v}})},MutationObserver:class{observe(){}},setTimeout:(f,ms)=>{let id=++next;timers.set(id,{f,ms});return id},clearTimeout:n=>timers.delete(n),fetch:async url=>{requests.push(url);if(error)throw new Error('network');return{ok:true,status:200,json:async()=>data}}};
 vm.createContext(context);vm.runInContext(code,context);
 async function flush(){for(let j=0;j<20;j++){await Promise.resolve();for(const [id,t]of [...timers])if(t.ms===0){timers.delete(id);t.f()}}}
 await flush();return{window,settings,events,requests,tile,title,header,context,flush,change(k,v){settings[k]=v;events.config({detail:{key:k,value:v}})}};
}
(async()=>{
 const h=await harness();assert.equal(h.requests.length,1,'cached live cards trigger data fetch without parser hook');assert.equal(h.title.textContent,'Sachlicher Titel');assert.equal(h.tile.data.metadata.tileMetadataRenderer.title.simpleText,'Sachlicher Titel');assert.match(h.tile.image.attrs.src,/time=0$/,'zero-second thumbnails are valid');
 h.tile.image.onload();assert.equal(h.tile.image.style.visibility,'visible');
 const imageError=await harness();imageError.tile.image.onerror();await imageError.flush();assert.equal(imageError.tile.image,null);assert.equal(imageError.title.textContent,'Sachlicher Titel');assert.equal(imageError.tile.data.header.tileHeaderRenderer.thumbnail.thumbnails[0].url,'original.jpg','restore original image after thumbnail load failure');
 h.change('enableDeArrow',false);await h.flush();assert.equal(h.title.textContent,'Ursprünglicher Titel');assert.equal(h.tile.image,null);assert.equal(h.tile.data.header.tileHeaderRenderer.thumbnail.thumbnails[0].url,'original.jpg');
 h.change('enableDeArrow',true);await h.flush();assert.equal(h.title.textContent,'Sachlicher Titel');assert.equal(h.requests.length,1,'apply cached data immediately when re-enabled');
 h.change('enableDeArrowThumbnails',false);await h.flush();assert.equal(h.tile.image,null);assert.equal(h.title.textContent,'Sachlicher Titel','title and thumbnail options are separate');
 const none=await harness({data:{titles:[],thumbnails:[]}});assert.equal(none.title.textContent,'Ursprünglicher Titel');assert.equal(none.tile.image,null);
 const off=await harness({enabled:false});assert.equal(off.requests.length,0);
 const failed=await harness({error:true});assert.equal(failed.window.__yvFeatureStatus.dearrow.state,'error');assert.equal(failed.title.textContent,'Ursprünglicher Titel','failed lookup never blanks a title');
 h.tile.data=card('fixture0002');h.window.__yvDeArrow.render();await h.flush();assert.equal(h.requests.length,2,'new video in a recycled tile gets its own data');
 h.tile.data.header.tileHeaderRenderer.thumbnail.thumbnails=[{url:'hq-thumbnail.jpg'}];h.window.__yvDeArrow.render();assert.equal(h.tile.data.header.tileHeaderRenderer.thumbnail.thumbnails[0].url,'hq-thumbnail.jpg','title-only DeArrow must not override HQ thumbnail setting');
 const lockup={contentType:'LOCKUP_CONTENT_TYPE_VIDEO',contentId:'fixture0003',metadata:{lockupMetadataViewModel:{title:{content:'Lockup original'}}},contentImage:{thumbnailViewModel:{image:{sources:[{url:'lockup.jpg'}]}}}};
 h.window.__yvDeArrow.prepare([{lockupViewModel:lockup}]);await h.flush();h.window.__yvDeArrow.prepare([{lockupViewModel:lockup}]);assert.equal(lockup.metadata.lockupMetadataViewModel.title.content,'Sachlicher Titel');
 console.log('DeArrow verified: real live model and DOM title, zero-second thumbnail, immediate enable/disable, separate image toggle, caching, recycled tiles, lockups and failed/no-data responses');
})().catch(e=>{console.error(e);process.exitCode=1});
