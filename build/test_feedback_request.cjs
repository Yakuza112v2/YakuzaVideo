const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const script = fs.readFileSync(process.argv[2], 'utf8');
const start = script.indexOf('function lo('), end = script.indexOf('function uo(', start);
const actionStart = script.indexOf('async function mo('), actionEnd = script.indexOf('function bo(', actionStart);
const translations = JSON.parse(fs.readFileSync(__dirname + '/de.json', 'utf8'));
const ga = key => key === 'toasts.feedbackSent' ? 'Feedback gesendet' : translations.videoMenu[key.split('.')[1]];
function token(value) {if (!value || typeof value !== 'object') return null; if (value.feedbackToken) return value.feedbackToken; for (const child of Object.values(value)) {const found = token(child); if (found) return found;} return null;}
function row(title, feedbackToken) {return {listItemViewModel: {title: {content: title}, rendererContext: {commandContext: {onTap: {innertubeCommand: {commandExecutorCommand: {commands: [{signalAction: {signal: 'CLOSE_POPUP'}}, {feedbackEndpoint: {feedbackToken}}]}}}}}}};}
function environment(rows) {
    const requests = [], sent = [], toasts = [], commands = [];
    const client = {fetch(request) {requests.push(request); return {subscribe(next) {next({content: {engagementPanelSectionListRenderer: {content: {listViewModel: {listItems: rows}}}}}); return {unsubscribe() {}};}};}};
    const context = {window: {_yttv: {registry: {mappings: {}, get() {return client;}}}}, ga, so: token, bo: value => value.content, setTimeout, clearTimeout, console,
        uo: async feedbackToken => {sent.push(feedbackToken); return {feedbackResponses: [{isProcessed: true}]};}, po: command => commands.push(command), Va: (_, text) => toasts.push(text)};
    vm.createContext(context); vm.runInContext(script.slice(start, end) + script.slice(actionStart, actionEnd), context);
    return {context, requests, sent, toasts, commands};
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
    console.log('Feedback request tests passed: select by action, not position; no false success');
})().catch(error => {console.error(error); process.exitCode = 1;});
