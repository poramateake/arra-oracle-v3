import { expect, test } from 'bun:test';
import { configToModels, loadVectorConfig } from '../../../src/vector/config.ts';

test('private vector template selects one OpenAI sqlite-vec collection', () => {
  const config = loadVectorConfig('deploy/private/arra-full-stack/vector-server.private.json');
  expect(config).not.toBeNull();
  const models = configToModels(config!);
  expect(Object.keys(models)).toEqual(['openai-small']);
  expect(models['openai-small']).toMatchObject({
    collection: 'oracle_knowledge_openai_small',
    adapter: 'sqlite-vec',
    provider: 'openai',
    model: 'text-embedding-3-small',
    embedder: { backend: 'openai', model: 'text-embedding-3-small', dimensions: 1536 },
  });
});
