import { num, uid } from './utils.js';
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

export function initializeSemesters() {
  if(!Array.isArray(state.semesters)||!state.semesters.length){
    state.semesters=[{id:uid(),name:'Semestre 1',subjects:state.subjects,absences:state.absences,sem:state.sem}];
  }
  const selected=state.semesters.find(x=>x.id===state.activeSemesterId)||state.semesters[0];
  state.activeSemesterId=selected.id;
  state.subjects=Array.isArray(selected.subjects)?selected.subjects:[];
  state.absences=Array.isArray(selected.absences)?selected.absences:[];
  state.sem=selected.sem||{start:'',end:'',pct:''};
}
export function commitSemester() {
  const selected=state.semesters.find(x=>x.id===state.activeSemesterId);
  if(selected)Object.assign(selected,{subjects:state.subjects,absences:state.absences,sem:state.sem});
}
export function switchSemester(id) {
  if(!state.semesters.some(x=>x.id===id))return;
  commitSemester();state.activeSemesterId=id;initializeSemesters();save();
}
export function addSemester(name, dates={}) {
  commitSemester();
  const semester={id:uid(),name:name.trim(),subjects:[],absences:[],sem:{start:dates.start||'',end:dates.end||'',pct:state.absencePct??''}};
  state.semesters.push(semester);state.activeSemesterId=semester.id;initializeSemesters();save();
}
export function removeSemester(id) {
  const index=state.semesters.findIndex(x=>x.id===id);
  if(index<0)return false;
  commitSemester();
  state.semesters.splice(index,1);
  if(!state.semesters.length){
    state.subjects=[];state.absences=[];state.sem={start:'',end:'',pct:state.absencePct??''};
    state.activeSemesterId=null;
  }else if(state.activeSemesterId===id){
    state.activeSemesterId=state.semesters[Math.min(index,state.semesters.length-1)].id;
  }
  initializeSemesters();save();return true;
}
initializeSemesters();
function normalizeAbsencePct(){
  if(state.absencePct==null)state.absencePct=state.sem.pct??'';
  state.sem.pct=state.absencePct;
  state.semesters.forEach(x=>{x.sem=x.sem||{start:'',end:''};x.sem.pct=state.absencePct});
}
normalizeAbsencePct();

function normalizeScale() {
  const scale=state.gradeScale||state.subjects[0]||{};
  const min=num(scale.min),max=num(scale.max);
  state.gradeScale=min!==null&&max!==null&&min>=0&&max>0&&min<=max?{min,max}:{min:3,max:5};
  state.semesters.forEach(semester=>semester.subjects.forEach(subject=>{subject.min=state.gradeScale.min;subject.max=state.gradeScale.max;}));
  state.subjects.forEach(subject=>{subject.min=state.gradeScale.min;subject.max=state.gradeScale.max;});
}
normalizeScale();

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
  commitSemester();
  normalizeAbsencePct();
  normalizeScale();
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
