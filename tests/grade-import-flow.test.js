import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGradeImport } from '../src/features/grade-import.js';
import { saveAIConfig } from '../src/services/ai.js';

test('selecciona una foto, llama a la API, reemplaza, evita duplicados y deshace; un fallo no borra', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{hidden:false,value:'',handlers:{},classList:{add(){},remove(){}},
      addEventListener(event,fn){this.handlers[event]=fn;},setAttribute(){},focus(){},click(){}});
    return elements.get(id);
  };
  globalThis.document={getElementById:element,addEventListener(){}};
  globalThis.localStorage={setItem(){},removeItem(){}};
  globalThis.FileReader=class {readAsDataURL(){this.result='data:image/png;base64,aGVsbG8=';this.onload();}};
  globalThis.Image=class {naturalWidth=100;naturalHeight=100;set src(value){this.onload();}};
  saveAIConfig({provider:'custom',baseUrl:'https://example.test/v1',model:'vision-test',remember:false});
  const original=[{id:'a',name:'Física',credits:3,days:[1],blocks:[],rows:[{p:'100',g:'2',pred:'5'}]}];
  const state={subjects:structuredClone(original),activeSemesterId:'s',semesters:[{id:'s',name:'2026-2'}],gradeScale:{min:3,max:5}};
  let saves=0, calls=0, fail=false;
  globalThis.fetch=async(url,options)=>{
    calls++; assert.match(url,/chat\/completions$/);
    const body=JSON.parse(options.body);
    assert.equal(body.messages[0].content[1].image_url.url,'data:image/png;base64,aGVsbG8=');
    if(fail) throw new Error('offline');
    return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify({materias:[{nombre:'Física',evaluaciones:[{nombre:'Parcial 1',porcentaje:50,nota:4},{nombre:'Parcial 2',porcentaje:50,nota:3}]}]})}}]})};
  };
  const {openGradeImport}=createGradeImport({state,save(){saves++;},render(){},openAIConfig(){}});
  openGradeImport();
  assert.equal(element('gradesAiDlg').hidden,false);
  const file=new Blob(['image'],{type:'image/png'});file.name='notas.png';
  element('gradesAiFile').files=[file];
  element('gradesAiFile').handlers.change.call(element('gradesAiFile'));
  assert.equal(element('gradesAiPreview').hidden,false);
  assert.equal(calls,0);
  await element('gradesAiSubmit').handlers.click.call(element('gradesAiSubmit'));
  assert.equal(state.subjects[0].rows.length,2);
  assert.equal(state.subjects[0].rows[0].g,'4');
  assert.deepEqual(state.subjects[0].days,[1]);
  assert.equal(saves,1);
  await element('gradesAiSubmit').handlers.click.call(element('gradesAiSubmit'));
  assert.equal(state.subjects[0].rows.length,2);assert.equal(saves,1);
  element('gradesAiUndo').handlers.click();
  assert.deepEqual(state.subjects,original);
  fail=true;
  await element('gradesAiSubmit').handlers.click.call(element('gradesAiSubmit'));
  assert.deepEqual(state.subjects,original);assert.equal(saves,2);
  assert.equal(element('gradesAiSubmit').disabled,false);
  assert.match(element('gradesAiStatus').textContent,/conectar/);
  const previousCalls = calls;
  element('grAnswer').value = '```json\n'+JSON.stringify({materias:[{nombre:'Física',evaluaciones:[{porcentaje:100,nota:4.5}]}]})+'\n```';
  element('grReviewAnswer').handlers.click();
  assert.deepEqual(state.subjects,original);
  assert.equal(element('grApply').hidden,false);
  element('grApply').handlers.click();
  assert.equal(state.subjects[0].rows[0].g,'4.5');
  assert.equal(calls,previousCalls);
  element('gradesAiUndo').handlers.click();
  assert.deepEqual(state.subjects,original);

});

test('la importación de notas conserva oculto el selector nativo y queda fuera del encabezado', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/data-act="(?:reorderAll|aiTools|updateGradesAI)"/);
  assert.match(html,/<input[^>]+id="gradesAiFile"[^>]+hidden>/);
  assert.match(html,/id="gradesAiDrop"/);
});
