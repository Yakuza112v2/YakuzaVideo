const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(process.argv[2],'utf8');
const start=script.indexOf('var za,Ba='),end=script.indexOf('window.isPipPlaying=',start),config=script.slice(start,end);
for(const value of [undefined,'null','[]','42','{broken']){
 const window={h5vcc:true,localStorage:{'ytaf-configuration':value}};
 const c={window,console:{warn(){},info(){},error(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}};vm.createContext(c);vm.runInContext(config,c);
 assert.equal(c.Ma('enableSponsorBlock'),true,'invalid saved settings must not crash the entire script');
 assert.equal(c.Ma('reloadHomeOnStartup'),true);
}
const window={h5vcc:true,localStorage:new Proxy({'ytaf-configuration':'{"enableDeArrow":true}'},{set(){throw Error('storage unavailable')}})};
const c={window,console:{warn(){},info(){},error(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}};vm.createContext(c);vm.runInContext(config,c);let applied=false;c.Ra.addEventListener('configChange',()=>applied=true);c.Ia('enableDeArrow',false);assert.equal(c.Ma('enableDeArrow'),false);assert.equal(applied,true,'storage failure must not prevent live application');
const begin=script.indexOf('function Na('),finish=script.indexOf('"complete"===document.readyState?Na()',begin);
const timers=[];const context={window:{},setTimeout:f=>timers.push(f)};vm.createContext(context);vm.runInContext(script.slice(begin,finish)+';Na();',context);assert.equal(timers.length,1,'late service registry must not abort script initialization');
let starts=0,stops=0;const preview={start(){starts++;return 'started'},stop(){stops++}};const player={};context.window._yttv={early:{mappings:{},get(){throw Error('not ready')}},later:{mappings:{},get:n=>n==='PlayerService'?player:preview}};timers.shift()();assert.equal(context.Fa,player);assert.equal(preview.start(),'started');preview.stop();assert.equal(starts,1);assert.equal(stops,1);context.window.isPipPlaying=true;preview.start();preview.stop();assert.equal(starts,1);assert.equal(stops,1);assert.equal(context.window.__yvPlayerServicesReady,true);
console.log('Full configuration initialization and delayed native player services verified, including corrupt settings and unavailable storage');
