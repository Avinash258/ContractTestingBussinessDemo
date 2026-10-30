import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-ACC',
  baseUrl: config.serviceBaseUrl('ACC'),
  stateHandlers: buildStateHandlers(),
}).catch(() => {
  process.exitCode = 1;
});
