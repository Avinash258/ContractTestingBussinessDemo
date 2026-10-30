/**
 * Single-provider runner — shows Pact verify detail + conclusion.
 *   npx ts-node --transpile-only tests/provider/run-one.ts mdm
 * Header/conclusion only: PACT_QUIET=1
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { filterProviderConsole } from './console-filter';

const name = (process.argv[2] || '').toLowerCase().replace(/\.ts$/, '');
if (!name) {
  console.error('Usage: run-one.ts <clm|mdm|acc|tax|alc|doc|gateway>');
  process.exit(2);
}

const file =
  name === 'gateway'
    ? 'gateway.provider.verify.ts'
    : `${name}.provider.verify.ts`;
const full = path.join('tests/provider', file);

const result = spawnSync(
  process.execPath,
  [path.join('node_modules', 'ts-node', 'dist', 'bin.js'), '--transpile-only', full],
  { encoding: 'utf8', cwd: process.cwd(), env: process.env }
);

process.stdout.write(
  filterProviderConsole(`${result.stdout || ''}${result.stderr || ''}`)
);
process.exit(result.status === null ? 1 : result.status);
