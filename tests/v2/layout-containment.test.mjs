import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const browser = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

test('Native DSH remains viewport-bounded when its sidebar content is taller than the viewport', () => {
  const pageAppCss = readFileSync(join(root, 'src', 'client', 'client', 'PageAppShell.module.css'), 'utf8');
  const rc2Css = readFileSync(join(root, 'src', 'adapters', 'dsh', 'rc2', 'Rc2NativeDshSurface.module.css'), 'utf8');
  const directory = mkdtempSync(join(tmpdir(), 'dsh-workspace-layout-'));
  const path = join(directory, 'fixture.html');
  try {
    writeFileSync(path, `<!doctype html>
<style>
  html, body, #root { height: 100%; margin: 0; }
  ${pageAppCss}
  ${rc2Css}
</style>
<div id="root">
  <div class="shell">
    <nav></nav>
    <main class="host">
      <section class="surface">
        <div data-native-dsh-surface>
          <div class="frame">
            <div class="sidebarCol"><div style="height: 1400px">long session list</div></div>
            <div class="centerCol">conversation</div>
            <div class="detailsCol"></div>
          </div>
        </div>
      </section>
    </main>
  </div>
</div>
<output id="result"></output>
<script>
  const root = document.querySelector('#root');
  const nativeSurface = document.querySelector('[data-native-dsh-surface]');
  const frame = document.querySelector('.frame');
  const sidebar = document.querySelector('.sidebarCol');
  document.querySelector('#result').textContent = JSON.stringify({
    rootHeight: root.clientHeight,
    nativeHeight: nativeSurface.clientHeight,
    frameHeight: frame.clientHeight,
    sidebarHeight: sidebar.clientHeight,
    sidebarScrollHeight: sidebar.scrollHeight,
  });
</script>`, 'utf8');
    const dom = execFileSync(browser, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-breakpad', '--disable-crash-reporter',
      '--no-crash-upload', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${join(directory, 'edge-profile')}`,
      '--dump-dom', '--window-size=1200,700', pathToFileURL(path).href,
    ], { encoding: 'utf8', timeout: 30_000 });
    const encoded = dom.match(/<output id="result">([^<]+)<\/output>/)?.[1];
    assert.ok(encoded, 'headless browser did not emit layout measurements');
    const measured = JSON.parse(encoded.replaceAll('&quot;', '"'));
    assert.equal(measured.nativeHeight, measured.rootHeight);
    assert.equal(measured.frameHeight, measured.rootHeight);
    assert.equal(measured.sidebarHeight, measured.rootHeight);
    assert.ok(measured.sidebarScrollHeight > measured.sidebarHeight);
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
