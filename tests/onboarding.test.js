import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule } from '../src/domain/schedule-import.js';

test('normaliza materias, días y bloques del horario', () => {
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

  const parsed = parseSchedule(response);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'Cálculo Diferencial');
  assert.deepEqual(parsed[0].days, [1, 3]);
  assert.equal(parsed[0].blocks.length, 2);
  assert.equal(parsed[1].name, 'Física I');
  assert.deepEqual(parsed[1].days, [2, 4]);
});
