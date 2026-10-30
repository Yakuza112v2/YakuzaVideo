const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const script = fs.readFileSync(process.argv[2], 'utf8');
const start = script.indexOf('function lo('), end = script.indexOf('function uo(', start);
const actionStart = script.indexOf('async function mo('), actionEnd = script.indexOf('function bo(', actionStart);
const translations = JSON.parse(fs.readFileSync(__dirname + '/de.json', 'utf8'));
const ga = key => key === 'toasts.feedbackSent' ? 'Feedback gesendet' : translations.videoMenu[key.split('.')[1]];
function token(value) {if (!value || typeof value !== 'object') return null; if (value.feedbackToken) return value.feedbackToken; for (const child of Object.values(value)) {const found = token(child); if (found) return found;} return null;}
function row(title, feedbackToken) {return {listItemViewModel: {title: {content: title}, rendererContext: {commandContext: {onTap: {innertubeCommand: {commandExecutorCommand: {commands: [{signalAction: {signal: 'CLOSE_POPUP'}}, {feedbackEndpoint: {feedbackToken}}]}}}}}}};}
function environment(rows) {
    const requests = [], sent = [], toasts = [], commands = [], dialogs = [];
    const client = {fetch(request) {requests.push(request); return {subscribe(next) {next({content: {engagementPanelSectionListRenderer: {content: {listViewModel: {listItems: rows}}}}}); return {unsubscribe() {}};}};}};
    const context = {window: {_yttv: {registry: {mappings: {}, get() {return client;}}}}, ga, so: token, bo: value => !value ? '' : value.content || value.simpleText || (value.runs || []).map(r=>r.text).join(''), Ha: (label,icon,actions) => ({compactLinkRenderer:{title:{simpleText:label.title},serviceEndpoint:{commandExecutorCommand:{commands:actions}}}}), Wa: items=>({overlayPanelItemListRenderer:{items}}), ja:(title,content,id)=>dialogs.push({title,content,id}), setTimeout, clearTimeout, console,
        uo: async feedbackToken => {sent.push(feedbackToken); return {feedbackResponses: [{isProcessed: true}]};}, po: command => commands.push(command), Va: (_, text) => toasts.push(text)};
    vm.createContext(context); vm.runInContext(script.slice(start, end) + script.slice(actionStart, actionEnd), context);
    return {context, requests, sent, toasts, commands, dialogs};
}
(async () => {
    const e = environment([row('Aus Wiedergabeverlauf entfernen', 'history-token'), row('Keine Videos von diesem Kanal empfehlen', 'channel-token'), row('Kein Interesse', 'interest-token')]);
    await e.context.mo({panelId: 'PAcontext_menu', params: 'video-request'}, 0, false);
    await e.context.mo({panelId: 'PAcontext_menu', params: 'video-request'}, 1, false);
    assert.deepEqual(e.sent, ['interest-token', 'channel-token']); assert.equal(e.requests[0].payload.params, 'video-request'); assert.equal(e.commands.length, 2);
    const missing = environment([row('Zum Kanal', null)]); await missing.context.mo({panelId: 'PAcontext_menu', params: 'request'}, 0, false);
    assert.equal(missing.sent.length, 0); assert.match(missing.toasts[0], /nicht an/);
    const rejected = environment([row('Not interested', 'valid')]); rejected.context.uo = async () => ({feedbackResponses: [{isProcessed: false}]});
    await rejected.context.mo({panelId: 'PAcontext_menu', params: 'request'}, 0, false); assert.match(rejected.toasts[0], /nicht bestätigt/); assert.equal(rejected.commands.length, 0);
    const reasons = environment([row('Kein Interesse', 'initial-token')]);
    reasons.context.uo = async value => {reasons.sent.push(value); return {feedbackResponses:[{isProcessed:true,followUpDialog:{dismissalFollowUpRenderer:{dismissalReasonsPrompt:{runs:[{text:'Feedback senden'}]},reasons:[
        {dismissalReasonTextRenderer:{text:{runs:[{text:'Ich habe dieses Video schon angesehen'}]},feedback:{feedbackEndpoint:{feedbackToken:'seen-token'}}}},
        {dismissalReasonTextRenderer:{text:{runs:[{text:'Das Video gefällt mir nicht'}]},feedback:{feedbackEndpoint:{feedbackToken:'dislike-token'}}}}
    ]}}}]};};
    await reasons.context.mo({panelId:'PAcontext_menu',params:'request'},0,true);
    assert.equal(reasons.dialogs.length,1); const items=reasons.dialogs[0].content.overlayPanelItemListRenderer.items;
    assert.equal(items[0].compactLinkRenderer.title.simpleText,'Ich habe dieses Video schon angesehen');
    assert.equal(items[1].compactLinkRenderer.title.simpleText,'Das Video gefällt mir nicht');
    const parameters=items[1].compactLinkRenderer.serviceEndpoint.commandExecutorCommand.commands[0].customAction.parameters;
    await reasons.context.yvSendFeedbackReason(parameters);
    assert.deepEqual(reasons.sent,['initial-token','dislike-token'],'the selected nested token reaches YouTube');
    assert.equal(reasons.commands.length,2,'dialog closes after confirmed initial and reason feedback');
    await reasons.context.mo({panelId:'PAcontext_menu',params:'another-video'},0,true);
    assert.notEqual(reasons.dialogs[0].id,reasons.dialogs[1].id,'a cached dialog must never retain another video token');
    const before=reasons.commands.length; reasons.context.uo=async()=>({feedbackResponses:[{isProcessed:false}]});
    await reasons.context.yvSendFeedbackReason(parameters);assert.equal(reasons.commands.length,before,'keep dialog open on rejection');assert.match(reasons.toasts.at(-1),/nicht bestätigt/);
    const malformed=environment([row('Kein Interesse','initial')]);malformed.context.uo=async()=>({feedbackResponses:[{isProcessed:true,followUpDialog:{dismissalFollowUpRenderer:{reasons:[{dismissalReasonTextRenderer:{text:{simpleText:'Missing token'}}},{dismissalReasonTextRenderer:{feedback:{feedbackEndpoint:{feedbackToken:'missing-text'}}}}]}}}]});
    await malformed.context.mo({panelId:'PAcontext_menu',params:'request'},0,true);assert.equal(malformed.dialogs.length,0,'never display empty or nonfunctional reason rows');
    // Exercise the real HTTP request builder, not a mock of uo.
    for (const [index,expected] of [[0,'seen-token'],[1,'dislike-token']]) {
        const live=environment([row('Kein Interesse','initial-token')]);const hidden=[];let profile='profileA',reject=false;
        live.context.window.__yvDismissedVideos={context:async()=>profile,add:(id,scope)=>{hidden.push({id,scope});return true;},refresh(){}};
        live.context.window._yttv.registry.get=()=>({fetch(request){live.requests.push(request);return {subscribe(next){
            if(request.path==='/youtubei/v1/get_panel') next({content:{engagementPanelSectionListRenderer:{content:{listViewModel:{listItems:[row('Kein Interesse','initial-token')]}}}}});
            else next({feedbackResponses:[{isProcessed:!reject,followUpDialog:{dismissalFollowUpRenderer:{reasons:[
                {dismissalReasonTextRenderer:{text:{simpleText:'Ich habe dieses Video schon angesehen'},feedback:{feedbackEndpoint:{feedbackToken:'seen-token'}}}},
                {dismissalReasonTextRenderer:{text:{simpleText:'Das Video gefällt mir nicht'},feedback:{feedbackEndpoint:{feedbackToken:'dislike-token'}}}}
            ]}}}]});return {unsubscribe(){}};}};}});
        const sendStart=script.indexOf('function uo('),sendEnd=script.indexOf('function co(',sendStart);vm.runInContext(script.slice(sendStart,sendEnd),live.context);
        await live.context.mo({panelId:'PAcontext_menu',params:'server-params',videoId:'fixture0001'},0,true);
        assert.equal(hidden.length,1,'only confirmed initial feedback dismisses the video');assert.equal(hidden[0].id,'fixture0001');
        const selected=live.dialogs[0].content.overlayPanelItemListRenderer.items[index].compactLinkRenderer.serviceEndpoint.commandExecutorCommand.commands[0].customAction.parameters;
        await live.context.yvSendFeedbackReason(selected);
        const requests=live.requests.filter(r=>r.path==='/youtubei/v1/feedback');assert.deepEqual(Array.from(requests[0].payload.feedbackTokens),['initial-token']);assert.deepEqual(Array.from(requests[1].payload.feedbackTokens),[expected]);
        assert.equal(hidden.length,2);profile='profileB';const count=live.requests.length;await live.context.yvSendFeedbackReason(selected);assert.equal(live.requests.length,count,'never send A reason under B profile');
        profile='profileA';reject=true;const rejectedCount=hidden.length;await live.context.mo({panelId:'PAcontext_menu',params:'request',videoId:'fixture0002'},0,true);assert.equal(hidden.length,rejectedCount,'do not falsely hide an unconfirmed rejection');
    }
    console.log('Both reasons verified through real /youtubei/v1/feedback builder: exact selected token, server acknowledgement, dismissal on success and profile isolation');
})().catch(error => {console.error(error); process.exitCode = 1;});
