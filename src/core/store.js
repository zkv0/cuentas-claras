import { KEY } from './constants.js';

export const state = { subjects: [], absences: [], sem: { start: '', end: '', pct: '' }, updatedAt: 0 };
let saved = () => {};

try {
  const data = JSON.parse(localStorage.getItem(KEY));
  if (data && Array.isArray(data.subjects)) {
    Object.assign(state, data);
    state.subjects = state.subjects.filter(subject => subject && Array.isArray(subject.rows));
  }
} catch (error) {
  console.warn('No se pudieron cargar los datos locales.', error);
}
if (!Array.isArray(state.absences)) state.absences = [];
if (!state.sem || typeof state.sem !== 'object') state.sem = { start: '', end: '', pct: '' };

export function onSave(callback) { saved = callback; }
export function find(id) { return state.subjects.find(subject => subject.id === id); }

/** Elimina una materia de la lista y de todas las faltas que la referencian.
 * Las faltas que se quedan sin materias también se eliminan.
 */
export function removeSubject(id) {
  state.subjects = state.subjects.filter(subject => subject.id !== id);
  state.absences.forEach(absence => {
    absence.ids = (Array.isArray(absence.ids) ? absence.ids : []).filter(subjectId => subjectId !== id);
  });
  state.absences = state.absences.filter(absence => absence.ids.length);
  save();
}

export function save() {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('No se pudieron guardar los datos locales.', error);
    const status = document.getElementById('sync');
    if (status) {
      status.hidden = false;
      status.className = 'sync warn';
      status.textContent = 'No se pudo guardar en este dispositivo. Exporta tus datos para conservarlos.';
    }
  }
  saved();
}
