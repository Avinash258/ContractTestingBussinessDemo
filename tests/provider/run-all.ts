import { spawnSync } from 'child_process';
import path from 'path';

const runners = [
  'clm.provider.verify.ts',
  'mdm.provider.verify.ts',
  'acc.provider.verify.ts',
  'tax.provider.verify.ts',
  'alc.provider.verify.ts',
  'doc.provider.verify.ts',
  'gateway.provider.verify.ts',
];

let failed = false;

for (const file of runners) {
  const full = path.join('tests/provider', file);
  console.log(`\n======== ${file} ========`);
  const result = spawnSync(
    process.execPath,
    [require.resolve('ts-node/dist/bin.js'), '--transpile-only', full],
    { stdio: 'inherit', cwd: process.cwd() }
  );
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
