import { num, f, esc } from '../core/utils.js';
import { calc, chip, isGraded } from '../domain/grades.js';

/** Construye las tarjetas y actualiza los cálculos sin interrumpir la escritura. */
export function createSubjectsView({ state, ui, open, open2, find, allowed, faltHtml }) {
  function bodyHtml(sub){
    var h='<div class="body"><div class="head"><input class="name" data-k="name" placeholder="Nombre de la materia" value="'+esc(sub.name)+'"></div>'+
      '<div class="cfg"><label>Nota mínima para ganar <input data-k="min" inputmode="decimal" value="'+esc(sub.min)+'"></label>'+
      '<label>Nota máxima <input data-k="max" inputmode="decimal" value="'+esc(sub.max)+'"></label></div>';
    function rowHtml(r,i,cp){
      return '<div class="row'+(cp?" compact":"")+'" data-i="'+i+'"><div><label>Porcentaje (%)</label><input data-k="p" inputmode="decimal" placeholder="'+(cp?"Porcentaje %":"20")+'" value="'+esc(r.p)+'"></div>'+
        '<div><label>Nota obtenida</label><input data-k="g" inputmode="decimal" placeholder="'+(cp?"Nota":"Pendiente")+'" value="'+esc(r.g)+'"></div>'+
        '<div class="needwrap"><label>Debes sacar</label><input class="pred" data-k="pred" inputmode="decimal" value="'+esc(r.pred)+'"></div>'+
        '<button class="ghost x" data-act="delRow" aria-label="Quitar evaluación">Quitar</button></div>';
    }
    var gi=[],oi=[];
    sub.rows.forEach(function(r,i){(isGraded(r)?gi:oi).push(i)});
    if(gi.length){
      var go=!!open2[sub.id];
      h+='<button class="grp'+(go?" open":"")+'" data-toggle2 aria-expanded="'+go+'"><span>Notas ya evaluadas</span><span class="gm"></span><span class="chev">›</span></button>';
      if(go){h+='<div class="grpbody">';gi.forEach(function(i){h+=rowHtml(sub.rows[i],i,true)});h+='</div>'}
    }
    oi.forEach(function(i){h+=rowHtml(sub.rows[i],i,false)});
    return h+'<div class="actions"><button data-act="addRow">Agregar evaluación</button><button class="ghost" data-act="archive">'+(sub.archived?"Restaurar":"Archivar")+'</button><button class="ghost" data-act="delSub">Eliminar materia</button></div></div>';
  }
  function cardHtml(sub){
    var o=!!open[sub.id],ro=ui.reorderAll||ui.reorderId===sub.id;
    return '<section class="card'+(o&&!ro?" open":"")+(ro?" reorder":"")+'" data-id="'+sub.id+'">'+
        (ro?'<div class="item ro"><span class="t"><span class="n"></span><span class="m"></span></span><span class="chip"></span><span class="mv"><button class="ghost" data-act="move" data-dir="-1" aria-label="Subir">↑</button><button class="ghost" data-act="move" data-dir="1" aria-label="Bajar">↓</button><button class="p" data-act="doneReorder">Listo</button></span></div>'
          :'<div class="item" data-toggle aria-expanded="'+o+'"><span class="t"><span class="n"></span><span class="m"></span></span><span class="fbox"></span><span class="chip"></span><span class="chev">›</span></div>'+(o?bodyHtml(sub):""))+
        '</section>';
  }
  function renderRaw(){
    var app=document.getElementById("app");
    var rb=document.querySelector('[data-act="reorderAll"]');if(rb)rb.classList.toggle("on",ui.reorderAll);
    var act=state.subjects.filter(function(x){return !x.archived}),arc=state.subjects.filter(function(x){return x.archived}),h="";
    if(!state.subjects.length)h='<div class="empty"><p>Aún no tienes materias.</p><div class="empty-acts"><button class="p" data-act="openOnboard">Subir foto de horario con IA</button><button class="ghost" data-act="addSched">Agregar horario a mano</button></div></div>';
    else{
      h=faltHtml()+(act.length?act.map(cardHtml).join(""):'<div class="empty">No tienes materias activas.</div>');
      if(arc.length){
        h+='<button class="arch-h'+(ui.archOpen?" open":"")+'" data-arch-toggle aria-expanded="'+ui.archOpen+'"><span>Archivadas</span><span class="gm">'+arc.length+(arc.length===1?" materia":" materias")+'</span><span class="chev">›</span></button>';
        if(ui.archOpen)h+='<div class="arch-list">'+arc.map(cardHtml).join("")+'</div>';
      }
    }
    app.innerHTML=h;
    app.querySelectorAll(".card").forEach(refreshCard);
  }
  function refreshCard(card){
    if(!card||!card.isConnected)return;
    var sub=find(card.dataset.id);if(!sub)return;
    var c=calc(sub),ch=chip(c);
    card.querySelector(".n").textContent=sub.name||"Sin nombre";
    var fc=state.absences.filter(function(a){return a.ids.indexOf(sub.id)>=0}).length,mx=allowed(sub),mEl=card.querySelector(".m");
    mEl.textContent="Acumulado "+f(c.earned)+" · "+f(c.graded)+"% evaluado";
    mEl.classList.toggle("warn",mx!==null&&fc>mx);
    var fb=card.querySelector(".fbox");if(fb){fb.textContent=fc+(mx!==null?"/"+mx:"")+(fc===1&&mx===null?" falta":" faltas");fb.classList.toggle("warn",mx!==null&&fc>mx)}
    var cp=card.querySelector(".chip");cp.className="chip "+ch.cls;cp.textContent=ch.t;
    var gm=card.querySelector(".gm");
    if(gm){var gc=sub.rows.filter(isGraded).length;gm.textContent=gc+(gc===1?" evaluación":" evaluaciones")+" · "+f(c.graded)+"% · acumulado "+f(c.earned)}
    var need=c.need,bad=need!==null&&need>c.max;
    var addBtn=card.querySelector('[data-act="addRow"]');
    if(addBtn)addBtn.hidden=(c.graded+c.pend)>=99.999;
    card.querySelectorAll(".row").forEach(function(d){
      var r=sub.rows[d.dataset.i],p=num(r.p),g=num(r.g);
      var pending=p!==null&&p>0&&g===null;
      d.classList.toggle("pending",pending);
      if(!pending)return;
      var inp=d.querySelector(".pred"),lab=d.querySelector(".needwrap label");
      var locked=num(r.pred)!==null;
      inp.classList.toggle("locked",locked);
      lab.textContent=locked?"Tu predicción":"Debes sacar";
      inp.classList.toggle("bad",!locked&&bad);
      if(!locked&&document.activeElement!==inp)inp.value=need===null?"":f(Math.max(need,0));
    });
  }

  return { renderRaw, refreshCard };
}
