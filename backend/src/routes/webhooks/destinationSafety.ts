import { promises as dns } from 'node:dns';
import { BlockList, isIP } from 'node:net';

import { AppError } from '../../lib/AppError.js';

const LOCAL_WEBHOOK_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

const BLOCKED_IPV4_SUBNETS: Array<[address: string, prefix: number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const BLOCKED_IPV6_SUBNETS: Array<[address: string, prefix: number]> = [
  ['::', 96],
  ['::ffff:0:0', 96],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

const blockedWebhookIpv4Addresses = new BlockList();
const blockedWebhookIpv6Addresses = new BlockList();
for (const [address, prefix] of BLOCKED_IPV4_SUBNETS) {
  blockedWebhookIpv4Addresses.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of BLOCKED_IPV6_SUBNETS) {
  blockedWebhookIpv6Addresses.addSubnet(address, prefix, 'ipv6');
}

export interface PublicWebhookAddress {
  address: string;
  family: 4 | 6;
}

export function normalizeWebhookHostnameForSafety(hostname: string): string {
  let normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');

  while (normalized.endsWith('.')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

export function isDisallowedWebhookIpAddress(address: string): boolean {
  const normalized = normalizeWebhookHostnameForSafety(address);
  const family = isIP(normalized);

  if (family === 4) {
    return blockedWebhookIpv4Addresses.check(normalized, 'ipv4');
  }

  if (family === 6) {
    return blockedWebhookIpv6Addresses.check(normalized, 'ipv6');
  }

  return false;
}

export function isDisallowedWebhookHost(hostname: string): boolean {
  const normalized = normalizeWebhookHostnameForSafety(hostname);

  return (
    LOCAL_WEBHOOK_HOSTS.includes(normalized) ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    isDisallowedWebhookIpAddress(normalized)
  );
}

export async function resolvePublicWebhookAddresses(
  hostname: string,
): Promise<PublicWebhookAddress[]> {
  const lookupHostname = normalizeWebhookHostnameForSafety(hostname);

  if (isDisallowedWebhookHost(lookupHostname)) {
    throw AppError.badRequest('Webhook URL host is not allowed');
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(lookupHostname, { all: true, verbatim: true });
  } catch {
    throw AppError.badRequest('Webhook URL host could not be resolved');
  }

  if (addresses.some(({ address }) => isDisallowedWebhookIpAddress(address))) {
    throw AppError.badRequest('Webhook URL host resolved to a private address');
  }

  return addresses.map(({ address, family }) => ({
    address,
    family: family === 6 ? 6 : 4,
  }));
}
