import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicUrl } from '../src/utils/ssrfGuard.js';

test('blocks non-http protocols', async () => {
  for (const u of ['file:///etc/passwd', 'ftp://example.com/x', 'gopher://x']) {
    const r = await validatePublicUrl(u, { resolveDns: false });
    assert.equal(r.ok, false, u);
  }
});

test('blocks loopback and private literal IPs', async () => {
  for (const u of ['http://127.0.0.1/admin', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data', 'http://172.16.0.9/']) {
    const r = await validatePublicUrl(u, { resolveDns: false });
    assert.equal(r.ok, false, u);
  }
});

test('blocks localhost hostname without DNS', async () => {
  const r = await validatePublicUrl('http://localhost:5001/api', { resolveDns: false });
  assert.equal(r.ok, false);
});

test('blocks private IPv6 loopback/link-local', async () => {
  for (const u of ['http://[::1]/', 'http://[fe80::1]/']) {
    const r = await validatePublicUrl(u, { resolveDns: false });
    assert.equal(r.ok, false, u);
  }
});

test('allows public https URLs (skip DNS)', async () => {
  const r = await validatePublicUrl('https://example.com/article', { resolveDns: false });
  assert.equal(r.ok, true);
});

test('rejects unparseable URLs', async () => {
  const r = await validatePublicUrl('ht tp://bad url spaces', { resolveDns: false });
  assert.equal(r.ok, false);
});
