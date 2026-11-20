import { connectPersonalAI } from '../ui/personal-ai.js';
import { isAIConfigured, loadAIConfig, readGradesImage, buildGradesPrompt } from '../services/ai.js';
import { planGradeImport } from '../domain/grade-import.js';
import { esc } from '../core/utils.js';

export function createGradeImport({state, save, render, adjustAI}) {
  const $ = id => document.getElementById(id);
  let busy = false, undo = null, selectedFile = null, previewUrl = null;
  let pending = null;
  function clearReview() {
    pending = null;
    $('grApply').hidden = true;
  }
  function applyPlan(plan, semester, before) {
      if (plan.changes.length) {
        state.subjects = plan.subjects; save(); render();
        undo = {semester, before, after:JSON.stringify(state.subjects)};
        $('gradesAiUndo').hidden = false;
      }
      $('gradesAiStatus').textContent = plan.changes.length ? 'Notas actualizadas.' : 'No se encontraron cambios que se puedan aplicar.';
      $('gradesAiResults').innerHTML = '<ul>'+plan.changes.concat(plan.warnings).map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>';
  }
  connectPersonalAI('gr', () => buildGradesPrompt(state.subjects), data => {
    clearReview();
    if (busy) throw new Error('Espera a que termine la lectura.');
    const plan = planGradeImport(state.subjects, data, state.gradeScale);
    $('gradesAiResults').innerHTML = '<ul>' + [...plan.changes, ...plan.warnings].map(line => '<li>' + esc(line) + '</li>').join('') + '</ul>';
    $('gradesAiStatus').textContent = plan.changes.length ? 'Revisa los cambios antes de aplicarlos.' : 'No hay cambios para aplicar.';
    if (!plan.changes.length) return;
    pending = {plan, semester: state.activeSemesterId, before: JSON.stringify(state.subjects), scale: JSON.stringify(state.gradeScale)};
    $('grApply').hidden = false;
  }, clearReview);
  $('grApply').addEventListener('click', () => {
    if (!pending || busy) return;
    const {plan, semester, before, scale} = pending;
    clearReview();
    if (semester !== state.activeSemesterId || before !== JSON.stringify(state.subjects) || scale !== JSON.stringify(state.gradeScale)) {
      $('gradesAiStatus').textContent = 'El semestre cambió. Revisa la respuesta de nuevo.';
      return;
    }
    applyPlan(plan, semester, before);
  });
  function openGradeImport() {
    clearReview();
    if (!busy) $('gradesAiStatus').textContent = '';
    $('gradesAiDlg').hidden = false;
    $('grMethod').querySelector?.('input:checked')?.focus();
  }
  const close = () => { $('gradesAiDlg').hidden = true; };
  $('gradesAiClose').addEventListener('click', close);
  $('gradesAiDlg').addEventListener('click', e => { if(e.target === $('gradesAiDlg')) close(); });
  document.addEventListener('keydown', e => {if(e.key === 'Escape' && !e.defaultPrevented) close();});
  $('gradesAiConfig').addEventListener('click', () => {close(); adjustAI(openGradeImport);});
  $('gradesAiUndo').addEventListener('click', () => {
    if (!undo) return;
    if (state.activeSemesterId !== undo.semester || JSON.stringify(state.subjects) !== undo.after) {
      $('gradesAiStatus').textContent = 'Se modificaron los datos o cambió el semestre. No se deshizo para conservar esos cambios.'; return;
    }
    state.subjects = JSON.parse(undo.before); save(); render(); undo = null;
    $('gradesAiUndo').hidden = true; $('gradesAiResults').innerHTML = '';
    $('gradesAiStatus').textContent = 'Actualización deshecha.';
  });
  function selectFile(file) {
    if (!file || busy) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type || '')) {
      $('gradesAiStatus').textContent = 'Elige una imagen PNG, JPG o WebP.'; return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    selectedFile = file; previewUrl = URL.createObjectURL(file);
    $('gradesAiThumb').src = previewUrl;
    $('gradesAiName').textContent = file.name;
    $('gradesAiEmpty').hidden = true; $('gradesAiPreview').hidden = false;
    $('gradesAiSubmit').disabled = false;
    $('gradesAiResults').innerHTML = '';
    $('gradesAiStatus').textContent = '';
  }
  $('gradesAiDrop').addEventListener('click', () => {if (!busy) $('gradesAiFile').click();});
  $('gradesAiFile').addEventListener('change', function() { selectFile(this.files && this.files[0]); this.value = ''; });
  $('gradesAiDrop').addEventListener('dragover', e => {e.preventDefault(); if (!busy) $('gradesAiDrop').classList.add('dragging');});
  $('gradesAiDrop').addEventListener('dragleave', () => $('gradesAiDrop').classList.remove('dragging'));
  $('gradesAiDrop').addEventListener('drop', e => {e.preventDefault(); $('gradesAiDrop').classList.remove('dragging'); selectFile(e.dataTransfer && e.dataTransfer.files[0]);});
  $('gradesAiSubmit').addEventListener('click', async function() {
    clearReview();
    const file = selectedFile;
    if (!file || busy) return;
    if (!isAIConfigured()) { $('gradesAiStatus').textContent = 'Configura primero la conexión de IA.'; return; }
    const semester = state.activeSemesterId, before = JSON.stringify(state.subjects), scale = JSON.stringify(state.gradeScale);
    busy = true; this.disabled = true; $('gradesAiDrop').disabled = true; $('gradesAiFile').disabled = true; $('gradesAiDrop').setAttribute('aria-busy','true'); $('gradesAiConfig').disabled = true; $('gradesAiUndo').disabled = true;
    $('gradesAiResults').innerHTML = ''; $('gradesAiStatus').textContent = 'Leyendo materias, notas, porcentajes y cancelaciones…';
    try {
      const data = await readGradesImage(file, loadAIConfig(), JSON.parse(before));
      if (state.activeSemesterId !== semester || JSON.stringify(state.subjects) !== before || JSON.stringify(state.gradeScale) !== scale) throw new Error('Los datos cambiaron mientras se leía la imagen. Vuelve a subirla en el semestre correcto.');
      const plan = planGradeImport(state.subjects, data, state.gradeScale);
      applyPlan(plan, semester, before);
    } catch(error) { $('gradesAiStatus').textContent = error.message || 'No se pudo leer la imagen. Intenta de nuevo.'; }
    finally {busy = false; this.disabled = false; $('gradesAiDrop').disabled = false; $('gradesAiFile').disabled = false; $('gradesAiDrop').setAttribute('aria-busy','false'); $('gradesAiConfig').disabled = false; $('gradesAiUndo').disabled = false;}
  });
  return {openGradeImport};
}
