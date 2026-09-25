type Env = Record<string, string | undefined>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Source = { index?: unknown; id?: unknown; excerpt?: unknown } & Record<string, unknown>;
type AskPayload = { instruction: string; question?: string; sources: Source[] };
type AdapterState = { active: number; nextAllowedAt: number };
type Options = { env?: Env; fetcher?: Fetcher; sleep?: (ms: number) => Promise<void>; state?: AdapterState };

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_INSTRUCTION_CHARS = 12_000;
const MAX_QUESTION_CHARS = 8_000;
const MAX_SOURCE_COUNT = 32;
const MAX_SOURCE_CHARS = 120_000;
const defaultState: AdapterState = { active: 0, nextAllowedAt: 0 };

export function createAdapterState(): AdapterState { return { active: 0, nextAllowedAt: 0 }; }

export async function handleRequest(request: Request, options: Options = {}): Promise<Response> {
  const url = new URL(request.url);
  const env = options.env ?? process.env;
  if (url.pathname === '/health' && request.method === 'GET') return json({ status: 'ok', provider: 'openai', model: env.OPENAI_CHAT_MODEL?.trim() || null, configured: Boolean(env.OPENAI_API_KEY?.trim() && env.OPENAI_CHAT_MODEL?.trim()) });
  if (url.pathname !== '/ask') return json({ error: 'not_found' }, 404);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let payload: AskPayload;
  try { payload = parsePayload(await request.json()); }
  catch { return json({ error: 'invalid_request' }, 400); }
  const consolidation = isConsolidation(payload.instruction);
  try {
    const raw = await callProvider(payload, options);
    const parsed = parseJson(raw);
    const output = consolidation ? validateConsolidation(parsed, payload.sources) : validateAsk(parsed, payload.sources);
    return json(output);
  } catch (error) {
    if (consolidation) return json({ action: 'NOOP', reason: 'adapter_fail_closed', model: env.OPENAI_CHAT_MODEL?.trim() || 'unconfigured' });
    return json({ answer: '', citations: [], noEvidence: true, mode: 'extractive' }, 503);
  }
}

async function callProvider(payload: AskPayload, options: Options): Promise<string> {
  const env = options.env ?? process.env;
  const key = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_CHAT_MODEL?.trim();
  if (!key || !model) throw new Error('OPENAI_API_KEY and OPENAI_CHAT_MODEL are required');
  const fetcher = options.fetcher ?? fetch;
  const state = options.state ?? defaultState;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxRetries = boundedInt(env.OPENAI_MAX_RETRIES, 2, 0, 3);
  const timeoutMs = boundedInt(env.OPENAI_TIMEOUT_MS, 30_000, 500, 120_000);
  const maxConcurrent = boundedInt(env.OPENAI_MAX_CONCURRENCY, 2, 1, 8);
  const minIntervalMs = boundedInt(env.OPENAI_MIN_INTERVAL_MS, 0, 0, 60_000);
  await acquire(state, maxConcurrent, minIntervalMs, sleep);
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(providerUrl(env), {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: payload.instruction },
              { role: 'user', content: JSON.stringify({ question: payload.question ?? '', sources: payload.sources }) },
            ],
            max_completion_tokens: boundedInt(env.OPENAI_MAX_OUTPUT_TOKENS, 700, 64, 2_000),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = new Error(`OpenAI chat failed (${response.status})`);
          if (attempt < maxRetries && (response.status === 429 || response.status >= 500)) { lastError = error; await sleep(50 * 2 ** attempt); continue; }
          throw error;
        }
        const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('OpenAI chat response missing content');
        return content;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) { await sleep(50 * 2 ** attempt); continue; }
      } finally { clearTimeout(timeout); }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  } finally { state.active = Math.max(0, state.active - 1); }
}

async function acquire(state: AdapterState, maxConcurrent: number, minIntervalMs: number, sleep: (ms: number) => Promise<void>): Promise<void> {
  while (true) {
    if (state.active < maxConcurrent) {
      const now = Date.now();
      const wait = state.nextAllowedAt - now;
      if (wait <= 0) {
        state.active += 1;
        state.nextAllowedAt = now + minIntervalMs;
        return;
      }
      await sleep(wait);
    } else await sleep(10);
  }
}

