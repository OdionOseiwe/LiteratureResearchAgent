/**
 * SSRF protection for outbound webpage retrieval.
 * Blocks non-http(s) schemes, localhost, private/loopback/link-local/reserved IPs and cloud metadata endpoints.
 */
import dns from 'dns/promises';
import net from 'net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost', 'metadata', 'metadata.google.internal', 'instance-data',
  '169.254.169.254', '100.100.100.200',
]);

function ipv4ToLong(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function isPrivateIpv4(ip) {
  const n = ipv4ToLong(ip);
  const ranges = [
    ['10.0.0.0', '10.255.255.255'],
    ['172.16.0.0', '172.31.255.255'],
    ['192.168.0.0', '192.168.255.255'],
    ['127.0.0.0', '127.255.255.255'],
    ['169.254.0.0', '169.254.255.255'],
    ['0.0.0.0', '0.255.255.255'],
    ['100.64.0.0', '100.127.255.255'], // CGNAT
    ['192.0.0.0', '192.0.0.255'],
    ['198.18.0.0', '198.19.255.255'],
    ['224.0.0.0', '255.255.255.255'], // multicast/reserved
  ];
  return ranges.some(([a, b]) => n >= ipv4ToLong(a) && n <= ipv4ToLong(b));
}

function isPrivateIpv6(ip) {
  const s = ip.toLowerCase();
  if (s === '::1' || s === '::') return true;
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80');
}

export function isBlockedIp(ip) {
  const type = net.isIP(ip);
  if (type === 4) return isPrivateIpv4(ip);
  if (type === 6) return isPrivateIpv6(ip);
  return true;
}

/**
 * Validate a user/agent supplied URL for safe fetching.
 * Returns { ok: true, url: URL } or { ok: false, reason }.
 * Resolves DNS to catch hostnames pointing at internal IPs.
 */
export async function validatePublicUrl(raw, { resolveDns = true } = {}) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, reason: `Blocked protocol: ${url.protocol}` };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(host)) return { ok: false, reason: 'Blocked hostname' };
  if (net.isIP(host)) {
    if (isBlockedIp(host)) return { ok: false, reason: 'Blocked private/reserved IP address' };
    return { ok: true, url };
  }
  if (resolveDns) {
    try {
      const addrs = await dns.lookup(host, { all: true, verbatim: true });
      if (!addrs.length) return { ok: false, reason: 'DNS lookup returned no addresses' };
      for (const a of addrs) {
        if (isBlockedIp(a.address)) {
          return { ok: false, reason: `Hostname resolves to a private/reserved address (${a.address})` };
        }
      }
    } catch (err) {
      return { ok: false, reason: `DNS lookup failed: ${err.code || err.message}` };
    }
  }
  return { ok: true, url };
}
