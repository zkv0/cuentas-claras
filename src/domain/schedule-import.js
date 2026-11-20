import { tm } from '../core/utils.js';

export function parseSchedule(response) {
  if (!Array.isArray(response?.materias)) return [];

  const subjects = [];
  for (const subject of response.materias) {
    if (!subject?.nombre) continue;
    const blocks = [];
    const seen = new Set();
    const entries = Array.isArray(subject.bloques) ? subject.bloques : [];

    for (const entry of entries) {
      const day = Number(entry?.dia);
      if (!entry || !(day >= 0 && day <= 6)) continue;
      const start = tm(entry.inicio), end = tm(entry.fin);
      const key = `${day}/${start}/${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push({ d: day, s: start, e: end });
    }

    const days = new Set(blocks.map(block => block.d));
    const extraDays = Array.isArray(subject.dias) ? subject.dias.map(Number) : [];
    for (const day of extraDays) {
      if (day >= 0 && day <= 6) days.add(day);
    }
    subjects.push({ name: String(subject.nombre).trim(), days: [...days], blocks });
  }
  return subjects;
}
