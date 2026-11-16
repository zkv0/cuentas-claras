import { createSubjectsView } from './ui/subjects-view.js';
import { createMotion } from './ui/motion.js';
import { state, save, find, onSave, removeSubject } from './core/store.js';
import { uid, num, f, esc } from './core/utils.js';
import { DIAS, MESES } from './core/constants.js';
import { classCount as countClasses, allowed as allowedAbsences } from './domain/attendance.js';
import { cleanSubject, applySubjectSnapshot } from './domain/subjects.js';
import { createSchedule } from './features/schedule.js';
import { createOnboarding } from './features/onboarding.js';
import { createQrTransfer } from './features/qr-transfer.js';
import { isAIConfigured, saveAIConfig } from './services/ai.js';
import { createSync } from './services/sync.js';

// Estado efímero de interfaz; los datos persistentes pertenecen a core/store.js.
const ui = { anim: {}, dialogMode: '', scheduleMessage: '', reorderAll: false, reorderId: null, archOpen: false };
const open = {}, open2 = {};
const classCount = sub => countClasses(sub, state.sem);
const allowed = sub => allowedAbsences(sub, state.sem);


  document.addEventListener("input",function(e){
    var el=e.target,k=el.dataset&&el.dataset.k;if(!k)return;
    var card=el.closest(".card");if(!card)return;
    var sub=find(card.dataset.id),row=el.closest(".row");if(!sub)return;
    if(row){
      var rr=sub.rows[row.dataset.i];rr[k]=el.value;
      if(k==="g"&&el.value.trim()!=="")rr.pred="";
    }else sub[k]=el.value;
    save();refreshCard(card);
  });
  document.addEventListener("focusout",function(e){var c=e.target.closest&&e.target.closest(".card");if(c)refreshCard(c)});
  document.addEventListener("click",function(e){
    if(e.target.closest('[data-act="addFalta"]')){openCal();return}
    var t=e.target.closest("[data-toggle]");
    if(t&&!ui.reorderAll){
      var tid=t.closest(".card").dataset.id;
      if(e.detail>=2)ui.reorderId=tid; // doble clic: entra a modo reordenar
      if(e.detail<2&&open[tid]){var cd=t.closest(".card");shrink(cd.querySelector(".body"),cd.querySelector(".chev"),function(){open[tid]=false;render()});return}
      open[tid]=!open[tid];ui.anim.open=open[tid]?tid:null;render();return;
    }
    var b=e.target.closest("button");if(!b)return;
    var card=b.closest(".card"),sub=card&&find(card.dataset.id),a=b.dataset.act;
    if(b.hasAttribute("data-arch-toggle")){
      if(ui.archOpen){shrink(document.querySelector(".arch-list"),b.querySelector(".chev"),function(){ui.archOpen=false;render()});return}
      ui.archOpen=true;ui.anim.arch=true;render();return;
    }
    if(b.hasAttribute("data-toggle2")){var sid=sub.id;if(open2[sid]){shrink(card.querySelector(".grpbody"),card.querySelector(".grp .chev"),function(){open2[sid]=false;render()});return}open2[sid]=true;ui.anim.grp=sid;render();return}
    if(a==="export"){openDlg("export");return}
    if(a==="import"){openDlg("import");return}
    if(a==="openOnboard"){openOnboarding();return}
    if(a==="reorderAll"){ui.reorderAll=!ui.reorderAll;ui.reorderId=null;ui.anim.flip=true;render();return}
    if(a==="doneReorder"){ui.reorderId=null;ui.reorderAll=false;ui.anim.flip=true;render();return}
    if(a==="move"&&sub){
      var ix=state.subjects.indexOf(sub),dr=+b.dataset.dir,jx=ix+dr;
      while(jx>=0&&jx<state.subjects.length&&!!state.subjects[jx].archived!==!!sub.archived)jx+=dr;
      if(jx>=0&&jx<state.subjects.length){var tmp=state.subjects[jx];state.subjects[jx]=sub;state.subjects[ix]=tmp;save();ui.anim.flip=true}
      render();return;
    }
    if(a==="uploadSch"){requestSchedulePhoto();return}
    if(a==="addSched"){openAddSched();return}
    if(a==="aiConfig"){openAIConfig();return}
    if(a==="editHorario"){openHorList();return}
    if(a==="delFalta"){var fid=b.dataset.fid;state.absences=state.absences.filter(function(x){return x.id!==fid});save();render();return}
    if(!sub)return;
    if(a==="archive"){sub.archived=!sub.archived;open[sub.id]=false;ui.anim.flip=true;save();render();return}
    if(a==="addRow"){sub.rows.push({p:"",g:"",pred:""});ui.anim.rowCard=sub.id;ui.anim.row=sub.rows.length-1}
    else if(a==="delRow"){var rw=b.closest(".row"),ri=+rw.dataset.i;shrink(rw,null,function(){sub.rows.splice(ri,1);save();render()});return}
    else if(a==="delSub"){
      if(!b.dataset.arm){
        b.dataset.arm="1";var old=b.textContent;
        b.textContent="Toca otra vez para eliminar de todas partes";b.style.color="var(--bad-ink)";b.style.borderColor="var(--bad-ink)";
        setTimeout(function(){if(b.isConnected){delete b.dataset.arm;b.textContent=old;b.style.color="";b.style.borderColor=""}},3000);
        return;
      }
      removeSubject(sub.id);ui.anim.flip=true;render();return;
    }
    save();render();
  });

  function $(id){return document.getElementById(id)}
  function openDlg(mode){
    ui.dialogMode=mode;$("dgo").hidden=false;var ta=$("dta");$("dmsg").textContent="";ta.hidden=false;$("dtab").hidden=true;
    $("dqrexport").hidden=mode!=="export";
    $("dqrimport").hidden=mode!=="import";
    if(mode==="export"){
      $("dt").textContent="Exportar datos";
      $("dp").textContent="Copia este texto y guárdalo donde quieras. Luego puedes importarlo aquí mismo.";
      ta.readOnly=true;ta.value=JSON.stringify({version:2,subjects:state.subjects,absences:state.absences,sem:state.sem},null,2);$("dgo").textContent="Copiar";
    }else{
      $("dt").textContent="Importar datos";
      $("dp").textContent="Pega el texto exportado. Las materias se agregarán a las que ya tienes.";
      ta.readOnly=false;ta.value="";ta.placeholder="Pega aquí tus datos";$("dgo").textContent="Importar";
    }
    $("dlg").hidden=false;ta.focus();if(mode==="export")ta.select();
  }
  function closeDlg(){$("dlg").hidden=true;$("dgo").hidden=false;$("dqrexport").hidden=true;$("dqrimport").hidden=true}
  function restoreSnapshot(data){
    var ai=applySubjectSnapshot(state,data);
    if(!ai&&(!data||!Array.isArray(data.subjects)))return;
    if(ai)saveAIConfig(ai);
    ui.scheduleMessage="Datos restaurados desde QR.";
    ui.reorderAll=false;ui.reorderId=null;
    if(!state.subjects.some(function(x){return !x.archived&&x.days&&x.days.length}))open.faltas=true;
    save();ui.anim.flip=true;render();closeDlg();ui.dialogMode="";
  }
  $("dx").addEventListener("click",closeDlg);
  $("dlg").addEventListener("click",function(e){if(e.target===$("dlg"))closeDlg()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")closeDlg()});
  $("dgo").addEventListener("click",function(){
    var ta=$("dta"),msg=$("dmsg");
    if(ui.dialogMode==="schedule"){applySched();return}
    if(ui.dialogMode==="editsched"){applyEditSched();return}
    if(ui.dialogMode==="addsched"){applyAddSched();return}
    if(ui.dialogMode==="ai"){applyAIConfig();return}
    if(ui.dialogMode==="qrreview"){applyImportReview();return}
    if(ui.dialogMode==="export"){
      ta.select();
      var ok=false;
      try{ok=document.execCommand("copy")}catch(e){}
      if(!ok&&navigator.clipboard){navigator.clipboard.writeText(ta.value).then(function(){msg.textContent="Copiado."},function(){msg.textContent="Selecciona el texto y cópialo manualmente."});return}
      msg.textContent=ok?"Copiado.":"Selecciona el texto y cópialo manualmente.";
      return;
    }
    try{
      var d=JSON.parse(ta.value.trim());
      var list=Array.isArray(d)?d:(d&&d.subjects);
      if(!Array.isArray(list)||!list.length)throw new Error("vacío");
      var src=list.filter(function(x){return x&&typeof x==="object"}),add=src.map(cleanSubject),idmap={};src.forEach(function(x,i){idmap[x.id]=add[i].id});
      if(!add.length)throw new Error("vacío");
      add.forEach(function(x){state.subjects.push(x)});ui.anim.flip=true;
      if(d&&d.sem&&typeof d.sem==="object"&&!state.sem.start&&!state.sem.end&&!state.sem.pct)state.sem={start:String(d.sem.start||""),end:String(d.sem.end||""),pct:String(d.sem.pct||"")};
      (Array.isArray(d.absences)?d.absences:[]).forEach(function(a){var ids=(a&&Array.isArray(a.ids)?a.ids:[]).map(function(i){return idmap[i]}).filter(Boolean);if(ids.length&&a.date&&!state.absences.some(function(z){return z.date===String(a.date)}))state.absences.push({id:uid(),date:String(a.date),ids:ids})});
      save();render();closeDlg();
    }catch(e){msg.textContent="No pude leer esos datos. Pega el texto completo tal como lo exportaste."}
  });
  function fmtDate(k){var p=k.split("-");return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
  function hasSchedule(){return state.subjects.some(function(x){return !x.archived&&x.days&&x.days.length})}
  function scheduleHint(hs){
    if(isAIConfigured())return hs?"La foto del horario se lee con tu API de IA. Cada falta se suma solo a las materias que tienes ese día.":"Sube una foto del horario y la leo con tu API de IA, o agrégalo a mano.";
    if(window.claude&&window.claude.use)return hs?"Cada falta se suma solo a las materias que tienes ese día.":"Sin horario, cada falta se suma a todas tus materias. Sube una foto y la leo por ti.";
    return "Conecta una API de IA para leer la foto o agrega el horario a mano.";
  }
  function faltHtml(){
    var o=!!open.faltas,n=state.absences.length,hs=hasSchedule();
    var h='<section class="card falt'+(o?" open":"")+'" data-id="faltas"><div class="item fh" data-toggle aria-expanded="'+o+'"><span class="t"><span class="n">Horario y faltas de asistencia</span><span class="m">'+(hs?"Horario guardado":"Sin horario guardado")+'</span></span><span class="chip none">'+n+(n===1?" falta":" faltas")+'</span><button class="icon" data-act="addFalta" aria-label="Añadir falta" title="Añadir falta"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button><span class="chev">›</span></div>';
    if(o){
      h+='<div class="body">'+semBox()+'<div class="sch"><button data-act="uploadSch">'+(hs?"Actualizar foto del horario":"Subir foto del horario")+'</button><button data-act="addSched">Agregar horario a mano</button><button data-act="editHorario">Editar horario</button><button class="ghost" data-act="aiConfig">'+(isAIConfigured()?"IA conectada":"Conectar IA")+'</button></div><p class="m" id="schmsg">'+esc(ui.scheduleMessage||scheduleHint(hs))+'</p>'+(hs?schedTable(stateRows()):"");
      var list=state.absences.slice().sort(function(a,b){return a.date<b.date?1:-1});
      if(!list.length)h+='<p class="m">Cuando registres una falta aparecerá aquí.</p>';
      list.forEach(function(a){
        var names=a.ids.map(function(i){var x=find(i);return x?(x.name||"Sin nombre"):null}).filter(Boolean).join(", ");
        h+='<div class="frow"><div><span class="fd">'+esc(fmtDate(a.date))+'</span><br><span class="m">'+esc(names)+'</span></div><button class="ghost" data-act="delFalta" data-fid="'+a.id+'">Quitar</button></div>';
      });
      h+='</div>';
    }
    return h+'</section>';
  }
  function limitLine(x){
    var mx=allowed(x);if(mx===null)return "";
    return '<p class="m hlim">Máx. '+mx+(mx===1?" falta":" faltas")+' de '+classCount(x)+' clases</p>';
  }
  function semBox(){
    var m=state.sem;
    return '<div class="semg"><label>Inicio del semestre<input type="date" data-sem="start" value="'+esc(m.start)+'"></label><label>Fin del semestre<input type="date" data-sem="end" value="'+esc(m.end)+'"></label><label>% máx. de faltas<input data-sem="pct" inputmode="decimal" placeholder="Ej. 20" value="'+esc(m.pct)+'"></label></div><p class="m semh">Cada día de clase cuenta como una falta. El máximo de cada materia se calcula con sus días de clase dentro del semestre.</p>';
  }
  document.addEventListener("input",function(e){
    var el=e.target,k=el.dataset&&el.dataset.sem;if(!k)return;
    state.sem[k]=el.value;save();
    document.querySelectorAll("#app .card").forEach(refreshCard);
  });

  /* calendario */
  var cal={y:0,m:0};
  function dkey(y,m,d){return y+"-"+("0"+(m+1)).slice(-2)+"-"+("0"+d).slice(-2)}
  function drawCal(){
    var first=new Date(cal.y,cal.m,1),off=(first.getDay()+6)%7,nd=new Date(cal.y,cal.m+1,0).getDate(),t=new Date(),tk=dkey(t.getFullYear(),t.getMonth(),t.getDate()),reg={};
    state.absences.forEach(function(a){reg[a.date]=1});
    $("ctitle").textContent=MESES[cal.m]+" "+cal.y;
    var h="";["L","M","M","J","V","S","D"].forEach(function(l){h+='<span class="cw">'+l+'</span>'});
    for(var i=0;i<off;i++)h+='<span></span>';
    for(var d=1;d<=nd;d++){var k=dkey(cal.y,cal.m,d);h+='<button class="cd'+(reg[k]?" f":"")+(k===tk?" t":"")+'" data-date="'+k+'">'+d+'</button>'}
    $("cgrid").innerHTML=h;
  }
  function openCal(){var t=new Date();cal.y=t.getFullYear();cal.m=t.getMonth();$("cmsg").textContent="";drawCal();$("cal").hidden=false}
  function closeCal(){$("cal").hidden=true}
  function addFalta(key){
    var p=key.split("-"),wd=new Date(+p[0],+p[1]-1,+p[2]).getDay(),msg=$("cmsg");
    if(state.absences.some(function(a){return a.date===key})){msg.textContent="Ya registraste una falta ese día.";return}
    var act=state.subjects.filter(function(x){return !x.archived}),hs=hasSchedule();
    var ids=act.filter(function(x){return !hs||(x.days||[]).indexOf(wd)>=0}).map(function(x){return x.id});
    if(!ids.length){msg.textContent=act.length?"Ese día no tienes clases según tu horario.":"Primero agrega un horario.";return}
    state.absences.push({id:uid(),date:key,ids:ids});
    save();closeCal();
    if(!open.faltas){open.faltas=true;ui.anim.open="faltas"}
    render();
  }
  $("cprev").addEventListener("click",function(){cal.m--;if(cal.m<0){cal.m=11;cal.y--}$("cmsg").textContent="";drawCal()});
  $("cnext").addEventListener("click",function(){cal.m++;if(cal.m>11){cal.m=0;cal.y++}$("cmsg").textContent="";drawCal()});
  $("cx").addEventListener("click",closeCal);
  $("cal").addEventListener("click",function(e){if(e.target===$("cal"))closeCal()});
  $("cgrid").addEventListener("click",function(e){var b=e.target.closest("[data-date]");if(b)addFalta(b.dataset.date)});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")closeCal()});

  const { renderRaw, refreshCard } = createSubjectsView({ state, ui, open, open2, find, allowed, faltHtml });
  const { render, shrink } = createMotion({ ui, renderRaw });
  const { openHorList, openSchedEdit, applyEditSched, applySched, schedTable, stateRows, requestSchedulePhoto, openAddSched, applyAddSched, openAIConfig, applyAIConfig } =
    createSchedule({ state, ui, save, render, find, limitLine, closeDlg, removeSubject });
  const { initOnboarding, openOnboarding } = createOnboarding({ state, ui, save, render, schedTable, openAddSched });
  const { applyImportReview } = createQrTransfer({ state, ui, restoreSnapshot });
  const { initSync, schedulePush } = createSync({ state, ui, render });
  onSave(schedulePush);
  if(!state.subjects.some(function(x){return !x.archived&&x.days&&x.days.length}))open.faltas=true;
  ui.anim.first=true;render();initSync();initOnboarding();
