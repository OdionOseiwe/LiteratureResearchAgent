import OpenAI from 'openai';
import config from '../config/index.js';
import { safeJsonParse, withRetry, truncate } from '../utils/helpers.js';

let client = null;

function getClient() {
  if (!client) {
    if (!config.openai.apiKey) {
      const err = new Error('OPENAI_API_KEY is not configured. Add it to backend/.env (see .env.example).');
      err.code = 'LLM_NOT_CONFIGURED';
      throw err;
    }
    client = new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl });
  }
  return client;
}

const isRetriable = (err) => {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) return true;
  if (status && status >= 500) return true;
  const msg = String(err?.message || '');
  return /timeout|timed out|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|rate limit/i.test(msg);
};

/**
 * Call the chat model. Returns { text, tokensUsed, model }.
 * @param {object} opts { system, user, heavy, temperature, maxTokens, json, trace }
 */
export async function chat({ system, user, heavy = false, temperature = 0.3, maxTokens = 3000, json = false, trace = 'llm' }) {
  const model = heavy ? config.openai.modelHeavy : config.openai.model;
  const openai = getClient();

  const body = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };

  try {
    const res = await withRetry(() => openai.chat.completions.create(body), {
      retries: 4,
      baseDelayMs: 1200,
      shouldRetry: isRetriable,
      onRetry: ({ attempt, delay, err }) =>
        console.warn(`[llm:${trace}] retry ${attempt} in ${delay}ms (${err?.status || err?.message})`),
    });
    const text = res?.choices?.[0]?.message?.content ?? '';
    const tokensUsed = res?.usage?.total_tokens ?? 0;
    return { text, tokensUsed, model };
  } catch (err) {
    // Some OpenAI-compatible providers reject response_format; fall back once without it.
    if (json && /response_format|json_object/i.test(String(err?.message || ''))) {
      const res = await withRetry(
        () => openai.chat.completions.create({ ...body, response_format: undefined }),
        { retries: 3, baseDelayMs: 1200, shouldRetry: isRetriable }
      );
      const text = res?.choices?.[0]?.message?.content ?? '';
      return { text, tokensUsed: res?.usage?.total_tokens ?? 0, model };
    }
    err.code = err.code || 'LLM_ERROR';
    // Surface the provider's actual message — OpenAI-compatible error bodies vary in shape
    err.message = extractProviderMessage(err) || err.message;
    throw err;
  }
}

/** Pull a readable message out of however the provider shaped its error body. */
function extractProviderMessage(err) {
  const data = err?.response?.data ?? err?.error ?? err?.body;
  const pick = (d) => {
    if (!d) return null;
    if (typeof d === 'string') return d.slice(0, 300);
    if (Array.isArray(d)) return d.map(pick).filter(Boolean).join('; ');
    return d?.error?.message || d?.message || d?.error || null;
  };
  return pick(data) || (typeof err?.message === 'string' && err.message.length < 400 ? err.message : null);
}

/**
 * Call the model expecting a JSON object; parse tolerantly and validate with `validate(obj) -> {ok, value|error}`.
 * One automatic repair attempt is made when parsing/validation fails.
 */
export async function chatJson({ system, user, heavy = false, temperature = 0.2, maxTokens = 4000, schemaHint, validate, trace = 'llm-json' }) {
  const first = await chat({ system, user, heavy, temperature, maxTokens, json: true, trace });
  let parsed = safeJsonParse(first.text);
  let tokensUsed = first.tokensUsed;
  let validation = validate ? validate(parsed) : { ok: !!parsed, value: parsed };

  if (!validation.ok) {
    const repairUser = `${user}\n\n---\nYour previous reply was not valid for this task (${validation.error || 'unparseable JSON'}). Reply with ONLY the corrected JSON object, no prose, no code fences.${schemaHint ? `\nExpected shape: ${schemaHint}` : ''}`;
    const second = await chat({ system, user: repairUser, heavy, temperature: 0, maxTokens, json: true, trace: `${trace}:repair` });
    tokensUsed += second.tokensUsed;
    parsed = safeJsonParse(second.text);
    validation = validate ? validate(parsed) : { ok: !!parsed, value: parsed };
  }
  if (!validation.ok) {
    const err = new Error(`LLM did not return valid structured output: ${validation.error || 'parse failure'}`);
    err.code = 'LLM_BAD_OUTPUT';
    throw err;
  }
  return { data: validation.value ?? parsed, tokensUsed, model: first.model };
}

/** Compact token-safe excerpt of webpage content for prompts. */
export const pageExcerpt = (text, max = config.maxPageChars) => truncate(text, max);
