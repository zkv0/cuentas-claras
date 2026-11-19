import { createScheduleReview } from '../ui/schedule-review.js';
import { uid, esc, tm } from '../core/utils.js';
import { DIAS } from '../core/constants.js';
import { providerDefaults, loadAIConfig, saveAIConfig, testAIConnection, isAIConfigured, buildSchedulePrompt, readScheduleImage } from '../services/ai.js';

/** Importa materias desde una foto del horario y permite configurar la API de IA.
 */
export function createOnboarding({ state, ui, save, render, schedTable, openAddSched }) {
  const $ = id => document.getElementById(id);
  let selectedFile = null;
  let pendingSubjects = null;
  let reviewEditor = null;

  function parseSubjects(res) {
    const items = [];
    const materias = (res && Array.isArray(res.materias)) ? res.materias : [];
    materias.forEach(function (m) {
      if (!m || !m.nombre) return;
      const bl = [];
      (Array.isArray(m.bloques) ? m.bloques : []).forEach(function (b) {
        const d = Number(b && b.dia);
        if (b && d >= 0 && d <= 6) bl.push({ d: d, s: tm(b.inicio), e: tm(b.fin) });
      });
      const days = bl.map(function (b) { return b.d; })
        .concat(Array.isArray(m.dias) ? m.dias.map(Number) : [])
        .filter(function (d, i, a) { return d >= 0 && d <= 6 && a.indexOf(d) === i; });
      const seen = {};
      const uniqueBl = bl.filter(function (b) {
        const k = b.d + '_' + b.s + '_' + b.e;
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      });
      items.push({ name: String(m.nombre).trim(), days: days, blocks: uniqueBl });
    });
    return items;
  }

  function setStatusMsg(text, type) {
    const el = $('obStatusMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'm' + (type ? ' ' + type : '');
  }

  function setAiMsg(text, type) {
    const el = $('obAiMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'm' + (type ? ' ' + type : '');
  }

  function getAIFormConfig() {
    const provider = $('obAiProvider');
    const key = $('obAiKey');
    const model = $('obAiModel');
    const base = $('obAiBase');
    const remember = $('obAiRemember');
    return {
      provider: provider ? provider.value : 'deepseek',
      apiKey: key ? key.value.trim() : '',
      model: model ? model.value.trim() : '',
      baseUrl: base ? base.value.trim() : '',
      remember: remember ? !!remember.checked : true,
    };
  }

  function applyProvider(id) {
    const defaults = providerDefaults(id);
    const base = $('obAiBase');
    const model = $('obAiModel');
    if (id === 'custom') {
      if (base) base.value = '';
      if (model) model.value = '';
      return;
    }
    if (base && defaults.baseUrl) base.value = defaults.baseUrl;
    if (model && defaults.model) model.value = defaults.model;
  }

  function resetFileSelection() {
    selectedFile = null;
    const fileInput = $('obFile');
    if (fileInput) fileInput.value = '';
    const emptyView = $('obDropEmpty');
    const filledView = $('obDropFilled');
    if (emptyView) emptyView.hidden = false;
    if (filledView) filledView.hidden = true;
    const thumb = $('obThumb');
    if (thumb) thumb.src = '';
    const fileName = $('obFileName');
    if (fileName) fileName.textContent = '';
  }

  function handleFile(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      setStatusMsg('Por favor selecciona un archivo de imagen compatible (JPG, PNG o WebP).', 'warn');
      return;
    }
    selectedFile = file;
    const emptyView = $('obDropEmpty');
    const filledView = $('obDropFilled');
    const fileName = $('obFileName');
    const thumb = $('obThumb');

    if (fileName) fileName.textContent = file.name || 'foto_horario.jpg';
    if (emptyView) emptyView.hidden = true;
    if (filledView) filledView.hidden = false;

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = function () {
        if (thumb) thumb.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    }
    setStatusMsg('');
  }

  function openOnboarding() {
    const dlg = $('onboardDlg');
    if (!dlg) return;
    pendingSubjects = null;
    resetFileSelection();
    setStatusMsg('');

    const cfg = loadAIConfig();
    const providerEl = $('obAiProvider');
    const keyEl = $('obAiKey');
    const modelEl = $('obAiModel');
    const baseEl = $('obAiBase');
    const rememberEl = $('obAiRemember');
    if (providerEl) providerEl.value = cfg.provider || 'deepseek';
    if (keyEl) keyEl.value = cfg.apiKey || '';
    const defaults = providerDefaults(cfg.provider);
    if (modelEl) modelEl.value = cfg.model || defaults.model || '';
    if (baseEl) baseEl.value = cfg.baseUrl || defaults.baseUrl || '';
    if (rememberEl) rememberEl.checked = cfg.remember !== false;

    if (isAIConfigured(cfg)) {
      setAiMsg('Conexión configurada. Lista para procesar.', 'ok');
    } else {
      setAiMsg('Configura el proveedor y la clave para procesar el horario.', '');
    }

    const setup = $('obSetup');
    const review = $('obReview');
    if (setup) setup.hidden = false;
    if (review) review.hidden = true;

    dlg.hidden = false;
  }

  function closeOnboarding() {
    const dlg = $('onboardDlg');
    if (dlg) dlg.hidden = true;
  }

  // Cableado de eventos
  const dropzone = $('obDropzone');
  const fileInput = $('obFile');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', function (e) {
      if (e.target.closest('#obChangePhoto')) {
        fileInput.click();
        return;
      }
      fileInput.click();
    });
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handleFile(files[0]);
    });
    fileInput.addEventListener('change', function () {
      const files = this.files;
      if (files && files.length) handleFile(files[0]);
    });
  }

  const changePhotoBtn = $('obChangePhoto');
  if (changePhotoBtn && fileInput) {
    changePhotoBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      fileInput.click();
    });
  }

  const providerEl = $('obAiProvider');
  if (providerEl) {
    providerEl.addEventListener('change', function () {
      applyProvider(providerEl.value);
    });
  }

  const aiTestBtn = $('obAiTest');
  if (aiTestBtn) {
    aiTestBtn.addEventListener('click', function () {
      const cfg = getAIFormConfig();
      if (!isAIConfigured(cfg)) {
        setAiMsg('Completa la clave, el modelo y la URL base para probar la conexión.', 'warn');
        return;
      }
      setAiMsg('Comprobando conexión…');
      testAIConnection(cfg).then(function (models) {
        setAiMsg(models.length
          ? 'Conexión correcta. Modelos disponibles: ' + models.slice(0, 4).join(', ') + '.'
          : 'No se pudo listar modelos. Guarda la configuración y prueba a leer una foto.',
          models.length ? 'ok' : 'warn');
      }).catch(function (err) {
        setAiMsg((err && err.message) || 'No pude conectar con la API de IA.', 'warn');
      });
    });
  }

  const submitBtn = $('obSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', async function () {
      if (!selectedFile) {
        setStatusMsg('Por favor selecciona o arrastra la foto de tu horario.', 'warn');
        return;
      }
      const cfg = getAIFormConfig();
      if (!isAIConfigured(cfg)) {
        const info = providerDefaults(cfg.provider);
        setStatusMsg(info.keyRequired && !cfg.apiKey
          ? 'Por favor ingresa tu clave de API a la derecha.'
          : 'Completa el proveedor, el modelo y la URL base.', 'warn');
        const keyEl = $('obAiKey');
        if (keyEl) keyEl.focus();
        return;
      }
      saveAIConfig(cfg);

      submitBtn.disabled = true;
      setStatusMsg('Leyendo tu horario con IA… Esto puede tardar unos segundos.', 'loading');

      try {
        const res = await readScheduleImage(selectedFile, cfg, buildSchedulePrompt([]));
        const items = parseSubjects(res);
        if (!items.length) {
          submitBtn.disabled = false;
          setStatusMsg('La IA respondió pero no detectó materias en la imagen. Prueba con una foto más nítida.', 'warn');
          return;
        }

        pendingSubjects = items;
        submitBtn.disabled = false;
        setStatusMsg('');

        // Mostrar pantalla de revisión
        const setup = $('obSetup');
        const review = $('obReview');
        if (setup) setup.hidden = true;
        if (review) review.hidden = false;

        const countEl = $('obReviewCount');
        if (countEl) {
          countEl.textContent = 'Encontramos ' + items.length + (items.length === 1 ? ' materia' : ' materias') + ' en tu horario. Revisa cómo quedaron organizadas:';
        }

        const tableEl = $('obReviewTable');
        if (tableEl && schedTable) {
          tableEl.innerHTML = schedTable(items.map(function (it) {
            return { name: it.name, days: it.days, blocks: it.blocks, isNew: true };
          }));
        }

        reviewEditor = createScheduleReview($('obReviewList'), items, function () {
          $('obReviewMsg').textContent = '';
          if (schedTable) $('obReviewTable').innerHTML = schedTable(items);
        });
      } catch (err) {
        submitBtn.disabled = false;
        setStatusMsg((err && err.message) || 'Ocurrió un error al leer el horario.', 'warn');
      }
    });
  }

  const confirmBtn = $('obConfirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      if (!reviewEditor || !pendingSubjects) return;
      const error=reviewEditor.validate();
      if(error){$('obReviewMsg').textContent=error;return;}
      if (pendingSubjects && pendingSubjects.length) {
        pendingSubjects.forEach(function (it) {
          state.subjects.push({
            id: uid(),
            name: it.name,
            min: 3,
            max: 5,
            days: it.days,
            blocks: it.blocks,
            rows: [
              { p: '', g: '', pred: '' },
              { p: '', g: '', pred: '' },
              { p: '', g: '', pred: '' },
            ],
          });
        });
        save();
      }
      closeOnboarding();
      ui.anim.flip = true;
      render();
    });
  }

  const backBtn = $('obBack');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      const setup = $('obSetup');
      const review = $('obReview');
      if (setup) setup.hidden = false;
      if (review) review.hidden = true;
    });
  }

  const skipBtn = $('obSkip');
  if (skipBtn) {
    skipBtn.addEventListener('click', function () {
      closeOnboarding();
      if (typeof openAddSched === 'function') openAddSched();
    });
  }

  const dlg = $('onboardDlg');
  if (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) closeOnboarding();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const onboardDlg = $('onboardDlg');
      if (onboardDlg && !onboardDlg.hidden) closeOnboarding();
    }
  });

  return { openOnboarding, closeOnboarding, parseSubjects };
}
