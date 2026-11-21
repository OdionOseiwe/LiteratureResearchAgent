import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSufficiency } from '../src/agents/researchManager.js';

test('quick depth is always sufficient after one round', () => {
  const r = evaluateSufficiency({ findings: [], verificationSummary: null, round: 1, maxRounds: 2, depth: 'quick' });
  assert.equal(r.sufficient, true);
});

test('insufficient when too few verified findings', () => {
  const r = evaluateSufficiency({
    findings: new Array(3).fill({ verificationStatus: 'Unverified' }),
    verificationSummary: { totalFindings: 3, byStatus: { Unverified: 3 } },
    round: 1, maxRounds: 2, depth: 'standard',
  });
  assert.equal(r.sufficient, false);
});

test('sufficient when enough verified/supported findings exist', () => {
  const r = evaluateSufficiency({
    findings: new Array(8).fill({}),
    verificationSummary: { totalFindings: 8, byStatus: { Supported: 5, 'Partially supported': 1, Unverified: 2 } },
    round: 1, maxRounds: 2, depth: 'standard',
  });
  assert.equal(r.sufficient, true);
});

test('never loops forever — max rounds forces sufficiency', () => {
  const r = evaluateSufficiency({
    findings: [],
    verificationSummary: { totalFindings: 0, byStatus: {} },
    round: 2, maxRounds: 2, depth: 'deep',
  });
  assert.equal(r.sufficient, true);
});
