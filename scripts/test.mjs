import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyArchitecture } from './verify-architecture.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
verifyArchitecture();
const result = spawnSync(process.execPath, ['--test', 'tests/v2/*.test.mjs'], { cwd: root, stdio: 'inherit', shell: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
