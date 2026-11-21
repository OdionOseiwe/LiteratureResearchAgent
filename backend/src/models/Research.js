import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled source' },
  url: { type: String, required: true },
  publisher: { type: String, default: '' },
  author: { type: String, default: '' },
  publishedAt: { type: String, default: '' }, // keep raw string; publishers use inconsistent formats
  accessedAt: { type: Date, default: Date.now },
  sourceType: { type: String, default: 'web' }, // academic | official | news | documentation | blog | report | web
  description: { type: String, default: '' },
  excerpt: { type: String, default: '' },
  query: { type: String, default: '' }, // search query that discovered it
  category: { type: String, default: 'general' },
  relevance: { type: Number, default: null },
  summary: { type: String, default: '' },
  verificationStatus: {
    type: String,
    enum: ['Verified', 'Supported', 'Partially supported', 'Conflicting evidence', 'Unverified', 'Unsupported', 'pending'],
    default: 'pending',
  },
  reachable: { type: Boolean, default: null },
  claimsSupported: { type: Number, default: 0 },
  discoveredBy: { type: String, default: 'web-discovery' },
}, { _id: true, timestamps: false });

const findingSchema = new mongoose.Schema({
  claim: { type: String, required: true },
  explanation: { type: String, default: '' },
  evidence: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  sourceTitle: { type: String, default: '' },
  excerpt: { type: String, default: '' },
  researchQuestion: { type: String, default: '' },
  confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  limitations: { type: String, default: '' },
  verificationStatus: {
    type: String,
    enum: ['Verified', 'Supported', 'Partially supported', 'Conflicting evidence', 'Unverified', 'Unsupported', 'pending'],
    default: 'pending',
  },
  verificationNote: { type: String, default: '' },
}, { _id: true });

const agentExecutionSchema = new mongoose.Schema({
  agent: { type: String, required: true },
  agentType: { type: String, default: 'specialist' },
  status: { type: String, enum: ['pending', 'working', 'completed', 'failed', 'skipped'], default: 'pending' },
  task: { type: String, default: '' },
  outputSummary: { type: String, default: '' },
  startedAt: { type: Date },
  endedAt: { type: Date },
  error: { type: String, default: '' },
  retryCount: { type: Number, default: 0 },
  tokensUsed: { type: Number, default: 0 },
}, { _id: false });

const researchSchema = new mongoose.Schema({
  topic: { type: String, required: true, trim: true, maxlength: 500 },
  prompt: { type: String, default: '', maxlength: 8000 },
  depth: { type: String, enum: ['quick', 'standard', 'deep'], default: 'standard' },
  timeframe: { type: String, default: '' },
  sourcePreferences: { type: [String], default: [] },
  outputFormat: { type: String, default: 'report' },
  userQuestions: { type: [String], default: [] },

  status: {
    type: String,
    enum: ['queued', 'planning', 'researching', 'analyzing', 'synthesizing', 'completed', 'failed', 'partial'],
    default: 'queued',
    index: true,
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  currentStage: { type: String, default: 'Queued' },
  activityLog: { type: [{ at: { type: Date, default: Date.now }, message: String }], default: [] },

  objective: { type: String, default: '' },
  scope: { type: String, default: '' },
  researchPlan: { type: [String], default: [] },
  researchQuestions: { type: [String], default: [] },

  agents: { type: [agentExecutionSchema], default: [] },
  sources: { type: [sourceSchema], default: [] },
  findings: { type: [findingSchema], default: [] },
  insights: { type: mongoose.Schema.Types.Mixed, default: null },
  verificationSummary: { type: mongoose.Schema.Types.Mixed, default: null },

  report: { type: mongoose.Schema.Types.Mixed, default: null }, // structured report object
  reportMarkdown: { type: String, default: '' },
  pdfPath: { type: String, default: '' },
  pdfGeneratedAt: { type: Date },

  error: { type: String, default: '' },
  errorDetails: { type: mongoose.Schema.Types.Mixed, default: null },
  rounds: { type: Number, default: 1 },
  tokensUsed: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
}, { timestamps: false });

researchSchema.index({ topic: 'text', prompt: 'text' });
researchSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

researchSchema.methods.logActivity = function (message) {
  this.activityLog.push({ at: new Date(), message });
  if (this.activityLog.length > 200) this.activityLog = this.activityLog.slice(-200);
};

export default mongoose.model('Research', researchSchema);
