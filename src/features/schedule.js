import { uid, esc, tm, toMin, fm } from '../core/utils.js';
import { DIAS } from '../core/constants.js';
import { AI_PROVIDERS, providerDefaults, loadAIConfig, saveAIConfig, clearAIConfig, isAIConfigured, readScheduleImage, testAIConnection, buildSchedulePrompt } from '../services/ai.js';

/** Edición manual y lectura de la foto con una API de IA configurable.
 * Si no hay conexión configurada se mantiene el SDK del entorno Claude como
 * alternativa y, si tampoco existe, se abre el formulario de conexión.
 */
export function createSchedule({ state, ui, save, render, find, limitLine, closeDlg, removeSubject }) {
  const $ = id => document.getElementById(id);
  let pendingSched = null;
  var ORDD=[1,2,3,4,5,6,0],editDraft=null,editSubId=null,addDraft=null,addReturnToList=false,aiPendingUpload=false;
  function hideQrActions(){var a=$("dqrexport"),b=$("dqrimport");if(a)a.hidden=true;if(b)b.hidden=true}
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
    hideQrActions();
    ui.dialogMode="horlist";editSubId=null;editDraft=null;$("dmsg").textContent="";
    $("dt").textContent="Editar horario";
    $("dp").textContent="Modifica el horario de cada materia o elimínala para quitarla de la lista, el horario y las faltas.";
    var subs=state.subjects.filter(function(x){return !x.archived});
    var h='<div class="hl-actions"><button class="p" data-hl-new>Agregar materia</button></div>';
    if(!subs.length)h+='<p class="m">Aún no tienes materias. Agrega la primera con su horario.</p>';
    subs.forEach(function(x){
      var on=(x.days||[]).length>0;
      h+='<div class="srow"><div><span class="fd">'+esc(x.name||"Sin nombre")+'</span>'+horSummary(x)+'</div><div class="sact"><button class="ghost" data-hl-edit="'+x.id+'">'+(on?"Modificar horario":"Agregar horario")+'</button>'+(on?'<button class="ghost" data-hl-delete="'+x.id+'">Eliminar materia</button>':'')+'</div></div>';
    });
    $("dta").hidden=true;$("dtab").hidden=false;$("dtab").innerHTML=h;
    $("dgo").hidden=true;$("dlg").hidden=false;
  }
  function openSchedEdit(sub){
    if(!sub)return;
    hideQrActions();
    editSubId=sub.id;
    editDraft={days:(sub.days||[]).slice(),blocks:(sub.blocks||[]).map(function(k){return{d:+k.d,s:k.s||"",e:k.e||""}})};
    ui.dialogMode="editsched";$("dmsg").textContent="";
    $("dt").textContent="Horario de "+(sub.name||"la materia");
    $("dp").textContent="Elige los días y las horas de clase. Al guardar se actualiza el horario.";
    $("dta").hidden=true;$("dtab").hidden=false;
    $("dgo").textContent="Guardar";$("dgo").hidden=false;$("dlg").hidden=false;
    drawEdit();
  }
  function drawEdit(){
    var h='<div class="days">';
    ORDD.forEach(function(d){h+='<button class="dchip'+(editDraft.days.indexOf(d)>=0?" on":"")+'" data-eday="'+d+'">'+DIAS[d]+'</button>'});
    h+='</div>';
    ORDD.forEach(function(d){
      if(editDraft.days.indexOf(d)<0)return;
      h+='<div class="times">';
      editDraft.blocks.forEach(function(b,i){
        if(b.d!==d)return;
        h+='<div class="trow"><span class="tl">'+DIAS[d]+'</span><input type="time" data-ei="'+i+'" data-ebk="s" value="'+esc(b.s)+'" aria-label="Hora de inicio"><span>a</span><input type="time" data-ei="'+i+'" data-ebk="e" value="'+esc(b.e)+'" aria-label="Hora de fin"></div>';
      });
      h+='</div>';
    });
    $("dtab").innerHTML=h;
  }
  function toggleEDay(d){
    var i=editDraft.days.indexOf(d);
    if(i>=0){editDraft.days.splice(i,1);editDraft.blocks=editDraft.blocks.filter(function(b){return b.d!==d})}
    else{editDraft.days.push(d);editDraft.blocks.push({d:d,s:"",e:""})}
    drawEdit();
  }
  function applyEditSched(){
    var sub=find(editSubId);if(!sub||!editDraft)return;
    var ds=editDraft.days.slice();
    sub.days=ds;
    sub.blocks=editDraft.blocks.filter(function(b){return ds.indexOf(b.d)>=0}).map(function(b){return{d:b.d,s:b.s,e:b.e}});
    save();render();openHorList();
  }
  function openAddSched(fromList){
    hideQrActions();
    addReturnToList=!!fromList;
    addDraft={name:"",days:[],blocks:[]};
    ui.dialogMode="addsched";$("dmsg").textContent="";
    $("dt").textContent="Agregar horario a mano";
    $("dp").textContent="Escribe la materia y elige los días y horas. Si ya existe una materia con ese nombre, se actualiza su horario; si no, se crea con este horario.";
    $("dta").hidden=true;$("dtab").hidden=false;
    $("dgo").textContent="Guardar horario";$("dgo").hidden=false;$("dlg").hidden=false;
    drawAddSched();
    var name=$("asName");if(name)name.focus();
  }
  function drawAddSched(){
    var h='<div class="addsched"><label>Materia<input id="asName" list="asNames" autocomplete="off" spellcheck="false" placeholder="Ej. Cálculo" value="'+esc(addDraft.name)+'"></label>';
    h+='<datalist id="asNames">'+subjectNames().map(function(n){return '<option value="'+esc(n)+'"></option>'}).join("")+'</datalist>';
    h+='<div class="days">';
    ORDD.forEach(function(d){h+='<button type="button" class="dchip'+(addDraft.days.indexOf(d)>=0?" on":"")+'" data-eday="'+d+'">'+DIAS[d]+'</button>'});
    h+='</div>';
    ORDD.forEach(function(d){
      if(addDraft.days.indexOf(d)<0)return;
      h+='<div class="times">';
      addDraft.blocks.forEach(function(b,i){
        if(b.d!==d)return;
        h+='<div class="trow"><span class="tl">'+DIAS[d]+'</span><input type="time" data-ai="'+i+'" data-abk="s" value="'+esc(b.s)+'" aria-label="Hora de inicio"><span>a</span><input type="time" data-ai="'+i+'" data-abk="e" value="'+esc(b.e)+'" aria-label="Hora de fin"></div>';
      });
      h+='</div>';
    });
    h+='<div class="addsched-actions"><button type="button" class="ghost" data-add-another>Guardar y agregar otra materia</button></div>';
    h+='</div>';
    $("dtab").innerHTML=h;
  }
  function syncAddName(){
    var el=$("asName");if(el&&addDraft)addDraft.name=el.value;
  }
  function toggleADay(d){
    if(!addDraft)return;
    syncAddName();
    var i=addDraft.days.indexOf(d);
    if(i>=0){addDraft.days.splice(i,1);addDraft.blocks=addDraft.blocks.filter(function(b){return b.d!==d})}
    else{addDraft.days.push(d);addDraft.blocks.push({d:d,s:"",e:""})}
    drawAddSched();
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
    else state.subjects.push({id:uid(),name:name,min:3,max:5,days:days,blocks:blocks,rows:[{p:"",g:"",pred:""},{p:"",g:"",pred:""},{p:"",g:"",pred:""}]});
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
    if(ui.dialogMode==="addsched"){
      if(e.target.closest("[data-add-another]")){saveAddSched(true);return}
      var ab=e.target.closest("[data-eday]");
      if(ab)toggleADay(+ab.dataset.eday);
      return;
    }
    var b=e.target.closest("[data-eday]");if(!b||ui.dialogMode!=="editsched"||!editDraft)return;
    toggleEDay(+b.dataset.eday);
  });
  $("dtab").addEventListener("change",function(e){
    var el=e.target;
    if(ui.dialogMode==="ai"&&el.id==="aiProvider"){applyAIProvider(el.value);return}
    if(el.dataset&&el.dataset.ai&&addDraft){
      var ab=addDraft.blocks[+el.dataset.ai];if(ab)ab[el.dataset.abk]=el.value;
      return;
    }
    if(!el.dataset||!el.dataset.ei||!editDraft)return;
    var blk=editDraft.blocks[+el.dataset.ei];if(blk)blk[el.dataset.ebk]=el.value;
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
    hideQrActions();
    aiPendingUpload=!!fromUpload;
    var cfg=loadAIConfig();
    ui.dialogMode="ai";$("dmsg").textContent="";
    $("dt").textContent="Conectar IA";
    $("dp").textContent="La foto del horario se lee con la API de IA que elijas. La clave queda solo en este navegador y no se incluye al exportar tus datos.";
    $("dta").hidden=true;$("dtab").hidden=false;
    $("dtab").innerHTML='<div class="dsform">'+
      '<label>Proveedor<select id="aiProvider">'+providerOptions(cfg.provider)+'</select></label>'+
      '<label>Clave de API<input type="password" id="aiKey" autocomplete="new-password" spellcheck="false" placeholder="sk-..." value="'+esc(cfg.apiKey)+'"></label>'+
      '<label>Modelo<input id="aiModel" spellcheck="false" autocapitalize="off" placeholder="Modelo con visión" value="'+esc(cfg.model)+'"></label>'+
      '<label>URL base<input id="aiBase" spellcheck="false" autocapitalize="off" placeholder="https://…/v1" value="'+esc(cfg.baseUrl)+'"></label>'+
      '<label class="dscheck"><input type="checkbox" id="aiRemember"'+(cfg.remember?' checked':'')+'> Guardar la conexión en este navegador</label>'+
      '<div class="dslinks"><span class="m">Consigue la clave en el panel de tu proveedor.</span><span class="dsacts"><button type="button" class="ghost" data-ai-test>Probar conexión</button><button type="button" class="ghost" data-ai-clear>Quitar clave</button></span></div>'+
      '<p class="m" id="aiMsg">'+(isAIConfigured()?"Conexión configurada. Puedes cambiar el proveedor, la clave o el modelo.":"Aún no hay una conexión guardada.")+'</p>'+
      '<p class="m dsnote">La imagen se envía al proveedor que elijas y cada lectura consume tokens de tu cuenta. La conexión se guarda en este navegador; si desmarcas la casilla, solo dura hasta cerrar la pestaña.</p>'+
    '</div>';
    $("dgo").textContent="Guardar";$("dgo").hidden=false;$("dlg").hidden=false;
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
    var ORD=[1,2,3,4,5,6,0],placed=[],loose=[],mn=1440,mx=0;
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
      var c=ORD.indexOf(p.d),top=(p.s-h0*60)/60*H+1,hg=Math.max(24,(p.e-p.s)/60*H-2);
      blks+='<div class="blk'+(p.isNew?" nw":"")+'" style="left:calc(100% / 7 * '+c+' + 2px);width:calc(100% / 7 - 4px);top:'+top+'px;height:'+hg+'px"><b>'+esc(p.name||"Sin nombre")+'</b><span>'+fm(p.s)+'–'+fm(p.e)+'</span></div>';
    });
    var head='<div class="sg-h"><span></span>'+ORD.map(function(d){return '<span>'+DIAS[d]+'</span>'}).join("")+'</div>';
    var out='<div class="sg"><div class="sg-scroll">'+head+'<div class="sg-b"><div class="sg-hours">'+hours+'</div><div class="sg-body" style="height:'+(n*H)+'px">'+blks+'</div></div></div></div>';
    if(loose.length)out+='<p class="sg-loose">Sin hora: '+loose.map(function(l){return esc(l.name||"Sin nombre")+" ("+DIAS[l.d]+")"}).join(", ")+'</p>';
    return out;
  }
  function stateRows(){
    return state.subjects.filter(function(x){return !x.archived&&x.days&&x.days.length}).map(function(x){
      return{name:x.name||"Sin nombre",days:x.days,blocks:x.blocks||[]};
    });
  }
  function showSched(res){
    hideQrActions();
    var items=[];
    ((res&&res.materias)||[]).forEach(function(m){
      if(!m||!m.nombre)return;
      var bl=[];(Array.isArray(m.bloques)?m.bloques:[]).forEach(function(b){var d=Number(b&&b.dia);if(b&&d>=0&&d<=6)bl.push({d:d,s:tm(b.inicio),e:tm(b.fin)})});
      var days=bl.map(function(b){return b.d}).concat(Array.isArray(m.dias)?m.dias.map(Number):[]).filter(function(d,i,a){return d>=0&&d<=6&&a.indexOf(d)===i});
      if(!days.length)return;
      var seen={};bl=bl.filter(function(b){var k=b.d+b.s+b.e;if(seen[k])return false;seen[k]=1;return true});
      items.push({name:String(m.nombre).trim(),days:days,blocks:bl,match:matchSubject(m.nombre)});
    });
    if(!items.length){setSch("No encontré materias en la imagen. Prueba con otra foto.");return}
    pendingSched=items;
    $("dmsg").textContent="";ui.dialogMode="schedule";
    $("dt").textContent="Horario leído";
    $("dp").textContent="Revisa lo que leí. Al aplicar se guardan los días y horas de cada materia; las marcadas como nueva se crearán.";
    $("dta").hidden=true;
    $("dtab").hidden=false;
    $("dtab").innerHTML=schedTable(items.map(function(i){return{name:i.match?i.match.name:i.name,isNew:!i.match,days:i.days,blocks:i.blocks}}));
    $("dgo").textContent="Aplicar";$("dlg").hidden=false;
    setSch("Horario leído. Revisa y aplica.");
  }
  function applySched(){
    (pendingSched||[]).forEach(function(i){
      if(i.match){i.match.days=i.days;i.match.blocks=i.blocks}
      else state.subjects.push({id:uid(),name:i.name,min:3,max:5,days:i.days,blocks:i.blocks,rows:[{p:"",g:"",pred:""},{p:"",g:"",pred:""},{p:"",g:"",pred:""}]});
    });
    pendingSched=null;save();ui.anim.flip=true;render();closeDlg();setSch("Horario guardado.");
  }
  $("schfile").addEventListener("change",function(){var f=this.files&&this.files[0];this.value="";if(f)readSchedule(f)});

function setSch(t){ui.scheduleMessage=t;var el=$("schmsg");if(el)el.textContent=t}

  return { openHorList, openSchedEdit, applyEditSched, openAddSched, applyAddSched, applySched, schedTable, stateRows, requestSchedulePhoto, openAIConfig, applyAIConfig };
}
