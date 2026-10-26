import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-MDM',
  baseUrl: config.serviceBaseUrl('MDM'),
  stateHandlers: buildStateHandlers(),
}).catch((err) => {
  console.error('\nMDM provider verification FAILED');
  console.error(err);
  process.exitCode = 1;
});
