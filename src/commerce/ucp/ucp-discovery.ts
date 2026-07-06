import { readRecord } from '../shopware/shopware-store-api-readers.js';

export async function discoverUcpShoppingEndpoint(
  fetchImplementation: typeof fetch,
  baseUrl: string,
): Promise<string> {
  const discoveryUrl = new URL('/.well-known/ucp', baseUrl);
  let response: Response;
  try {
    response = await fetchImplementation(discoveryUrl);
  } catch (cause) {
    throw new Error(
      `UCP endpoint discovery failed: network error fetching ${discoveryUrl.toString()}`,
      { cause },
    );
  }
  if (!response.ok) {
    throw new Error(
      `UCP endpoint discovery failed: ${discoveryUrl.toString()} returned ${response.status}`,
    );
  }
  const profile = await response.json();
  return parseShoppingServiceEndpoint(profile);
}

function parseShoppingServiceEndpoint(profile: unknown): string {
  const root = readRecord(profile);
  const ucp = readRecord(root.ucp);
  const services = readRecord(ucp.services);
  const shopping = services['dev.ucp.shopping'];

  if (!shopping) {
    throw new Error('UCP profile missing dev.ucp.shopping service');
  }

  // Handle both object form (spec) and array form (our own emitted profile uses arrays)
  const service: unknown = Array.isArray(shopping) ? (shopping as readonly unknown[])[0] : shopping;
  const serviceRecord = readRecord(service);
  const endpoint = serviceRecord.endpoint;

  if (typeof endpoint !== 'string' || !endpoint) {
    throw new Error('UCP profile missing dev.ucp.shopping REST endpoint');
  }

  return endpoint.replace(/\/$/, '');
}
