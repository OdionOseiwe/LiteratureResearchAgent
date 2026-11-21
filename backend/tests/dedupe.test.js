import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, dedupeSources, domainOf } from '../src/utils/dedupe.js';

test('normalizeUrl strips protocol, www, tracking params, fragments', () => {
  assert.equal(
    normalizeUrl('https://www.Example.com/path/?utm_source=x&b=2&id=42#frag'),
    'example.com/path?b=2&id=42'
  );
});

test('normalizeUrl handles trailing slashes and case', () => {
  assert.equal(normalizeUrl('HTTPS://EXAMPLE.com/A/B/'), 'example.com/A/B');
});

test('normalizeUrl tolerates garbage input', () => {
  assert.equal(typeof normalizeUrl('not a url'), 'string');
});

test('domainOf returns registrable host without www', () => {
  assert.equal(domainOf('https://www.reuters.com/world/x'), 'reuters.com');
  assert.equal(domainOf('::bad::'), '');
});

test('dedupeSources removes URL duplicates and keeps richer metadata', () => {
  const sources = [
    { url: 'https://a.com/article', title: 'First', publisher: '' },
    { url: 'https://www.a.com/article?utm_medium=email', title: 'First (dupe)', publisher: 'A.com' },
    { url: 'https://b.com/other', title: 'Other', publisher: 'B' },
  ];
  const { unique, duplicatesRemoved } = dedupeSources(sources);
  assert.equal(unique.length, 2);
  assert.equal(duplicatesRemoved, 1);
  const kept = unique.find((s) => s.url.includes('a.com'));
  assert.equal(kept.title, 'First');
  assert.equal(kept.publisher, 'A.com'); // merged from duplicate
});

test('dedupeSources drops entries with no URL', () => {
  const { unique } = dedupeSources([{ title: 'no url' }, null, { url: 'https://ok.com/', title: 'ok' }]);
  assert.equal(unique.length, 1);
});
