import { describe, expect, test } from 'bun:test';
import { handleRequest } from '../../../deploy/private/arra-full-stack/llm-adapter.ts';

const askPayload = {
  instruction: 'Answer only from sources. Return JSON with answer, citations, noEvidence.',
  question: 'What is Arra?',
  sources: [{ index: 1, id: 'doc-1', excerpt: 'Arra is a private memory layer.' }],
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('private LLM adapter', () => {
  test('fails closed when provider credentials are incomplete', async () => {
    let calls = 0;
    const result = await handleRequest(new Request('http://127.0.0.1/ask', {
      method: 'POST', body: JSON.stringify(askPayload), headers: { 'content-type': 'application/json' },
    }), { env: {}, fetcher: async () => { calls += 1; return response({}); } });

    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ noEvidence: true });
    expect(calls).toBe(0);
  });

  test('returns a cited ask response and pins the configured model', async () => {
    let request: any;
    const result = await handleRequest(new Request('http://127.0.0.1/ask', {
      method: 'POST', body: JSON.stringify(askPayload), headers: { 'content-type': 'application/json' },
    }), {
      env: { OPENAI_API_KEY: 'test-key', OPENAI_CHAT_MODEL: 'test-mini' },
      fetcher: async (_url, init) => { request = JSON.parse(String(init?.body)); return response({ choices: [{ message: { content: '{"answer":"Arra is private.","citations":[1],"noEvidence":false}' } }] }); },
    });

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ answer: 'Arra is private.', citations: [1], noEvidence: false });
    expect(request.model).toBe('test-mini');
    expect(request.messages[1].content).toContain('What is Arra?');
  });

  test('fails closed when an ask cites an unavailable source index', async () => {
    const result = await handleRequest(new Request('http://127.0.0.1/ask', {
      method: 'POST', body: JSON.stringify(askPayload), headers: { 'content-type': 'application/json' },
    }), {
      env: { OPENAI_API_KEY: 'test-key', OPENAI_CHAT_MODEL: 'test-mini' },
      fetcher: async () => response({ choices: [{ message: { content: '{"answer":"unsupported","citations":[99],"noEvidence":false}' } }] }),
    });

    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ noEvidence: true, citations: [] });
  });

  test('fails closed when evidence-backed output has no citations', async () => {
    const result = await handleRequest(new Request('http://127.0.0.1/ask', {
      method: 'POST', body: JSON.stringify(askPayload), headers: { 'content-type': 'application/json' },
    }), {
      env: { OPENAI_API_KEY: 'test-key', OPENAI_CHAT_MODEL: 'test-mini' },
      fetcher: async () => response({ choices: [{ message: { content: '{"answer":"unsupported","citations":[],"noEvidence":false}' } }] }),
    });
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ noEvidence: true });
  });

  test('rejects a non-OpenAI endpoint in private mode without sending the key', async () => {
    let calls = 0;
    const result = await handleRequest(new Request('http://127.0.0.1/ask', {
      method: 'POST', body: JSON.stringify(askPayload), headers: { 'content-type': 'application/json' },
    }), {
      env: { ORACLE_PRIVATE_DEPLOYMENT: '1', OPENAI_API_KEY: 'test-key', OPENAI_CHAT_MODEL: 'test-mini', OPENAI_CHAT_URL: 'http://evil.invalid/chat' },
      fetcher: async () => { calls += 1; return response({}); },
    });
    expect(result.status).toBe(503);
    expect(calls).toBe(0);
  });

  test('returns a validated SUPERSEDE decision for consolidation prompts', async () => {
    const result = await handleRequest(new Request('http://127.0.0.1/ask', {
      method: 'POST', body: JSON.stringify({ instruction: 'Return SUPERSEDE or NOOP only.', question: 'compare', sources: [{ index: 1, id: 'old' }, { index: 2, id: 'new' }] }),
      headers: { 'content-type': 'application/json' },
    }), {
      env: { OPENAI_API_KEY: 'test-key', OPENAI_CHAT_MODEL: 'test-mini' },
      fetcher: async () => response({ choices: [{ message: { content: '{"action":"SUPERSEDE","oldId":"old","newId":"new","reason":"newer"}' } }] }),
    });

    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ action: 'SUPERSEDE', oldId: 'old', newId: 'new' });
  });

  test('consolidation provider failure becomes a safe NOOP', async () => {
    const result = await handleRequest(new Request('http://127.0.0.1/ask', {
      method: 'POST', body: JSON.stringify({ instruction: 'Return SUPERSEDE or NOOP only.', question: 'compare', sources: [] }),
      headers: { 'content-type': 'application/json' },
    }), {
      env: { OPENAI_API_KEY: 'test-key', OPENAI_CHAT_MODEL: 'test-mini' },
      fetcher: async () => { throw new Error('network down'); },
    });

    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ action: 'NOOP' });
  });
});
