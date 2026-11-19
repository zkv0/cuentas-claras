import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnboarding } from '../src/features/onboarding.js';

function createMockDom() {
  const elements = new Map();
  const listeners = new Map();

  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        hidden: true,
        value: '',
        textContent: '',
        innerHTML: '',
        className: '',
        dataset: {},
        classList: {
          add(c) { this.classes = this.classes || new Set(); this.classes.add(c); },
          remove(c) { if (this.classes) this.classes.delete(c); },
          contains(c) { return Boolean(this.classes && this.classes.has(c)); },
        },
        handlers: {},
        addEventListener(event, handler) { this.handlers[event] = handler; },
        focus() {},
        click() { if (this.handlers.click) this.handlers.click({ target: this, preventDefault() {} }); },
        closest() { return null; },
      });
    }
    return elements.get(id);
  }

  return {
    element,
    document: {
      getElementById: element,
      addEventListener(event, handler) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(handler);
      },
    },
    listeners,
  };
}

test('parseSubjects extrae correctamente materias, días y bloques', () => {
  const mockDom = createMockDom();
  globalThis.document = mockDom.document;
  const onboarding = createOnboarding({
    state: { subjects: [] },
    ui: { anim: {} },
    save() {},
    render() {},
    schedTable() { return ''; },
  });

  const response = {
    materias: [
      {
        nombre: 'Cálculo Diferencial',
        bloques: [
          { dia: 1, inicio: '07:00', fin: '09:00' },
          { dia: 3, inicio: '07:00', fin: '09:00' },
        ],
      },
      {
        nombre: 'Física I',
        dias: [2, 4],
        bloques: [
          { dia: 2, inicio: '09:00', fin: '11:00' },
          { dia: 4, inicio: '09:00', fin: '11:00' },
        ],
      },
    ],
  };

  const parsed = onboarding.parseSubjects(response);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'Cálculo Diferencial');
  assert.deepEqual(parsed[0].days, [1, 3]);
  assert.equal(parsed[0].blocks.length, 2);
  assert.equal(parsed[1].name, 'Física I');
  assert.deepEqual(parsed[1].days, [2, 4]);
});

test('agregar horario a mano cierra la bienvenida y abre el editor manual', () => {
  const mockDom = createMockDom();
  globalThis.document = mockDom.document;
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
  };

  const state = { subjects: [] };
  let manualOpened = false;
  const onboarding = createOnboarding({
    state,
    ui: { anim: {} },
    save() {},
    render() {},
    schedTable() { return ''; },
    openAddSched() { manualOpened = true; },
  });

  onboarding.openOnboarding();
  assert.equal(mockDom.element('onboardDlg').hidden, false);

  mockDom.element('obSkip').click();
  assert.equal(mockDom.element('onboardDlg').hidden, true);
  assert.equal(manualOpened, true);
  assert.equal(state.subjects.length, 0);
});
