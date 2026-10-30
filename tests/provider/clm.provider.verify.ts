import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-CLM',
  baseUrl: config.serviceBaseUrl('CLM'),
  stateHandlers: buildStateHandlers(),
}).catch(() => {
  process.exitCode = 1;
});
