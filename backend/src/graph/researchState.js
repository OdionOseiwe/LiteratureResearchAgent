import { Annotation } from '@langchain/langgraph';

/**
 * Shared state for the research graph. Each node returns partial updates.
 * Arrays/objects are replaced (not merged) by returning the full new value.
 */
export const ResearchState = Annotation.Root({
  jobId: Annotation({ reducer: (_, v) => v, default: () => '' }),
  topic: Annotation({ reducer: (_, v) => v, default: () => '' }),
  depth: Annotation({ reducer: (_, v) => v, default: () => 'standard' }),
  timeframe: Annotation({ reducer: (_, v) => v, default: () => '' }),
  sourcePreferences: Annotation({ reducer: (_, v) => v, default: () => [] }),
  userQuestions: Annotation({ reducer: (_, v) => v, default: () => [] }),
  outputFormat: Annotation({ reducer: (_, v) => v, default: () => 'report' }),

  // Manager outputs
  objective: Annotation({ reducer: (_, v) => v, default: () => '' }),
  scope: Annotation({ reducer: (_, v) => v, default: () => '' }),
  researchQuestions: Annotation({ reducer: (_, v) => v, default: () => [] }),
  plan: Annotation({ reducer: (_, v) => v, default: () => [] }),

  // Discovered + merged sources (full replacement each round)
  sources: Annotation({ reducer: (_, v) => v, default: () => [] }),
  findings: Annotation({ reducer: (_, v) => v, default: () => [] }),
  verificationSummary: Annotation({ reducer: (_, v) => v, default: () => null }),
  insights: Annotation({ reducer: (_, v) => v, default: () => null }),

  // Control flow
  round: Annotation({ reducer: (_, v) => v, default: () => 1 }),
  maxRounds: Annotation({ reducer: (_, v) => v, default: () => 2 }),
  sufficiencyReason: Annotation({ reducer: (_, v) => v, default: () => '' }),

  // Final artifacts
  report: Annotation({ reducer: (_, v) => v, default: () => null }),

  // Accounting
  tokensUsed: Annotation({ reducer: (a, b) => (a || 0) + (b || 0), default: () => 0 }),
  errors: Annotation({ reducer: (_, v) => v, default: () => [] }),
});
