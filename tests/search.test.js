import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSubjects } from '../src/domain/search.js';
const semesters=[{id:'a',name:'2026-2',subjects:[{id:'1',name:'Cálculo Integral'},{id:'2',name:'Física',archived:true}]},{id:'b',name:'2027-1',subjects:[{id:'3',name:'Cálculo Integral'}]}];
test('busca solo materias en todos los semestres ignorando tildes y mayúsculas',()=>{
  const results=searchSubjects(semesters,' CALCULO ');
  assert.equal(results.length,2);
  assert.deepEqual(results.map(x=>x.semesterName),['2026-2','2027-1']);
  assert.deepEqual(results.map(x=>x.subjectId),['1','3']);
  assert.equal(searchSubjects(semesters,'2026-2').length,0);
  assert.equal(searchSubjects(semesters,'   ').length,0);
});
test('incluye archivadas y permite buscar varias palabras',()=>{
  assert.equal(searchSubjects(semesters,'fisica')[0].archived,true);
  assert.equal(searchSubjects(semesters,'integral calculo').length,2);
  assert.equal(searchSubjects(semesters,'quimica').length,0);
});
