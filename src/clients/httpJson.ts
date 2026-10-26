import axios, { AxiosInstance } from 'axios';
import { httpAgent, httpsAgent } from './httpAgent';

export function createJsonClient(baseUrl: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/$/, ''),
    timeout: 15_000,
    headers: { Accept: 'application/json', Connection: 'close' },
    httpAgent,
    httpsAgent,
    validateStatus: () => true,
  });
}

export async function getJson(
  client: AxiosInstance,
  path: string
): Promise<{ status: number; data: any }> {
  const res = await client.get(path);
  return { status: res.status, data: res.data };
}
