import { uid, tm } from '../core/utils.js';

// Crea una copia importable con identidad nueva; mantiene la estructura histórica.
export function cleanSubject(x){
    var rows=Array.isArray(x.rows)?x.rows:[];
    return{id:uid(),archived:!!x.archived,days:Array.isArray(x.days)?x.days.filter(function(n){return n>=0&&n<=6}):[],blocks:Array.isArray(x.blocks)?x.blocks.filter(function(k){return k&&k.d>=0&&k.d<=6}).map(function(k){return{d:+k.d,s:tm(k.s),e:tm(k.e)}}):[],name:String(x.name==null?"":x.name),min:x.min==null?3:x.min,max:x.max==null?5:x.max,
      rows:rows.map(function(r){r=r||{};return{p:r.p==null?"":String(r.p),g:r.g==null?"":String(r.g),pred:r.pred==null?"":String(r.pred)}})};
  }

/** Reemplaza el contenido académico con una copia completa (por ejemplo, un QR).
 * Devuelve la configuración de IA incluida, o null si la copia no la trae.
 */
export function applySubjectSnapshot(state, data){
  if(!state||!data||!Array.isArray(data.subjects))return null;
  var src=data.subjects.filter(function(x){return x&&typeof x==="object"&&Array.isArray(x.rows)});
  var add=src.map(cleanSubject),idmap={};
  src.forEach(function(x,i){idmap[x.id]=add[i].id});
  state.subjects=add;
  var seen={},absences=[];
  (Array.isArray(data.absences)?data.absences:[]).forEach(function(a){
    if(!a)return;
    var date=String(a.date||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||seen[date])return;
    var ids=(Array.isArray(a.ids)?a.ids:[]).map(function(i){return idmap[i]}).filter(Boolean);
    if(!ids.length)return;
    seen[date]=1;absences.push({id:uid(),date:date,ids:ids});
  });
  state.absences=absences;
  state.sem=data.sem&&typeof data.sem==="object"
    ?{start:String(data.sem.start||""),end:String(data.sem.end||""),pct:String(data.sem.pct||"")}
    :{start:"",end:"",pct:""};
  return data.ai&&typeof data.ai==="object"?data.ai:null;
}
