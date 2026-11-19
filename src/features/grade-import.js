import { isAIConfigured, loadAIConfig, readGradesImage } from '../services/ai.js';
import { planGradeImport } from '../domain/grade-import.js';
import { esc } from '../core/utils.js';

export function createGradeImport({state, save, render, openAIConfig}) {
  const $ = id => document.getElementById(id);
  let busy = false, undo = null, selectedFile = null, previewUrl = null;
  function openGradeImport() {
    if (!busy) $('gradesAiStatus').textContent = isAIConfigured() ? '' : 'Conecta una API con visión.';
    $('gradesAiDlg').hidden = false;
    $('gradesAiDrop').focus();
  }
  const close = () => { $('gradesAiDlg').hidden = true; };
  $('gradesAiClose').addEventListener('click', close);
  $('gradesAiDlg').addEventListener('click', e => { if(e.target === $('gradesAiDlg')) close(); });
  document.addEventListener('keydown', e => {if(e.key === 'Escape') close();});
  $('gradesAiConfig').addEventListener('click', () => {close(); openAIConfig(false);});
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
      if (plan.changes.length) {
        state.subjects = plan.subjects; save(); render();
        undo = {semester, before, after:JSON.stringify(state.subjects)};
        $('gradesAiUndo').hidden = false;
      }
      $('gradesAiStatus').textContent = plan.changes.length ? 'Notas actualizadas.' : 'No se encontraron cambios que se puedan aplicar.';
      $('gradesAiResults').innerHTML = '<ul>'+plan.changes.concat(plan.warnings).map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>';
    } catch(error) { $('gradesAiStatus').textContent = error.message || 'No se pudo leer la imagen. Intenta de nuevo.'; }
    finally {busy = false; this.disabled = false; $('gradesAiDrop').disabled = false; $('gradesAiFile').disabled = false; $('gradesAiDrop').setAttribute('aria-busy','false'); $('gradesAiConfig').disabled = false; $('gradesAiUndo').disabled = false;}
  });
  return {openGradeImport};
}
