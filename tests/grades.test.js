import test from 'node:test';
import assert from 'node:assert/strict';
import { calc, chip } from '../src/domain/grades.js';
import { classCount, allowed } from '../src/domain/attendance.js';
import { cleanSubject, applySubjectSnapshot } from '../src/domain/subjects.js';

const subject = rows => ({ min: 3, max: 5, rows });

test('calcula el promedio necesario sobre el porcentaje restante', () => {
  const result = calc(subject([{ p: 40, g: 4 }, { p: 60, g: '' }]));
  assert.equal(result.earned, 1.6);
  assert.ok(Math.abs(result.need - 2.333333333333333) < 1e-10);
});

test('reserva puntos de predicciones fijas antes de distribuir lo pendiente', () => {
  const result = calc(subject([
    { p: 40, g: 4 }, { p: 20, g: '', pred: 5 }, { p: 40, g: '' },
  ]));
  assert.equal(result.predPts, 1);
  assert.ok(Math.abs(result.need - 1) < 1e-10);
});

test('usa porcentaje sin asignar cuando aún no se definieron pendientes', () => {
  const result = calc(subject([{ p: 50, g: 2 }]));
  assert.equal(result.free, 50);
  assert.equal(result.need, 4);
});

test('distingue nota definitiva, proyección y porcentajes inválidos', () => {
  assert.equal(chip(calc(subject([{ p: 100, g: 4 }]))).t, 'Ganada: 4.00');
  assert.equal(chip(calc(subject([{ p: 100, g: 2 }]))).t, 'Perdida: 2.00');
  assert.equal(chip(calc(subject([{ p: 100, g: '', pred: 4 }]))).t, 'Proyección: 4.00');
  assert.equal(chip(calc(subject([{ p: 101, g: 4 }]))).t, 'Revisa los %');
});

test('acepta coma decimal y detecta metas superiores a la escala', () => {
  assert.equal(calc(subject([{ p: '50', g: '3,5' }])).earned, 1.75);
  assert.equal(chip(calc(subject([{ p: 90, g: 1 }]))).cls, 'bad');
});

test('cuenta días dentro del semestre incluidos ambos extremos', () => {
  const semester = { start: '2026-11-16', end: '2026-11-30', pct: '20' };
  const sub = { days: [1, 3, 5] };
  assert.equal(classCount(sub, semester), 7);
  assert.equal(allowed(sub, semester), 1);
  assert.equal(allowed(sub, { ...semester, pct: '0' }), 0);
  assert.equal(classCount(sub, { start: semester.end, end: semester.start }), 0);
});

test('importa materias con identidad nueva conservando notas y bloques', () => {
  const source = { id: 'old', name: 'Física', days: [1], blocks: [{ d: 1, s: '7:00', e: '9:00' }], rows: [{ p: 50, g: 4 }] };
  const result = cleanSubject(source);
  assert.notEqual(result.id, source.id);
  assert.deepEqual(result.rows, [{ p: '50', g: '4', pred: '' }]);
  assert.deepEqual(result.blocks, [{ d: 1, s: '07:00', e: '09:00' }]);
});

test('restaura una copia completa y remapea las faltas', () => {
  const state = { subjects: [{ id: 'old', rows: [] }], absences: [], sem: { start: '', end: '', pct: '' } };
  const data = {
    subjects: [{ id: 's1', name: 'Cálculo', days: [1], blocks: [{ d: 1, s: '7:00', e: '9:00' }], rows: [{ p: '50', g: '4' }] }],
    absences: [
      { date: '2026-11-16', ids: ['s1'] },
      { date: '2026-11-16', ids: ['s1'] },
      { date: '2026-11-17', ids: ['no-existe'] },
    ],
    sem: { start: '2026-01-01', end: '2026-06-01', pct: '20' },
    ai: { provider: 'openai', apiKey: 'sk-test' },
  };
  const ai = applySubjectSnapshot(state, data);
  assert.equal(state.subjects.length, 1);
  assert.equal(state.subjects[0].name, 'Cálculo');
  assert.notEqual(state.subjects[0].id, 's1');
  assert.equal(state.absences.length, 1);
  assert.deepEqual(state.absences[0].ids, [state.subjects[0].id]);
  assert.deepEqual(state.sem, data.sem);
  assert.deepEqual(ai, data.ai);
});
