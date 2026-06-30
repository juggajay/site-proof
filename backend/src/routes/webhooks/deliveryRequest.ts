import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

import {
  normalizeWebhookHostnameForSafety,
  resolvePublicWebhookAddresses,
  type PublicWebhookAddress,
} from './destinationSafety.js';

export interface WebhookDeliveryRequest {
  body: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export interface WebhookDeliveryResponse {
  status: number;
  text(): Promise<string>;
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

async function sendFetchWebhookDeliveryRequest(
  deliveryUrl: string,
  request: WebhookDeliveryRequest,
): Promise<WebhookDeliveryResponse> {
  return fetch(deliveryUrl, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
    redirect: 'error',
    signal: request.signal,
  });
}

function readPinnedWebhookResponse(
  parsed: URL,
  lookupHostname: string,
  address: PublicWebhookAddress,
  request: WebhookDeliveryRequest,
): Promise<WebhookDeliveryResponse> {
  if (request.signal?.aborted) {
    throw createAbortError();
  }

  const transport = parsed.protocol === 'https:' ? https : http;
  const requestOptions: http.RequestOptions & { servername?: string } = {
    family: address.family,
    headers: {
      ...request.headers,
      Host: parsed.host,
    },
    hostname: address.address,
    method: 'POST',
    path: `${parsed.pathname}${parsed.search}`,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    protocol: parsed.protocol,
  };

  if (parsed.protocol === 'https:' && isIP(lookupHostname) === 0) {
    requestOptions.servername = lookupHostname;
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    function abortRequest() {
      clientRequest.destroy(createAbortError());
    }

    function cleanup() {
      request.signal?.removeEventListener('abort', abortRequest);
    }

    function settle(callback: () => void) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    }

    const clientRequest = transport.request(requestOptions, (response) => {
      const chunks: Buffer[] = [];

      response.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      response.on('end', () => {
        settle(() => {
          const status = response.statusCode ?? 0;
          if (status >= 300 && status < 400) {
            reject(new Error('Webhook redirects are not allowed'));
            return;
          }

          const responseBody = Buffer.concat(chunks).toString('utf8');
          resolve({
            status,
            text: async () => responseBody,
          });
        });
      });

      response.on('error', (error) => {
        settle(() => reject(error));
      });
    });

    request.signal?.addEventListener('abort', abortRequest, { once: true });

    clientRequest.on('error', (error) => {
      settle(() => reject(error));
    });

    clientRequest.write(request.body);
    clientRequest.end();
  });
}

async function sendPinnedWebhookDeliveryRequest(
  deliveryUrl: string,
  request: WebhookDeliveryRequest,
): Promise<WebhookDeliveryResponse> {
  const parsed = new URL(deliveryUrl);
  const lookupHostname = normalizeWebhookHostnameForSafety(parsed.hostname);
  const [address] = await resolvePublicWebhookAddresses(lookupHostname);

  if (!address) {
    throw new Error('Webhook URL host could not be resolved');
  }

  return readPinnedWebhookResponse(parsed, lookupHostname, address, request);
}

export async function sendWebhookDeliveryRequest(
  deliveryUrl: string,
  request: WebhookDeliveryRequest,
): Promise<WebhookDeliveryResponse> {
  if (process.env.NODE_ENV !== 'production') {
    return sendFetchWebhookDeliveryRequest(deliveryUrl, request);
  }

  return sendPinnedWebhookDeliveryRequest(deliveryUrl, request);
}
