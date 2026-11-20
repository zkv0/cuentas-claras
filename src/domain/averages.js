import { num } from '../core/utils.js';
import { calc } from './grades.js';
// Solo notas definitivas; las pendientes no se convierten en ceros.
export function weightedAverage(subjects){
  let points=0,credits=0,count=0;
  subjects.forEach(subject=>{
    const credit=num(subject.credits),grade=calc(subject);
    if(subject.cancelled||!Number.isFinite(credit)||credit<=0||grade.over||Math.abs(grade.graded-100)>.001)return;
    points+=grade.earned*credit;credits+=credit;count++;
  });
  return {value:credits?points/credits:null,credits,count};
}

export function semesterAverage(subjects){
  const available = subjects.flatMap(subject => {
    if (subject.cancelled) return [];
    const grade = calc(subject);
    if (grade.over || grade.graded <= 0) return [];
    return [{ value: grade.earned * 100 / grade.graded, credits: num(subject.credits) }];
  });
  const useCredits = available.every(subject => subject.credits > 0);
  let points = 0, totalWeight = 0;
  for (const subject of available) {
    const weight = useCredits ? subject.credits : 1;
    points += subject.value * weight;
    totalWeight += weight;
  }
  return totalWeight ? points / totalWeight : null;
}
