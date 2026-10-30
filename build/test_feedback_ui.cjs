const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(process.argv[2],'utf8'),translations=JSON.parse(fs.readFileSync(__dirname+'/de.json','utf8'));
function between(a,b){const i=script.indexOf(a),j=script.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return script.slice(i,j);}
const card={style:'TILE_STYLE_YTLR_DEFAULT',contentType:'TILE_CONTENT_TYPE_VIDEO',contentId:'fixture0001',metadata:{tileMetadataRenderer:{title:{simpleText:'Video'},lines:[{lineRenderer:{items:[{lineItemRenderer:{text:{simpleText:'Kanal'}}}]}}]}},header:{tileHeaderRenderer:{thumbnail:{thumbnails:[{url:'https://example.com/image.jpg'}]}}},onSelectCommand:{watchEndpoint:{videoId:'fixture0001'}},onLongPressCommand:{showEngagementPanelEndpoint:{identifier:{tag:'PAcontext_menu'},globalConfiguration:{params:'server-params'}}}};
let listener,observer;const element={data:card};const context={x:v=>typeof v,window:{},location:{hash:'#/'},document:{body:{},querySelectorAll:()=>[element],addEventListener:(n,f)=>listener=f},MutationObserver:class{constructor(f){observer=f;}observe(){}},setTimeout:f=>{f();return 1;},ga:k=>translations.videoMenu[k.split('.')[1]]||k,Ma:k=>k==='enableLongPress',b:values=>{let i=0;return{s(){},n(){return i<values.length?{value:values[i++],done:false}:{done:true};},e(e){throw e;},f(){}};},btoa:v=>Buffer.from(v,'binary').toString('base64')};
vm.createContext(context);
vm.runInContext(between('function so(','function lo(')+between('function _a(','function Ka(')+between('function bo(','setTimeout(')+between('function Co(','function yvInstallFeedbackUi(')+between('function yvInstallFeedbackUi(','yvInstallFeedbackUi(Co,xo,ga,so);'),context);
// The parser already ran before script injection; work with the live renderer object.
vm.runInContext('yvInstallFeedbackUi(Co,xo,ga,so)',context);
const items=card.onLongPressCommand.showMenuCommand.menu.menuRenderer.items;
const labels=items.map(item=>item.menuServiceItemRenderer?.text.runs[0].text||item.menuNavigationItemRenderer?.text.runs[0].text);
assert.deepEqual(Array.from(labels).slice(0,2),['Kein Interesse','Keine Videos von diesem Kanal empfehlen']);
assert.equal(items[0].menuServiceItemRenderer.serviceEndpoint.playlistEditEndpoint.customAction.parameters.params,'server-params');
listener({keyCode:13});assert.equal(items.length,7,'repeated opening must not duplicate options');
const old=card.onLongPressCommand;context.location.hash='#/watch?v=fixture0001';listener({keyCode:13});assert.equal(card.onLongPressCommand,old);
assert.equal(typeof observer,'function');console.log('Live Home component repair verified: cached native panel becomes complete menu; feedback first; no duplicates');
