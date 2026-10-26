import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-ALC',
  baseUrl: config.serviceBaseUrl('ALC'),
  stateHandlers: buildStateHandlers(),
}).catch((err) => {
  console.error('\nALC provider verification FAILED');
  console.error(err);
  process.exitCode = 1;
});
