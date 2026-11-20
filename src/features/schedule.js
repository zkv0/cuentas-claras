import { createScheduleReview } from '../ui/schedule-review.js';
import { parseSchedule } from '../domain/schedule-import.js';
import { createScheduledSubject } from '../domain/subjects.js';
import { esc, tm, toMin, fm } from '../core/utils.js';
import { DIAS } from '../core/constants.js';
import { AI_PROVIDERS, providerDefaults, loadAIConfig, saveAIConfig, clearAIConfig, isAIConfigured, testAIConnection } from '../services/ai.js';

export function createSchedule({ state, ui, save, render, find, openPanel, closeDlg, removeSubject }) {
  const $ = id => document.getElementById(id);
  let pendingSched = null, scheduleReview = null;
  const ORDD = [1,2,3,4,5,6,0];
  const editDrafts = new Map();
  let addDraft = null, addReturnToList = false;

  function openHorList(reset = true){
    if (reset) editDrafts.clear();
    const subjects = state.subjects.filter(subject => !subject.archived);
    const rows = subjects.map(subject => {
      if (!editDrafts.has(subject.id)) {
        const days = [...(subject.days || [])];
        const blocks = (subject.blocks || []).map(block => ({d:+block.d,s:block.s || '',e:block.e || ''}));
        for (const day of days) {
          if (!blocks.some(block => block.d === day)) blocks.push({d:day,s:'',e:''});
        }
        editDrafts.set(subject.id, {name:subject.name || '', days, blocks, changed:false});
      }
      const draft = editDrafts.get(subject.id);
      const id = esc(subject.id);
      return '<section class="srow" data-hl-subject="'+id+'"><header><input class="schedule-subject-name" data-hl-name aria-label="Nombre de la materia" placeholder="Nombre de la materia" value="'+esc(draft.name)+'">'+
        '<button type="button" class="icon schedule-delete" data-hl-delete="'+id+'" aria-label="Eliminar materia" title="Eliminar materia">'+
        '<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v6m4-6v6"/></svg></button></header>'+
        '<div data-hl-fields>'+scheduleEditor(draft)+'</div></section>';
    }).join('');
    openPanel('horlist', {
      title:'Editar horario',
      body:'<div class="hl-actions"><button type="button" class="ghost" data-hl-new>Añadir materia</button></div>'+
        (rows || '<p class="m">Aún no tienes materias.</p>'),
      confirm:subjects.length ? 'Guardar horario' : ''
    });
  }

  function activeDraft(target){
    if (ui.dialogMode === 'addsched') return addDraft;
    if (ui.dialogMode === 'horlist') return editDrafts.get(target.closest('[data-hl-subject]')?.dataset.hlSubject);
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
      </div>` : fields;
  }
  function applyEditSched(){
    for (const draft of editDrafts.values()) {
      if (draft.nameChanged && !draft.name.trim()) {
        $('dmsg').textContent = 'Escribe el nombre de la materia.';
        return;
      }
    }
    for (const [id, draft] of editDrafts) {
      const subject = find(id);
      if (!subject) continue;
      if (draft.nameChanged) subject.name = draft.name.trim();
      if (!draft.changed) continue;
      subject.days = draft.days.slice();
      subject.blocks = draft.blocks.filter(block => draft.days.includes(block.d))
        .map(block => ({d:block.d, s:tm(block.s), e:tm(block.e)}));
    }
    save();
    render();
    closeDlg();
    setSch('Horario guardado.');
  }
  function openAddSched(fromList){
    addReturnToList=!!fromList;
    addDraft={name:"",days:[],blocks:[]};
    openPanel('addsched', {
      title:'Añadir materia',
      description:'Escribe el nombre de la materia. Puedes añadir el horario ahora o más adelante.',
      body:scheduleEditor(addDraft), confirm:'Añadir materia'
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
  }
  function applyAddSched(){
    if(!addDraft)return;
    syncAddName();
    var name=String(addDraft.name||"").trim();
    if(!name){$("dmsg").textContent="Escribe el nombre de la materia.";return}
    var days=addDraft.days.slice();
    var blocks=addDraft.blocks.filter(function(b){return days.indexOf(b.d)>=0}).map(function(b){return{d:b.d,s:tm(b.s),e:tm(b.e)}});
    var match=exactSubject(name);
    if(match && !days.length){
      $("dmsg").textContent="Ya existe una materia con ese nombre.";
      return;
    }
    if(match){match.days=days;match.blocks=blocks}
    else state.subjects.push(createScheduledSubject({name,days,blocks}));
    addDraft=null;save();ui.anim.flip=true;render();
    if(addReturnToList){
      addReturnToList=false;
      openHorList(false);
      setSch(days.length ? "Horario guardado." : "Materia añadida.");
    }else{
      closeDlg();
      setSch(days.length ? "Horario guardado." : "Materia añadida.");
    }
  }
  $("dtab").addEventListener("click",function(e){
    if(ui.dialogMode==="ai"){
      if(e.target.closest("[data-ai-test]")){testAI();return}
      if(e.target.closest("[data-ai-clear]")){clearAI();return}
      return;
    }
    if(ui.dialogMode==="horlist"){
      if(e.target.closest("[data-hl-new]")){openAddSched(true);return}
      var cb=e.target.closest("[data-hl-delete]");
      if(cb){
        var cs=find(cb.dataset.hlDelete);if(!cs)return;
        if(!cb.dataset.arm){
          const confirmation = 'Toca la papelera otra vez para eliminar la materia.';
          cb.dataset.arm = '1';
          cb.setAttribute('aria-label','Confirmar eliminación de materia');
          cb.title = 'Confirmar eliminación';
          $('dmsg').textContent = confirmation;
          setTimeout(() => {
            if (!cb.isConnected) return;
            delete cb.dataset.arm;
            cb.setAttribute('aria-label','Eliminar materia');
            cb.title = 'Eliminar materia';
            if ($('dmsg').textContent === confirmation) $('dmsg').textContent = '';
          }, 3000);
          return;
        }
        removeSubject(cs.id);
        editDrafts.delete(cs.id);
        render();openHorList(false);
        return;
      }
    }
    const draft = activeDraft(e.target);
    const day = e.target.closest("[data-eday]");
    if (!draft || !day) return;
    const fields = ui.dialogMode === 'horlist'
      ? day.closest('[data-hl-subject]').querySelector('[data-hl-fields]')
      : $('dtab');
    toggleDay(draft, Number(day.dataset.eday));
    draft.changed = true;
    fields.innerHTML = scheduleEditor(draft);
    fields.querySelector('[data-eday="'+day.dataset.eday+'"]')?.focus();
  });
  $("dtab").addEventListener("change",function(e){
    var el=e.target;
    if(ui.dialogMode==="ai"&&el.id==="aiProvider"){applyAIProvider(el.value);return}
    if (el.dataset?.block == null) return;
    const draft = activeDraft(el);
    const block = draft?.blocks[el.dataset.block];
    if (block) {
      block[el.dataset.time] = el.value;
      draft.changed = true;
    }
  });
  $("dtab").addEventListener("input",function(e){
    const field = e.target;
    if (ui.dialogMode === 'addsched' && field.id === 'asName' && addDraft) addDraft.name = field.value;
    if (ui.dialogMode === 'horlist' && field.dataset?.hlName !== undefined) {
      const draft = activeDraft(field);
      if (draft) {
        draft.name = field.value;
        draft.nameChanged = true;
        $('dmsg').textContent = '';
      }
    }
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
  function openAIConfig(){
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
    closeDlg();setSch("Conexión de IA guardada.");render();
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

function setSch(t){ui.scheduleMessage=t;var el=$("schmsg");if(el)el.textContent=t}

  return { showSched, openHorList, applyEditSched, openAddSched, applyAddSched, applySched, schedTable, stateRows, openAIConfig, applyAIConfig };
}
