import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};

const { state, removeSubject } = await import('../src/core/store.js');

test('elimina la materia y sus referencias de todas las faltas', () => {
  state.subjects = [{ id: 'a', rows: [] }, { id: 'b', rows: [] }];
  state.absences = [
    { id: 'x', date: '2026-11-16', ids: ['a', 'b'] },
    { id: 'y', date: '2026-11-17', ids: ['a'] },
    { id: 'z', date: '2026-11-18', ids: ['b'] },
  ];
  state.updatedAt = 0;
  removeSubject('a');
  assert.deepEqual(state.subjects.map(subject => subject.id), ['b']);
  assert.deepEqual(state.absences, [
    { id: 'x', date: '2026-11-16', ids: ['b'] },
    { id: 'z', date: '2026-11-18', ids: ['b'] },
  ]);
  assert.ok(state.updatedAt > 0);
  assert.equal(JSON.parse(memory.get('calc-notas-v2')).subjects.length, 1);
});

test('limpia faltas sin materias y tolera referencias incompletas', () => {
  state.subjects = [{ id: 'b', rows: [] }];
  state.absences = [{ id: 'q', ids: [] }, { id: 'r' }];
  assert.doesNotThrow(() => removeSubject('no-existe'));
  assert.deepEqual(state.absences, []);
});
