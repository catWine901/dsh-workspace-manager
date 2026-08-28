/** Minimal built-component check only: no DSH startup, API calls or acceptance workflow. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolchain = process.argv[2];
if (!toolchain) throw new Error('Usage: node scripts/check-render.mjs <existing DSH source toolchain directory>');
const tools = createRequire(resolve(toolchain, 'package.json'));
const deps = createRequire(resolve(toolchain, 'packages/client/web/package.json'));
const { JSDOM } = tools('jsdom');
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="test-root"></div></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = deps('react');
const { createRoot } = deps('react-dom/client');
let bundle;
window.__ModuleLoader__ = { load({ id, factory }) {
  assert.equal(id, '@tingyu9527/dsh-workspace-manager');
  bundle = factory(deps);
} };
vm.runInThisContext(readFileSync(resolve(project, 'lib/client.js'), 'utf8'), { filename: 'manager-client.js' });
assert.equal(typeof bundle.apply, 'function');
let state = { registry: null, eligible: new Map([['knowledge', {}]]), activePageId: null, visitedPageIds: [], failedPageIds: [] };
const props = {
  usePageApp: select => select(state), select() {}, uninstall() {}, t: key => key,
  renderSlot: key => React.createElement('input', { 'data-check': key, defaultValue: 'draft' }),
};
const root = createRoot(document.getElementById('test-root'));
const draw = async () => { await React.act(async () => { root.render(React.createElement(bundle.PageAppShell, props)); }); };
try {
  await draw();
  const nativeInput = document.querySelector('[data-page-id="dsh"] input');
  assert.ok(nativeInput);
  state = { ...state, activePageId: 'knowledge', visitedPageIds: ['knowledge'] };
  await draw();
  assert.equal(document.querySelector('[data-page-id="dsh"]').hidden, true);
  assert.equal(document.querySelector('[data-page-id="knowledge"]').hidden, false);
  assert.equal(document.querySelector('[data-page-id="dsh"] input'), nativeInput);
  const knowledgeInput = document.querySelector('[data-page-id="knowledge"] input');
  knowledgeInput.value = 'keep this draft';
  state = { ...state, activePageId: null };
  await draw();
  assert.equal(document.querySelector('[data-page-id="dsh"]').hidden, false);
  assert.equal(document.querySelector('[data-page-id="knowledge"]').hidden, true);
  assert.equal(document.querySelector('[data-page-id="knowledge"] input'), knowledgeInput);
  assert.equal(knowledgeInput.value, 'keep this draft');
  assert.equal(document.querySelectorAll('[data-page-app-rail]').length, 1);
  console.log('PASS: built factory loads; native/managed DOM retained; visibility switches; one permanent rail.');
  console.log('Scope: component fixture only. No real DSH/API/browser acceptance executed.');
} finally {
  await React.act(async () => root.unmount());
  dom.window.close();
}
