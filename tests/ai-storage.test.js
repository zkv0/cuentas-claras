import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map([
  ['calc-notas-deepseek', JSON.stringify({
    apiKey: 'sk-old',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    remember: true,
  })],
]);
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

const { loadAIConfig, saveAIConfig, isAIConfigured } = await import('../src/services/ai.js');

test('migra la configuración antigua de DeepSeek a la conexión genérica', () => {
  const config = loadAIConfig();
  assert.equal(config.provider, 'deepseek');
  assert.equal(config.apiKey, 'sk-old');
  assert.equal(config.model, 'deepseek-flash');
  assert.equal(isAIConfigured(config), true);
});

test('al guardar usa la clave nueva y elimina la anterior', () => {
  const saved = saveAIConfig({
    provider: 'deepseek',
    apiKey: 'sk-new',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    remember: true,
  });
  assert.equal(saved.apiKey, 'sk-new');
  assert.equal(JSON.parse(memory.get('calc-notas-ai')).apiKey, 'sk-new');
  assert.equal(memory.has('calc-notas-deepseek'), false);
});
