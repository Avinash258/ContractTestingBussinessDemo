import { config } from '../../src/config';
import { verifyProvider } from './verify-provider';
import { buildStateHandlers } from './states';

verifyProvider({
  provider: 'TaxMesh-Gateway',
  baseUrl: config.gatewayBaseUrl,
  stateHandlers: buildStateHandlers(),
}).catch((err) => {
  console.error('\nGateway provider verification FAILED');
  console.error(err);
  process.exitCode = 1;
});
