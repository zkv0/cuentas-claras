import { cleanSubject } from './subjects.js';

const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = value => value === null || value === undefined || String(value).trim() === '' ? null : Number(String(value).replace(',', '.').replace(/%$/, '').trim());

// Plan puro: valida cada materia antes de devolver una copia para aplicar.
export function planGradeImport(subjects, data, scale) {
  if (!data || !Array.isArray(data.materias)) throw new Error('La respuesta no contiene materias.');
  const result = JSON.parse(JSON.stringify(subjects)), changes = [], warnings = [], seen = new Set();
  if (!data.materias.length) return {subjects:result, changes, warnings:['No se detectaron materias; se conservaron todos los datos.']};
  result.forEach(s => {s.rows = [];});
  for (const item of data.materias) {
    if (!item || !norm(item.nombre)) {warnings.push('Materia sin nombre legible.'); continue;}
    const name = String(item.nombre).trim(), key = norm(name);
    if (seen.has(key)) { warnings.push(name + ': materia repetida; se omitió la repetición.'); continue; }
    seen.add(key);
    const matches = result.filter(s => norm(s.name) === key);
    if (matches.length > 1) { warnings.push(name + ': hay varias materias con ese nombre.'); continue; }
    const existing = matches[0];
    const credit = number(item.creditos);
    if (credit !== null && (!Number.isFinite(credit) || credit < 0)) {
      warnings.push(name + ': créditos inválidos.'); continue;
    }
    const draft = existing ? JSON.parse(JSON.stringify(existing)) : cleanSubject({name, rows:[], min:scale.min, max:scale.max});
    if (credit !== null) draft.credits = String(credit);
    const creditInfo = credit !== null ? ' Créditos: ' + credit + '.' : '';
    if (item.estado === 'cancelada') {
      if (!/\b(cancelad[ao]s?|retirad[ao]s?)\b/.test(norm(item.evidenciaCancelacion))) {
        warnings.push(name + ': cancelación sin evidencia explícita; se omitió.'); continue;
      }
      draft.cancelled = true; draft.archived = true; draft.rows = [];
      if (existing) Object.assign(existing, draft); else result.push(draft);
      changes.push(name + ': cancelada y archivada.' + creditInfo);
      continue;
    }
    if (existing?.cancelled) { warnings.push(name + ': está cancelada; restáurala para actualizarla.'); continue; }
    if (!Array.isArray(item.evaluaciones)) {warnings.push(name + ': no se pudieron leer las evaluaciones.'); continue;}
    draft.rows = [];
    const used = new Set();
    let invalid = '';
    for (const row of item.evaluaciones) {
      if (!row || typeof row !== 'object') { invalid = 'evaluación inválida'; break; }
      const p = number(row.porcentaje), g = number(row.nota), label = String(row.nombre || '').trim();
      if (!Number.isFinite(p) || p <= 0 || p > 100 || (g !== null && (!Number.isFinite(g) || g < 0 || g > scale.max))) {
        invalid = 'nota o porcentaje ausente o fuera de rango'; break;
      }
      const evaluationKey = norm(label);
      if (evaluationKey && used.has(evaluationKey)) {invalid = 'evaluación repetida en la respuesta'; break;}
      if (evaluationKey) used.add(evaluationKey);
      const target = {p:String(p),g:g === null ? '' : String(g),pred:''};
      if (label) target.label = label;
      draft.rows.push(target);
    }
    if (draft.rows.reduce((sum,r) => sum + (number(r.p) || 0),0) > 100.001) invalid = 'los porcentajes suman más de 100 %';
    if (invalid) { warnings.push(name + ': ' + invalid + '; no se modificó.'); continue; }
    if (existing) Object.assign(existing, draft); else result.push(draft);
    changes.push(name + ': ' + (existing ? 'notas actualizadas.' : 'materia y notas añadidas.') + creditInfo);
  }
  if (warnings.length) return {subjects:JSON.parse(JSON.stringify(subjects)),changes:[],warnings:[...warnings,'No se aplicó la importación. Sube una captura completa y legible.']};
  subjects.filter(s => !seen.has(norm(s.name)) && s.rows.length).forEach(s => changes.push(s.name + ': evaluaciones anteriores eliminadas; no aparece en la foto.'));
  if (JSON.stringify(result) === JSON.stringify(subjects)) return {subjects:result,changes:[],warnings:[]};
  return {subjects:result, changes, warnings};
}
