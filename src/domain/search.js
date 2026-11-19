function normalize(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
export function searchSubjects(semesters,query){
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  if(!terms.length)return [];
  return semesters.flatMap(semester=>(semester.subjects||[])
    .filter(subject=>terms.every(term=>normalize(subject.name).includes(term)))
    .map(subject=>({semesterId:semester.id,semesterName:semester.name,subjectId:subject.id,name:subject.name,archived:!!subject.archived})));
}
