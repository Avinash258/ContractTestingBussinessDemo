import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

async function postGateway(path: string): Promise<void> {
  const base = config.gatewayBaseUrl.replace(/\/$/, '');
  await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{}',
  }).catch(() => undefined);
}

const handlers = {
  ...buildStateHandlers(),
  // Ensure filing mutations that need engagement data succeed during verify
  'filing run-all is available': async () => {
    await postGateway('/api/filing/run-all');
  },
  'filing run step cem is available': async () => {
    await postGateway('/api/filing/run-all');
  },
  'filing run step tax is available': async () => {
    await postGateway('/api/filing/run-all');
  },
  'filing tax calculate is available': async () => {
    await postGateway('/api/filing/run-all');
  },
  'filing alc allocate is available': async () => {
    await postGateway('/api/filing/run-all');
  },
  'filing reset is available': async () => {
    // no pre-seed required
  },
};

verifyProvider({
  provider: 'TaxMesh-Gateway',
  baseUrl: config.gatewayBaseUrl,
  stateHandlers: handlers,
}).catch(() => {
  process.exitCode = 1;
});
