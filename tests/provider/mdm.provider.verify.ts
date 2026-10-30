import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-MDM',
  baseUrl: config.serviceBaseUrl('MDM'),
  stateHandlers: buildStateHandlers(),
}).catch(() => {
  process.exitCode = 1;
});
