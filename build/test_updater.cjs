const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const script=fs.readFileSync(process.argv[2],'utf8');
const start=script.indexOf('function ro('),end=script.indexOf('function ',start+10);
assert.ok(start>=0 && end>start);
const updater=script.slice(start,end);
const endpoint='https://api.github.com/repos/Yakuza112v2/YakuzaVideo/releases/latest';
const download='https://github.com/Yakuza112v2/YakuzaVideo/releases/download/v1.0.9/YakuzaVideo-armeabi-v7a.apk';
async function check(arch,current,latest,fail=false){
 const requests=[],downloads=[],dialogs=[],errors=[];
 const context={
  window:{h5vcc:{tizentube:{GetVersion:()=>current,GetArchitecture:()=>arch}}},Date,
  console:{info(){},error(...args){errors.push(args);}},
  fetch:async url=>{requests.push(url);if(fail)throw Error('offline');return {ok:true,json:async()=>({tag_name:'v'+latest,published_at:'2026-10-29T00:00:00Z',body:'Personal update',assets:[{name:'SHA256SUMS.txt'},{name:'YakuzaVideo-armeabi-v7a.apk',browser_download_url:download}]})};},
  ga:value=>value,Ha:(label,icon,actions)=>{for(const action of actions)if(action.customAction?.action==='UPDATE_DOWNLOAD')downloads.push(action.customAction.parameters);return {};},
  Qa:value=>value,Wa:value=>value,ja:(...args)=>dialogs.push(args),Va(){}
 };
 vm.createContext(context);vm.runInContext(updater+';ro(false);',context);
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(requests,[endpoint]);
 if(fail){assert.equal(dialogs.length,0);assert.equal(errors.length,1);}
 else if(latest===current){assert.equal(dialogs.length,0);assert.equal(downloads.length,0);}
 else{assert.equal(dialogs.length,1);assert.deepEqual(downloads,[download]);assert.equal(errors.length,0);}
}
(async()=>{
 await check('armeabi-v7a','1.0.8','1.0.9');
 await check('arm64-v8a','1.0.8','1.0.9');
 await check(undefined,'1.0.8','1.0.8');
 await check('armeabi-v7a','1.0.8','1.0.8');
 await check('armeabi-v7a','1.0.8','1.0.9',true);
 console.log('5 updater behavior checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
