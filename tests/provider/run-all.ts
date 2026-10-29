/**
 * Local provider runner — same gateway resolution as CI.
 * Base URLs come from gateway.config.json → /api/proxy/{SERVICE}.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { resolveGatewayBaseUrl } from '../../src/gatewayConfig';
import { config } from '../../src/config';

const runners = [
  'clm.provider.verify.ts',
  'mdm.provider.verify.ts',
  'acc.provider.verify.ts',
  'tax.provider.verify.ts',
  'alc.provider.verify.ts',
  'doc.provider.verify.ts',
  'gateway.provider.verify.ts',
];

const gateway = resolveGatewayBaseUrl();
const childEnv = {
  ...process.env,
  // Force CI-parity: children use gateway.config.json host, not stale shell vars / :4101
  GATEWAY_BASE_URL: gateway,
  TAXMESH_BASE_URL: gateway,
  PACT_PROVIDER_URL: gateway,
  PACT_USE_LOCAL_PORTS: '',
};

console.log('\n=== TaxMesh provider verification (local) ===');
console.log(`Gateway (gateway.config.json): ${gateway}`);
console.log(`  CLM proxy : ${config.serviceBaseUrl('CLM')}`);
console.log(`  MDM proxy : ${config.serviceBaseUrl('MDM')}`);
console.log(`  Gateway   : ${config.gatewayBaseUrl}`);
console.log('');

let failed = false;

for (const file of runners) {
  const full = path.join('tests/provider', file);
  console.log(`\n======== ${file} ========`);
  const result = spawnSync(
    process.execPath,
    [require.resolve('ts-node/dist/bin.js'), '--transpile-only', full],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: childEnv,
    }
  );
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
