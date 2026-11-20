export function curriculumNameKey(name) {
  return String(name ?? '').trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ');
}

export function parseCurriculum(data) {
  if (!Array.isArray(data?.semestres) || !data.semestres.length) {
    throw new Error('No se encontraron semestres en la malla.');
  }
  const semesters = new Set();
  return data.semestres.map(period => {
    const name = typeof period?.nombre === 'string' ? period.nombre.trim() : '';
    if (!name || !Array.isArray(period.materias) || !period.materias.length) {
      throw new Error('Cada semestre debe tener nombre y al menos una materia.');
    }
    const key = curriculumNameKey(name);
    if (semesters.has(key)) throw new Error('La respuesta repite el semestre «' + name + '». Pide a la IA que agrupe sus materias.');
    semesters.add(key);

    const subjects = new Set();
    return {
      name,
      subjects: period.materias.map(item => {
        const subjectName = typeof item?.nombre === 'string' ? item.nombre.trim() : '';
        const subjectKey = curriculumNameKey(subjectName);
        if (!subjectName || subjects.has(subjectKey)) throw new Error('Hay materias sin nombre o repetidas en «' + name + '».');
        subjects.add(subjectKey);
        const credits = item.creditos;
        if (credits !== null && (typeof credits !== 'number' || !Number.isFinite(credits) || credits < 0)) {
          throw new Error('Créditos inválidos en «' + subjectName + '». Usa un número o null si no aparecen.');
        }
        return {name: subjectName, credits};
      })
    };
  });
}
