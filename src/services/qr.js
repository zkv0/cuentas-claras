/** Paquetes QR para transferir la copia completa sin backend.
 * Cada código lleva una parte del texto comprimido y un índice; el receptor
 * junta todas las partes antes de restaurar.
 */
export const QR_CHUNK_SIZE = 600;
export const QR_PREFIX = 'CCQR1';

export function makeQrId() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var id = '';
  for (var i = 0; i < 8; i += 1) {
    id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return id;
}

export function splitQrPayload(payload, size) {
  var text = String(payload || '');
  var chunkSize = Math.max(100, Number(size) || QR_CHUNK_SIZE);
  var chunks = [];
  for (var i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export function formatQrPart(id, index, total, chunk) {
  return QR_PREFIX + '|' + id + '|' + index + '|' + total + '|' + chunk;
}

export function parseQrPart(value) {
  var text = String(value == null ? '' : value).trim();
  var match = /^CCQR1\|([A-Z0-9]{4,16})\|(\d{1,3})\|(\d{1,3})\|([\s\S]+)$/.exec(text);
  if (!match) return null;
  var index = Number(match[2]);
  var total = Number(match[3]);
  if (!index || !total || index > total || total > 200) return null;
  return { id: match[1], index: index, total: total, chunk: match[4] };
}

export function joinQrParts(parts) {
  if (!Array.isArray(parts) || !parts.length) return null;
  var id = parts[0].id;
  var total = parts[0].total;
  var chunks = {};
  parts.forEach(function (part) {
    if (!part || part.id !== id || part.total !== total) return;
    chunks[part.index] = part.chunk;
  });
  var joined = '';
  for (var i = 1; i <= total; i += 1) {
    if (typeof chunks[i] !== 'string') return null;
    joined += chunks[i];
  }
  return joined;
}
