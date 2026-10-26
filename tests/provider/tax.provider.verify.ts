import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-TAX',
  baseUrl: config.serviceBaseUrl('TAX'),
  stateHandlers: buildStateHandlers(),
}).catch((err) => {
  console.error('\nTAX provider verification FAILED');
  console.error(err);
  process.exitCode = 1;
});
