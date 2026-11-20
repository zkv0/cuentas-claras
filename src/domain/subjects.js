import { uid, tm } from '../core/utils.js';

export function subjectSnapshot({subjects, absences, sem, gradeScale, absencePct, semesters, activeSemesterId}){
  return {subjects, absences, sem, gradeScale, absencePct, semesters, activeSemesterId};
}

export function createScheduledSubject({name, days, blocks}){
  return {
    id:uid(), name, days, blocks, min:3, max:5,
    rows:Array.from({length:3}, () => ({p:'',g:'',pred:''}))
  };
}

// Crea una copia importable con identidad nueva; mantiene la estructura histórica.
export function cleanSubject(x){
    var rows=Array.isArray(x.rows)?x.rows:[];
    return{id:uid(),archived:!!x.archived,cancelled:!!x.cancelled,days:Array.isArray(x.days)?x.days.filter(function(n){return n>=0&&n<=6}):[],blocks:Array.isArray(x.blocks)?x.blocks.filter(function(k){return k&&k.d>=0&&k.d<=6}).map(function(k){return{d:+k.d,s:tm(k.s),e:tm(k.e)}}):[],credits:x.credits==null?"":String(x.credits),name:String(x.name==null?"":x.name),min:x.min==null?3:x.min,max:x.max==null?5:x.max,
      rows:rows.map(function(r){r=r||{};return{...(r.label?{label:String(r.label)}:{}),p:r.p==null?"":String(r.p),g:r.g==null?"":String(r.g),pred:r.pred==null?"":String(r.pred)}})};
  }

/** Reemplaza el contenido académico con una copia completa (por ejemplo, un QR).
 * Devuelve la configuración de IA incluida, o null si la copia no la trae.
 */
export function applySubjectSnapshot(state, data){
  if(!state||!data||!Array.isArray(data.subjects))return null;
  if(Array.isArray(data.semesters)&&data.semesters.length){
    var periods=data.semesters.filter(x=>x&&typeof x==='object'&&Array.isArray(x.subjects)).map(function(x){
      var temp={};applySubjectSnapshot(temp,{subjects:x.subjects,absences:x.absences,sem:x.sem});
      return {id:uid(),sourceId:x.id,name:String(x.name||'Semestre'),subjects:temp.subjects,absences:temp.absences,sem:temp.sem};
    });
    if(periods.length){
      var selected=periods.find(x=>x.sourceId===data.activeSemesterId)||periods[0];
      periods.forEach(x=>delete x.sourceId);state.semesters=periods;state.activeSemesterId=selected.id;
      state.absencePct=data.absencePct??selected.sem.pct??'';
      state.subjects=selected.subjects;state.absences=selected.absences;state.sem=selected.sem;
      state.gradeScale=data.gradeScale||{min:selected.subjects[0]?.min??3,max:selected.subjects[0]?.max??5};
      return data.ai&&typeof data.ai==='object'?data.ai:null;
    }
  }
  state.absencePct=data.absencePct??data.sem?.pct??'';
  var src=data.subjects.filter(function(x){return x&&typeof x==="object"&&Array.isArray(x.rows)});
  var add=src.map(cleanSubject),idmap={};
  src.forEach(function(x,i){idmap[x.id]=add[i].id});
  state.subjects=add;
  state.gradeScale=data.gradeScale||{min:add[0]?.min??3,max:add[0]?.max??5};
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
