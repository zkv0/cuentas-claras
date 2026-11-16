import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitQrPayload,
  formatQrPart,
  parseQrPart,
  joinQrParts,
  makeQrId,
} from '../src/services/qr.js';

test('genera un identificador corto para agrupar los códigos', () => {
  const id = makeQrId();
  assert.match(id, /^[A-Z0-9]{8}$/);
  assert.notEqual(makeQrId(), makeQrId());
});

test('parte y reconstruye un contenido largo en varios QR', () => {
  const payload = 'abcdefghij'.repeat(130);
  const chunks = splitQrPayload(payload, 600);
  assert.equal(chunks.length, 3);
  const id = 'ABCD2345';
  const parts = chunks.map((chunk, index) => formatQrPart(id, index + 1, chunks.length, chunk));
  const parsed = parts.map(parseQrPart);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].total, 3);
  assert.equal(joinQrParts(parsed.slice().reverse()), payload);
});

test('detecta partes incompletas o ajenas', () => {
  const id = 'ABCD2345';
  const a = parseQrPart(formatQrPart(id, 1, 2, 'hola'));
  const b = parseQrPart(formatQrPart(id, 2, 2, 'mundo'));
  assert.equal(joinQrParts([a, b]), 'holamundo');
  assert.equal(joinQrParts([a]), null);
  assert.equal(joinQrParts([a, parseQrPart(formatQrPart('ZZZZ9999', 2, 2, 'mundo'))]), null);
});

test('rechaza textos que no son paquetes de Cuentas Claras', () => {
  assert.equal(parseQrPart('https://ejemplo.com'), null);
  assert.equal(parseQrPart('CCQR1|ABC|1|2|dato'), null);
  assert.equal(parseQrPart('CCQR1|ABCD|3|2|dato'), null);
  assert.equal(parseQrPart('CCQR1|ABCD|1|2|'), null);
  assert.equal(parseQrPart('CCQR1|ABCD|1|2|dato').chunk, 'dato');
});
