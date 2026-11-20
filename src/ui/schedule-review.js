import { DIAS } from '../core/constants.js';
import { esc, toMin } from '../core/utils.js';

export function validateScheduleReview(items) {
  if (!items?.length) return 'No hay materias para guardar.';
  for (const item of items) {
    if (!item.blocks.length) return item.name + ': agrega al menos un bloque.';
    for (const block of item.blocks) {
      const start=toMin(block.s),end=toMin(block.e);
      if (!Number.isInteger(block.d)||block.d<0||block.d>6) return item.name + ': elige un día válido.';
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(block.s)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(block.e)||start===null||end===null||end<=start) return item.name + ': revisa la hora de inicio y fin.';
    }
  }
  return '';
}

export function createScheduleReview(container, items, onChange) {
  items.forEach(item => {
    item.blocks=(item.blocks||[]).map(b=>({...b}));
    (item.days||[]).forEach(d=>{if(!item.blocks.some(b=>b.d===d))item.blocks.push({d,s:'',e:''});});
    item.days=[...new Set(item.blocks.map(b=>b.d))];
  });
  function draw(openIndex) {
    container.innerHTML=items.map((item,i)=>'<details class="schedule-review-item" data-sr="'+i+'"'+(i===openIndex?' open':'')+'><summary><strong>'+esc(item.name)+'</strong><span>Editar</span></summary><div class="schedule-review-blocks">'+item.blocks.map((b,j)=>
      '<div class="schedule-review-block" data-sr-block="'+j+'"><label>Día<select data-sr-field="d">'+[1,2,3,4,5,6,0].map(d=>'<option value="'+d+'"'+(b.d===d?' selected':'')+'>'+DIAS[d]+'</option>').join('')+'</select></label><label>Inicio<input type="time" data-sr-field="s" value="'+esc(b.s)+'"></label><label>Fin<input type="time" data-sr-field="e" value="'+esc(b.e)+'"></label><button type="button" class="icon" data-sr-action="remove" aria-label="Quitar bloque">×</button></div>'
    ).join('')+'<button type="button" class="ghost" data-sr-action="add">Añadir bloque</button></div></details>').join('');
  }
  function update(e) {
    const field=e.target.dataset.srField;
    if(!field)return;
    const section=e.target.closest('[data-sr]'),row=e.target.closest('[data-sr-block]');
    if(!section||!row)return;
    const item=items[+section.dataset.sr],block=item.blocks[+row.dataset.srBlock];
    block[field]=field==='d'?Number(e.target.value):e.target.value;
    item.days=[...new Set(item.blocks.map(b=>b.d))];onChange();
  }
  container.oninput=update;container.onchange=update;
  container.onclick=e=>{
    const button=e.target.closest('[data-sr-action]');if(!button)return;
    const section=button.closest('[data-sr]');if(!section)return;
    const i=+section.dataset.sr,item=items[i];
    if(button.dataset.srAction==='add')item.blocks.push({d:1,s:'',e:''});
    else item.blocks.splice(+button.closest('[data-sr-block]').dataset.srBlock,1);
    item.days=[...new Set(item.blocks.map(b=>b.d))];draw(i);onChange();
  };
  draw();
  return {validate:()=>validateScheduleReview(items)};
}
