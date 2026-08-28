/** Build this standalone snapshot's client sources, without rebuilding or downloading DSH. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length && (args[0] !== '--toolchain' || args.length !== 2)) throw new Error('Usage: node scripts/build-client.mjs [--toolchain <existing tools directory>]');
const localRequire = createRequire(join(root, 'package.json'));
const tools = args[1] ? resolve(args[1]) : root;
const toolsRequire = createRequire(join(tools, 'package.json'));
function tool(name) {
  try { return localRequire.resolve(name); }
  catch { return toolsRequire.resolve(name); }
}
const { build } = await import(pathToFileURL(tool('tsdown')).href);
const { transform } = localRequire(tool('lightningcss'));
const moduleId = '@tingyu9527/dsh-workspace-manager';
const shared = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-runtime/client', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives']);
let zod;
try { zod = tool('zod'); }
catch { zod = createRequire(join(tools, 'packages/host/page-app-manager/package.json')).resolve('zod'); }
mkdirSync(join(root, 'lib'), { recursive: true });

await build({
  config: false,
  cwd: root,
  entry: { client: 'src/client/client/index.ts' },
  outDir: 'lib',
  tsconfig: 'tsconfig.build.json',
  format: 'cjs', platform: 'browser', target: 'es2022',
  dts: false, clean: false, sourcemap: false, minify: true,
  deps: { neverBundle: id => shared.has(id), alwaysBundle: id => !shared.has(id) },
  define: {
    'process.env.DSH_CLIENT_PAGE_APP_MANAGER_LEGACY_RC2': '"true"',
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [{
    name: 'standalone-manager-inputs',
    resolveId(source, importer) {
      if (source === '@deepseek-ai/dsh-page-app-manager/remote') return join(root, 'src/client/generated/typert.remote-client.js');
      if (source === 'zod') return zod;
      if (source.endsWith('.module.css')) return '\0wm-css:' + resolve(dirname(importer), source) + '.mjs';
      if (source.startsWith('@deepseek-ai/') && !shared.has(source)) throw new Error(`Unexpected runtime dependency: ${source}`);
    },
    load(id) {
      if (!id.startsWith('\0wm-css:')) return;
      const path = id.slice('\0wm-css:'.length, -'.mjs'.length);
      const filename = relative(root, path).replaceAll('\\', '/');
      const { code, exports } = transform({ filename, code: readFileSync(path), cssModules: { pattern: 'wm_[hash]_[local]' }, minify: true });
      const classes = Object.fromEntries(Object.entries(exports ?? {}).map(([key, value]) => [key, value.name]));
      const tag = `${moduleId}/${filename}`;
      return `const tag = ${JSON.stringify(tag)};
if (typeof document !== 'undefined') {
  let style = [...document.querySelectorAll('style[data-workspace-manager-css]')].find(node => node.dataset.workspaceManagerCss === tag);
  if (!style) { style = document.createElement('style'); style.dataset.workspaceManagerCss = tag; document.head.appendChild(style); }
  style.textContent = ${JSON.stringify(code.toString())};
}
export default ${JSON.stringify(classes)};`;
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({id:${JSON.stringify(moduleId)},factory:(require)=>{`,
    intro: 'var module={exports:{}};var exports=module.exports;',
    footer: 'return module.exports;}});',
  },
});

// The historical distribution includes a second source projection; keep it in sync.
cpSync(join(root, 'src/client'), join(root, 'packages/ui-page-app-manager/src'), { recursive: true });
const descriptor = join(root, 'lib/types/client/index.d.ts');
if (existsSync(descriptor)) {
  const text = readFileSync(descriptor, 'utf8');
  if (!text.includes('"page-app.shell":')) {
    writeFileSync(descriptor, text + '\n// RC2 host wrapper owner supplied by the compatibility patch.\ndeclare module "@deepseek-ai/dsh-client-ui-slots" { interface SlotMap { "page-app.shell": { kind: "single"; scope: "root"; owner: { nativeSurface: import("react").ReactNode } } } }\n');
  }
}
console.log('Built lib/client.js from this directory; synchronized source projection. No acceptance suite was run.');
