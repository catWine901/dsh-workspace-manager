/** Exact-version, hash-guarded and reversible RC2 host compatibility patch. */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [command = 'status', hostArgument] = process.argv.slice(2);
if (!['status', 'apply', 'restore'].includes(command) || !hostArgument) {
  throw new Error('Usage: node scripts/patch-host.mjs <status|apply|restore> <DSH consumer directory>');
}
const host = realpathSync(resolve(hostArgument));
const version = '0.1.1-rc.2';
const backupRoot = join(host, '.workspace-manager-host-patch');
const receiptPath = join(backupRoot, 'receipt.json');
const hash = data => createHash('sha256').update(data).digest('hex');

function insideHost(path) {
  const actual = realpathSync(path);
  const rel = relative(host, actual);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Target escapes the selected host: ${path}`);
  return actual;
}

/** Resolve installed package copies without following links outside the selected installation. */
function packageRoots(name) {
  const candidates = [join(host, 'node_modules', name)];
  const store = join(host, 'node_modules', '.pnpm');
  if (existsSync(store)) {
    for (const entry of readdirSync(store, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(join(store, entry.name, 'node_modules', name));
    }
  }
  const roots = [...new Set(candidates.filter(path => existsSync(join(path, 'package.json'))).map(insideHost))];
  if (!roots.length) throw new Error(`Package not found in the selected host: ${name}`);
  for (const root of roots) {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (manifest.name !== name || manifest.version !== version) {
      throw new Error(`This patch requires ${name}@${version}; found ${manifest.name}@${manifest.version}`);
    }
  }
  return roots;
}

function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) throw new Error(`Patch anchor missing or ambiguous: ${before}`);
  return text.replace(before, after);
}

function patchLayout(text) {
  const helper = readFileSync(join(project, 'host-patches', 'rc2-root-wrapper.js'), 'utf8');
  text = replaceOnce(text, '\t\tfunction apply(ctx) {',
    `${helper}\n\t\tconst WorkspaceRoot = createWorkspaceRoot(AppFrame, react_jsx_runtime.jsx);\n\t\tfunction apply(ctx) {`);
  text = replaceOnce(text, '\t\t\t\t\tname: "root",\n\t\t\t\t\tchildren: {',
    '\t\t\t\t\tname: "root",\n\t\t\t\t\tchildren: {\n\t\t\t\t\t\t"page-app.shell": { kind: "single", scope: "root" },');
  text = replaceOnce(text, '\t\t\t\t}, AppFrame);', [
    '\t\t\t\t}, WorkspaceRoot);',
    '\t\t\t\tconst disposeFallback = ctx.slots.inject("page-app.shell", () => ctx.slots.register({',
    '\t\t\t\t\tname: "page-app.shell", priority: 100',
    '\t\t\t\t}, NativeSurfaceFallback));',
  ].join('\n'));
  return replaceOnce(text, '\t\t\t\t\tdisposeRegistration();', '\t\t\t\t\tdisposeFallback();\n\t\t\t\t\tdisposeRegistration();');
}

function patchEvents(text) {
  return replaceOnce(text, 'const API_REMOTE_FORWARDED_EVENTS = [',
    'const API_REMOTE_FORWARDED_EVENTS = [\n\t"page-app-manager/changed",\n\t"page-app-manager/activation-requested",');
}

const specifications = [
  { name: '@deepseek-ai/dsh-client-ui-layout', file: 'lib/client.js', before: '16f001f89a9bc19c54cfa90e37cf52e191113af0abe5efd593e57d7ab30060ad', transform: patchLayout },
  { name: '@deepseek-ai/dsh-api-remotes', file: 'lib/index.js', before: '5406e17c29e42b81ebb8c36030a67de3db19d4d94bace10052b924d72a10e756', transform: patchEvents },
];

/** Rename a new inode over the target; never write through pnpm hardlinks into its store. */
function atomicWrite(path, data) {
  const temp = `${path}.wm-${randomUUID()}.tmp`;
  writeFileSync(temp, data, { flag: 'wx' });
  renameSync(temp, path);
}

const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null;
if (receipt && (receipt.schema !== 1 || receipt.host !== host)) throw new Error('Patch receipt does not belong to this host.');
packageRoots('@deepseek-ai/dsh');

const changes = specifications.flatMap(spec => packageRoots(spec.name).map(root => {
  const path = insideHost(join(root, spec.file));
  const current = readFileSync(path);
  const currentHash = hash(current);
  const saved = receipt?.files.find(item => item.path === relative(host, path));
  const original = currentHash === spec.before ? current
    : saved ? readFileSync(join(backupRoot, saved.backup)) : null;
  if (!original || hash(original) !== spec.before) throw new Error(`Unknown or modified RC2 artifact; refusing to patch ${path}`);
  const desired = Buffer.from(spec.transform(original.toString('utf8').replaceAll('\r\n', '\n')));
  if (currentHash !== spec.before && currentHash !== hash(desired)) {
    throw new Error(`Artifact changed after patching; refusing to overwrite ${path}`);
  }
  return { path, original, desired, currentHash, backup: `${hash(relative(host, path))}.original` };
}));

if (command === 'status') {
  console.log(JSON.stringify(changes.map(item => ({ path: item.path, patched: item.currentHash === hash(item.desired) })), null, 2));
} else {
  // All targets, hashes and versions are checked before writing any target.
  mkdirSync(backupRoot, { recursive: true });
  for (const item of changes) {
    const path = join(backupRoot, item.backup);
    if (!existsSync(path)) writeFileSync(path, item.original, { flag: 'wx' });
    else if (hash(readFileSync(path)) !== hash(item.original)) throw new Error(`Backup mismatch: ${path}`);
  }
  const nextReceipt = {
    schema: 1, host, version, action: command, date: new Date().toISOString(),
    files: changes.map(item => ({ path: relative(host, item.path), backup: item.backup, before: hash(item.original), after: hash(item.desired) })),
  };
  // Receipt is durable before the first target write, allowing recovery from interruption.
  atomicWrite(receiptPath, JSON.stringify(nextReceipt, null, 2) + '\n');
  for (const item of changes) {
    const targetBytes = command === 'apply' ? item.desired : item.original;
    if (item.currentHash !== hash(targetBytes)) atomicWrite(item.path, targetBytes);
    if (hash(readFileSync(item.path)) !== hash(targetBytes)) throw new Error(`Write verification failed: ${item.path}`);
  }
  console.log(JSON.stringify({ action: command, host, files: changes.length, receipt: receiptPath, restartRequired: true }, null, 2));
}
