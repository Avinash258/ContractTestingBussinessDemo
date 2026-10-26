import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-DOC',
  baseUrl: config.serviceBaseUrl('DOC'),
  stateHandlers: buildStateHandlers(),
}).catch((err) => {
  console.error('\nDOC provider verification FAILED');
  console.error(err);
  process.exitCode = 1;
});
