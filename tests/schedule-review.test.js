import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduleReview, validateScheduleReview } from '../src/ui/schedule-review.js';

test('corrige días y horas del borrador y actualiza la vista previa antes de guardar', () => {
  const items=[{name:'Física',days:[1,3],blocks:[{d:1,s:'08:00',e:'10:00'}]}];
  const container={innerHTML:''};let previews=0;
  const editor=createScheduleReview(container,items,()=>previews++);
  assert.equal(items[0].blocks.length,2);
  assert.match(editor.validate(),/hora/);
  const section={dataset:{sr:'0'}},row={dataset:{srBlock:'1'}};
  function change(field,value) {
    container.oninput({target:{dataset:{srField:field},value,closest:selector=>selector==='[data-sr]'?section:row}});
  }
  change('d','5');change('s','14:00');change('e','16:00');
  assert.deepEqual(items[0].days,[1,5]);
  assert.deepEqual(items[0].blocks[1],{d:5,s:'14:00',e:'16:00'});
  assert.equal(editor.validate(),'');assert.equal(previews,3);
  const button={dataset:{srAction:'remove'},closest:selector=>selector==='[data-sr]'?section:row};
  container.onclick({target:{closest:()=>button}});
  assert.deepEqual(items[0].days,[1]);assert.equal(items[0].blocks.length,1);
  button.dataset.srAction='add';container.onclick({target:{closest:()=>button}});
  assert.equal(items[0].blocks.length,2);assert.match(editor.validate(),/hora/);
});

test('permite corregir materias sin días detectados y rechaza horas y días inválidos', () => {
  const items=[{name:'Cálculo',days:[],blocks:[]}];
  createScheduleReview({innerHTML:''},items,()=>{});
  assert.match(validateScheduleReview(items),/bloque/);
  for(const block of [{d:8,s:'08:00',e:'10:00'},{d:1,s:'10:00',e:'08:00'},{d:1,s:'08:90',e:'10:00'}]) {
    items[0].blocks=[block];assert.notEqual(validateScheduleReview(items),'');
  }
});
