import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bool = (v, dflt = false) => (v === undefined ? dflt : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));
const num = (v, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

const config = {
  port: num(process.env.PORT, 5001),
  // Render injects RENDER_EXTERNAL_URL automatically; use it when FRONTEND_URL isn't set.
  frontendUrl: process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI || '',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model: process.env.OPENAI_MODEL || 'gemini-2.5-flash',
    modelHeavy: process.env.OPENAI_MODEL_HEAVY || process.env.OPENAI_MODEL || 'gemini-2.5-flash',
  },
  tavilyApiKey: process.env.TAVILY_API_KEY || '',
  pdfStoragePath: path.resolve(__dirname, '..', '..', process.env.PDF_STORAGE_PATH || './storage'),
  tavilyBaseUrl: process.env.TAVILY_BASE_URL || 'https://api.tavily.com',
  jinaReaderBaseUrl: process.env.JINA_READER_BASE_URL || 'https://r.jina.ai',
  maxSourcesPerRun: num(process.env.MAX_SOURCES_PER_RUN, 18),
  maxPageChars: num(process.env.MAX_PAGE_CHARS, 12000),
  maxResearchRounds: num(process.env.MAX_RESEARCH_ROUNDS, 2),
  searchResultsPerQuery: num(process.env.SEARCH_RESULTS_PER_QUERY, 6),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

/** Return list of human-readable config problems (empty when fully configured). */
export function configIssues() {
  const issues = [];
  if (!config.mongodbUri) issues.push('MONGODB_URI is not set (MongoDB connection will fail)');
  if (!config.openai.apiKey) issues.push('OPENAI_API_KEY is not set (LLM calls will fail)');
  if (!config.tavilyApiKey) issues.push('TAVILY_API_KEY is not set (web search will fail)');
  return issues;
}

/** Hard validation used at startup – logs clearly, refuses to boot only when DB is missing. */
export function assertBootConfig() {
  fs.mkdirSync(config.pdfStoragePath, { recursive: true });
  const issues = configIssues();
  for (const i of issues) console.warn(`[config] WARNING: ${i}`);
  if (!config.mongodbUri) {
    console.error('[config] FATAL: MONGODB_URI is required to start the server. See .env.example.');
    process.exit(1);
  }
}

export default config;
