import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonParse, escapeHtml, truncate } from '../src/utils/helpers.js';

test('safeJsonParse parses clean JSON', () => {
  assert.deepEqual(safeJsonParse('{"a":1}'), { a: 1 });
});

test('safeJsonParse extracts JSON from code fences', () => {
  assert.deepEqual(safeJsonParse('Here is the result:\n```json\n{"a": [1,2]}\n```\nThanks!'), { a: [1, 2] });
});

test('safeJsonParse extracts JSON embedded in prose', () => {
  assert.deepEqual(safeJsonParse('prefix text {"ok": true, "n": 3} trailing'), { ok: true, n: 3 });
});

test('safeJsonParse returns null for unrecoverable input', () => {
  assert.equal(safeJsonParse(''), null);
  assert.equal(safeJsonParse('no json at all'), null);
  assert.equal(safeJsonParse(null), null);
});

test('escapeHtml neutralizes markup', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('truncate caps long strings', () => {
  const out = truncate('x'.repeat(100), 20);
  assert.ok(out.length < 100);
  assert.match(out, /truncated/);
  assert.equal(truncate('short', 20), 'short');
});
