import type { RuntimeEnv } from './schema.ts';

export function validatePrivateDeployment(env: RuntimeEnv, issues: string[]): void {
  if (env.ORACLE_PRIVATE_DEPLOYMENT?.trim() !== '1') return;
  // HTTP and MCP have separate guards. A MCP-only token would leave /api/*
  // fail-open, so private mode requires the existing HTTP bearer explicitly.
  if (!filled(env.ARRA_API_TOKEN)) issues.push('private deployment requires ARRA_API_TOKEN for HTTP API protection.');
  if (!filled(env.ORACLE_BIND_HOST)) issues.push('private deployment requires ORACLE_BIND_HOST for loopback binding.');
  else if (!isLoopbackHost(env.ORACLE_BIND_HOST!)
    && !(env.ARRA_PRIVATE_CONTAINER === '1' && env.ORACLE_BIND_HOST!.trim() === '0.0.0.0')) {
    issues.push('ORACLE_BIND_HOST must be loopback-only in private deployment (or 0.0.0.0 only inside the loopback-published private container).');
  }
  if (filled(env.ARRA_API_KEY) && filled(env.ARRA_API_TOKEN) && env.ARRA_API_KEY!.trim() !== env.ARRA_API_TOKEN!.trim()) {
    issues.push('private deployment requires ARRA_API_KEY and ARRA_API_TOKEN to match when both are configured.');
  }
  const llmEnabled = ['1', 'true', 'yes'].includes((env.ORACLE_ASK_LLM ?? '').trim().toLowerCase())
    || ['1', 'true', 'yes'].includes((env.ORACLE_CONSOLIDATION_LLM ?? '').trim().toLowerCase());
  if (!llmEnabled) return;
  if (!filled(env.OPENAI_API_KEY)) issues.push('private LLM adapter requires OPENAI_API_KEY.');
  if (!filled(env.OPENAI_CHAT_MODEL)) issues.push('private LLM adapter requires OPENAI_CHAT_MODEL.');
  for (const key of ['ORACLE_ASK_LLM_URL', 'ORACLE_CONSOLIDATION_LLM_URL']) {
    if (!filled(env[key])) issues.push(`${key} is required when private LLM is enabled.`);
    else if (!isLoopbackUrl(env[key]!)) issues.push(`${key} must be loopback-only in private deployment.`);
  }
}

function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  } catch { return false; }
}

function isLoopbackHost(value: string): boolean {
  return ['127.0.0.1', 'localhost', '::1'].includes(value.trim().replace(/^\[|\]$/g, ''));
}

function filled(value: string | undefined): boolean { return Boolean(value?.trim()); }
