const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const script = fs.readFileSync(process.argv[2], 'utf8');
const start = script.indexOf('function xo('), end = script.indexOf('function yvInstallFeedbackUi(', start);
const translations = JSON.parse(fs.readFileSync(__dirname + '/de.json', 'utf8'));
const context = {
    location: {hash: "#/"}, btoa: value => Buffer.from(value, "binary").toString("base64"),
    ga: key => translations.videoMenu[key.split('.')[1]],
    qa: (label, endpoint) => ({menuServiceItemRenderer: {text: {simpleText: label}, serviceEndpoint: endpoint}}),
    bo: value => value?.simpleText || value?.runs?.map(run => run.text).join('') || '',
    so(value) { if (!value || typeof value !== 'object') return null; if (typeof value.feedbackToken === 'string') return value.feedbackToken; for (const child of Object.values(value)) { const token = context.so(child); if (token) return token; } return null; }
};
vm.createContext(context); vm.runInContext(script.slice(start, end), context);
const panel = () => ({showEngagementPanelEndpoint: {identifier: {tag: 'video-menu'}, globalConfiguration: {params: 'server-provided-params'}}});
const card = command => ({tileRenderer: {onLongPressCommand: command}});
const native = (text, token) => ({menuServiceItemRenderer: {text: {simpleText: text}, serviceEndpoint: {feedbackEndpoint: {feedbackToken: token}}}});
const actions = items => items.map(item => item.menuServiceItemRenderer?.serviceEndpoint?.playlistEditEndpoint?.customAction?.action).filter(Boolean);
let checks = 0;
function check(name, fn) { fn(); checks++; }
check('unrelated feedback token must not hide either action', () => {
    const unrelated = native('Aus Wiedergabeverlauf entfernen', 'history-token'), items = [unrelated];
    context.xo(card(panel()), items);
    assert.equal(items[0], unrelated); assert.deepEqual(actions(items), ['NOT_INTERESTED', 'DONT_RECOMMEND_CHANNEL']);
    assert.equal(items[1].menuServiceItemRenderer.text.simpleText, 'Kein Interesse');
    assert.equal(items[2].menuServiceItemRenderer.serviceEndpoint.playlistEditEndpoint.customAction.parameters.params, 'server-provided-params');
});
check('wrapped command executor', () => {
    const items = []; context.xo(card({commandExecutorCommand: {commands: [{signalAction: {signal: 'ignored'}}, {innertubeCommand: panel()}]}}), items);
    assert.equal(items.length, 2);
});
check('lockup renderer command', () => {
    const items = []; context.xo({lockupViewModel: {rendererContext: {commandContext: {onLongPress: {innertubeCommand: panel()}}}}}, items);
    assert.equal(items.length, 2);
});
check('existing native not-interested action preserves channel action', () => {
    const existing = native('Kein Interesse', 'not-interested-token'), items = [existing]; context.xo(card(panel()), items);
    assert.equal(items[0], existing); assert.deepEqual(actions(items), ['DONT_RECOMMEND_CHANNEL']);
});
check('existing channel action preserves not-interested action', () => {
    const items = [native('Keine Videos von diesem Kanal empfehlen', 'channel-token')]; context.xo(card(panel()), items);
    assert.deepEqual(actions(items), ['NOT_INTERESTED']);
});
check('existing native actions are kept without duplicates', () => {
    const items = [native('Kein Interesse', 'one'), native('Keine Videos von diesem Kanal empfehlen', 'two')];
    context.xo(card(panel()), items); assert.equal(items.length, 2);
});
check('reprocessing stays idempotent', () => {
    const items = []; context.xo(card(panel()), items); context.xo(card(panel()), items); assert.equal(items.length, 2);
});
check('no invented panel parameters', () => {
    const existing = native('Wiedergeben', 'other'), items = [existing];
    context.xo(card({showEngagementPanelEndpoint: {identifier: {tag: 'video-menu'}}}), items); assert.deepEqual(items, [existing]);
});
check('unrelated nested menu panels are not used', () => {
    const items = []; context.xo(card({showMenuCommand: {menu: {items: [panel()]}}}), items); assert.equal(items.length, 0);
});
check('full video-card menu processing retains the feedback actions', () => {
    context.b = values => { let index = 0; return {s() {}, n() {return index < values.length ? {value: values[index++], done: false} : {done: true};}, e(error) {throw error;}, f() {}}; };
    context.Ma = key => key === 'enableLongPress';
    context._a = () => ({showMenuCommand: {menu: {menuRenderer: {items: [native('Aus Wiedergabeverlauf entfernen', 'history-token')]}}}});
    const co = script.indexOf('function Co(');
    vm.runInContext(script.slice(co, start), context);
    const item = {tileRenderer: {
        style: 'TILE_STYLE_YTLR_DEFAULT', contentId: 'fixture-video',
        metadata: {tileMetadataRenderer: {title: {simpleText: 'Fixture'}, lines: [{lineRenderer: {items: [{lineItemRenderer: {text: {simpleText: 'Channel'}}}]}}]}},
        header: {tileHeaderRenderer: {thumbnail: {thumbnails: [{url: 'https://example.com/thumbnail.jpg'}]}}},
        onSelectCommand: {watchEndpoint: {videoId: 'fixture-video'}},
        onLongPressCommand: {commandExecutorCommand: {commands: [{innertubeCommand: panel()}]}}
    }};
    context.Co([item]);
    assert.deepEqual(actions(item.tileRenderer.onLongPressCommand.showMenuCommand.menu.menuRenderer.items), ['NOT_INTERESTED', 'DONT_RECOMMEND_CHANNEL']);
});
check('Home video without a panel command gets both options', () => {
    const item = {lockupViewModel: {contentId: 'NO6ZB9iF8kc', rendererContext: {commandContext: {onLongPress: {innertubeCommand: {showMenuCommand: {menu: {menuRenderer: {items: []}}}}}}}}};
    const items = []; context.xo(item, items); assert.deepEqual(actions(items), ['NOT_INTERESTED', 'DONT_RECOMMEND_CHANNEL']);
    const params = items[0].menuServiceItemRenderer.serviceEndpoint.playlistEditEndpoint.customAction.parameters;
    assert.equal(params.panelId, 'PAcontext_menu');
    // Compare against the public TV panel API integration fixture, not a guessed token.
    assert.equal(params.params, '-golCgtOTzZaQjlpRjhrYyCeAUITCAISD0ZFd2hhdF90b193YXRjaA==');
});
check('fallback is video-specific and restricted to Home', () => {
    const tile = card({}); tile.tileRenderer.contentId = 'QwGuhdnFPyo';
    const items = []; context.xo(tile, items);
    const decoded = Buffer.from(items[0].menuServiceItemRenderer.serviceEndpoint.playlistEditEndpoint.customAction.parameters.params, 'base64url');
    assert.equal(decoded.subarray(5, 16).toString(), 'QwGuhdnFPyo');
    context.location.hash = '#/browse?c=FEsubscriptions'; const other = []; context.xo(tile, other); assert.equal(other.length, 0);
    context.location.hash = '#/';
});
if (process.argv[3]) {
    const original = fs.readFileSync(process.argv[3], 'utf8');
    const a = original.indexOf('function xo('), b = original.indexOf('function Ao(', a);
    const previous = {...context}; vm.createContext(previous); vm.runInContext(original.slice(a, b), previous);
    const items = [native('Aus Wiedergabeverlauf entfernen', 'history-token')];
    previous.xo(card(panel()), items);
    assert.deepEqual(actions(items), [], 'The previous implementation must reproduce the missing actions');
    console.log('Previous implementation reproduces the missing-action defect');
}
console.log(checks + ' feedback-menu behavior checks passed');
