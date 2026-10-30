const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const input=process.argv[2]&&fs.readFileSync(process.argv[2],'utf8');const code=input?input.slice(input.indexOf('class Po {'),input.indexOf('var zo;',input.indexOf('class Po {'))):fs.readFileSync(__dirname+'/sponsorblock.js','utf8');
async function harness({enabled=true,manual=[],category=true,fail=false,noData=false}={}){
 const settings={enableSponsorBlock:enabled,enableSponsorBlockSponsor:category,enableSponsorBlockToasts:true,sponsorBlockManualSkips:manual};
 const timers=new Map(),events={},requests=[],toasts=[];let id=0,now=100000;const network={fail,noData};const state={video:{tagName:'VIDEO',currentTime:0,duration:120,paused:false,playbackRate:1,closest:()=>null}};
 const segments=[{segment:[10,20],category:'sponsor',UUID:'one',actionType:'skip'}];
 const location={hash:'#/watch?v=fixture0001'};const window={addEventListener:(n,f)=>events['window:'+n]=f};
 const context={window,location,URLSearchParams,AbortController,Date:{now:()=>now},console:{...console,error(){}},Ma:k=>settings[k],Do:v=>{assert.equal(v,'fixture0001');return 'abcd'+'0'.repeat(60)},Va:(title,text)=>toasts.push({title,text}),ga:key=>key,Eo:{},Ra:{addEventListener:(n,f)=>events.config=f},document:{querySelectorAll:()=>[state.video],querySelector:()=>null,addEventListener:(n,f)=>events[n]=f},setTimeout:(f,ms)=>{const n=++id;timers.set(n,{f,ms});return n},clearTimeout:n=>timers.delete(n),fetch:async url=>{requests.push(url);if(network.fail)throw new Error('network');return{ok:true,status:network.noData?404:200,json:async()=>[{videoID:'fixture0001',segments}]}}};
 vm.createContext(context);vm.runInContext(code,context);
 async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
 await flush();return {context,window,location,events,settings,timers,state,requests,toasts,flush,network,advance(ms){now+=ms;const item=[...timers].find(([,t])=>t.ms===750);if(item){timers.delete(item[0]);item[1].f();}},change(k,v){settings[k]=v;events.config({detail:{key:k,value:v}})}};
}
(async()=>{
 const h=await harness();assert.equal(h.requests.length,1,'already playing video loads segments without needing a hash change');assert.match(h.requests[0],/skipSegments\/abcd\?categories=/);
 h.state.video.currentTime=15;h.events.timeupdate({target:h.state.video});assert.equal(h.state.video.currentTime,20,'skip when already inside a segment; absent overlay cannot block it');assert.equal(h.window.__yvFeatureStatus.sponsorblock.skips,1);
 h.change('enableSponsorBlock',false);h.state.video.currentTime=15;h.events.timeupdate({target:h.state.video});assert.equal(h.state.video.currentTime,15);
 h.change('enableSponsorBlock',true);await h.flush();assert.equal(h.state.video.currentTime,20,'enable during playback applies without reopening video');
 h.change('sponsorBlockManualSkips',['sponsor']);h.state.video.currentTime=15;h.events.seeked({target:h.state.video});assert.equal(h.state.video.currentTime,15,'respect manual skips');h.change('sponsorBlockManualSkips',[]);assert.equal(h.state.video.currentTime,20,'switch manual to automatic applies immediately');
 h.change('enableSponsorBlockSponsor',false);h.state.video.currentTime=15;h.events.timeupdate({target:h.state.video});assert.equal(h.state.video.currentTime,15);h.change('enableSponsorBlockSponsor',true);assert.equal(h.state.video.currentTime,20);
 h.state.video.paused=true;h.state.video.currentTime=15;h.events.pause({target:h.state.video});assert.equal(h.state.video.currentTime,15);h.state.video.paused=false;h.events.play({target:h.state.video});assert.equal(h.state.video.currentTime,20);
 h.state.video={...h.state.video,currentTime:15};h.events.loadedmetadata({target:h.state.video});assert.equal(h.state.video.currentTime,20,'rebind when YouTube replaces the video element');
 h.state.video.currentTime=0;h.state.video.playbackRate=2;h.events.ratechange({target:h.state.video});assert.ok([...h.timers.values()].some(t=>t.ms===5000),'future skip timer accounts for playback speed');
 h.location.hash='#/watch?list=some-playlist&v=fixture0001';h.events['window:hashchange']();assert.equal(h.window.sponsorblock.videoID,'fixture0001','parse video ID regardless of parameter order');
 h.location.hash='#/';h.events['window:hashchange']();assert.equal(h.window.sponsorblock,null);h.state.video.currentTime=15;h.events.timeupdate({target:h.state.video});assert.equal(h.state.video.currentTime,15,'Home previews never trigger SponsorBlock');
 const error=await harness({fail:true});assert.equal(error.window.__yvFeatureStatus.sponsorblock.state,'error');assert.equal(error.toasts.length,1);error.network.fail=false;error.advance(31000);await error.flush();assert.equal(error.requests.length,2);assert.equal(error.window.__yvFeatureStatus.sponsorblock.state,'ready','retry failed requests rather than silently staying broken');
 const empty=await harness({noData:true});assert.equal(empty.window.__yvFeatureStatus.sponsorblock.state,'no_data');empty.state.video.currentTime=15;empty.events.timeupdate({target:empty.state.video});assert.equal(empty.state.video.currentTime,15);assert.equal(empty.requests.length,1);
 console.log('SponsorBlock verified: cold playback, missing overlay, live enable/category/manual changes, seeking into a segment, replacement video, pause, speed and preview isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
