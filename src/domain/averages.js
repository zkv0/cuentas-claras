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
