import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(join(root, path), 'utf8');
const fail = message => { throw new Error(`architecture verification: ${message}`); };
const filesUnder = (directory) => {
  const absolute = join(root, directory);
  const found = [];
  for (const name of readdirSync(absolute)) {
    const path = join(absolute, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(relative(root, path)));
    else found.push(path);
  }
  return found;
};

export function verifyArchitecture() {
  const pkg = JSON.parse(read('package.json'));
  const matrix = JSON.parse(read('compatibility.json'));
  if (matrix.hostBridgeVersion !== 1) fail('compatibility matrix must declare HostBridge v1');
  if (matrix.adapters.length !== 1 || matrix.adapters[0].dshVersionRange !== '=0.1.1-rc.2') fail('the supported DSH range must be explicit and exact');
  if (pkg.peerDependencies['@deepseek-ai/dsh-app-boot'] !== '0.1.1-rc.2') fail('host peer range is not version locked');
  const published = JSON.stringify(pkg.files);
  for (const forbidden of ['patch-host', 'host-patches', 'backup', 'receipt']) {
    if (published.includes(forbidden)) fail(`package files contain forbidden ${forbidden}`);
  }
  const patch = read('cordis.patch.yml');
  if (!patch.includes('/adapters/dsh/rc2') || !patch.includes("name: '@tingyu9527/dsh-workspace-manager'")) fail('bundle does not compose the adapter and manager from one package');
  if (!/- id:\s*ui-layout\s*\n\s*disabled:\s*true/u.test(patch)) fail('RC2 layout replacement does not disable native ui-layout through composition');
  if (/id:\s*ui-layout[\s\S]{0,120}name:/u.test(patch)) fail('manager bundle must preserve native ui-layout as the fallback');
  for (const directory of ['src/core', 'src/features']) {
    for (const path of filesUnder(directory)) {
      const source = readFileSync(path, 'utf8');
      if (/from\s+['"]@deepseek-ai\/(?:dsh|cordis)/u.test(source)) fail(`${relative(root, path)} imports DSH/Cordis directly`);
      if (/0\.1\.1-rc\.2|hostVersion\s*[=!]==?/u.test(source)) fail(`${relative(root, path)} contains host-version branching`);
    }
  }
  const core = read('src/core/WorkspaceRootShell.tsx');
  const rootAt = core.indexOf('data-workspace-root-shell');
  const contentAt = core.indexOf('data-workspace-content-region');
  const nativeAt = core.indexOf('data-native-dsh-surface');
  if (!(rootAt >= 0 && rootAt < contentAt && contentAt < nativeAt)) fail('WorkspaceRootShell -> WorkspaceContentRegion -> NativeDshSurface nesting is absent');
  for (const path of filesUnder('lib')) {
    const source = readFileSync(path, 'utf8');
    if (/[A-Za-z]:\\(?:Users|AAA-workboard|AppData|Temp)\\/u.test(source)) fail(`published artifact ${relative(root, path)} contains an absolute development path`);
    if (/patch-host\.mjs|host-patches|rc2-root-wrapper/u.test(source)) fail(`published artifact ${relative(root, path)} contains a host patch reference`);
    if (/@deepseek-ai\/dsh-app-boot\/profile-runtime-bridge/u.test(source)) fail(`published artifact ${relative(root, path)} imports an RC2-unexported DSH subpath`);
  }
  return { adapter: matrix.adapters[0].adapterId, hostBridgeVersion: matrix.hostBridgeVersion };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifyArchitecture()));
}
