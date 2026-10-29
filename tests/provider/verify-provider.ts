import path from 'path';
import { Verifier, VerifierOptions } from '@pact-foundation/pact';
import { listPactFilesForProvider } from '../../src/pact/listPacts';

/** Shared provider verification helper. */
export async function verifyProvider(opts: {
  provider: string;
  baseUrl: string;
  stateHandlers?: VerifierOptions['stateHandlers'];
}): Promise<void> {
  const pactUrls = listPactFilesForProvider(opts.provider);

  console.log(`TaxMesh provider verification: ${opts.provider}`);
  console.log(`  baseUrl      : ${opts.baseUrl}`);
  console.log(`  (from gateway.config.json unless URL_* / OVERRIDE / PACT_USE_LOCAL_PORTS)`);
  console.log(
    `  pact files   : ${pactUrls.map((p) => path.basename(p)).join(', ')}`
  );
  console.log('');

  const output = await new Verifier({
    provider: opts.provider,
    providerBaseUrl: opts.baseUrl,
    pactUrls,
    logLevel: 'info',
    stateHandlers: opts.stateHandlers || {},
  }).verifyProvider();

  console.log(`\n${opts.provider} verification PASSED`);
  console.log(output);
}
