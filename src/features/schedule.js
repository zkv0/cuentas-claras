import { createScheduleReview } from '../ui/schedule-review.js';
import { parseSchedule } from '../domain/schedule-import.js';
import { createScheduledSubject } from '../domain/subjects.js';
import { esc, tm, toMin, fm } from '../core/utils.js';
import { DIAS } from '../core/constants.js';
import { AI_PROVIDERS, providerDefaults, loadAIConfig, saveAIConfig, clearAIConfig, isAIConfigured, readScheduleImage, testAIConnection, buildSchedulePrompt } from '../services/ai.js';

/** Edición manual y lectura de la foto con una API de IA configurable.
 * Si no hay conexión configurada se mantiene el SDK del entorno Claude como
 * alternativa y, si tampoco existe, se abre el formulario de conexión.
 */
export function createSchedule({ state, ui, save, render, find, limitLine, openPanel, closeDlg, removeSubject }) {
  const $ = id => document.getElementById(id);
  let pendingSched = null, scheduleReview = null;
  var ORDD=[1,2,3,4,5,6,0],editDraft=null,editSubId=null,addDraft=null,addReturnToList=false,aiPendingUpload=false;
  function horSummary(x){
    var on=(x.days||[]).length>0;
    if(!on)return '<p class="m hsnone">Sin horario</p>';
        var lines='';
    ORDD.forEach(function(d){
      if(x.days.indexOf(d)<0)return;
      var bl=(x.blocks||[]).filter(function(b){return b.d===d});
      var t=bl.length?bl.map(function(b){return b.s&&b.e?b.s+" – "+b.e:"sin hora"}).join(", "):"sin hora";
      lines+='<div class="hl2"><span>'+DIAS[d]+'</span><span>'+esc(t)+'</span></div>';
    });
    return '<div class="hlines">'+lines+'</div>'+limitLine(x);
  }
  function openHorList(){
    editSubId=null;editDraft=null;
    var subs=state.subjects.filter(function(x){return !x.archived});
    var h='<div class="hl-actions"><button class="p" data-hl-new>Agregar materia</button></div>';
    if(!subs.length)h+='<p class="m">Aún no tienes materias. Agrega la primera con su horario.</p>';
    subs.forEach(function(x){
      var on=(x.days||[]).length>0;
      h+='<div class="srow"><div><span class="fd">'+esc(x.name||"Sin nombre")+'</span>'+horSummary(x)+'</div><div class="sact"><button class="ghost" data-hl-edit="'+x.id+'">'+(on?"Modificar horario":"Agregar horario")+'</button>'+(on?'<button class="ghost" data-hl-delete="'+x.id+'">Eliminar materia</button>':'')+'</div></div>';
    });
    openPanel('horlist', {
      title:'Editar horario',
      description:'Modifica el horario de cada materia o elimínala para quitarla de la lista, el horario y las faltas.',
      body:h
    });
  }
  function openSchedEdit(sub){
    if(!sub)return;
    editSubId=sub.id;
    editDraft={days:(sub.days||[]).slice(),blocks:(sub.blocks||[]).map(function(k){return{d:+k.d,s:k.s||"",e:k.e||""}})};
    openPanel('editsched', {
      title:'Horario de '+(sub.name||'la materia'),
      description:'Elige los días y las horas de clase. Al guardar se actualiza el horario.',
      body:scheduleEditor(editDraft), confirm:'Guardar'
    });
  }
  function activeDraft(){
    if(ui.dialogMode==='addsched')return addDraft;
    if(ui.dialogMode==='editsched')return editDraft;
    return null;
  }
  function scheduleEditor(draft){
    const days = ORDD.map(day => {
      const selected = draft.days.includes(day);
      return `<button type="button" class="dchip${selected ? ' on' : ''}" data-eday="${day}" aria-pressed="${selected}">${DIAS[day]}</button>`;
    }).join('');
    const times = ORDD.filter(day => draft.days.includes(day)).map(day => {
      const rows = draft.blocks.map((block, index) => block.d === day ? `
        <div class="trow"><span class="tl">${DIAS[day]}</span>
          <input type="time" data-block="${index}" data-time="s" value="${esc(block.s)}" aria-label="Hora de inicio">
          <span>a</span>
          <input type="time" data-block="${index}" data-time="e" value="${esc(block.e)}" aria-label="Hora de fin">
        </div>` : '').join('');
      return `<div class="times">${rows}</div>`;
    }).join('');
    const fields = `<div class="days">${days}</div>${times}`;
    return draft === addDraft ? `
      <div class="addsched">
        <label>Materia<input id="asName" list="asNames" autocomplete="off" spellcheck="false" placeholder="Ej. Cálculo" value="${esc(draft.name)}"></label>
        <datalist id="asNames">${subjectNames().map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist>
        ${fields}
        <div class="addsched-actions"><button type="button" class="ghost" data-add-another>Guardar y agregar otra materia</button></div>
      </div>` : fields;
  }
  function applyEditSched(){
    var sub=find(editSubId);if(!sub||!editDraft)return;
    var ds=editDraft.days.slice();
    sub.days=ds;
    sub.blocks=editDraft.blocks.filter(function(b){return ds.indexOf(b.d)>=0}).map(function(b){return{d:b.d,s:b.s,e:b.e}});
    save();render();openHorList();
  }
  function openAddSched(fromList){
    addReturnToList=!!fromList;
    addDraft={name:"",days:[],blocks:[]};
    openPanel('addsched', {
      title:'Agregar horario a mano',
      description:'Escribe la materia y elige los días y horas. Si ya existe una materia con ese nombre, se actualiza su horario; si no, se crea con este horario.',
      body:scheduleEditor(addDraft), confirm:'Guardar horario'
    });
    var name=$("asName");if(name)name.focus();
  }
  function syncAddName(){
    var el=$("asName");if(el&&addDraft)addDraft.name=el.value;
  }
  function toggleDay(draft, day){
    if(draft === addDraft)syncAddName();
    const index = draft.days.indexOf(day);
    if(index >= 0){
      draft.days.splice(index, 1);
      draft.blocks = draft.blocks.filter(block => block.d !== day);
    }else{
      draft.days.push(day);
      draft.blocks.push({d:day,s:'',e:''});
    }
    $('dtab').innerHTML=scheduleEditor(draft);
  }
  function saveAddSched(reopen){
    if(!addDraft)return;
    syncAddName();
    var name=String(addDraft.name||"").trim();
    if(!name){$("dmsg").textContent="Escribe el nombre de la materia.";return}
    var days=addDraft.days.slice();
    if(!days.length){$("dmsg").textContent="Elige al menos un día de clase.";return}
    var blocks=addDraft.blocks.filter(function(b){return days.indexOf(b.d)>=0}).map(function(b){return{d:b.d,s:tm(b.s),e:tm(b.e)}});
    var match=exactSubject(name);
    if(match){match.days=days;match.blocks=blocks}
    else state.subjects.push(createScheduledSubject({name,days,blocks}));
    addDraft=null;save();ui.anim.flip=true;render();
    if(reopen){
      openAddSched(false);
      $("dmsg").textContent="Materia guardada. Puedes agregar otra.";
      setSch("Horario guardado.");
    }else if(addReturnToList){
      addReturnToList=false;
      openHorList();
      setSch("Horario guardado.");
    }else{
      closeDlg();
      setSch("Horario guardado.");
    }
  }
  function applyAddSched(){saveAddSched(false)}
  $("dtab").addEventListener("click",function(e){
    if(ui.dialogMode==="ai"){
      if(e.target.closest("[data-ai-test]")){testAI();return}
      if(e.target.closest("[data-ai-clear]")){clearAI();return}
      return;
    }
    if(ui.dialogMode==="horlist"){
      if(e.target.closest("[data-hl-new]")){openAddSched(true);return}
      var eb=e.target.closest("[data-hl-edit]");
      if(eb){openSchedEdit(find(eb.dataset.hlEdit));return}
      var cb=e.target.closest("[data-hl-delete]");
      if(cb){
        var cs=find(cb.dataset.hlDelete);if(!cs)return;
        if(!cb.dataset.arm){
          cb.dataset.arm="1";cb.textContent="Toca otra vez para eliminar de todas partes";
          cb.style.color="var(--bad-ink)";cb.style.borderColor="var(--bad-ink)";
          setTimeout(function(){if(cb.isConnected){delete cb.dataset.arm;cb.textContent="Eliminar materia";cb.style.color="";cb.style.borderColor=""}},3000);
          return;
        }
        removeSubject(cs.id);
        if(editSubId===cs.id){editSubId=null;editDraft=null}
        render();openHorList();
      }
      return;
    }
    if(ui.dialogMode==="addsched"&&e.target.closest("[data-add-another]")){saveAddSched(true);return}
    const draft = activeDraft();
    const day = e.target.closest("[data-eday]");
    if(draft && day)toggleDay(draft, Number(day.dataset.eday));
  });
  $("dtab").addEventListener("change",function(e){
    var el=e.target;
    if(ui.dialogMode==="ai"&&el.id==="aiProvider"){applyAIProvider(el.value);return}
    const block = activeDraft()?.blocks[el.dataset?.block];
    if(block)block[el.dataset.time]=el.value;
  });
  $("dtab").addEventListener("input",function(e){
    if(ui.dialogMode==="addsched"&&e.target&&e.target.id==="asName"&&addDraft)addDraft.name=e.target.value;
  });

  /* conexión con una API de IA */
  function aiSetMsg(t,c){var el=$("aiMsg");if(!el)return;el.textContent=t||"";el.className="m"+(c?" "+c:"")}
  function providerOptions(selected){
    return AI_PROVIDERS.map(function(p){return '<option value="'+p.id+'"'+(p.id===selected?" selected":"")+'>'+esc(p.label)+'</option>'}).join("");
  }
  function applyAIProvider(id){
    var d=providerDefaults(id),base=$("aiBase"),model=$("aiModel");
    if(id==="custom"){
      if(base)base.value="";
      if(model)model.value="";
      return;
    }
    if(d.baseUrl&&base)base.value=d.baseUrl;
    if(d.model&&model)model.value=d.model;
  }
  function aiFormConfig(){
    var provider=$("aiProvider"),key=$("aiKey"),model=$("aiModel"),base=$("aiBase"),remember=$("aiRemember");
    return{
      provider:provider?provider.value:"deepseek",
      apiKey:key?key.value:"",
      model:model?model.value:"",
      baseUrl:base?base.value:"",
      remember:remember?!!remember.checked:true
    };
  }
  function openAIConfig(fromUpload){
    aiPendingUpload=!!fromUpload;
    var cfg=loadAIConfig();
    const body='<div class="dsform">'+
      '<label>Proveedor<select id="aiProvider">'+providerOptions(cfg.provider)+'</select></label>'+
      '<label>Clave de API<input type="password" id="aiKey" autocomplete="new-password" spellcheck="false" placeholder="sk-..." value="'+esc(cfg.apiKey)+'"></label>'+
      '<label>Modelo<input id="aiModel" spellcheck="false" autocapitalize="off" placeholder="Modelo con visión" value="'+esc(cfg.model)+'"></label>'+
      '<label>URL base<input id="aiBase" spellcheck="false" autocapitalize="off" placeholder="https://…/v1" value="'+esc(cfg.baseUrl)+'"></label>'+
      '<label class="dscheck"><input type="checkbox" id="aiRemember"'+(cfg.remember?' checked':'')+'> Guardar la conexión en este navegador</label>'+
      '<div class="dslinks"><span class="m">Consigue la clave en el panel de tu proveedor.</span><span class="dsacts"><button type="button" class="ghost" data-ai-test>Probar conexión</button><button type="button" class="ghost" data-ai-clear>Quitar clave</button></span></div>'+
      '<p class="m" id="aiMsg">'+(isAIConfigured()?"Conexión configurada. Puedes cambiar el proveedor, la clave o el modelo.":"Aún no hay una conexión guardada.")+'</p>'+
      '<p class="m dsnote">La imagen se envía al proveedor que elijas y cada lectura consume tokens de tu cuenta. La conexión se guarda en este navegador; si desmarcas la casilla, solo dura hasta cerrar la pestaña.</p>'+
    '</div>';
    openPanel('ai', {
      title:'Conectar IA',
      description:'Elige la API que usará Cuentas Claras para leer las capturas de notas y horarios.',
      body, confirm:'Guardar'
    });
  }
  function applyAIConfig(){
    var cfg=aiFormConfig();
    if(!isAIConfigured(cfg)){
      var info=providerDefaults(cfg.provider);
      aiSetMsg(info.keyRequired&&!String(cfg.apiKey||"").trim()?"Escribe la clave de API de "+info.label+".":"Completa el modelo y la URL base.","warn");
      return;
    }
    cfg=saveAIConfig(cfg);
    var photo=aiPendingUpload;aiPendingUpload=false;
    closeDlg();setSch(photo?"IA conectada. Elige la foto de tu horario.":"Conexión de IA guardada.");render();
    if(photo)$("schfile").click();
  }
  function testAI(){
    var cfg=aiFormConfig();
    if(!isAIConfigured(cfg)){aiSetMsg("Completa la clave, el modelo y la URL base para probar la conexión.","warn");return}
    aiSetMsg("Comprobando conexión…");
    testAIConnection(cfg).then(function(models){
      aiSetMsg(models.length
        ?"Conexión correcta. Modelos: "+models.slice(0,6).join(", ")+"."
        :"No se pudo listar modelos. Guarda la configuración y prueba a leer una foto.",
        models.length?"ok":"warn");
    },function(e){aiSetMsg((e&&e.message)||"No pude conectar con la API de IA.","warn")});
  }
  function clearAI(){
    clearAIConfig();
    var key=$("aiKey");if(key)key.value="";
    aiSetMsg("Clave eliminada de este navegador.","warn");
    setSch("Conexión de IA eliminada.");
    render();
  }
  function requestSchedulePhoto(){
    if(isAIConfigured()||(window.claude&&window.claude.use)){$("schfile").click();return}
    setSch("Conecta una API de IA para leer la foto del horario.");
    openAIConfig(true);
  }

  /* horario con foto + IA */
  function norm(t){return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g,"").trim()}
  function matchSubject(n){
    var q=norm(n),best=null;
    state.subjects.forEach(function(x){
      if(x.archived||!x.name)return;
      var w=norm(x.name);
      if(w===q)best=x;else if(!best&&q.length>=4&&w.length>=4&&(w.indexOf(q)>=0||q.indexOf(w)>=0))best=x;
    });
    return best;
  }
  function exactSubject(n){
    var q=norm(n);
    return state.subjects.find(function(x){return !x.archived&&x.name&&norm(x.name)===q})||null;
  }
  function subjectNames(){
    return state.subjects.filter(function(x){return !x.archived&&x.name}).map(function(x){return x.name});
  }
  function readSchedule(file){
    if(isAIConfigured()){
      setSch("Leyendo tu horario con IA…");
      readScheduleImage(file,loadAIConfig(),buildSchedulePrompt(subjectNames())).then(showSched).catch(function(e){
        setSch((e&&e.message)||"No pude leer el horario. Prueba con una foto más clara.");
      });
      return;
    }
    if(!window.claude||!window.claude.use){
      setSch("Conecta una API de IA para leer la foto del horario.");
      openAIConfig(true);
      return;
    }
    setSch("Leyendo tu horario…");
    claude.use("sample").then(function(sample){
      if(!sample)throw{code:"na"};
      return sample.limits().then(function(l){
        if(!l||!l.images)throw{code:"na"};
        return sample.json(buildSchedulePrompt(subjectNames()),{images:file,modelTier:"default"});
      });
    }).then(showSched).catch(function(e){
      setSch(e&&e.code==="not_granted"?"No diste permiso para leer la imagen.":"No pude leer el horario. Prueba con una foto más clara.");
    });
  }
  function schedTable(items){
    var placed=[],loose=[],mn=1440,mx=0;
    items.forEach(function(it){
      var cov={};
      (it.blocks||[]).forEach(function(b){
        var s=toMin(b.s),e=toMin(b.e);cov[b.d]=1;
        if(s===null){loose.push({name:it.name,d:b.d,isNew:it.isNew});return}
        if(e===null||e<=s)e=s+60;
        placed.push({name:it.name,isNew:it.isNew,d:b.d,s:s,e:e});
        if(s<mn)mn=s;if(e>mx)mx=e;
      });
      (it.days||[]).forEach(function(d){if(!cov[d])loose.push({name:it.name,d:d,isNew:it.isNew})});
    });
    if(!placed.length&&!loose.length)return "";
    var H=40,h0=placed.length?Math.floor(mn/60):0,h1=placed.length?Math.ceil(mx/60):0,n=Math.max(0,h1-h0);
    var hours="";for(var k=0;k<n;k++)hours+='<div class="hl">'+("0"+(h0+k)).slice(-2)+':00</div>';
    var blks="";
    placed.forEach(function(p){
      var c=ORDD.indexOf(p.d),top=(p.s-h0*60)/60*H+1,hg=Math.max(24,(p.e-p.s)/60*H-2);
      blks+='<div class="blk'+(p.isNew?" nw":"")+'" style="left:calc(100% / 7 * '+c+' + 2px);width:calc(100% / 7 - 4px);top:'+(top/(n*H)*100)+'%;height:'+(hg/(n*H)*100)+'%"><b>'+esc(p.name||"Sin nombre")+'</b><span>'+fm(p.s)+'–'+fm(p.e)+'</span></div>';
    });
    var head='<div class="sg-h"><span></span>'+ORDD.map(function(d){return '<span>'+DIAS[d]+'</span>'}).join("")+'</div>';
    var out='<div class="sg" style="--schedule-hours:'+Math.max(1,n)+';--schedule-natural-height:'+(n*H)+'px"><div class="sg-scroll">'+head+'<div class="sg-b"><div class="sg-hours">'+hours+'</div><div class="sg-body" style="height:'+(n*H)+'px">'+blks+'</div></div></div></div>';
    if(loose.length)out+='<p class="sg-loose">Sin hora: '+loose.map(function(l){return esc(l.name||"Sin nombre")+" ("+DIAS[l.d]+")"}).join(", ")+'</p>';
    return out;
  }
  function stateRows(){
    return state.subjects.filter(function(x){return !x.archived&&x.days&&x.days.length}).map(function(x){
      return{name:x.name||"Sin nombre",days:x.days,blocks:x.blocks||[]};
    });
  }
  function showSched(res){
    const items = parseSchedule(res).map(subject => ({ ...subject, match: matchSubject(subject.name) }));
    if(!items.length){setSch("No encontré materias en la imagen. Prueba con otra foto.");return}
    pendingSched=items;
    openPanel('schedule', {
      title:'Horario leído', confirm:'Aplicar',
      body:'<div id="scheduleReviewEditor"></div><div id="scheduleReviewPreview"></div>'
    });
    function updatePreview(){
      $('dmsg').textContent='';
      $('scheduleReviewPreview').innerHTML=schedTable(items.map(function(i){return{name:i.match?i.match.name:i.name,isNew:!i.match,days:i.days,blocks:i.blocks}}));
    }
    scheduleReview=createScheduleReview($('scheduleReviewEditor'),items,updatePreview);
    updatePreview();
    setSch("Horario leído. Revisa y aplica.");
  }
  function applySched(){
    if(!pendingSched||!scheduleReview)return;
    const error=scheduleReview.validate();
    if(error){$('dmsg').textContent=error;return;}
    (pendingSched||[]).forEach(function(i){
      if(i.match){i.match.days=i.days;i.match.blocks=i.blocks}
      else state.subjects.push(createScheduledSubject(i));
    });
    pendingSched=null;scheduleReview=null;save();ui.anim.flip=true;render();closeDlg();setSch("Horario guardado.");
  }
  $("schfile").addEventListener("change",function(){var f=this.files&&this.files[0];this.value="";if(f)readSchedule(f)});

function setSch(t){ui.scheduleMessage=t;var el=$("schmsg");if(el)el.textContent=t}

  return { showSched, openHorList, applyEditSched, openAddSched, applyAddSched, applySched, schedTable, stateRows, requestSchedulePhoto, openAIConfig, applyAIConfig };
}
