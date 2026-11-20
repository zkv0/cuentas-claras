import { connectPersonalAI } from '../ui/personal-ai.js';
import { createScheduleReview } from '../ui/schedule-review.js';
import { parseSchedule } from '../domain/schedule-import.js';
import { createScheduledSubject } from '../domain/subjects.js';
import { loadAIConfig, isAIConfigured, buildSchedulePrompt, readScheduleImage } from '../services/ai.js';

/** Importa materias desde una foto del horario y permite configurar la API de IA.
 */
export function createOnboarding({ state, ui, save, render, schedTable, openAddSched, reviewExisting, adjustAI }) {
  const $ = id => document.getElementById(id);
  let selectedFile = null;
  let pendingSubjects = null;
  let reviewEditor = null;
  let readId = 0;

  function setStatusMsg(text, type) {
    const el = $('obStatusMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'api-only grades-ai-status' + (type ? ' ' + type : '');
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
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
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

    const setup = $('obSetup');
    const review = $('obReview');
    if (setup) setup.hidden = false;
    if (review) review.hidden = true;

    dlg.hidden = false;
  }

  function closeOnboarding() {
    readId++;
    $('obSubmit').disabled = false;
    $('obAdjustAI').disabled = false;
    const dlg = $('onboardDlg');
    if (dlg) dlg.hidden = true;
  }

  // Cableado de eventos
  const dropzone = $('obDropzone');
  const fileInput = $('obFile');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('dragging');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('dragging');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragging');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handleFile(files[0]);
    });
    fileInput.addEventListener('change', function () {
      const files = this.files;
      if (files && files.length) handleFile(files[0]);
    });
  }

  $('obClose').addEventListener('click', closeOnboarding);

  const adjustButton = $('obAdjustAI');
  adjustButton.addEventListener('click', () => {
    closeOnboarding();
    adjustAI(() => {
      $('onboardDlg').hidden = false;
      setStatusMsg(isAIConfigured() ? 'API configurada.' : '');
      adjustButton.focus();
    });
  });

  const submitBtn = $('obSubmit');
  connectPersonalAI('ob', () => buildSchedulePrompt(state.subjects.map(subject => subject.name)), data => {
    if (submitBtn.disabled) return;
    if (!data.materias.every(item => Array.isArray(item?.bloques) || Array.isArray(item?.dias)))
      throw new Error('La respuesta debe contener los bloques del horario de cada materia.');
    if (state.subjects.length && reviewExisting) {
      closeOnboarding();
      reviewExisting(data);
    } else reviewSchedule(data);
  });
  function reviewSchedule(res) {
        const items = parseSchedule(res);
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
  }
  if (submitBtn) {
    submitBtn.addEventListener('click', async function () {
      if (!selectedFile) {
        setStatusMsg('Por favor selecciona o arrastra la foto de tu horario.', 'warn');
        return;
      }
      const cfg = loadAIConfig();
      if (!isAIConfigured(cfg)) {
        setStatusMsg('Conecta tu API en Ajustar IA para leer la foto.', 'warn');
        adjustButton.focus();
        return;
      }

      const request = ++readId;
      adjustButton.disabled = true;
      submitBtn.disabled = true;
      setStatusMsg('Leyendo tu horario con IA… Esto puede tardar unos segundos.', 'loading');

      try {
        const res = await readScheduleImage(selectedFile, cfg, buildSchedulePrompt(state.subjects.map(subject => subject.name)));
        if (request !== readId) return;
        if (state.subjects.length && reviewExisting && parseSchedule(res).length) {
          submitBtn.disabled = false;
          closeOnboarding();
          reviewExisting(res);
        } else reviewSchedule(res);
      } catch (err) {
        if (request !== readId) return;
        submitBtn.disabled = false;
        setStatusMsg((err && err.message) || 'Ocurrió un error al leer el horario.', 'warn');
      } finally {
        if (request === readId) adjustButton.disabled = false;
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
        pendingSubjects.forEach(subject => state.subjects.push(createScheduledSubject(subject)));
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
    if (e.key === 'Escape' && !e.defaultPrevented) {
      const onboardDlg = $('onboardDlg');
      if (onboardDlg && !onboardDlg.hidden) closeOnboarding();
    }
  });

  return { openOnboarding };
}
