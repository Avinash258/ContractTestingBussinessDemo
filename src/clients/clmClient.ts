import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { httpAgent, httpsAgent } from './httpAgent';
import {
  assertSchema,
  clmContractsCatalogSchema,
  clmHealthSchema,
  ct00EngagementSchema,
  type Ct00Engagement,
} from '../schemas/ct00';

/**
 * How MDM talks to CLM for CT-00.
 * In consumer Pact tests, `baseUrl` points at the Pact mock server.
 */
export class ClmClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: 10_000,
      headers: { Accept: 'application/json', Connection: 'close' },
      httpAgent,
      httpsAgent,
      validateStatus: () => true,
    });
  }

  static againstLiveClm(): ClmClient {
    return new ClmClient(config.clmBaseUrl);
  }

  async getHealth() {
    const res = await this.http.get('/health');
    if (res.status !== 200) {
      throw new Error(`CLM /health returned ${res.status}`);
    }
    return assertSchema(clmHealthSchema, res.data, 'GET /health');
  }

  async getContractsCatalog() {
    const res = await this.http.get('/contracts');
    if (res.status !== 200) {
      throw new Error(`CLM /contracts returned ${res.status}`);
    }
    return assertSchema(
      clmContractsCatalogSchema,
      res.data,
      'GET /contracts'
    );
  }

  /** Primary CT-00 producer payload consumed by MDM */
  async getEngagementContext(): Promise<Ct00Engagement> {
    const res = await this.http.get(config.contract.path);
    if (res.status !== 200) {
      throw new Error(
        `CLM ${config.contract.path} returned ${res.status}`
      );
    }
    return assertSchema(
      ct00EngagementSchema,
      res.data,
      `GET ${config.contract.path}`
    );
  }

  /** Downstream payloads CLM sends to MDM (includes CT-00) */
  async getDownstreamToMdm() {
    const res = await this.http.get('/downstream/MDM');
    if (res.status !== 200) {
      throw new Error(`CLM /downstream/MDM returned ${res.status}`);
    }
    return res.data;
  }
}
