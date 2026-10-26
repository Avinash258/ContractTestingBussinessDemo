import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { httpAgent, httpsAgent } from './httpAgent';
import {
  assertSchema,
  ct01EntitiesSchema,
  ct02TaxAttributesSchema,
  ct03OwnershipSchema,
  ct04FilingMetaSchema,
  mdmHealthSchema,
  type Ct01Entities,
  type Ct02TaxAttributes,
  type Ct03Ownership,
  type Ct04FilingMeta,
} from '../schemas/mdm';

/**
 * How downstream services (ACC / TAX / ALC / DOC) talk to MDM.
 * In consumer Pact tests, `baseUrl` points at the Pact mock server.
 */
export class MdmClient {
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

  static againstLiveMdm(): MdmClient {
    return new MdmClient(config.mdmBaseUrl);
  }

  async getHealth() {
    const res = await this.http.get('/health');
    if (res.status !== 200) {
      throw new Error(`MDM /health returned ${res.status}`);
    }
    return assertSchema(mdmHealthSchema, res.data, 'GET /health');
  }

  async getEntities(): Promise<Ct01Entities> {
    const path = config.mdm.contracts.ct01.path;
    const res = await this.http.get(path);
    if (res.status !== 200) throw new Error(`MDM ${path} returned ${res.status}`);
    return assertSchema(ct01EntitiesSchema, res.data, `GET ${path}`);
  }

  async getTaxAttributes(): Promise<Ct02TaxAttributes> {
    const path = config.mdm.contracts.ct02.path;
    const res = await this.http.get(path);
    if (res.status !== 200) throw new Error(`MDM ${path} returned ${res.status}`);
    return assertSchema(ct02TaxAttributesSchema, res.data, `GET ${path}`);
  }

  async getOwnership(): Promise<Ct03Ownership> {
    const path = config.mdm.contracts.ct03.path;
    const res = await this.http.get(path);
    if (res.status !== 200) throw new Error(`MDM ${path} returned ${res.status}`);
    return assertSchema(ct03OwnershipSchema, res.data, `GET ${path}`);
  }

  async getFilingMeta(): Promise<Ct04FilingMeta> {
    const path = config.mdm.contracts.ct04.path;
    const res = await this.http.get(path);
    if (res.status !== 200) throw new Error(`MDM ${path} returned ${res.status}`);
    return assertSchema(ct04FilingMetaSchema, res.data, `GET ${path}`);
  }

  async getDownstream(peer: string) {
    const res = await this.http.get(`/downstream/${peer}`);
    if (res.status !== 200) {
      throw new Error(`MDM /downstream/${peer} returned ${res.status}`);
    }
    return res.data;
  }
}
