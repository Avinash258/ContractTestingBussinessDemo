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
import {
  clmV2EngagementSchema,
  clmV2ErrorSchema,
  clmV2StatusSchema,
  type ClmV2Engagement,
  type ClmV2Error,
  type ClmV2Status,
} from '../schemas/clmV2';

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

  /** v2 readiness — MDM checks this before importing master data */
  async getV2Status(): Promise<ClmV2Status> {
    const res = await this.http.get('/v2/status');
    if (res.status !== 200) {
      throw new Error(`CLM /v2/status returned ${res.status}`);
    }
    return assertSchema(clmV2StatusSchema, res.data, 'GET /v2/status');
  }

  async getV2Engagement(): Promise<ClmV2Engagement> {
    const res = await this.http.get('/v2/engagement');
    if (res.status !== 200) {
      throw new Error(`CLM /v2/engagement returned ${res.status}`);
    }
    return assertSchema(clmV2EngagementSchema, res.data, 'GET /v2/engagement');
  }

  /** Returns HTTP status + validated error body for rejected patches */
  async patchV2Engagement(
    body: Record<string, unknown>
  ): Promise<{ status: number; data: ClmV2Engagement | ClmV2Error }> {
    const res = await this.http.patch('/v2/engagement', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 400) {
      return {
        status: res.status,
        data: assertSchema(clmV2ErrorSchema, res.data, 'PATCH /v2/engagement 400'),
      };
    }
    return { status: res.status, data: res.data };
  }
}
