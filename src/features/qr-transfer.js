import { esc } from '../core/utils.js';
import { loadAIConfig, isAIConfigured, providerDefaults } from '../services/ai.js';
import { makeQrId, splitQrPayload, formatQrPart, parseQrPart, joinQrParts, QR_CHUNK_SIZE } from '../services/qr.js';

/** Exportación e importación por QR, sin backend.
 * El QR contiene una copia completa (incluida la configuración de IA) y se
 * parte en varios códigos cuando no cabe en uno solo.
 */
export function createQrTransfer({ state, ui, restoreSnapshot }) {
  const $ = id => document.getElementById(id);
  let exportParts = [];
  let exportIndex = 0;
  let pendingSnapshot = null;
  let scanSession = null;
  let scanning = false;
  let stream = null;
  let scanTimer = null;
  let detector = null;
  let detectorFails = 0;
  let scanCanvas = null;
  let scanVideo = null;

  function setMsg(id, text, type) {
    var el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'm' + (type ? ' ' + type : '');
  }

  function utf8ToBase64(value) {
    var bytes = new TextEncoder().encode(String(value));
    var binary = '';
    bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToUtf8(value) {
    var binary = atob(String(value));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeSnapshot(snapshot) {
    var json = JSON.stringify(snapshot);
    if (typeof LZString !== 'undefined' && LZString && LZString.compressToBase64) {
      return 'LZ1:' + LZString.compressToBase64(json);
    }
    return 'B64:' + utf8ToBase64(json);
  }

  function decodePayload(payload) {
    var text = String(payload || '');
    if (text.indexOf('LZ1:') === 0) {
      if (typeof LZString === 'undefined' || !LZString || !LZString.decompressFromBase64) {
        throw new Error('Este navegador no pudo descomprimir el QR.');
      }
      var json = LZString.decompressFromBase64(text.slice(4));
      if (!json) throw new Error('El QR está incompleto o dañado.');
      return json;
    }
    if (text.indexOf('B64:') === 0) {
      return base64ToUtf8(text.slice(4));
    }
    throw new Error('El QR no tiene un formato reconocido.');
  }

  function snapshot() {
    var ai = loadAIConfig();
    return {
      app: 'cuentas-claras',
      version: 2,
      exportedAt: new Date().toISOString(),
      subjects: state.subjects,
      absences: state.absences,
      sem: state.sem,
      ai: isAIConfigured(ai) ? ai : null,
    };
  }

  function drawExportQr() {
    var part = exportParts[exportIndex];
    var svg;
    try {
      var qr = qrcode(0, 'M');
      qr.addData(part);
      qr.make();
      svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    } catch (error) {
      $('dtab').innerHTML = '<p class="m warn">No pude generar el QR. Usa la exportación de texto.</p>';
      return;
    }
    var total = exportParts.length;
    var html = '<div class="qrview"><div class="qrimg">' + svg + '</div>';
    if (total > 1) {
      html += '<div class="qrnav">' +
        '<button type="button" class="ghost" data-qr-prev' + (exportIndex === 0 ? ' disabled' : '') + '>‹</button>' +
        '<span class="qrcount">Código ' + (exportIndex + 1) + ' de ' + total + '</span>' +
        '<button type="button" class="ghost" data-qr-next' + (exportIndex === total - 1 ? ' disabled' : '') + '>›</button>' +
        '</div><p class="m" style="text-align:center">Escanea este código y luego pasa al siguiente.</p>';
    } else {
      html += '<p class="m" style="text-align:center">Un solo código contiene toda la información.</p>';
    }
    html += '<p class="m qrwarn">Puede incluir tu configuración y tu clave de API. No compartas este QR.</p></div>';
    $('dtab').innerHTML = html;
  }

  function openExportQr() {
    try {
      if (typeof qrcode !== 'function') throw new Error('No se cargó el generador de QR. Usa la exportación de texto.');
      var payload = encodeSnapshot(snapshot());
      var chunks = splitQrPayload(payload, QR_CHUNK_SIZE);
      if (!chunks.length) throw new Error('No hay datos para exportar.');
      if (chunks.length > 99) throw new Error('Hay demasiados datos para el QR. Usa la exportación de texto.');
      var id = makeQrId();
      exportParts = chunks.map(function (chunk, index) {
        return formatQrPart(id, index + 1, chunks.length, chunk);
      });
      exportIndex = 0;
      ui.dialogMode = 'exportqr';
      $('dt').textContent = 'Exportar por QR';
      $('dp').textContent = 'Escanea los códigos desde el otro dispositivo. La copia incluye materias, faltas, semestre y conexión de IA.';
      $('dta').hidden = true;
      $('dtab').hidden = false;
      $('dgo').hidden = true;
      $('dqrexport').hidden = true;
      $('dqrimport').hidden = true;
      $('dmsg').textContent = '';
      $('dlg').hidden = false;
      drawExportQr();
    } catch (error) {
      setMsg('dmsg', (error && error.message) || 'No pude crear el QR.', 'warn');
    }
  }

  function openImportQr() {
    scanSession = null;
    $('qrScanDlg').hidden = false;
    setMsg('qrScanMsg', 'Iniciando cámara…');
    startCamera();
  }

  function setScanMsg(text, type) {
    setMsg('qrScanMsg', text, type);
  }

  function cameraError(error) {
    var name = error && error.name;
    if (name === 'NotAllowedError') return 'No diste permiso para usar la cámara.';
    if (name === 'NotFoundError') return 'No encontré una cámara disponible.';
    if (name === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación.';
    return 'No pude abrir la cámara. La cámara requiere HTTPS o localhost y un navegador compatible.';
  }

  function stopScanner(hide) {
    scanning = false;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = null;
    if (stream) {
      stream.getTracks().forEach(function (track) { track.stop(); });
      stream = null;
    }
    if (scanVideo) scanVideo.srcObject = null;
    detector = null;
    if (hide) $('qrScanDlg').hidden = true;
  }

  function scheduleFrame() {
    if (!scanning) return;
    scanTimer = setTimeout(scanFrame, 250);
  }

  function scanFrame() {
    if (!scanning || !scanVideo) return;
    if (detector) {
      try {
        detector.detect(scanVideo).then(function (codes) {
          if (scanning && codes && codes.length && codes[0].rawValue) handleQrText(codes[0].rawValue);
        }, function () {
          detectorFails += 1;
          if (detectorFails > 5 && typeof jsQR === 'function') detector = null;
        }).then(scheduleFrame);
      } catch (error) {
        detector = null;
        scheduleFrame();
      }
      return;
    }
    if (typeof jsQR !== 'function' || scanVideo.readyState < 2 || !scanVideo.videoWidth) {
      scheduleFrame();
      return;
    }
    try {
      var width = Math.min(640, scanVideo.videoWidth);
      var height = Math.round(scanVideo.videoHeight * (width / scanVideo.videoWidth));
      if (!scanCanvas) scanCanvas = document.createElement('canvas');
      scanCanvas.width = width;
      scanCanvas.height = height;
      var context = scanCanvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(scanVideo, 0, 0, width, height);
      var image = context.getImageData(0, 0, width, height);
      var code = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) handleQrText(code.data);
    } catch (error) {}
    scheduleFrame();
  }

  function startCamera() {
    scanVideo = $('qrVideo');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanMsg('Este navegador no permite abrir la cámara. Prueba desde HTTPS o localhost.', 'warn');
      return;
    }
    stopScanner(false);
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    }).then(function (mediaStream) {
      stream = mediaStream;
      scanVideo.srcObject = mediaStream;
      scanVideo.muted = true;
      scanVideo.setAttribute('playsinline', '');
      return scanVideo.play().catch(function () {});
    }).then(function () {
      detector = null;
      detectorFails = 0;
      if (typeof BarcodeDetector !== 'undefined') {
        try {
          detector = new BarcodeDetector({ formats: ['qr_code'] });
        } catch (error) {
          detector = null;
        }
      }
      if (!detector && typeof jsQR !== 'function') {
        stopScanner(false);
        setScanMsg('Este navegador no puede leer QR. Prueba con Chrome, Edge o Safari actualizado.', 'warn');
        return;
      }
      scanning = true;
      setScanMsg('Apunta la cámara al código QR.');
      scanFrame();
    }).catch(function (error) {
      stopScanner(false);
      setScanMsg(cameraError(error), 'warn');
    });
  }

  function handleQrText(text) {
    var part = parseQrPart(text);
    if (!part) {
      setScanMsg('Ese código no es una copia de Cuentas Claras.', 'warn');
      return;
    }
    if (!scanSession || scanSession.id !== part.id || scanSession.total !== part.total) {
      scanSession = { id: part.id, total: part.total, parts: {} };
    }
    scanSession.parts[part.index] = part;
    var received = Object.keys(scanSession.parts).length;
    if (received < part.total) {
      setScanMsg('Recibido ' + received + ' de ' + part.total + ' códigos. Escanea los que faltan.');
      return;
    }
    var payload = joinQrParts(Object.keys(scanSession.parts).map(function (index) {
      return scanSession.parts[index];
    }));
    if (!payload) {
      setScanMsg('Faltan partes del QR. Vuelve a escanear los códigos.', 'warn');
      return;
    }
    try {
      var data = JSON.parse(decodePayload(payload));
      if (!data || !Array.isArray(data.subjects)) throw new Error('El QR no contiene materias válidas.');
      stopScanner(true);
      scanSession = null;
      showReview(data);
    } catch (error) {
      scanSession = null;
      setScanMsg((error && error.message) || 'No pude leer los datos del QR.', 'warn');
    }
  }

  function decodeImageFile(file) {
    setScanMsg('Leyendo la imagen…');
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          var scale = Math.min(1, 1000 / Math.max(image.width, image.height));
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          var context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          function finish(text) {
            if (text) handleQrText(text);
            else setScanMsg('No encontré un QR legible en la imagen.', 'warn');
          }
          function fallbackJsQr() {
            if (typeof jsQR !== 'function') {
              finish('');
              return;
            }
            var qr = jsQR(pixels.data, pixels.width, pixels.height);
            finish(qr && qr.data ? qr.data : '');
          }
          if (typeof BarcodeDetector !== 'undefined') {
            try {
              new BarcodeDetector({ formats: ['qr_code'] }).detect(image).then(function (codes) {
                if (codes && codes.length && codes[0].rawValue) finish(codes[0].rawValue);
                else fallbackJsQr();
              }, fallbackJsQr);
              return;
            } catch (error) {}
          }
          fallbackJsQr();
        } catch (error) {
          setScanMsg('No pude leer la imagen del QR.', 'warn');
        }
      };
      image.onerror = function () {
        setScanMsg('No pude abrir la imagen.', 'warn');
      };
      image.src = String(reader.result || '');
    };
    reader.onerror = function () {
      setScanMsg('No pude abrir la imagen.', 'warn');
    };
    reader.readAsDataURL(file);
  }

  function showReview(data) {
    pendingSnapshot = data;
    ui.dialogMode = 'qrreview';
    $('dt').textContent = 'Restaurar desde QR';
    $('dp').textContent = 'Se reemplazarán tus materias, faltas y semestre actuales. Si el QR incluye IA, también se restaurará su configuración.';
    $('dmsg').textContent = '';
    $('dta').hidden = true;
    $('dtab').hidden = false;
    var count = Array.isArray(data.subjects) ? data.subjects.length : 0;
    var absences = Array.isArray(data.absences) ? data.absences.length : 0;
    var hasAi = Boolean(data.ai && isAIConfigured(data.ai));
    var provider = data.ai && data.ai.provider ? providerDefaults(data.ai.provider).label : 'sin proveedor';
    $('dtab').innerHTML = '<div class="qrreview">' +
      '<p><b>' + count + '</b> materia' + (count === 1 ? '' : 's') + ' y <b>' + absences + '</b> falta' + (absences === 1 ? '' : 's') + '.</p>' +
      '<p class="m">Conexión de IA incluida: ' + (hasAi ? 'sí (' + esc(provider) + ')' : 'no') + '.</p>' +
      '<p class="m qrwarn">Solo restaura códigos de una fuente confiable.</p></div>';
    $('dgo').textContent = 'Restaurar todo';
    $('dgo').hidden = false;
    $('dqrexport').hidden = true;
    $('dqrimport').hidden = true;
    $('dlg').hidden = false;
  }

  function applyImportReview() {
    if (!pendingSnapshot) return;
    var data = pendingSnapshot;
    pendingSnapshot = null;
    restoreSnapshot(data);
  }

  function handleQrClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (ui.dialogMode === 'exportqr') {
      if (target.closest('[data-qr-prev]') && exportIndex > 0) {
        exportIndex -= 1;
        drawExportQr();
        return;
      }
      if (target.closest('[data-qr-next]') && exportIndex < exportParts.length - 1) {
        exportIndex += 1;
        drawExportQr();
      }
    }
  }

  $('dqrexport').addEventListener('click', openExportQr);
  $('dqrimport').addEventListener('click', openImportQr);
  $('qrScanCancel').addEventListener('click', function () {
    stopScanner(true);
  });
  $('qrScanUpload').addEventListener('click', function () {
    $('qrScanFile').click();
  });
  $('qrScanFile').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (file) decodeImageFile(file);
  });
  $('qrScanDlg').addEventListener('click', function (event) {
    if (event.target === $('qrScanDlg')) stopScanner(true);
  });
  document.addEventListener('click', handleQrClick);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !$('qrScanDlg').hidden) stopScanner(true);
  });

  return { openExportQr, openImportQr, applyImportReview };
}