function parsePayload(value: unknown): AskPayload {
  if (!value || typeof value !== 'object') throw new Error('payload must be an object');
  const record = value as Record<string, unknown>;
  const instruction = typeof record.instruction === 'string' ? record.instruction.trim() : '';
  if (!instruction) throw new Error('instruction is required');
  const question = typeof record.question === 'string' ? record.question.trim() : '';
  if (instruction.length > MAX_INSTRUCTION_CHARS || question.length > MAX_QUESTION_CHARS) throw new Error('request text exceeds adapter bounds');
  const sources = Array.isArray(record.sources) ? record.sources.filter(isRecord) as Source[] : [];
  if (sources.length > MAX_SOURCE_COUNT || JSON.stringify(sources).length > MAX_SOURCE_CHARS) throw new Error('source payload exceeds adapter bounds');
  return { instruction, question, sources };
}

function validateAsk(value: unknown, sources: Source[]): Record<string, unknown> {
  const record = asRecord(value);
  const answer = typeof record.answer === 'string' ? record.answer.trim() : '';
  const citations = Array.isArray(record.citations) ? record.citations.map(Number).filter(Number.isInteger) : [];
  if (!answer || typeof record.noEvidence !== 'boolean') throw new Error('invalid ask response');
  const validIndexes = new Set(sources.map((source, index) => Number.isInteger(source.index) ? Number(source.index) : index + 1));
  if (citations.some((citation) => !validIndexes.has(citation))) throw new Error('ask citation index is not in sources');
  if (record.noEvidence === false && citations.length === 0) throw new Error('evidence-backed ask requires citations');
  return { answer, citations: [...new Set(citations)], noEvidence: record.noEvidence };
}

function validateConsolidation(value: unknown, sources: Source[]): Record<string, unknown> {
  const record = asRecord(value);
  const action = String(record.action ?? '').toUpperCase();
  if (action === 'NOOP') return { action: 'NOOP', reason: text(record.reason) ?? 'no-op' };
  if (action !== 'SUPERSEDE') throw new Error('invalid consolidation action');
  const oldId = text(record.oldId ?? record.old_id), newId = text(record.newId ?? record.new_id);
  const ids = new Set(sources.map((source) => text(source.id)).filter(Boolean));
  if (!oldId || !newId || oldId === newId || !ids.has(oldId) || !ids.has(newId)) throw new Error('invalid consolidation ids');
  return { action: 'SUPERSEDE', oldId, newId, reason: text(record.reason) ?? 'LLM consolidation suggestion' };
}

function parseJson(value: string): unknown {
  const text = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}
function isConsolidation(instruction: string): boolean { const text = instruction.toUpperCase(); return text.includes('SUPERSEDE') || text.includes('NOOP'); }
function asRecord(value: unknown): Record<string, unknown> { if (!isRecord(value)) throw new Error('response must be an object'); return value; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number { const value = Number.parseInt(raw ?? '', 10); return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback; }
function json(body: unknown, status = 200): Response { return Response.json(body, { status, headers: { 'cache-control': 'no-store' } }); }
function providerUrl(env: Env): string {
  const candidate = env.OPENAI_CHAT_URL?.trim() || OPENAI_URL;
  if (env.ORACLE_PRIVATE_DEPLOYMENT === '1' && candidate !== OPENAI_URL) throw new Error('private adapter only permits api.openai.com chat completions');
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.openai.com' || parsed.pathname !== '/v1/chat/completions' || parsed.search || parsed.username || parsed.password) throw new Error('unapproved OpenAI endpoint');
  } catch (error) {
    throw error instanceof Error ? error : new Error('invalid OpenAI endpoint');
  }
  return candidate;
}

if (import.meta.main) {
  const port = boundedInt(process.env.ORACLE_LLM_ADAPTER_PORT, 47779, 1024, 65_535);
  Bun.serve({ hostname: '127.0.0.1', port, fetch: (request) => handleRequest(request) });
  console.log(`Arra LLM adapter listening on 127.0.0.1:${port}`);
}
