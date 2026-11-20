import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAIConfig,
  isAIConfigured,
  extractJson,
  buildSchedulePrompt,
  readScheduleImage,
  testAIConnection,
} from '../src/services/ai.js';

test('normaliza proveedores y permite una API local sin clave', () => {
  const deepseek = normalizeAIConfig({ apiKey: '  sk-abc  ' });
  assert.equal(deepseek.provider, 'deepseek');
  assert.equal(deepseek.apiKey, 'sk-abc');
  assert.equal(deepseek.baseUrl, 'https://api.deepseek.com');
  assert.equal(deepseek.model, 'deepseek-flash');
  assert.equal(deepseek.remember, true);

  const openai = normalizeAIConfig({
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1///',
    model: 'gpt-4o-mini',
  });
  assert.equal(openai.baseUrl, 'https://api.openai.com/v1');
  assert.equal(openai.provider, 'openai');

  const local = normalizeAIConfig({
    provider: 'custom',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llava',
  });
  assert.equal(isAIConfigured(local), true);
  assert.equal(isAIConfigured({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }), false);
});

test('extrae JSON aunque venga con cercas o texto alrededor', () => {
  assert.deepEqual(extractJson('```json\n{"materias":[]}\n```'), { materias: [] });
  assert.deepEqual(extractJson('Claro, aquí está: {"materias":[{"nombre":"Física"}]} Fin.'), {
    materias: [{ nombre: 'Física' }],
  });
  assert.equal(extractJson('   '), null);
  assert.equal(extractJson('sin json'), null);
});

test('el mensaje pide JSON y conserva los nombres conocidos', () => {
  const prompt = buildSchedulePrompt(['Cálculo', 'Física']);
  assert.match(prompt, /JSON/);
  assert.match(prompt, /"Cálculo"/);
  assert.match(prompt, /"Física"/);
  assert.match(prompt, /"materias"/);
});

test('envía la clave y la imagen a un proveedor compatible con OpenAI', async () => {
  const original = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: '{"materias":[{"nombre":"Cálculo","bloques":[{"dia":1,"inicio":"07:00","fin":"09:00"}]}]}' } }],
      }),
    };
  };
  try {
    const result = await readScheduleImage(
      'data:image/png;base64,AAAA',
      { provider: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      'Extrae el horario en JSON.',
    );
    assert.equal(result.materias[0].nombre, 'Cálculo');
    assert.equal(captured.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(captured.options.headers.Authorization, 'Bearer sk-test');
    const body = JSON.parse(captured.options.body);
    assert.equal(body.model, 'gpt-4o-mini');
    assert.equal(body.thinking, undefined);
    assert.equal(body.messages[0].content[1].image_url.url, 'data:image/png;base64,AAAA');
    assert.equal(body.response_format.type, 'json_object');
  } finally {
    globalThis.fetch = original;
  }
});

test('permite un servidor local sin clave y sin modo JSON', async () => {
  const original = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: '{"materias":[]}' } }] }),
    };
  };
  try {
    const result = await readScheduleImage(
      'data:image/png;base64,AAAA',
      { provider: 'custom', baseUrl: 'http://localhost:11434/v1', model: 'llava' },
      'Extrae el horario en JSON.',
    );
    assert.deepEqual(result, { materias: [] });
    assert.equal(captured.url, 'http://localhost:11434/v1/chat/completions');
    assert.equal(captured.options.headers.Authorization, undefined);
    assert.equal(JSON.parse(captured.options.body).response_format, undefined);
  } finally {
    globalThis.fetch = original;
  }
});

test('usa el formato de Anthropic y sus cabeceras', async () => {
  const original = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ content: [{ type: 'text', text: '{"materias":[]}' }] }),
    };
  };
  try {
    const result = await readScheduleImage(
      'data:image/jpeg;base64,BBBB',
      { provider: 'anthropic', apiKey: 'sk-ant', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5' },
      'Extrae el horario en JSON.',
    );
    assert.deepEqual(result, { materias: [] });
    assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(captured.options.headers['x-api-key'], 'sk-ant');
    assert.equal(captured.options.headers['anthropic-version'], '2023-06-01');
    assert.equal(captured.options.headers['anthropic-dangerous-direct-browser-access'], 'true');
    const body = JSON.parse(captured.options.body);
    assert.equal(body.model, 'claude-sonnet-4-5');
    assert.equal(body.response_format, undefined);
    assert.equal(body.messages[0].content[0].type, 'text');
    assert.deepEqual(body.messages[0].content[1], {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'BBBB' },
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('traduce los errores de autenticación', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ error: { message: 'Authentication Fails' } }),
  });
  try {
    await assert.rejects(
      readScheduleImage(
        'data:image/png;base64,AAAA',
        { provider: 'deepseek', apiKey: 'sk-bad', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
        'JSON',
      ),
      /clave de API/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('reintenta una vez cuando la respuesta llega vacía', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const content = calls === 1 ? '   ' : '{"materias":[]}';
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
    };
  };
  try {
    const result = await readScheduleImage(
      'data:image/png;base64,AAAA',
      { provider: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      'JSON',
    );
    assert.deepEqual(result, { materias: [] });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test('prueba la conexión consultando los modelos del proveedor', async () => {
  const original = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }),
    };
  };
  try {
    const models = await testAIConnection({
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });
    assert.deepEqual(models, ['gpt-4o-mini']);
    assert.equal(captured.url, 'https://api.openai.com/v1/models');
    assert.equal(captured.options.headers.Authorization, 'Bearer sk-test');
  } finally {
    globalThis.fetch = original;
  }
});

test('lee varias capturas de una malla y acepta la colección de semestres', async () => {
  const original = globalThis.fetch;
  const images = ['data:image/png;base64,AAAA','data:image/png;base64,BBBB'];
  const result = {semestres:[{nombre:'Semestre 1',materias:[{nombre:'Cálculo',creditos:3}]}]};
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.messages[0].content.slice(1).map(item => item.image_url.url),images);
      return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]})};
    };
    const config = {provider:'openai',apiKey:'sk-test',baseUrl:'https://api.openai.com/v1',model:'gpt-4o-mini'};
    assert.deepEqual(await readScheduleImage(images, config, 'Lee la malla.', 'la malla', 8000, 'semestres'),result);
  } finally {
    globalThis.fetch = original;
  }
});
