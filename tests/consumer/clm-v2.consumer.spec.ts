import Pact from '@pact-foundation/pact';
import { deepLike } from '../../src/matchers/common';
import fs from 'fs';
import path from 'path';

const loadFixture = (folder: string, name: string) => 
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../testdata/${folder}/${name}.json`), 'utf8'));

Pact.setup({
  consumer: 'TaxMesh-Client',
  provider: 'TaxMesh-CLM',
  logLevel: 'info',
});

describe('CLM v2 API Contracts', () => {
  afterEach(() => Pact.verify());

  it('should return engagement details for a valid ID', () => {
    Pact.given('CLM has engagement ENG-200').uponReceiving('a request for engagement ENG-200')
      .withRequest({ method: 'GET', path: '/api/proxy/CLM/v2/engagement', query: { id: 'ENG-200' } })
      .willRespondWith({
        status: 200,
        body: deepLike(loadFixture('clm', 'v2-engagement-pos')),
      });
  });

  it('should return CLM v2 status', () => {
    Pact.given('CLM service is running').uponReceiving('a request for CLM v2 status')
      .withRequest({ method: 'GET', path: '/api/proxy/CLM/v2/status' })
      .willRespondWith({
        status: 200,
        body: deepLike(loadFixture('clm', 'v2-status-pos')),
      });
  });

  it('should update engagement status via PATCH', () => {
    Pact.given('CLM has engagement ENG-200').uponReceiving('a PATCH request to update engagement ENG-200')
      .withRequest({ 
        method: 'PATCH', 
        path: '/api/proxy/CLM/v2/engagement', 
        query: { id: 'ENG-200' },
        body: { status: 'Completed' } 
      })
      .willRespondWith({
        status: 200,
        body: deepLike(loadFixture('clm', 'v2-engagement-patch')),
      });
  });
});
