import test from 'node:test';
import assert from 'node:assert/strict';
import { exportScheduleImage } from '../src/features/schedule-image.js';
test('exporta el horario de cada semestre a PNG con los colores activos al descargar',t=>{
 const texts=[],downloads=[],fills=[],textColors=new Map();let type,canvas;
 const ctx=new Proxy({
   measureText:text=>({width:text.length*8}),
   fillText(text){texts.push(text);textColors.set(text,this.fillStyle)},
   fillRect(){fills.push(this.fillStyle)}
 },{get:(obj,key)=>key in obj?obj[key]:()=>{}});
 const root={};
 let colors={'--bg':'#c5e2ff','--ink':'#102d53','--muted':'#2b496e','--line':'#8ab6e8','--strong-surface':'#94c1f6','--accent':'#164bb0'};
 globalThis.getComputedStyle=element=>{
   assert.equal(element,root);
   return {getPropertyValue:name=>colors[name]||''};
 };
 t.after(()=>{delete globalThis.getComputedStyle;delete globalThis.document});
 globalThis.document={documentElement:root,body:{appendChild(){}},createElement(tag){
   if(tag==='canvas')return canvas={getContext:()=>ctx,toBlob(callback,mime){type=mime;callback(new Blob(['png']))}};
   return {click(){downloads.push(this.download)},remove(){}};
 }};
 const state={activeSemesterId:'a',semesters:[{id:'a',name:'2027-1'},{id:'b',name:'2026-2'}],subjects:[{name:'Cálculo',days:[1,3],blocks:[{d:1,s:'08:00',e:'10:00'}]},{name:'Archivada',archived:true,days:[1],blocks:[]}]};
 exportScheduleImage(state,error=>assert.fail(error));
 assert.equal(type,'image/png');assert.equal(downloads[0],'horario-2027-1.png');
 assert.equal(canvas.width,1600);assert.ok(canvas.height>200);
 assert.ok(texts.includes('Cálculo'));assert.ok(texts.some(t=>t.includes('sin hora')));
 assert.ok(!texts.some(t=>t.includes('Archivada')));
 assert.deepEqual(fills,['#c5e2ff','#94c1f6']);
 assert.equal(ctx.strokeStyle,'#8ab6e8');
 assert.equal(textColors.get('Lun'),'#164bb0');
 assert.equal(textColors.get('Cálculo'),'#102d53');
 assert.equal(textColors.get('08:00 - 10:00'),'#2b496e');
 state.semesters[1].subjects = [{name:'Bases de Datos',days:[2],blocks:[{d:2,s:'14:00',e:'16:00'}]}];
 colors={...colors,'--bg':'#fff','--ink':'#0d1725','--strong-surface':'#becfe5'};
 texts.length = 0;
 exportScheduleImage(state,error=>assert.fail(error),'b');
 assert.equal(downloads[1],'horario-2026-2.png');
 assert.ok(texts.includes('Bases de Datos'));
 assert.ok(!texts.includes('Cálculo'));
 assert.deepEqual(fills.slice(2),['#fff','#becfe5']);
 assert.equal(textColors.get('Bases de Datos'),'#0d1725');
 assert.equal(state.activeSemesterId,'a');
});
test('sin horario informa el problema y no descarga',()=>{
 let message;exportScheduleImage({semesters:[],subjects:[]},value=>message=value);
 assert.match(message,/Agrega un horario/);
});
