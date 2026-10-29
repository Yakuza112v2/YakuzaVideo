const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const player = fs.readFileSync(process.argv[2], 'utf8');
const intro = player.slice(player.indexOf('(function () {'), player.indexOf('\n!function()', player.indexOf('(function () {')));
assert.ok(intro.includes('yakuzavideo-startup') && !intro.includes('__YAKUZAVIDEO_LOGO_BASE64__'));
function environment(hasRoot = true) {
    let now = 0, next = 0; const timers = [], nodes = [], listeners = new Map(), docListeners = {};
    function element(tag) { const value = {tag, children: [], style: {}, complete: false,
        setAttribute() {}, appendChild(child) {this.children.push(child);}, remove() {this.removedAt = now;}};
        nodes.push(value); return value; }
    const root = element('html');
    const document = {documentElement: hasRoot ? root : null, createElement: element, addEventListener(name, callback) {docListeners[name] = callback;}};
    const window = {addEventListener(name, callback) {listeners.set(name, callback);}, removeEventListener(name, callback) {if (listeners.get(name) === callback) listeners.delete(name);}};
    const context = {window, document, setTimeout(callback, delay) {timers.push({at: now + delay, callback, id: next++});}, requestAnimationFrame(callback) {timers.push({at: now + 16, callback, id: next++});}};
    vm.createContext(context); vm.runInContext(intro, context);
    function advance(delay) { const until = now + delay; for (;;) {timers.sort((a,b) => a.at-b.at || a.id-b.id); if (!timers.length || timers[0].at > until) break; const timer = timers.shift(); now = timer.at; timer.callback();} now = until; }
    return {root, document, docListeners, window, context, nodes, listeners, advance, get now() {return now;}};
}
let e = environment(); const overlay = e.root.children[0], image = e.nodes.find(node => node.tag === 'img');
assert.ok(overlay); assert.match(image.src, /^data:image\/png;base64,iVBOR/);
e.advance(5000); assert.equal(overlay.removedAt, undefined, 'Loading time must not consume the logo display time');
image.onload(); image.onload(); e.advance(32);
const painted = e.now;
e.advance(3199); assert.notEqual(overlay.style.opacity, '0');
e.advance(1); assert.equal(overlay.style.opacity, '0'); assert.ok(e.now - painted >= 3000);
assert.equal(e.listeners.size, 0); e.advance(300); assert.ok(overlay.removedAt - painted >= 3500);
vm.runInContext(intro, e.context); assert.equal(e.root.children.length, 1, 'The intro must not repeat in the same document');
e = environment(false); assert.equal(e.root.children.length, 0); e.document.documentElement = e.root; e.docListeners.DOMContentLoaded();
assert.equal(e.root.children.length, 1);
let prevented = 0; e.listeners.get('keydown')({keyCode: 13, preventDefault() {prevented++;}, stopImmediatePropagation() {}});
assert.equal(prevented, 1); e.listeners.get('keydown')({keyCode: 27, preventDefault() {throw Error('Back must remain available');}, stopImmediatePropagation() {}});
console.log('Startup image, minimum display time, delayed image loading, one-time launch and remote input verified');
