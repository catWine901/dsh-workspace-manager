import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { verifyArchitecture } from '../../scripts/verify-architecture.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const binDirectory = dirname(process.execPath);
const globalRoot = process.env.DSH_GLOBAL_NODE_MODULES ?? join(binDirectory, 'node_modules');
const dshDir = process.env.DSH_PACKAGE_DIR ?? join(globalRoot, '@deepseek-ai', 'dsh');
const dshRequire = createRequire(join(dshDir, 'package.json'));
const dshPackage = JSON.parse(readFileSync(join(dshDir, 'package.json'), 'utf8'));

function hashTree(directory) {
  const hash = createHash('sha256');
  const visit = current => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      const stat = statSync(path);
      if (stat.isDirectory()) visit(path);
      else if (/\.(?:js|mjs|cjs|css|json)$/u.test(name)) hash.update(path.slice(directory.length)).update(readFileSync(path));
    }
  };
  visit(directory);
  return hash.digest('hex');
}

test('architecture boundaries and package hygiene pass', () => {
  assert.deepEqual(verifyArchitecture(), {
    adapter: 'dsh-0.1.1-rc.2-layout-replacement',
    hostBridgeVersion: 1,
  });
});

test('the configured global DSH is the supported stock version', () => {
  assert.equal(dshPackage.version, '0.1.1-rc.2');
  assert.equal(execFileSync(process.execPath, [join(dshDir, 'lib', 'bin.js'), '--version'], { encoding: 'utf8' }).trim(), dshPackage.version);
});

test('published Host entry points are valid Node 22 modules', () => {
  for (const file of ['index.js', 'adapter-dsh-rc2.js', 'host-bridge.js', 'wrapper.js']) {
    execFileSync(process.execPath, ['--check', join(root, 'lib', file)], { encoding: 'utf8' });
  }
});

test('layout replacement disables native ui-layout only while the manager layer is active', async () => {
  const includePath = dshRequire.resolve('@deepseek-ai/cordis-plugin-include');
  const yamlPath = dshRequire.resolve('js-yaml');
  const { applyEntryPatches, entryListSchema } = await import(pathToFileURL(includePath));
  const { load } = await import(pathToFileURL(yamlPath));
  const parse = path => load(readFileSync(path, 'utf8'), { schema: entryListSchema });
  const basePackage = dirname(dshRequire.resolve('@deepseek-ai/dsh-base/package.json'));
  const webPackage = dirname(dshRequire.resolve('@deepseek-ai/dsh-web-app/package.json'));
  const nativePatches = [...parse(join(basePackage, 'cordis.patch.yml')), ...parse(join(webPackage, 'cordis.patch.yml'))];
  const managerPatches = parse(join(root, 'cordis.patch.yml'));
  const warnings = [];
  const nativeRows = applyEntryPatches([], structuredClone(nativePatches), warning => warnings.push(warning));
  const activeRows = applyEntryPatches([], structuredClone([...nativePatches, ...managerPatches]), warning => warnings.push(warning));
  const nativeLayout = nativeRows.find(row => row.id === 'ui-layout');
  const activeLayout = activeRows.find(row => row.id === 'ui-layout');
  assert.equal(activeLayout.name, '@deepseek-ai/dsh-client-ui-layout');
  assert.equal(nativeLayout.disabled, undefined);
  assert.equal(activeLayout.disabled, true);
  assert.equal(activeRows.filter(row => row.name === '@tingyu9527/dsh-workspace-manager').length, 1);
  assert.equal(activeRows.filter(row => row.name === '@tingyu9527/dsh-workspace-manager/adapters/dsh/rc2').length, 1);
  assert.deepEqual(applyEntryPatches([], structuredClone(nativePatches), () => {}), nativeRows);
  assert.deepEqual(warnings, []);
});

test('verification and composition never rewrite global DSH artifacts', async () => {
  const before = hashTree(dshDir);
  verifyArchitecture();
  const after = hashTree(dshDir);
  assert.equal(after, before);
});
