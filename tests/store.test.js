import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};

const { state, removeSubject } = await import('../src/core/store.js');

test('elimina solo el semestre elegido y conserva los demás al guardar y recargar', async () => {
  const {removeSemester,save}=await import('../src/core/store.js');
  const previous=JSON.parse(JSON.stringify(state));
  state.semesters=['uno','dos','tres'].map(id=>({id,name:id,subjects:[{id:'materia-'+id,rows:[]}],absences:[{id:'f-'+id,ids:['materia-'+id]}],sem:{start:'',end:'',pct:''}}));
  state.activeSemesterId='dos';
  state.subjects=state.semesters[1].subjects;state.absences=state.semesters[1].absences;state.sem=state.semesters[1].sem;save();
  assert.equal(removeSemester('dos'),true);
  assert.deepEqual(state.semesters.map(x=>x.id),['uno','tres']);
  assert.equal(state.activeSemesterId,'tres');
  assert.equal(state.subjects[0].id,'materia-tres');
  assert.equal(state.absences[0].id,'f-tres');
  assert.equal(JSON.parse(memory.get('calc-notas-v2')).semesters.length,2);
  const reload=await import('../src/core/store.js?deleted-semester');
  assert.equal(reload.state.activeSemesterId,'tres');
  assert.equal(reload.state.semesters.some(x=>x.id==='dos'),false);
  assert.equal(removeSemester('inexistente'),false);
  removeSemester('uno');removeSemester('tres');
  assert.equal(state.semesters.length,1);
  assert.deepEqual(state.subjects,[]);assert.deepEqual(state.absences,[]);
  assert.notEqual(state.activeSemesterId,'tres');
  Object.assign(state,previous);save();
});

test('elimina la materia y sus referencias de todas las faltas', () => {
  state.subjects = [{ id: 'a', rows: [] }, { id: 'b', rows: [] }];
  state.absences = [
    { id: 'x', date: '2026-11-16', ids: ['a', 'b'] },
    { id: 'y', date: '2026-11-17', ids: ['a'] },
    { id: 'z', date: '2026-11-18', ids: ['b'] },
  ];
  state.updatedAt = 0;
  removeSubject('a');
  assert.deepEqual(state.subjects.map(subject => subject.id), ['b']);
  assert.deepEqual(state.absences, [
    { id: 'x', date: '2026-11-16', ids: ['b'] },
    { id: 'z', date: '2026-11-18', ids: ['b'] },
  ]);
  assert.ok(state.updatedAt > 0);
  assert.equal(JSON.parse(memory.get('calc-notas-v2')).subjects.length, 1);
});

test('limpia faltas sin materias y tolera referencias incompletas', () => {
  state.subjects = [{ id: 'b', rows: [] }];
  state.absences = [{ id: 'q', ids: [] }, { id: 'r' }];
  assert.doesNotThrow(() => removeSubject('no-existe'));
  assert.deepEqual(state.absences, []);
});

test('cada semestre conserva sus materias, horario y faltas al cambiar y recargar', async () => {
  const { addSemester, switchSemester, save } = await import('../src/core/store.js');
  const original=state.activeSemesterId;
  state.subjects=[{id:'calculo',name:'Cálculo',rows:[],days:[1],blocks:[{d:1,s:'08:00',e:'10:00'}]}];
  state.absences=[{id:'f1',date:'2026-11-16',ids:['calculo']}];
  state.absencePct='20';
  state.sem={start:'2026-08-01',end:'2026-12-01',pct:'20'};save();
  addSemester('2027-1');
  const second=state.activeSemesterId;
  assert.notEqual(second,original);
  assert.deepEqual(state.subjects,[]);
  assert.deepEqual(state.absences,[]);
  assert.equal(state.sem.start,'');
  state.subjects.push({id:'fisica',rows:[],days:[2],blocks:[]});save();
  switchSemester(original);
  assert.equal(state.subjects[0].id,'calculo');
  assert.equal(state.subjects[0].blocks[0].s,'08:00');
  assert.equal(state.absences[0].id,'f1');
  assert.equal(state.sem.pct,'20');
  switchSemester(second);
  assert.equal(state.subjects[0].id,'fisica');
  assert.equal(state.absences.length,0);
  const reloaded=await import('../src/core/store.js?semester-reload');
  assert.equal(reloaded.state.activeSemesterId,second);
  reloaded.switchSemester(original);
  assert.equal(reloaded.state.subjects[0].id,'calculo');
  assert.equal(reloaded.state.absences.length,1);
});

test('una copia completa restaura todos los semestres con sus referencias', async () => {
  const { applySubjectSnapshot }=await import('../src/domain/subjects.js');
  const snapshot=JSON.parse(JSON.stringify(state));
  const restored={};applySubjectSnapshot(restored,snapshot);
  assert.equal(restored.semesters.length,snapshot.semesters.length);
  const first=restored.semesters.find(x=>x.subjects.some(s=>s.name==='Cálculo'));
  assert.ok(first);
  assert.equal(first.absences[0].ids[0],first.subjects[0].id);
  assert.notEqual(first.subjects[0].id,'calculo');
  assert.equal(restored.subjects[0].id,restored.semesters.find(x=>x.id===restored.activeSemesterId).subjects[0].id);
});
