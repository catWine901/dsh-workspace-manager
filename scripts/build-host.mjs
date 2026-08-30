/** Build the self-contained Host, wrapper, and version adapter without downloading DSH. */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
if (args.some((arg, index) => index % 2 === 0 && !['--toolchain', '--runtime'].includes(arg)) || args.length % 2 !== 0) {
  throw new Error('Usage: node scripts/build-host.mjs [--toolchain <existing tools directory>] [--runtime <existing DSH package directory>]');
}
const localRequire = createRequire(join(root, 'package.json'));
const tools = valueOf('--toolchain') ? resolve(valueOf('--toolchain')) : root;
const toolsRequire = createRequire(join(tools, 'package.json'));
const runtime = valueOf('--runtime');
const runtimeRequire = runtime === undefined ? undefined : createRequire(join(resolve(runtime), 'package.json'));
function tool(name) {
  try { return localRequire.resolve(name); }
  catch {
    try { return toolsRequire.resolve(name); }
    catch (error) {
      if (runtimeRequire !== undefined) return runtimeRequire.resolve(name);
      throw error;
    }
  }
}
const { build } = await import(pathToFileURL(tool('tsdown')).href);
const typescriptModule = await import(pathToFileURL(tool('typescript')).href);
const ts = typescriptModule.default ?? typescriptModule;
const zod = tool('zod');
const yaml = tool('js-yaml');
const execa = tool('execa');
await build({
  config: false,
  cwd: root,
  entry: {
    index: 'src/host/index.ts',
    'host-bridge': 'src/host-bridge/index.ts',
    wrapper: 'src/host/wrapper.ts',
    'adapter-dsh-rc2': 'src/adapters/dsh/rc2/host.ts',
  },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: false,
  clean: false,
  sourcemap: false,
  minify: false,
  deps: {
    neverBundle: id => id.startsWith('@deepseek-ai/'),
    alwaysBundle: id => !id.startsWith('@deepseek-ai/'),
  },
  plugins: [{
    name: 'standalone-host-inputs',
    resolveId(source) {
      if (source === 'zod') return zod;
      if (source === 'js-yaml') return yaml;
      if (source === 'execa') return execa;
    },
    transform(code, id) {
      if (!/\.(?:c|m)?ts$/u.test(id)) return;
      return {
        code: ts.transpileModule(code, {
          fileName: id,
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            useDefineForClassFields: true,
          },
        }).outputText,
        map: null,
      };
    },
  }],
  outputOptions: { entryFileNames: '[name].js' },
});
console.log('Built Host, wrapper, and RC2 adapter from this directory.');
