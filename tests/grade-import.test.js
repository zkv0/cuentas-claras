import test from 'node:test';
import assert from 'node:assert/strict';
import { planGradeImport } from '../src/domain/grade-import.js';
import { weightedAverage } from '../src/domain/averages.js';
import { cleanSubject } from '../src/domain/subjects.js';
import { buildGradesPrompt } from '../src/services/ai.js';
const scale = {min:3,max:5};
const subject = () => ({id:'a',name:'Física',credits:3,rows:[{p:'50',g:'4',pred:''},{p:'50',g:'',pred:'3'}],...scale});
const data = evaluaciones => ({materias:[{nombre:'Fisica',estado:'activa',evaluaciones}]});

test('lee créditos visibles y los utiliza en el promedio ponderado', () => {
  const plan=planGradeImport([subject()],{materias:[
    {nombre:'Física',creditos:4,evaluaciones:[{porcentaje:100,nota:5}]},
    {nombre:'Otra',creditos:'2',evaluaciones:[{porcentaje:100,nota:2}]}
  ]},scale);
  assert.equal(plan.warnings.length,0);
  assert.equal(plan.subjects[0].credits,'4');
  assert.equal(plan.subjects[1].credits,'2');
  assert.equal(weightedAverage(plan.subjects).value,4);
  assert.equal(cleanSubject(plan.subjects[0]).credits,'4');
  const prompt=buildGradesPrompt([subject()]);
  assert.match(prompt,/"creditos":null/);
  assert.match(prompt,/literal legend/);
});

test('créditos ausentes conservan los existentes y créditos inválidos impiden cambios', () => {
  const parsed=data([{porcentaje:100,nota:4}]);
  parsed.materias[0].creditos=null;
  assert.equal(planGradeImport([subject()],parsed,scale).subjects[0].credits,3);
  for (const creditos of [-1,'ilegible',Infinity]) {
    parsed.materias[0].creditos=creditos;
    const plan=planGradeImport([subject()],parsed,scale);
    assert.deepEqual(plan.subjects,[subject()]);
    assert.equal(plan.changes.length,0);
  }
});

test('importa también materias canceladas nuevas con sus créditos', () => {
  const plan=planGradeImport([],{materias:[{nombre:'Cálculo',creditos:3,estado:'cancelada',evidenciaCancelacion:'Cancelada'}]},scale);
  assert.equal(plan.warnings.length,0);
  assert.equal(plan.subjects[0].cancelled,true);
  assert.equal(plan.subjects[0].archived,true);
  assert.equal(plan.subjects[0].credits,'3');
  assert.equal(weightedAverage(plan.subjects).value,null);
});

test('reemplaza todas las evaluaciones, elimina predicciones y repetir no duplica', () => {
  const input=[subject(),{...subject(),id:'b',name:'Otra'}];
  const parsed=data([{nombre:'Final',porcentaje:60,nota:0}]);
  const first=planGradeImport(input,parsed,scale);
  assert.deepEqual(first.subjects[0].rows,[{label:'Final',p:'60',g:'0',pred:''}]);
  assert.deepEqual(first.subjects[1].rows,[]);
  assert.equal(input[0].rows.length,2);
  assert.equal(first.subjects[0].id,input[0].id);
  assert.equal(first.subjects[0].credits,3);
  assert.equal(planGradeImport(first.subjects,parsed,scale).changes.length,0);
});
test('pendientes de la captura reemplazan notas previas y errores conservan todos los datos', () => {
  const input=[subject()];
  assert.equal(planGradeImport(input,data([{porcentaje:60,nota:null}]),scale).subjects[0].rows[0].g,'');
  for(const rows of [[{porcentaje:null,nota:4}],[{porcentaje:60,nota:4},{porcentaje:50,nota:3}],[{porcentaje:60,nota:6}]]) {
    const plan=planGradeImport(input,data(rows),scale);
    assert.equal(plan.changes.length,0); assert.ok(plan.warnings.length);
    assert.deepEqual(plan.subjects,input);
  }
  assert.deepEqual(planGradeImport(input,{materias:[]},scale).subjects,input);
});
test('solo cancela con estado explícito, excluye del promedio y conserva datos al exportar', () => {
  const input=[subject(),{...subject(),id:'b',name:'Otra'}];
  input[0].rows=[{label:'Final',p:'100',g:'4',pred:''}];
  assert.equal(planGradeImport(input,{materias:[{nombre:'Física',estado:'cancelada'}]},scale).changes.length,0);
  const plan=planGradeImport(input,{materias:[{nombre:'Física',estado:'cancelada',evidenciaCancelacion:'Materia cancelada'}]},scale);
  assert.equal(plan.subjects[0].archived,true);
  assert.equal(weightedAverage([plan.subjects[0]]).value,null);
  assert.deepEqual(plan.subjects[1].rows,[]);
  const restored=cleanSubject(plan.subjects[0]);
  assert.equal(restored.cancelled,true); assert.deepEqual(restored.rows,[]);
});
test('añade materias nuevas con evaluaciones distintas de igual porcentaje sin duplicar al repetir', () => {
  const parsed={materias:[{nombre:'Nueva',evaluaciones:[{nombre:'Parcial 1',porcentaje:50,nota:4},{nombre:'Parcial 2',porcentaje:50,nota:3}]}]};
  const first=planGradeImport([],parsed,scale);
  assert.equal(first.subjects[0].rows.length,2);
  assert.equal(planGradeImport(first.subjects,parsed,scale).changes.length,0);
});
