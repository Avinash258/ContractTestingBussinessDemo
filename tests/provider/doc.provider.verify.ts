import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-DOC',
  baseUrl: config.serviceBaseUrl('DOC'),
  stateHandlers: buildStateHandlers(),
}).catch(() => {
  process.exitCode = 1;
});
