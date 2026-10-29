const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const script = fs.readFileSync(process.argv[2], 'utf8');
const start = script.indexOf('function yvObserveStartupBrowse('), end = script.indexOf('function po(e,t){', start);
assert.ok(start >= 0 && end > start);
assert.ok(script.includes('yvObserveStartupBrowse(e);'));
assert.ok(script.includes('yvRefreshHomeOnStartup();var o=Ro()'));
const code = script.slice(start, end);
const subscriptionResponse = () => ({responseContext: {serviceTrackingParams: [{service: 'GFEEDBACK', params: [{key: 'browse_id', value: 'FEsubscriptions'}]}]}, contents: {tvBrowseRenderer: {content: {tvSecondaryNavRenderer: {sections: []}}}}});
function environment({ready = true, guide = true, hash = '#/', enabled = true, target = null, identity = null} = {}) {
    let now = 0, next = 0;
    const timers = new Map(), listeners = new Map(), requests = [], commands = [];
    const state = {ready, guide, next: null, error: null, unsubscribed: 0};
    const client = {fetch(request) {requests.push(request); return {subscribe(next, error) {state.next = next; state.error = error; return {unsubscribe() {state.unsubscribed++;}};}};}};
    const router = {instance: {resolveCommand() {}}};
    const registry = {mappings: {}, get(name) {if (!state.ready) throw Error('not ready'); return name === 'CurrentIdentityService' ? identity : client;}};
    const location = {hash};
    const window = {_yttv: {router, registry}, addEventListener(name, callback) {listeners.set(name, callback);}, removeEventListener(name, callback) {if (listeners.get(name) === callback) listeners.delete(name);}};
    const context = {window, location, document: {querySelector() {return state.guide ? {children: [{}]} : null;}}, console: {warn() {}}, Date: {now: () => now},
        Ma: key => key === 'reloadHomeOnStartup' ? enabled : target,
        // Do not pretend that requesting the already active Home causes a reload.
        po: command => commands.push(JSON.parse(JSON.stringify(command))),
        setTimeout(callback, delay) {const id = ++next; timers.set(id, {at: now + delay, callback}); return id;}, clearTimeout(id) {timers.delete(id);}};
    vm.createContext(context); vm.runInContext(code + ';yvRefreshHomeOnStartup();', context);
    function advance(delay) {const until = now + delay; for (;;) {const entry = [...timers].sort((a,b) => a[1].at-b[1].at)[0]; if (!entry || entry[1].at > until) break; timers.delete(entry[0]); now = entry[1].at; entry[1].callback();} now = until;}
    function navigate(hash) {location.hash = hash; listeners.get('hashchange')?.();}
    function respond(items = []) {state.next({items: [{guideSectionRenderer: {items}}]});}
    function loaded(response = subscriptionResponse()) {context.yvObserveStartupBrowse(response);}
    return {state, window, location, context, requests, commands, listeners, timers, advance, navigate, respond, loaded};
}
let checks = 0;
function check(name, fn) {fn(); checks++;}
const ids = e => e.commands.map(command => command.browseEndpoint.browseId);
check('leave Home, await the actual subscriptions response and route, then return Home', () => {
    const e = environment({ready: false, guide: false}); e.advance(1000); assert.equal(e.requests.length, 0);
    e.state.ready = true; e.advance(200); assert.equal(e.requests.length, 0);
    e.state.guide = true; e.advance(200); assert.equal(e.requests[0].path, '/youtubei/v1/guide');
    e.respond(); assert.deepEqual(ids(e), ['FEsubscriptions']);
    e.loaded(); e.advance(1000); assert.deepEqual(ids(e), ['FEsubscriptions'], 'response alone is not a committed navigation');
    e.navigate('#/browse?c=FEsubscriptions'); e.advance(249); assert.equal(e.commands.length, 1);
    e.advance(1); assert.deepEqual(ids(e), ['FEsubscriptions', 'FEtopics']); assert.equal(e.listeners.size, 0);
    e.advance(20000); assert.equal(e.commands.length, 2);
});
check('route first also waits for response; unrelated browse responses do not count', () => {
    const e = environment(); e.respond(); e.navigate('#/browse?c=FEsubscriptions');
    e.loaded({responseContext: {serviceTrackingParams: [{service: 'GFEEDBACK', params: [{key: 'browse_id', value: 'FEtopics'}]}]}});
    e.advance(500); assert.equal(e.commands.length, 1); e.loaded(); e.advance(250); assert.equal(e.commands.length, 2);
});
check('keep full account-aware navigation endpoints from guide', () => {
    const e = environment(); const endpoint = id => ({guideEntryRenderer: {navigationEndpoint: {browseEndpoint: {browseId: id, params: 'account-specific'}}}});
    e.respond([endpoint('FEtopics'), endpoint('FEsubscriptions')]);
    assert.equal(e.commands[0].browseEndpoint.params, 'account-specific'); e.navigate('#/browse?c=FEsubscriptions'); e.loaded(); e.advance(250);
    assert.equal(e.commands[1].browseEndpoint.params, 'account-specific');
});
check('manual navigation and remote input cancel automatic navigation', () => {
    const waiting = environment({ready: false}); waiting.navigate('#/watch?v=video'); waiting.state.ready = true; waiting.advance(25000); assert.equal(waiting.commands.length, 0);
    const e = environment(); e.respond(); e.navigate('#/watch?v=video'); e.loaded(); e.advance(10000); assert.equal(e.commands.length, 1);
    const input = environment(); input.respond(); input.navigate('#/browse?c=FEsubscriptions'); input.listeners.get('keydown')(); input.loaded(); input.advance(10000); assert.equal(input.commands.length, 1);
});
check('other startup pages are not forced through subscriptions', () => {
    const e = environment({target: JSON.stringify({browseEndpoint: {browseId: 'FElibrary'}})}); e.respond(); assert.deepEqual(ids(e), ['FElibrary']);
});
check('deep links and disabled refresh stay untouched', () => {
    for (const options of [{hash: '#/watch?v=video'}, {hash: '#/browse?c=FEtopics_news'}, {enabled: false}]) {
        const e = environment(options); e.advance(25000); assert.equal(e.commands.length, 0); assert.equal(e.requests.length, 0);
    }
});
check('bounded timeouts return to Home even without a parsed subscriptions response', () => {
    const e = environment(); e.advance(5000); assert.deepEqual(ids(e), ['FEsubscriptions']); e.navigate('#/browse?c=FEsubscriptions'); e.advance(8000); assert.deepEqual(ids(e), ['FEsubscriptions', 'FEtopics']);
    const error = environment(); error.state.error(Error('offline')); assert.deepEqual(ids(error), ['FEsubscriptions']);
});
check('readiness timeout cleans up and scheduling is once per document', () => {
    const e = environment({ready: false}); e.advance(25000); assert.equal(e.commands.length, 0); assert.equal(e.timers.size, 0); assert.equal(e.listeners.size, 0);
    const once = environment(); vm.runInContext('yvRefreshHomeOnStartup()', once.context); assert.equal(once.requests.length, 1);
});
check('alternate Home route and invalid configuration remain supported', () => {
    const e = environment({hash: '#/browse?c=FEwhat_to_watch', target: 'invalid'}); e.respond(); assert.deepEqual(ids(e), ['FEsubscriptions']);
});
(async () => {
    let resolveIdentity;
    const e = environment({identity: {get: () => new Promise(resolve => {resolveIdentity = resolve;})}});
    assert.equal(e.requests.length, 0); resolveIdentity({}); await new Promise(resolve => setImmediate(resolve)); assert.equal(e.requests.length, 1); checks++;
    console.log(checks + ' startup route-transition checks passed');
})().catch(error => {console.error(error); process.exitCode = 1;});
