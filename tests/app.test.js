import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// DOM mínimo: comprueba el arranque y la conexión entre módulos sin dependencias.
// No sustituye una prueba visual en un navegador real.
const elements = new Map();
const listeners = new Map();
const memory = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    hidden: false, innerHTML: '', value: '', textContent: '', dataset: {},
    classList: { toggle() {} },
    handlers: {},
    addEventListener(event, handler) { this.handlers[event] = handler; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    focus() {}, select() {}, click() {},
  });
  return elements.get(id);
}
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
};
globalThis.document = {
  getElementById: element,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener(event, handler) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  },
};
globalThis.window = {};
function clickAction(action) {
  const button = {
    dataset: { act: action },
    closest(selector) { return selector === 'button' ? this : null; },
    hasAttribute() { return false; },
  };
  for (const handler of listeners.get('click') ?? []) handler({ target: button });
}

test('la distribución sin módulos arranca, crea, guarda y exporta sin el SDK de Claude', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<script defer src="\.\/assets\/app\.bundle\.js"><\/script>/);
  assert.match(html, /assets\/qrcode\.js/);
  assert.match(html, /assets\/jsQR\.js/);
  assert.doesNotMatch(html, /type="module"/);
  vm.runInThisContext(readFileSync(new URL('../assets/qrcode.js', import.meta.url), 'utf8'));
  vm.runInThisContext(readFileSync(new URL('../assets/lz-string.min.js', import.meta.url), 'utf8'));
  vm.runInThisContext(readFileSync(new URL('../assets/app.bundle.js', import.meta.url), 'utf8'));
  assert.match(element('app').innerHTML, /Aún no tienes materias/);
  assert.match(element('app').innerHTML, /Agregar horario a mano/);
  // La bienvenida ofrece crear las materias desde un horario, no una materia vacía.
  element('obSkip').handlers.click();
  assert.equal(element('onboardDlg').hidden, true);
  assert.equal(element('dlg').hidden, false);
  assert.equal(element('dt').textContent, 'Agregar horario a mano');
  const scheduleDay = String(new Date().getDay());
  element('asName').value = 'Cálculo';
  element('dtab').handlers.click({
    target: { closest: selector => selector === '[data-eday]' ? { dataset: { eday: scheduleDay } } : null },
  });
  element('dgo').handlers.click();
  const saved = JSON.parse(memory.get('calc-notas-v2'));
  assert.equal(saved.subjects.length, 1);
  assert.equal(saved.subjects[0].name, 'Cálculo');
  assert.deepEqual(saved.subjects[0].days, [Number(scheduleDay)]);
  assert.equal(saved.subjects[0].rows.length, 3);
  assert.equal(element('dlg').hidden, true);
  assert.match(element('app').innerHTML, /Horario y faltas de asistencia/);
  clickAction('export');
  assert.equal(element('dlg').hidden, false);
  assert.equal(element('dqrexport').hidden, false);
  assert.equal(element('dqrimport').hidden, true);
  assert.equal(JSON.parse(element('dta').value).subjects.length, 1);
  element('dx').handlers.click();
  clickAction('editHorario');
  assert.equal(element('dgo').hidden, true);
  assert.match(element('dtab').innerHTML, /data-hl-new/);
  assert.match(element('dtab').innerHTML, /Agregar materia/);
  element('dtab').handlers.click({
    target: { closest: selector => selector === '[data-hl-new]' ? {} : null },
  });
  assert.equal(element('dt').textContent, 'Agregar horario a mano');
  assert.match(element('dtab').innerHTML, /data-add-another/);
  // Cambiar de diálogo debe recuperar el botón que la lista de horarios oculta.
  clickAction('import');
  assert.equal(element('dgo').hidden, false);
  assert.equal(element('dqrimport').hidden, false);
  assert.equal(element('dqrexport').hidden, true);
  // Sin clave configurada, subir una foto abre el formulario de IA.
  clickAction('uploadSch');
  assert.equal(element('dlg').hidden, false);
  assert.equal(element('dt').textContent, 'Conectar IA');
  assert.match(element('dtab').innerHTML, /id="aiProvider"/);
  assert.match(element('dtab').innerHTML, /OpenAI/);
  assert.match(element('dtab').innerHTML, /id="aiKey"/);
  element('aiProvider').value = 'deepseek';
  element('aiKey').value = 'sk-test';
  element('aiModel').value = 'deepseek-flash';
  element('aiBase').value = 'https://api.deepseek.com';
  element('aiRemember').checked = true;
  element('dgo').handlers.click();
  assert.equal(JSON.parse(memory.get('calc-notas-ai')).apiKey, 'sk-test');
  assert.equal(element('dlg').hidden, true);

  // La exportación por QR genera un SVG con la copia completa.
  clickAction('export');
  element('dqrexport').handlers.click();
  assert.equal(element('dt').textContent, 'Exportar por QR');
  assert.match(element('dtab').innerHTML, /<svg/);
  element('dx').handlers.click();

  // El botón de cámara abre el escáner y se puede cancelar.
  clickAction('import');
  element('dqrimport').handlers.click();
  assert.equal(element('qrScanDlg').hidden, false);
  assert.match(element('qrScanMsg').textContent, /cámara|navegador/i);
  element('qrScanCancel').handlers.click();
  assert.equal(element('qrScanDlg').hidden, true);
  element('dx').handlers.click();

  // Registrar una falta y eliminar la materia debe limpiar también esa falta.
  clickAction('addFalta');
  const today = new Date();
  const dateKey = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
  element('cgrid').handlers.click({ target: { closest: () => ({ dataset: { date: dateKey } }) } });
  const subjectId = JSON.parse(memory.get('calc-notas-v2')).subjects[0].id;
  const deleteButton = {
    dataset: { act: 'delSub' }, textContent: 'Eliminar materia', style: {}, isConnected: true,
    hasAttribute() { return false; },
    closest(selector) {
      if (selector === 'button') return this;
      if (selector === '.card') return { dataset: { id: subjectId } };
      return null;
    },
  };
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  try {
    for (const handler of listeners.get('click') ?? []) handler({ target: deleteButton });
    for (const handler of listeners.get('click') ?? []) handler({ target: deleteButton });
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
  const afterDelete = JSON.parse(memory.get('calc-notas-v2'));
  assert.equal(afterDelete.subjects.length, 0);
  assert.equal(afterDelete.absences.length, 0);
});
