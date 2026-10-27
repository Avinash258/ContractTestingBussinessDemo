import Pact from '@pact-foundation/pact';
import { deepLike } from '../../src/matchers/common';
import fs from 'fs';
import path from 'path';

const loadFixture = (name: string) => 
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../testdata/mdm/${name}.json`), 'utf8'));

Pact.setup({
  consumer: 'TaxMesh-Client',
  provider: 'TaxMesh-MDM',
  logLevel: 'info',
});

describe('MDM v2 API Contracts', () => {
  afterEach(() => Pact.verify());

  describe('Positive Scenarios', () => {
    it('should return entity details for a valid ID', () => {
      Pact.given('MDM has entity E-100').uponReceiving('a request for entity E-100')
        .withRequest({ method: 'GET', path: '/api/proxy/MDM/v2/entity', query: { id: 'E-100' } })
        .willRespondWith({
          status: 200,
          body: deepLike(loadFixture('v2-entity-pos')),
        });
    });

    it('should return ownership details for a valid entity', () => {
      Pact.given('MDM has ownership for E-100').uponReceiving('a request for ownership of E-100')
        .withRequest({ method: 'GET', path: '/api/proxy/MDM/v2/ownership', query: { id: 'E-100' } })
        .willRespondWith({
          status: 200,
          body: deepLike(loadFixture('v2-ownership-pos')),
        });
    });

    it('should return partners list', () => {
      Pact.given('MDM has partners list').uponReceiving('a request for MDM partners')
        .withRequest({ method: 'GET', path: '/api/proxy/MDM/v2/partners' })
        .willRespondWith({
          status: 200,
          body: deepLike(loadFixture('v2-partners-pos')),
        });
    });

    it('should return MDM v2 status', () => {
      Pact.given('MDM has v2 status active').uponReceiving('a request for MDM v2 status')
        .withRequest({ method: 'GET', path: '/api/proxy/MDM/v2/status' })
        .willRespondWith({
          status: 200,
          body: deepLike(loadFixture('v2-status-pos')),
        });
    });
  });

  describe('Negative Scenarios', () => {
    it('should return 404 for a non-existent entity', () => {
      Pact.given('MDM does not have entity E-999').uponReceiving('a request for entity E-999')
        .withRequest({ method: 'GET', path: '/api/proxy/MDM/v2/entity', query: { id: 'E-999' } })
        .willRespondWith({
          status: 404,
          body: deepLike(loadFixture('v2-entity-neg')),
        });
    });

    it('should return 400 for invalid query parameters', () => {
      Pact.given('MDM is running').uponReceiving('a request with invalid params')
        .withRequest({ method: 'GET', path: '/api/proxy/MDM/v2/status', query: { invalid: 'true' } })
        .willRespondWith({
          status: 400,
          body: deepLike(loadFixture('v2-status-neg')),
        });
    });
  });
});
