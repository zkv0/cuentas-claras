import test from 'node:test';
import assert from 'node:assert/strict';
import { exportScheduleImage } from '../src/features/schedule-image.js';
test('exporta el horario activo a PNG con nombre, días y clases sin hora',()=>{
 const texts=[],downloads=[];let type,canvas;
 const ctx=new Proxy({measureText:t=>({width:t.length*8}),fillText:t=>texts.push(t)},{get:(obj,key)=>key in obj?obj[key]:()=>{}});
 globalThis.document={body:{appendChild(){}},createElement(tag){
   if(tag==='canvas')return canvas={getContext:()=>ctx,toBlob(callback,mime){type=mime;callback(new Blob(['png']))}};
   return {click(){downloads.push(this.download)},remove(){}};
 }};
 const state={activeSemesterId:'a',semesters:[{id:'a',name:'2027-1'},{id:'b',name:'2026-2'}],subjects:[{name:'Cálculo',days:[1,3],blocks:[{d:1,s:'08:00',e:'10:00'}]},{name:'Archivada',archived:true,days:[1],blocks:[]}]};
 exportScheduleImage(state,error=>assert.fail(error));
 assert.equal(type,'image/png');assert.equal(downloads[0],'horario-2027-1.png');
 assert.equal(canvas.width,1600);assert.ok(canvas.height>200);
 assert.ok(texts.includes('Cálculo'));assert.ok(texts.some(t=>t.includes('sin hora')));
 assert.ok(!texts.some(t=>t.includes('Archivada')));
});
test('sin horario informa el problema y no descarga',()=>{
 let message;exportScheduleImage({semesters:[],subjects:[]},value=>message=value);
 assert.match(message,/Agrega un horario/);
});
