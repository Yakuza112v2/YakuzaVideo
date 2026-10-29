const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const script = fs.readFileSync(process.argv[2], 'utf8');
const start = script.indexOf('function yvRefreshHomeOnStartup('), end = script.indexOf('function po(e,t){', start);
assert.ok(start >= 0 && end > start);
assert.ok(script.includes('n&&(window.__yvGuideReady=true);'));
assert.ok(script.includes('yvRefreshHomeOnStartup();var o=Ro()'));
assert.ok(!script.includes('Ma("reloadHomeOnStartup")&&(Ma("launchToOnStartup")?'));
const code = script.slice(start, end);
function environment({ready = true, guide = true, hash = '#/', enabled = true, target = null} = {}) {
    let now = 0, next = 0; const timers = new Map(), listeners = new Map(), requests = [], commands = [];
    const state = {ready, guide, next: null, error: null, unsubscribed: 0};
    const client = {fetch(request) {requests.push(request); return {subscribe(next, error) {state.next = next; state.error = error; return {unsubscribe() {state.unsubscribed++;}};}};}};
    const router = {instance: {resolveCommand() {}}};
    const registry = {mappings: {}, get() {if (!state.ready) throw Error('not ready'); return client;}};
    const location = {hash};
    const window = {_yttv: {router, registry}, addEventListener(name, callback) {listeners.set(name, callback);}, removeEventListener(name, callback) {if (listeners.get(name) === callback) listeners.delete(name);}};
    const context = {window, location, document: {querySelector() {return state.guide ? {children: [{}]} : null;}}, console: {warn() {}}, Date: {now: () => now},
        Ma: key => key === 'reloadHomeOnStartup' ? enabled : target,
        po: command => commands.push(JSON.parse(JSON.stringify(command))),
        setTimeout(callback, delay) {const id = ++next; timers.set(id, {at: now + delay, callback}); return id;}, clearTimeout(id) {timers.delete(id);}};
    vm.createContext(context); vm.runInContext(code + ';yvRefreshHomeOnStartup();', context);
    function advance(delay) {const until = now + delay; for (;;) {const entry = [...timers].sort((a,b) => a[1].at-b[1].at)[0]; if (!entry || entry[1].at > until) break; timers.delete(entry[0]); now = entry[1].at; entry[1].callback();} now = until;}
    function navigate(hash) {location.hash = hash; listeners.get('hashchange')?.();}
    function respond() {state.next({items: [{guideSectionRenderer: {items: []}}]});}
    return {state, window, location, context, requests, commands, listeners, timers, advance, navigate, respond};
}
let checks = 0;
function check(name, fn) {fn(); checks++;}
check('wait for the actual service client and guide', () => {
    const e = environment({ready: false, guide: false}); e.advance(1000); assert.equal(e.requests.length, 0); assert.equal(e.commands.length, 0);
    e.state.ready = true; e.advance(200); assert.equal(e.requests.length, 0);
    e.state.guide = true; e.advance(200); assert.equal(e.requests.length, 1); assert.equal(e.commands.length, 0);
    e.respond(); assert.deepEqual(e.commands, [{browseEndpoint: {browseId: 'FEtopics'}}]);
    e.advance(10000); assert.equal(e.commands.length, 1); assert.equal(e.listeners.size, 0);
});
check('use freshly returned guide data before browsing Home', () => {
    const e = environment(); assert.equal(e.requests[0].path, '/youtubei/v1/guide'); e.state.next(null); assert.equal(e.commands.length, 0);
    e.respond(); assert.equal(e.commands.length, 1); assert.ok(e.state.unsubscribed);
});
check('do not interrupt navigation while waiting for services', () => {
    const e = environment({ready: false}); e.navigate('#/watch?v=video'); e.state.ready = true; e.advance(2000);
    assert.equal(e.commands.length, 0); assert.equal(e.requests.length, 0);
});
check('do not interrupt navigation while waiting for the guide response', () => {
    const e = environment(); e.navigate('#/browse?c=FEsubscriptions'); e.respond(); e.advance(6000); assert.equal(e.commands.length, 0);
});
check('respect another configured startup page', () => {
    const e = environment({target: JSON.stringify({browseEndpoint: {browseId: 'FEsubscriptions'}})});
    assert.deepEqual(e.commands, [{browseEndpoint: {browseId: 'FEsubscriptions'}}]); assert.equal(e.requests.length, 0);
});
check('leave deep links and disabled startup refresh alone', () => {
    for (const options of [{hash: '#/watch?v=video'}, {hash: '#/browse?c=FEtopics_news'}, {enabled: false}]) {
        const e = environment(options); e.advance(20000); assert.equal(e.commands.length, 0); assert.equal(e.requests.length, 0);
    }
});
check('bounded fallback after a network error or timeout', () => {
    const e = environment(); e.state.error(Error('offline')); e.respond(); e.advance(6000); assert.equal(e.commands.length, 1);
    const timed = environment(); timed.advance(5000); assert.equal(timed.commands.length, 1); timed.respond(); assert.equal(timed.commands.length, 1);
});
check('stop waiting if the app never becomes ready', () => {
    const e = environment({ready: false}); e.advance(20000); assert.equal(e.commands.length, 0); assert.equal(e.timers.size, 0); assert.equal(e.listeners.size, 0);
});
check('do not schedule the startup navigation twice', () => {
    const e = environment(); vm.runInContext('yvRefreshHomeOnStartup()', e.context); assert.equal(e.requests.length, 1);
});
check('recognize Home browse routes and recover from an invalid saved setting', () => {
    const e = environment({hash: '#/browse?c=FEtopics', target: 'invalid'}); e.respond(); assert.equal(e.commands[0].browseEndpoint.browseId, 'FEtopics');
});
if (process.argv[3]) {
    const previous = fs.readFileSync(process.argv[3], 'utf8');
    const old = 'Ma("reloadHomeOnStartup")&&(Ma("launchToOnStartup")?po(JSON.parse(Ma("launchToOnStartup"))):po({signalAction:{signal:"SOFT_RELOAD_PAGE"}}));';
    assert.ok(previous.includes(old)); let attempts = 0;
    vm.runInNewContext(old, {Ma: key => key === 'reloadHomeOnStartup', po() {attempts++;}});
    assert.equal(attempts, 1, 'The previous startup code dispatches before any readiness check');
    console.log('Previous startup reproduces an immediate reload before navigation readiness');
}
console.log(checks + ' startup Home navigation checks passed');
