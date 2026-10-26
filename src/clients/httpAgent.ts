import http from 'http';
import https from 'https';

/**
 * Disable keep-alive so sequential Pact mock servers do not hit
 * recycled sockets (ECONNRESET / "socket hang up") under Node 18+.
 * @see https://github.com/pact-foundation/pact-js/issues/1066
 */
export const httpAgent = new http.Agent({ keepAlive: false });
export const httpsAgent = new https.Agent({ keepAlive: false });
