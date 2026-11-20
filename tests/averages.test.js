import test from 'node:test';
import assert from 'node:assert/strict';
import { semesterAverage, weightedAverage } from '../src/domain/averages.js';
const sub=(credits,grade,p=100)=>({credits,rows:[{p,g:grade}],min:3,max:5});
test('pondera por créditos y no promedia promedios de semestres',()=>{
 assert.equal(weightedAverage([sub(4,5),sub(2,2)]).value,4);
 assert.equal(weightedAverage([sub('3',4),sub('1',2)]).value,3.5);
});
test('excluye pendientes, créditos inválidos y porcentajes excesivos, incluye ceros y archivadas',()=>{
 assert.equal(weightedAverage([sub(3,5,50),sub('',5),sub(-1,5),sub(2,5,110)]).value,null);
 assert.equal(weightedAverage([sub(3,0),{...sub(1,4),archived:true}]).value,1);
});
test('calcula el promedio parcial sobre las notas registradas y usa el mismo peso si faltan créditos',()=>{
 const partial={...sub(4,5,25),rows:[{p:25,g:5},{p:75,g:'',pred:1}]};
 assert.equal(semesterAverage([partial,sub('',3,60),sub(2,'')]),4);
 assert.equal(semesterAverage([partial,sub(1,0)]),4);
 assert.equal(semesterAverage([sub('',0),{...sub('',5),cancelled:true},sub('',5,110)]),0);
 assert.equal(semesterAverage([sub('','')]),null);
});
