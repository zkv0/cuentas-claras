// Generado por node tools/build.mjs. Edita los módulos de src/.
(() => {
"use strict";
const modules = Object.create(null);
// src/core/utils.js
modules["src/core/utils.js"] = (() => {
// Conversiones compartidas. Las fechas de asistencia se interpretan en hora local.
function uid(){return Math.random().toString(36).slice(2,9)}

function num(v){var n=parseFloat(String(v).replace(",","."));return isNaN(n)?null:n}

function f(n){return (Math.round(n*100)/100).toFixed(2)}

function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")}

function tm(x){var m=String(x||"").match(/(\d{1,2}):(\d{2})/);return m?("0"+m[1]).slice(-2)+":"+m[2]:""}

function toMin(t){var m=String(t||"").match(/^(\d{1,2}):(\d{2})$/);return m?(+m[1])*60+(+m[2]):null}

function fm(min){return ("0"+Math.floor(min/60)).slice(-2)+":"+("0"+(min%60)).slice(-2)}

return { uid, num, f, esc, tm, toMin, fm };
})();

// src/domain/grades.js
modules["src/domain/grades.js"] = (() => {
const { num, f } = modules["src/core/utils.js"];

/** Cálculo puro: porcentajes sobre 100 y notas en la escala de cada materia.
 * Una predicción fija reserva sus puntos antes de repartir la nota necesaria.
 * `need` usa pendientes definidos; `needAll` incluye porcentaje sin asignar.
 */
function isGraded(r){var p=num(r.p),g=num(r.g);return p!==null&&p>0&&g!==null}

function calc(sub){
    var earned=0,graded=0,pend=0,predPts=0,lockedPct=0;
    sub.rows.forEach(function(r){
      var p=num(r.p),g=num(r.g),q=num(r.pred);
      if(p===null||p<=0)return;
      if(g!==null){earned+=p*g/100;graded+=p}
      else{pend+=p;if(q!==null){predPts+=p*q/100;lockedPct+=p}}
    });
    var free=Math.max(0,100-graded-pend);
    var openDef=pend-lockedPct;
    var op=openDef>0.0001?openDef:free;
    var min=num(sub.min)||0,max=num(sub.max)||5;
    var need=op>0.0001?(min-earned-predPts)/(op/100):null;
    var all=openDef+free;
    var needAll=all>0.0001?(min-earned-predPts)/(all/100):null;
    return{earned:earned,graded:graded,pend:pend,free:free,open:op,openDef:openDef,needAll:needAll,predPts:predPts,remaining:pend+free,need:need,min:min,max:max,over:graded+pend>100.001};
  }

function chip(c){
    if(c.graded+c.pend===0)return{cls:"none",t:"Sin evaluaciones"};
    if(c.over)return{cls:"bad",t:"Revisa los %"};
    if(c.remaining<=0.0001)return c.earned>=c.min-0.0001?{cls:"ok",t:"Ganada: "+f(c.earned)}:{cls:"bad",t:"Perdida: "+f(c.earned)};
    if(c.need===null){var t=c.earned+c.predPts;return {cls:t>=c.min-0.0001?"ok":"bad",t:"Proyección: "+f(t)}}
    if(c.need<=0)return{cls:"ok",t:"Ya ganaste"};
    if(c.need>c.max)return{cls:"bad",t:"Imposible ("+f(c.need)+")"};
    return{cls:"",t:"Necesitas "+f(c.need)};
  }

return { isGraded, calc, chip };
})();

// src/ui/subjects-view.js
modules["src/ui/subjects-view.js"] = (() => {
const { num, f, esc } = modules["src/core/utils.js"];

const { calc, chip, isGraded } = modules["src/domain/grades.js"];

/** Construye las tarjetas y actualiza los cálculos sin interrumpir la escritura. */
function createSubjectsView({ state, ui, open, open2, find, allowed, faltHtml }) {
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

return { createSubjectsView };
})();

// src/ui/motion.js
modules["src/ui/motion.js"] = (() => {
/** Animaciones de apertura, cierre, reordenación y pulsación.
 * Respeta la preferencia del sistema de reducir movimiento.
 */
function createMotion({ ui, renderRaw }) {
  var EASE="cubic-bezier(.2,0,0,1)",reduced=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
  function pads(el){var c=getComputedStyle(el);return{pt:c.paddingTop,pb:c.paddingBottom,mb:c.marginBottom}}
  function grow(el,chev){
    if(!el||reduced)return;
    var h=el.offsetHeight,p=pads(el);el.style.overflow="hidden";
    var a=el.animate([{height:"0px",paddingTop:"0px",paddingBottom:"0px",opacity:0},{height:h+"px",paddingTop:p.pt,paddingBottom:p.pb,opacity:1}],{duration:300,easing:EASE});
    a.onfinish=a.oncancel=function(){el.style.overflow=""};
    if(chev)chev.animate([{transform:"rotate(0deg)"},{transform:"rotate(90deg)"}],{duration:250,easing:EASE});
  }
  function shrink(el,chev,cb){
    if(!el||reduced){cb();return}
    var h=el.offsetHeight,p=pads(el);el.style.overflow="hidden";
    var a=el.animate([{height:h+"px",paddingTop:p.pt,paddingBottom:p.pb,marginBottom:p.mb,opacity:1},{height:"0px",paddingTop:"0px",paddingBottom:"0px",marginBottom:"0px",opacity:0}],{duration:220,easing:EASE,fill:"forwards"});
    if(chev)chev.animate([{transform:"rotate(90deg)"},{transform:"rotate(0deg)"}],{duration:220,easing:EASE,fill:"forwards"});
    a.onfinish=cb;
  }
  function render(){
    var app=document.getElementById("app"),pos={};
    if(ui.anim.flip)app.querySelectorAll(".card").forEach(function(c){pos[c.dataset.id]=c.getBoundingClientRect().top});
    renderRaw();
    var f=ui.anim;ui.anim={};
    if(reduced)return;
    app.querySelectorAll(".card").forEach(function(c,i){
      var id=c.dataset.id;
      if(f.first)c.animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],{duration:350,delay:i*50,easing:EASE,fill:"backwards"});
      else if(f.flip){
        if(pos[id]==null)c.animate([{opacity:0,transform:"scale(.92)"},{opacity:1,transform:"none"}],{duration:300,easing:EASE});
        else{var d=pos[id]-c.getBoundingClientRect().top;if(d)c.animate([{transform:"translateY("+d+"px)"},{transform:"none"}],{duration:320,easing:EASE})}
      }
      if(f.arch&&i===0)grow(app.querySelector(".arch-list"),app.querySelector(".arch-h .chev"));
      if(f.open===id)grow(c.querySelector(".body"),c.querySelector(".chev"));
      if(f.grp===id)grow(c.querySelector(".grpbody"),c.querySelector(".grp .chev"));
      if(f.rowCard===id){var r=c.querySelector('.row[data-i="'+f.row+'"]');if(r)r.animate([{opacity:0,transform:"translateY(-8px)"},{opacity:1,transform:"none"}],{duration:280,easing:EASE})}
    });
  }
  document.addEventListener("pointerdown",function(e){
    var b=e.target.closest&&e.target.closest("button");if(!b||b.disabled||reduced)return;
    var r=b.getBoundingClientRect(),z=Math.max(r.width,r.height)*2,sp=document.createElement("span");
    sp.className="ripple";sp.style.cssText="width:"+z+"px;height:"+z+"px;left:"+(e.clientX-r.left-z/2)+"px;top:"+(e.clientY-r.top-z/2)+"px";
    b.appendChild(sp);setTimeout(function(){sp.remove()},600);
  });



  return { render, shrink };
}

return { createMotion };
})();

// src/core/constants.js
modules["src/core/constants.js"] = (() => {
// Mantener esta clave permite abrir los datos guardados por la versión monolítica.
const KEY = 'calc-notas-v2';
// Configuración de la API de IA; se guarda aparte para no incluirla al exportar.
const AI_KEY = 'calc-notas-ai';
// Clave anterior de DeepSeek; se lee para migrar la conexión existente.
const LEGACY_DS_KEY = 'calc-notas-deepseek';
// Marca de bienvenida inicial para no volver a abrir el asistente tras el primer uso.
const ONBOARD_KEY = 'calc-notas-onboarded';
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

return { KEY, AI_KEY, LEGACY_DS_KEY, ONBOARD_KEY, DIAS, MESES };
})();

// src/core/store.js
modules["src/core/store.js"] = (() => {
const { KEY } = modules["src/core/constants.js"];

const state = { subjects: [], absences: [], sem: { start: '', end: '', pct: '' }, updatedAt: 0 };
let saved = () => {};

try {
  const data = JSON.parse(localStorage.getItem(KEY));
  if (data && Array.isArray(data.subjects)) {
    Object.assign(state, data);
    state.subjects = state.subjects.filter(subject => subject && Array.isArray(subject.rows));
  }
} catch (error) {
  console.warn('No se pudieron cargar los datos locales.', error);
}
if (!Array.isArray(state.absences)) state.absences = [];
if (!state.sem || typeof state.sem !== 'object') state.sem = { start: '', end: '', pct: '' };

function onSave(callback) { saved = callback; }
function find(id) { return state.subjects.find(subject => subject.id === id); }

/** Elimina una materia de la lista y de todas las faltas que la referencian.
 * Las faltas que se quedan sin materias también se eliminan.
 */
function removeSubject(id) {
  state.subjects = state.subjects.filter(subject => subject.id !== id);
  state.absences.forEach(absence => {
    absence.ids = (Array.isArray(absence.ids) ? absence.ids : []).filter(subjectId => subjectId !== id);
  });
  state.absences = state.absences.filter(absence => absence.ids.length);
  save();
}

function save() {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('No se pudieron guardar los datos locales.', error);
    const status = document.getElementById('sync');
    if (status) {
      status.hidden = false;
      status.className = 'sync warn';
      status.textContent = 'No se pudo guardar en este dispositivo. Exporta tus datos para conservarlos.';
    }
  }
  saved();
}

return { state, onSave, find, removeSubject, save };
})();

// src/domain/attendance.js
modules["src/domain/attendance.js"] = (() => {
const { num } = modules["src/core/utils.js"];

// Cuenta días de clase, incluidos los extremos del semestre, sin descontar festivos.
function classCount(sub, semester){
    var m=semester;if(!m||!m.start||!m.end||!(sub.days||[]).length)return 0;
    var a=m.start.split("-"),b=m.end.split("-");if(a.length<3||b.length<3)return 0;
    var d=new Date(+a[0],+a[1]-1,+a[2]),e=new Date(+b[0],+b[1]-1,+b[2]),n=0,g=0;
    if(isNaN(d)||isNaN(e)||e<d)return 0;
    while(d<=e&&g++<500){if(sub.days.indexOf(d.getDay())>=0)n++;d.setDate(d.getDate()+1)}
    return n;
  }

function allowed(sub, semester){
    var p=num(semester&&semester.pct),n=classCount(sub, semester);
    if(p===null||p<0||!n)return null;
    return Math.floor(n*p/100+1e-9);
  }

return { classCount, allowed };
})();

// src/domain/subjects.js
modules["src/domain/subjects.js"] = (() => {
const { uid, tm } = modules["src/core/utils.js"];

// Crea una copia importable con identidad nueva; mantiene la estructura histórica.
function cleanSubject(x){
    var rows=Array.isArray(x.rows)?x.rows:[];
    return{id:uid(),archived:!!x.archived,days:Array.isArray(x.days)?x.days.filter(function(n){return n>=0&&n<=6}):[],blocks:Array.isArray(x.blocks)?x.blocks.filter(function(k){return k&&k.d>=0&&k.d<=6}).map(function(k){return{d:+k.d,s:tm(k.s),e:tm(k.e)}}):[],name:String(x.name==null?"":x.name),min:x.min==null?3:x.min,max:x.max==null?5:x.max,
      rows:rows.map(function(r){r=r||{};return{p:r.p==null?"":String(r.p),g:r.g==null?"":String(r.g),pred:r.pred==null?"":String(r.pred)}})};
  }

/** Reemplaza el contenido académico con una copia completa (por ejemplo, un QR).
 * Devuelve la configuración de IA incluida, o null si la copia no la trae.
 */
function applySubjectSnapshot(state, data){
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

return { cleanSubject, applySubjectSnapshot };
})();

// src/services/ai.js
modules["src/services/ai.js"] = (() => {
const { AI_KEY, LEGACY_DS_KEY } = modules["src/core/constants.js"];

/** Lectura de horarios con APIs de IA que aceptan imágenes.
 * Se soportan endpoints compatibles con OpenAI y el formato de Anthropic.
 * La clave se usa directamente desde el navegador y nunca se incluye en la
 * exportación de datos. La app sigue funcionando sin conexión de IA.
 */
const AI_MAX_IMAGE = 1800;

const AI_PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', format: 'openai', keyRequired: true },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', format: 'openai', keyRequired: true },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', format: 'openai', keyRequired: true },
  { id: 'anthropic', label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5', format: 'anthropic', keyRequired: true },
  { id: 'google', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', format: 'openai', keyRequired: true },
  { id: 'custom', label: 'Otra API compatible con OpenAI', baseUrl: '', model: '', format: 'openai', keyRequired: false },
];

let memoryConfig = null;

function providerInfo(id) {
  return AI_PROVIDERS.find(provider => provider.id === id) || AI_PROVIDERS[0];
}

function providerDefaults(id) {
  var provider = providerInfo(id);
  return {
    baseUrl: provider.baseUrl,
    model: provider.model,
    label: provider.label,
    keyRequired: provider.keyRequired,
    format: provider.format,
  };
}

function providerLabel(config) {
  var normalized = normalizeAIConfig(config);
  return providerInfo(normalized.provider).label;
}

function normalizeBase(value, fallback) {
  var base = String(value || '').trim().replace(/\/+$/, '');
  return base || fallback || '';
}

function normalizeAIConfig(raw) {
  var source = raw && typeof raw === 'object' ? raw : {};
  var provider = AI_PROVIDERS.some(item => item.id === source.provider) ? source.provider : 'deepseek';
  var preset = providerInfo(provider);
  return {
    provider: provider,
    apiKey: String(source.apiKey || '').trim(),
    baseUrl: normalizeBase(source.baseUrl, preset.baseUrl),
    model: String(source.model || '').trim() || preset.model,
    remember: source.remember !== false,
  };
}

function readConfigKey(key) {
  try {
    var local = localStorage.getItem(key);
    if (local) return JSON.parse(local);
  } catch (error) {}
  try {
    if (typeof sessionStorage !== 'undefined') {
      var session = sessionStorage.getItem(key);
      if (session) return JSON.parse(session);
    }
  } catch (error) {}
  return null;
}

function loadAIConfig() {
  if (memoryConfig) return normalizeAIConfig(memoryConfig);
  var raw = readConfigKey(AI_KEY);
  if (!raw) raw = readConfigKey(LEGACY_DS_KEY);
  if (raw && !raw.provider) raw = Object.assign({}, raw, { provider: 'deepseek' });
  return normalizeAIConfig(raw);
}

function saveAIConfig(raw) {
  var config = normalizeAIConfig(raw);
  memoryConfig = config;
  var usable = Boolean(config.baseUrl && config.model);
  try {
    if (usable && config.remember) {
      localStorage.setItem(AI_KEY, JSON.stringify(config));
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(AI_KEY);
    } else if (usable) {
      localStorage.removeItem(AI_KEY);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(AI_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(AI_KEY);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(AI_KEY);
    }
    localStorage.removeItem(LEGACY_DS_KEY);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(LEGACY_DS_KEY);
  } catch (error) {}
  return config;
}

function clearAIConfig() {
  memoryConfig = null;
  try {
    localStorage.removeItem(AI_KEY);
    localStorage.removeItem(LEGACY_DS_KEY);
  } catch (error) {}
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(AI_KEY);
      sessionStorage.removeItem(LEGACY_DS_KEY);
    }
  } catch (error) {}
}

function isAIConfigured(config) {
  var normalized = config ? normalizeAIConfig(config) : loadAIConfig();
  var info = providerInfo(normalized.provider);
  if (!normalized.baseUrl || !normalized.model) return false;
  return Boolean(normalized.apiKey || !info.keyRequired);
}

function buildSchedulePrompt(names) {
  var known = Array.isArray(names) ? names : [];
  return 'La imagen es el horario semanal de clases de un estudiante. Extrae cada materia y los días de la semana en que tiene clase; junta todos los bloques de una misma materia en un solo elemento. Responde solo con JSON válido, sin texto adicional, con esta forma: {"materias":[{"nombre":"...","bloques":[{"dia":1,"inicio":"07:00","fin":"09:00"}]}]}. En "dia" usa números: 1 lunes, 2 martes, 3 miércoles, 4 jueves, 5 viernes, 6 sábado, 0 domingo. Pon un bloque por cada clase. Las horas suelen estar en los encabezados de las filas o columnas de la tabla (por ejemplo 7:00 - 8:00): lee ahí la hora de inicio y la de fin de cada clase, uniendo franjas consecutivas de la misma materia, y escríbelas en formato 24 h (14:00 para las 2 pm). Usa null solo si de verdad no aparece ninguna hora. Si una materia coincide con una de estas que el estudiante ya tiene, usa exactamente ese nombre: ' + JSON.stringify(known) + '. Si la imagen no es un horario, responde {"materias":[]}.';
}

function splitDataUrl(value) {
  var match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/i.exec(String(value || ''));
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function buildScheduleRequest(config, imageUrl, prompt) {
  var normalized = normalizeAIConfig(config);
  var info = providerInfo(normalized.provider);
  var text = String(prompt || buildSchedulePrompt([]));
  if (info.format === 'anthropic') {
    var source = splitDataUrl(imageUrl);
    var image = source
      ? { type: 'image', source: { type: 'base64', media_type: source.mediaType, data: source.data } }
      : { type: 'image', source: { type: 'url', url: String(imageUrl || '') } };
    return {
      model: normalized.model,
      max_tokens: 3000,
      messages: [{ role: 'user', content: [{ type: 'text', text: text }, image] }],
    };
  }
  var body = {
    model: normalized.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: text },
        { type: 'image_url', image_url: { url: String(imageUrl || ''), detail: 'high' } },
      ],
    }],
    max_tokens: 3000,
    stream: false,
  };
  if (normalized.provider === 'deepseek') {
    body.thinking = { type: 'disabled' };
    body.temperature = 0;
  }
  if (normalized.provider === 'deepseek' || normalized.provider === 'openai' || normalized.provider === 'openrouter') {
    body.response_format = { type: 'json_object' };
  }
  return body;
}

function extractJson(text) {
  var value = String(text == null ? '' : text).trim();
  if (!value) return null;
  value = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(value);
  } catch (error) {}
  var first = value.indexOf('{');
  var last = value.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(value.slice(first, last + 1));
    } catch (error) {}
  }
  return null;
}

function userError(message) {
  var error = new Error(message);
  error.userMessage = true;
  return error;
}

function apiError(status, data, label) {
  var detail = String((data && data.error && data.error.message) || '').trim();
  var message;
  if (status === 401 || status === 403) message = 'La clave de API de ' + label + ' no es válida o no tiene permisos.';
  else if (status === 402) message = 'La cuenta de ' + label + ' no tiene saldo suficiente.';
  else if (status === 404) message = 'No encontré el endpoint de ' + label + ' en esa URL base. Revisa la dirección.';
  else if (status === 429) message = label + ' está recibiendo demasiadas solicitudes. Espera un momento.';
  else if (status >= 500) message = label + ' no está disponible ahora. Intenta de nuevo.';
  else if (status === 400) message = label + ' rechazó la solicitud' + (detail ? ': ' + detail : '.') + ' Revisa que el modelo acepte imágenes y que la URL base sea correcta.';
  else message = label + ' respondió con un error' + (detail ? ': ' + detail : '.');
  var error = new Error(message);
  error.status = status;
  error.detail = detail;
  error.userMessage = true;
  return error;
}

async function requestJson(url, options, timeout, label) {
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = setTimeout(function () {
    if (controller) controller.abort();
  }, timeout || 90000);
  try {
    var settings = Object.assign({}, options);
    if (controller) settings.signal = controller.signal;
    var response = await fetch(url, settings);
    var text = await response.text();
    var data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {}
    if (!response.ok) {
      throw apiError(response.status, data || { error: { message: text.slice(0, 300) } }, label);
    }
    if (!data) throw userError(label + ' devolvió una respuesta vacía que no pude leer.');
    return data;
  } catch (error) {
    if (error && error.name === 'AbortError') throw userError(label + ' tardó demasiado en responder. Intenta de nuevo.');
    if (error && (error.status || error.userMessage)) throw error;
    throw userError('No pude conectar con ' + label + '. Revisa tu conexión, la URL base y que el proveedor permita CORS desde esta página.');
  } finally {
    clearTimeout(timer);
  }
}

function contentText(content) {
  if (Array.isArray(content)) {
    return content.map(function (part) {
      if (typeof part === 'string') return part;
      return part && typeof part.text === 'string' ? part.text : '';
    }).join('');
  }
  return content == null ? '' : String(content);
}

function responseContent(data, info) {
  if (info.format === 'anthropic') return contentText(data && data.content);
  var choice = data && data.choices && data.choices[0];
  return contentText(choice && choice.message && choice.message.content);
}

function cleanBase(value) {
  return String(value || '').trim().replace(/\/+$/, '').replace(/\/(chat\/completions|messages|models)$/, '');
}

function openAIEndpoint(base, path) {
  return cleanBase(base) + path;
}

function anthropicEndpoint(base, path) {
  var clean = cleanBase(base);
  return /\/v1$/.test(clean) ? clean + path : clean + '/v1' + path;
}

function chatEndpoint(config, info) {
  return info.format === 'anthropic'
    ? anthropicEndpoint(config.baseUrl, '/messages')
    : openAIEndpoint(config.baseUrl, '/chat/completions');
}

function modelsEndpoint(config, info) {
  return info.format === 'anthropic'
    ? anthropicEndpoint(config.baseUrl, '/models')
    : openAIEndpoint(config.baseUrl, '/models');
}

function requestHeaders(config, info, hasBody) {
  var headers = {};
  if (info.format === 'anthropic') {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  } else if (config.apiKey) {
    headers.Authorization = 'Bearer ' + config.apiKey;
  }
  if (hasBody) headers['Content-Type'] = 'application/json';
  return headers;
}

function validateConfig(config) {
  var normalized = normalizeAIConfig(config);
  var info = providerInfo(normalized.provider);
  if (!normalized.baseUrl || !normalized.model) {
    throw userError('Configura el proveedor, la URL base y el modelo de IA.');
  }
  if (info.keyRequired && !normalized.apiKey) {
    throw userError('Escribe la clave de API de ' + info.label + '.');
  }
  return { config: normalized, info: info };
}

function fileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result || ''));
    };
    reader.onerror = function () {
      reject(new Error('No pude leer la imagen.'));
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise(function (resolve, reject) {
    var image = new Image();
    image.onload = function () {
      resolve(image);
    };
    image.onerror = function () {
      reject(new Error('La imagen no se pudo abrir.'));
    };
    image.src = source;
  });
}

const prepareImage = async function (file) {
  if (!file) throw new Error('No elegiste ninguna imagen.');
  var raw = await fileToDataUrl(file);
  if (!/^data:image\//i.test(raw)) throw new Error('El archivo no es una imagen compatible.');
  var image;
  try {
    image = await loadImage(raw);
  } catch (error) {
    throw new Error('No pude abrir la imagen. Usa una foto JPG, PNG o WebP.');
  }
  var width = image.naturalWidth || image.width;
  var height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error('La imagen no tiene un tamaño válido.');
  var scale = Math.min(1, AI_MAX_IMAGE / Math.max(width, height));
  if (scale === 1 && raw.length <= 2 * 1024 * 1024) return raw;
  var canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  var context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador no pudo preparar la imagen.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
};

const readScheduleImage = async function (image, config, prompt) {
  var checked = validateConfig(config);
  var normalized = checked.config;
  var info = checked.info;
  var imageUrl = typeof image === 'string' && /^data:image\//i.test(image)
    ? image
    : await prepareImage(image);
  var body = buildScheduleRequest(normalized, imageUrl, prompt);
  var url = chatEndpoint(normalized, info);
  var options = {
    method: 'POST',
    headers: requestHeaders(normalized, info, true),
    body: JSON.stringify(body),
  };
  var data;
  try {
    data = await requestJson(url, options, 90000, info.label);
  } catch (error) {
    var jsonModeError = error && error.status === 400 && body.response_format &&
      /response_format|json/i.test((error.detail || '') + ' ' + (error.message || ''));
    if (!jsonModeError) throw error;
    var retryBody = Object.assign({}, body);
    delete retryBody.response_format;
    data = await requestJson(url, {
      method: 'POST',
      headers: requestHeaders(normalized, info, true),
      body: JSON.stringify(retryBody),
    }, 90000, info.label);
  }
  var content = responseContent(data, info);
  if (!content.trim()) {
    data = await requestJson(url, options, 90000, info.label);
    content = responseContent(data, info);
  }
  var parsed = extractJson(content);
  if (!parsed || !Array.isArray(parsed.materias)) {
    throw userError(info.label + ' respondió, pero no pude interpretar el horario. Prueba con una foto más clara.');
  }
  return parsed;
};

const testAIConnection = async function (config) {
  var checked = validateConfig(config);
  var normalized = checked.config;
  var info = checked.info;
  var url = modelsEndpoint(normalized, info);
  try {
    var data = await requestJson(url, {
      method: 'GET',
      headers: requestHeaders(normalized, info, false),
    }, 20000, info.label);
    var list = Array.isArray(data && data.data) ? data.data : [];
    return list.map(function (model) {
      return model && model.id;
    }).filter(Boolean);
  } catch (error) {
    if (error && error.status === 404) return [];
    throw error;
  }
};

return { AI_MAX_IMAGE, AI_PROVIDERS, providerDefaults, providerLabel, normalizeAIConfig, loadAIConfig, saveAIConfig, clearAIConfig, isAIConfigured, buildSchedulePrompt, buildScheduleRequest, extractJson, prepareImage, readScheduleImage, testAIConnection };
})();

// src/features/schedule.js
modules["src/features/schedule.js"] = (() => {
const { uid, esc, tm, toMin, fm } = modules["src/core/utils.js"];

const { DIAS } = modules["src/core/constants.js"];

const { AI_PROVIDERS, providerDefaults, loadAIConfig, saveAIConfig, clearAIConfig, isAIConfigured, readScheduleImage, testAIConnection, buildSchedulePrompt } = modules["src/services/ai.js"];

/** Edición manual y lectura de la foto con una API de IA configurable.
 * Si no hay conexión configurada se mantiene el SDK del entorno Claude como
 * alternativa y, si tampoco existe, se abre el formulario de conexión.
 */
function createSchedule({ state, ui, save, render, find, limitLine, closeDlg, removeSubject }) {
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

return { createSchedule };
})();

// src/features/onboarding.js
modules["src/features/onboarding.js"] = (() => {
const { uid, esc, tm } = modules["src/core/utils.js"];

const { DIAS, ONBOARD_KEY } = modules["src/core/constants.js"];

const { providerDefaults, loadAIConfig, saveAIConfig, testAIConnection, isAIConfigured, buildSchedulePrompt, readScheduleImage } = modules["src/services/ai.js"];

/** Asistente de bienvenida en el primer ingreso: permite subir la foto del horario
 * y configurar una API de IA para entrar a la página con todas las materias ya creadas.
 */
function createOnboarding({ state, ui, save, render, schedTable, openAddSched }) {
  const $ = id => document.getElementById(id);
  let selectedFile = null;
  let pendingSubjects = null;

  function parseSubjects(res) {
    const items = [];
    const materias = (res && Array.isArray(res.materias)) ? res.materias : [];
    materias.forEach(function (m) {
      if (!m || !m.nombre) return;
      const bl = [];
      (Array.isArray(m.bloques) ? m.bloques : []).forEach(function (b) {
        const d = Number(b && b.dia);
        if (b && d >= 0 && d <= 6) bl.push({ d: d, s: tm(b.inicio), e: tm(b.fin) });
      });
      const days = bl.map(function (b) { return b.d; })
        .concat(Array.isArray(m.dias) ? m.dias.map(Number) : [])
        .filter(function (d, i, a) { return d >= 0 && d <= 6 && a.indexOf(d) === i; });
      if (!days.length) return;
      const seen = {};
      const uniqueBl = bl.filter(function (b) {
        const k = b.d + '_' + b.s + '_' + b.e;
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      });
      items.push({ name: String(m.nombre).trim(), days: days, blocks: uniqueBl });
    });
    return items;
  }

  function setStatusMsg(text, type) {
    const el = $('obStatusMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'm' + (type ? ' ' + type : '');
  }

  function setAiMsg(text, type) {
    const el = $('obAiMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'm' + (type ? ' ' + type : '');
  }

  function getAIFormConfig() {
    const provider = $('obAiProvider');
    const key = $('obAiKey');
    const model = $('obAiModel');
    const base = $('obAiBase');
    const remember = $('obAiRemember');
    return {
      provider: provider ? provider.value : 'deepseek',
      apiKey: key ? key.value.trim() : '',
      model: model ? model.value.trim() : '',
      baseUrl: base ? base.value.trim() : '',
      remember: remember ? !!remember.checked : true,
    };
  }

  function applyProvider(id) {
    const defaults = providerDefaults(id);
    const base = $('obAiBase');
    const model = $('obAiModel');
    if (id === 'custom') {
      if (base) base.value = '';
      if (model) model.value = '';
      return;
    }
    if (base && defaults.baseUrl) base.value = defaults.baseUrl;
    if (model && defaults.model) model.value = defaults.model;
  }

  function resetFileSelection() {
    selectedFile = null;
    const fileInput = $('obFile');
    if (fileInput) fileInput.value = '';
    const emptyView = $('obDropEmpty');
    const filledView = $('obDropFilled');
    if (emptyView) emptyView.hidden = false;
    if (filledView) filledView.hidden = true;
    const thumb = $('obThumb');
    if (thumb) thumb.src = '';
    const fileName = $('obFileName');
    if (fileName) fileName.textContent = '';
  }

  function handleFile(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      setStatusMsg('Por favor selecciona un archivo de imagen compatible (JPG, PNG o WebP).', 'warn');
      return;
    }
    selectedFile = file;
    const emptyView = $('obDropEmpty');
    const filledView = $('obDropFilled');
    const fileName = $('obFileName');
    const thumb = $('obThumb');

    if (fileName) fileName.textContent = file.name || 'foto_horario.jpg';
    if (emptyView) emptyView.hidden = true;
    if (filledView) filledView.hidden = false;

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = function () {
        if (thumb) thumb.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    }
    setStatusMsg('');
  }

  function openOnboarding() {
    const dlg = $('onboardDlg');
    if (!dlg) return;
    pendingSubjects = null;
    resetFileSelection();
    setStatusMsg('');

    const cfg = loadAIConfig();
    const providerEl = $('obAiProvider');
    const keyEl = $('obAiKey');
    const modelEl = $('obAiModel');
    const baseEl = $('obAiBase');
    const rememberEl = $('obAiRemember');
    if (providerEl) providerEl.value = cfg.provider || 'deepseek';
    if (keyEl) keyEl.value = cfg.apiKey || '';
    const defaults = providerDefaults(cfg.provider);
    if (modelEl) modelEl.value = cfg.model || defaults.model || '';
    if (baseEl) baseEl.value = cfg.baseUrl || defaults.baseUrl || '';
    if (rememberEl) rememberEl.checked = cfg.remember !== false;

    if (isAIConfigured(cfg)) {
      setAiMsg('Conexión configurada. Lista para procesar.', 'ok');
    } else {
      setAiMsg('Configura el proveedor y la clave para procesar el horario.', '');
    }

    const setup = $('obSetup');
    const review = $('obReview');
    if (setup) setup.hidden = false;
    if (review) review.hidden = true;

    dlg.hidden = false;
  }

  function closeOnboarding() {
    const dlg = $('onboardDlg');
    if (dlg) dlg.hidden = true;
    try {
      localStorage.setItem(ONBOARD_KEY, '1');
    } catch (e) {}
  }

  function initOnboarding() {
    let onboarded = false;
    try {
      onboarded = Boolean(localStorage.getItem(ONBOARD_KEY));
    } catch (e) {}
    if (!onboarded && state.subjects.length === 0) {
      openOnboarding();
    }
  }

  // Cableado de eventos
  const dropzone = $('obDropzone');
  const fileInput = $('obFile');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', function (e) {
      if (e.target.closest('#obChangePhoto')) {
        fileInput.click();
        return;
      }
      fileInput.click();
    });
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handleFile(files[0]);
    });
    fileInput.addEventListener('change', function () {
      const files = this.files;
      if (files && files.length) handleFile(files[0]);
    });
  }

  const changePhotoBtn = $('obChangePhoto');
  if (changePhotoBtn && fileInput) {
    changePhotoBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      fileInput.click();
    });
  }

  const providerEl = $('obAiProvider');
  if (providerEl) {
    providerEl.addEventListener('change', function () {
      applyProvider(providerEl.value);
    });
  }

  const aiTestBtn = $('obAiTest');
  if (aiTestBtn) {
    aiTestBtn.addEventListener('click', function () {
      const cfg = getAIFormConfig();
      if (!isAIConfigured(cfg)) {
        setAiMsg('Completa la clave, el modelo y la URL base para probar la conexión.', 'warn');
        return;
      }
      setAiMsg('Comprobando conexión…');
      testAIConnection(cfg).then(function (models) {
        setAiMsg(models.length
          ? 'Conexión correcta. Modelos disponibles: ' + models.slice(0, 4).join(', ') + '.'
          : 'No se pudo listar modelos. Guarda la configuración y prueba a leer una foto.',
          models.length ? 'ok' : 'warn');
      }).catch(function (err) {
        setAiMsg((err && err.message) || 'No pude conectar con la API de IA.', 'warn');
      });
    });
  }

  const submitBtn = $('obSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', async function () {
      if (!selectedFile) {
        setStatusMsg('Por favor selecciona o arrastra la foto de tu horario.', 'warn');
        return;
      }
      const cfg = getAIFormConfig();
      if (!isAIConfigured(cfg)) {
        const info = providerDefaults(cfg.provider);
        setStatusMsg(info.keyRequired && !cfg.apiKey
          ? 'Por favor ingresa tu clave de API a la derecha.'
          : 'Completa el proveedor, el modelo y la URL base.', 'warn');
        const keyEl = $('obAiKey');
        if (keyEl) keyEl.focus();
        return;
      }
      saveAIConfig(cfg);

      submitBtn.disabled = true;
      setStatusMsg('Leyendo tu horario con IA… Esto puede tardar unos segundos.', 'loading');

      try {
        const res = await readScheduleImage(selectedFile, cfg, buildSchedulePrompt([]));
        const items = parseSubjects(res);
        if (!items.length) {
          submitBtn.disabled = false;
          setStatusMsg('La IA respondió pero no detectó materias en la imagen. Prueba con una foto más nítida.', 'warn');
          return;
        }

        pendingSubjects = items;
        submitBtn.disabled = false;
        setStatusMsg('');

        // Mostrar pantalla de revisión
        const setup = $('obSetup');
        const review = $('obReview');
        if (setup) setup.hidden = true;
        if (review) review.hidden = false;

        const countEl = $('obReviewCount');
        if (countEl) {
          countEl.textContent = 'Encontramos ' + items.length + (items.length === 1 ? ' materia' : ' materias') + ' en tu horario. Revisa cómo quedaron organizadas:';
        }

        const tableEl = $('obReviewTable');
        if (tableEl && schedTable) {
          tableEl.innerHTML = schedTable(items.map(function (it) {
            return { name: it.name, days: it.days, blocks: it.blocks, isNew: true };
          }));
        }

        const listEl = $('obReviewList');
        if (listEl) {
          let listHtml = '';
          items.forEach(function (it) {
            const daysTxt = it.days.map(function (d) { return DIAS[d]; }).join(', ');
            const timesTxt = (it.blocks || []).map(function (b) {
              return (b.s && b.e) ? b.s + ' – ' + b.e : '';
            }).filter(Boolean).join(', ');
            listHtml += '<div class="onboard-sub-item"><span class="onboard-sub-name">' +
              esc(it.name) + '</span><span class="onboard-sub-sched">' +
              esc(daysTxt + (timesTxt ? ' · ' + timesTxt : '')) + '</span></div>';
          });
          listEl.innerHTML = listHtml;
        }
      } catch (err) {
        submitBtn.disabled = false;
        setStatusMsg((err && err.message) || 'Ocurrió un error al leer el horario.', 'warn');
      }
    });
  }

  const confirmBtn = $('obConfirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      if (pendingSubjects && pendingSubjects.length) {
        pendingSubjects.forEach(function (it) {
          state.subjects.push({
            id: uid(),
            name: it.name,
            min: 3,
            max: 5,
            days: it.days,
            blocks: it.blocks,
            rows: [
              { p: '', g: '', pred: '' },
              { p: '', g: '', pred: '' },
              { p: '', g: '', pred: '' },
            ],
          });
        });
        save();
      }
      closeOnboarding();
      ui.anim.flip = true;
      render();
    });
  }

  const backBtn = $('obBack');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      const setup = $('obSetup');
      const review = $('obReview');
      if (setup) setup.hidden = false;
      if (review) review.hidden = true;
    });
  }

  const skipBtn = $('obSkip');
  if (skipBtn) {
    skipBtn.addEventListener('click', function () {
      closeOnboarding();
      if (typeof openAddSched === 'function') openAddSched();
    });
  }

  const dlg = $('onboardDlg');
  if (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) closeOnboarding();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const onboardDlg = $('onboardDlg');
      if (onboardDlg && !onboardDlg.hidden) closeOnboarding();
    }
  });

  return { initOnboarding, openOnboarding, closeOnboarding, parseSubjects };
}

return { createOnboarding };
})();

// src/services/qr.js
modules["src/services/qr.js"] = (() => {
/** Paquetes QR para transferir la copia completa sin backend.
 * Cada código lleva una parte del texto comprimido y un índice; el receptor
 * junta todas las partes antes de restaurar.
 */
const QR_CHUNK_SIZE = 600;
const QR_PREFIX = 'CCQR1';

function makeQrId() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var id = '';
  for (var i = 0; i < 8; i += 1) {
    id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return id;
}

function splitQrPayload(payload, size) {
  var text = String(payload || '');
  var chunkSize = Math.max(100, Number(size) || QR_CHUNK_SIZE);
  var chunks = [];
  for (var i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function formatQrPart(id, index, total, chunk) {
  return QR_PREFIX + '|' + id + '|' + index + '|' + total + '|' + chunk;
}

function parseQrPart(value) {
  var text = String(value == null ? '' : value).trim();
  var match = /^CCQR1\|([A-Z0-9]{4,16})\|(\d{1,3})\|(\d{1,3})\|([\s\S]+)$/.exec(text);
  if (!match) return null;
  var index = Number(match[2]);
  var total = Number(match[3]);
  if (!index || !total || index > total || total > 200) return null;
  return { id: match[1], index: index, total: total, chunk: match[4] };
}

function joinQrParts(parts) {
  if (!Array.isArray(parts) || !parts.length) return null;
  var id = parts[0].id;
  var total = parts[0].total;
  var chunks = {};
  parts.forEach(function (part) {
    if (!part || part.id !== id || part.total !== total) return;
    chunks[part.index] = part.chunk;
  });
  var joined = '';
  for (var i = 1; i <= total; i += 1) {
    if (typeof chunks[i] !== 'string') return null;
    joined += chunks[i];
  }
  return joined;
}

return { QR_CHUNK_SIZE, QR_PREFIX, makeQrId, splitQrPayload, formatQrPart, parseQrPart, joinQrParts };
})();

// src/features/qr-transfer.js
modules["src/features/qr-transfer.js"] = (() => {
const { esc } = modules["src/core/utils.js"];

const { loadAIConfig, isAIConfigured, providerDefaults } = modules["src/services/ai.js"];

const { makeQrId, splitQrPayload, formatQrPart, parseQrPart, joinQrParts, QR_CHUNK_SIZE } = modules["src/services/qr.js"];

/** Exportación e importación por QR, sin backend.
 * El QR contiene una copia completa (incluida la configuración de IA) y se
 * parte en varios códigos cuando no cabe en uno solo.
 */
function createQrTransfer({ state, ui, restoreSnapshot }) {
  const $ = id => document.getElementById(id);
  let exportParts = [];
  let exportIndex = 0;
  let pendingSnapshot = null;
  let scanSession = null;
  let scanning = false;
  let stream = null;
  let scanTimer = null;
  let detector = null;
  let detectorFails = 0;
  let scanCanvas = null;
  let scanVideo = null;

  function setMsg(id, text, type) {
    var el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'm' + (type ? ' ' + type : '');
  }

  function utf8ToBase64(value) {
    var bytes = new TextEncoder().encode(String(value));
    var binary = '';
    bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToUtf8(value) {
    var binary = atob(String(value));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeSnapshot(snapshot) {
    var json = JSON.stringify(snapshot);
    if (typeof LZString !== 'undefined' && LZString && LZString.compressToBase64) {
      return 'LZ1:' + LZString.compressToBase64(json);
    }
    return 'B64:' + utf8ToBase64(json);
  }

  function decodePayload(payload) {
    var text = String(payload || '');
    if (text.indexOf('LZ1:') === 0) {
      if (typeof LZString === 'undefined' || !LZString || !LZString.decompressFromBase64) {
        throw new Error('Este navegador no pudo descomprimir el QR.');
      }
      var json = LZString.decompressFromBase64(text.slice(4));
      if (!json) throw new Error('El QR está incompleto o dañado.');
      return json;
    }
    if (text.indexOf('B64:') === 0) {
      return base64ToUtf8(text.slice(4));
    }
    throw new Error('El QR no tiene un formato reconocido.');
  }

  function snapshot() {
    var ai = loadAIConfig();
    return {
      app: 'cuentas-claras',
      version: 2,
      exportedAt: new Date().toISOString(),
      subjects: state.subjects,
      absences: state.absences,
      sem: state.sem,
      ai: isAIConfigured(ai) ? ai : null,
    };
  }

  function drawExportQr() {
    var part = exportParts[exportIndex];
    var svg;
    try {
      var qr = qrcode(0, 'M');
      qr.addData(part);
      qr.make();
      svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    } catch (error) {
      $('dtab').innerHTML = '<p class="m warn">No pude generar el QR. Usa la exportación de texto.</p>';
      return;
    }
    var total = exportParts.length;
    var html = '<div class="qrview"><div class="qrimg">' + svg + '</div>';
    if (total > 1) {
      html += '<div class="qrnav">' +
        '<button type="button" class="ghost" data-qr-prev' + (exportIndex === 0 ? ' disabled' : '') + '>‹</button>' +
        '<span class="qrcount">Código ' + (exportIndex + 1) + ' de ' + total + '</span>' +
        '<button type="button" class="ghost" data-qr-next' + (exportIndex === total - 1 ? ' disabled' : '') + '>›</button>' +
        '</div><p class="m" style="text-align:center">Escanea este código y luego pasa al siguiente.</p>';
    } else {
      html += '<p class="m" style="text-align:center">Un solo código contiene toda la información.</p>';
    }
    html += '<p class="m qrwarn">Puede incluir tu configuración y tu clave de API. No compartas este QR.</p></div>';
    $('dtab').innerHTML = html;
  }

  function openExportQr() {
    try {
      if (typeof qrcode !== 'function') throw new Error('No se cargó el generador de QR. Usa la exportación de texto.');
      var payload = encodeSnapshot(snapshot());
      var chunks = splitQrPayload(payload, QR_CHUNK_SIZE);
      if (!chunks.length) throw new Error('No hay datos para exportar.');
      if (chunks.length > 99) throw new Error('Hay demasiados datos para el QR. Usa la exportación de texto.');
      var id = makeQrId();
      exportParts = chunks.map(function (chunk, index) {
        return formatQrPart(id, index + 1, chunks.length, chunk);
      });
      exportIndex = 0;
      ui.dialogMode = 'exportqr';
      $('dt').textContent = 'Exportar por QR';
      $('dp').textContent = 'Escanea los códigos desde el otro dispositivo. La copia incluye materias, faltas, semestre y conexión de IA.';
      $('dta').hidden = true;
      $('dtab').hidden = false;
      $('dgo').hidden = true;
      $('dqrexport').hidden = true;
      $('dqrimport').hidden = true;
      $('dmsg').textContent = '';
      $('dlg').hidden = false;
      drawExportQr();
    } catch (error) {
      setMsg('dmsg', (error && error.message) || 'No pude crear el QR.', 'warn');
    }
  }

  function openImportQr() {
    scanSession = null;
    $('qrScanDlg').hidden = false;
    setMsg('qrScanMsg', 'Iniciando cámara…');
    startCamera();
  }

  function setScanMsg(text, type) {
    setMsg('qrScanMsg', text, type);
  }

  function cameraError(error) {
    var name = error && error.name;
    if (name === 'NotAllowedError') return 'No diste permiso para usar la cámara.';
    if (name === 'NotFoundError') return 'No encontré una cámara disponible.';
    if (name === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación.';
    return 'No pude abrir la cámara. La cámara requiere HTTPS o localhost y un navegador compatible.';
  }

  function stopScanner(hide) {
    scanning = false;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = null;
    if (stream) {
      stream.getTracks().forEach(function (track) { track.stop(); });
      stream = null;
    }
    if (scanVideo) scanVideo.srcObject = null;
    detector = null;
    if (hide) $('qrScanDlg').hidden = true;
  }

  function scheduleFrame() {
    if (!scanning) return;
    scanTimer = setTimeout(scanFrame, 250);
  }

  function scanFrame() {
    if (!scanning || !scanVideo) return;
    if (detector) {
      try {
        detector.detect(scanVideo).then(function (codes) {
          if (scanning && codes && codes.length && codes[0].rawValue) handleQrText(codes[0].rawValue);
        }, function () {
          detectorFails += 1;
          if (detectorFails > 5 && typeof jsQR === 'function') detector = null;
        }).then(scheduleFrame);
      } catch (error) {
        detector = null;
        scheduleFrame();
      }
      return;
    }
    if (typeof jsQR !== 'function' || scanVideo.readyState < 2 || !scanVideo.videoWidth) {
      scheduleFrame();
      return;
    }
    try {
      var width = Math.min(640, scanVideo.videoWidth);
      var height = Math.round(scanVideo.videoHeight * (width / scanVideo.videoWidth));
      if (!scanCanvas) scanCanvas = document.createElement('canvas');
      scanCanvas.width = width;
      scanCanvas.height = height;
      var context = scanCanvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(scanVideo, 0, 0, width, height);
      var image = context.getImageData(0, 0, width, height);
      var code = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) handleQrText(code.data);
    } catch (error) {}
    scheduleFrame();
  }

  function startCamera() {
    scanVideo = $('qrVideo');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanMsg('Este navegador no permite abrir la cámara. Prueba desde HTTPS o localhost.', 'warn');
      return;
    }
    stopScanner(false);
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    }).then(function (mediaStream) {
      stream = mediaStream;
      scanVideo.srcObject = mediaStream;
      scanVideo.muted = true;
      scanVideo.setAttribute('playsinline', '');
      return scanVideo.play().catch(function () {});
    }).then(function () {
      detector = null;
      detectorFails = 0;
      if (typeof BarcodeDetector !== 'undefined') {
        try {
          detector = new BarcodeDetector({ formats: ['qr_code'] });
        } catch (error) {
          detector = null;
        }
      }
      if (!detector && typeof jsQR !== 'function') {
        stopScanner(false);
        setScanMsg('Este navegador no puede leer QR. Prueba con Chrome, Edge o Safari actualizado.', 'warn');
        return;
      }
      scanning = true;
      setScanMsg('Apunta la cámara al código QR.');
      scanFrame();
    }).catch(function (error) {
      stopScanner(false);
      setScanMsg(cameraError(error), 'warn');
    });
  }

  function handleQrText(text) {
    var part = parseQrPart(text);
    if (!part) {
      setScanMsg('Ese código no es una copia de Cuentas Claras.', 'warn');
      return;
    }
    if (!scanSession || scanSession.id !== part.id || scanSession.total !== part.total) {
      scanSession = { id: part.id, total: part.total, parts: {} };
    }
    scanSession.parts[part.index] = part;
    var received = Object.keys(scanSession.parts).length;
    if (received < part.total) {
      setScanMsg('Recibido ' + received + ' de ' + part.total + ' códigos. Escanea los que faltan.');
      return;
    }
    var payload = joinQrParts(Object.keys(scanSession.parts).map(function (index) {
      return scanSession.parts[index];
    }));
    if (!payload) {
      setScanMsg('Faltan partes del QR. Vuelve a escanear los códigos.', 'warn');
      return;
    }
    try {
      var data = JSON.parse(decodePayload(payload));
      if (!data || !Array.isArray(data.subjects)) throw new Error('El QR no contiene materias válidas.');
      stopScanner(true);
      scanSession = null;
      showReview(data);
    } catch (error) {
      scanSession = null;
      setScanMsg((error && error.message) || 'No pude leer los datos del QR.', 'warn');
    }
  }

  function decodeImageFile(file) {
    setScanMsg('Leyendo la imagen…');
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          var scale = Math.min(1, 1000 / Math.max(image.width, image.height));
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          var context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          function finish(text) {
            if (text) handleQrText(text);
            else setScanMsg('No encontré un QR legible en la imagen.', 'warn');
          }
          function fallbackJsQr() {
            if (typeof jsQR !== 'function') {
              finish('');
              return;
            }
            var qr = jsQR(pixels.data, pixels.width, pixels.height);
            finish(qr && qr.data ? qr.data : '');
          }
          if (typeof BarcodeDetector !== 'undefined') {
            try {
              new BarcodeDetector({ formats: ['qr_code'] }).detect(image).then(function (codes) {
                if (codes && codes.length && codes[0].rawValue) finish(codes[0].rawValue);
                else fallbackJsQr();
              }, fallbackJsQr);
              return;
            } catch (error) {}
          }
          fallbackJsQr();
        } catch (error) {
          setScanMsg('No pude leer la imagen del QR.', 'warn');
        }
      };
      image.onerror = function () {
        setScanMsg('No pude abrir la imagen.', 'warn');
      };
      image.src = String(reader.result || '');
    };
    reader.onerror = function () {
      setScanMsg('No pude abrir la imagen.', 'warn');
    };
    reader.readAsDataURL(file);
  }

  function showReview(data) {
    pendingSnapshot = data;
    ui.dialogMode = 'qrreview';
    $('dt').textContent = 'Restaurar desde QR';
    $('dp').textContent = 'Se reemplazarán tus materias, faltas y semestre actuales. Si el QR incluye IA, también se restaurará su configuración.';
    $('dmsg').textContent = '';
    $('dta').hidden = true;
    $('dtab').hidden = false;
    var count = Array.isArray(data.subjects) ? data.subjects.length : 0;
    var absences = Array.isArray(data.absences) ? data.absences.length : 0;
    var hasAi = Boolean(data.ai && isAIConfigured(data.ai));
    var provider = data.ai && data.ai.provider ? providerDefaults(data.ai.provider).label : 'sin proveedor';
    $('dtab').innerHTML = '<div class="qrreview">' +
      '<p><b>' + count + '</b> materia' + (count === 1 ? '' : 's') + ' y <b>' + absences + '</b> falta' + (absences === 1 ? '' : 's') + '.</p>' +
      '<p class="m">Conexión de IA incluida: ' + (hasAi ? 'sí (' + esc(provider) + ')' : 'no') + '.</p>' +
      '<p class="m qrwarn">Solo restaura códigos de una fuente confiable.</p></div>';
    $('dgo').textContent = 'Restaurar todo';
    $('dgo').hidden = false;
    $('dqrexport').hidden = true;
    $('dqrimport').hidden = true;
    $('dlg').hidden = false;
  }

  function applyImportReview() {
    if (!pendingSnapshot) return;
    var data = pendingSnapshot;
    pendingSnapshot = null;
    restoreSnapshot(data);
  }

  function handleQrClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (ui.dialogMode === 'exportqr') {
      if (target.closest('[data-qr-prev]') && exportIndex > 0) {
        exportIndex -= 1;
        drawExportQr();
        return;
      }
      if (target.closest('[data-qr-next]') && exportIndex < exportParts.length - 1) {
        exportIndex += 1;
        drawExportQr();
      }
    }
  }

  $('dqrexport').addEventListener('click', openExportQr);
  $('dqrimport').addEventListener('click', openImportQr);
  $('qrScanCancel').addEventListener('click', function () {
    stopScanner(true);
  });
  $('qrScanUpload').addEventListener('click', function () {
    $('qrScanFile').click();
  });
  $('qrScanFile').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (file) decodeImageFile(file);
  });
  $('qrScanDlg').addEventListener('click', function (event) {
    if (event.target === $('qrScanDlg')) stopScanner(true);
  });
  document.addEventListener('click', handleQrClick);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !$('qrScanDlg').hidden) stopScanner(true);
  });

  return { openExportQr, openImportQr, applyImportReview };
}

return { createQrTransfer };
})();

// src/services/sync.js
modules["src/services/sync.js"] = (() => {
const { KEY } = modules["src/core/constants.js"];

/** Sincronización opcional: prevalece la copia con updatedAt más reciente.
 * La app continúa localmente cuando el SDK no existe o la cuenta no está disponible.
 */
function createSync({ state, ui, render }) {
  const $ = id => document.getElementById(id);
  var sync = { ref: null, timer: null };
  function setSync(t, c) {
    var el = $('sync');
    if (!el) return;
    el.hidden = !t;
    el.textContent = t || '';
    el.className = 'sync ' + (c || '');
  }
  function pushNow() {
    if (!sync.ref) return;
    sync.ref.set({ json: JSON.stringify({ subjects: state.subjects, absences: state.absences, sem: state.sem }), updatedAt: state.updatedAt }).then(
      function () { setSync('Sincronizado con tu cuenta', 'ok'); },
      function () { setSync('No se pudo sincronizar. Guardado solo en este dispositivo.', 'warn'); }
    );
  }
  function schedulePush() {
    if (!sync.ref) return;
    clearTimeout(sync.timer);
    setSync('Sincronizando…');
    sync.timer = setTimeout(pushNow, 900);
  }
  function localOnly() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function pull(first) {
    if (!sync.ref) return Promise.resolve();
    return sync.ref.get().then(function (snap) {
      var d = snap.exists ? snap.data() : null, r = null;
      if (d && d.json) { try { r = JSON.parse(d.json); } catch (e) {} }
      var rt = (d && d.updatedAt) || 0, lt = state.updatedAt || 0;
      if (r && Array.isArray(r.subjects)) {
        if (!lt && state.subjects.length) {
          state.subjects = r.subjects.concat(state.subjects);
          state.absences = (Array.isArray(r.absences) ? r.absences : []).concat(state.absences);
          if (r.sem && !state.sem.start && !state.sem.end && !state.sem.pct) state.sem = r.sem;
          state.updatedAt = Date.now();
          localOnly();
          ui.anim.flip = true;
          render();
          pushNow();
          return;
        }
        if (rt > lt) {
          var ae = document.activeElement;
          if (!first && ae && /INPUT|TEXTAREA/.test(ae.tagName)) return;
          state.subjects = r.subjects;
          state.absences = Array.isArray(r.absences) ? r.absences : [];
          if (r.sem) state.sem = r.sem;
          state.updatedAt = rt;
          localOnly();
          ui.anim.flip = true;
          render();
        } else if (rt < lt) {
          pushNow();
          return;
        }
        setSync('Sincronizado con tu cuenta', 'ok');
      } else if (state.subjects.length) {
        if (!state.updatedAt) { state.updatedAt = Date.now(); localOnly(); }
        pushNow();
      } else setSync('Sincronizado con tu cuenta', 'ok');
    }).catch(function () {
      setSync('No se pudo sincronizar. Guardado solo en este dispositivo.', 'warn');
    });
  }
  function initSync() {
    if (!window.claude || !window.claude.use) return;
    Promise.all([claude.use('user'), claude.use('db')]).then(function (r) {
      if (!r[0] || !r[1]) { setSync('Solo en este dispositivo', ''); return; }
      return r[0].id().then(function (id) {
        if (!id) { setSync('Solo en este dispositivo', ''); return; }
        sync.ref = r[1].doc('data/users/' + id + '/state');
        setSync('Sincronizando…');
        return pull(true);
      });
    }).catch(function () { setSync('Solo en este dispositivo', ''); });
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && sync.ref) pull(false);
  });

  return { initSync, schedulePush };
}

return { createSync };
})();

// src/app.js
modules["src/app.js"] = (() => {
const { createSubjectsView } = modules["src/ui/subjects-view.js"];

const { createMotion } = modules["src/ui/motion.js"];

const { state, save, find, onSave, removeSubject } = modules["src/core/store.js"];

const { uid, num, f, esc } = modules["src/core/utils.js"];

const { DIAS, MESES } = modules["src/core/constants.js"];

const { classCount: countClasses, allowed: allowedAbsences } = modules["src/domain/attendance.js"];

const { cleanSubject, applySubjectSnapshot } = modules["src/domain/subjects.js"];

const { createSchedule } = modules["src/features/schedule.js"];

const { createOnboarding } = modules["src/features/onboarding.js"];

const { createQrTransfer } = modules["src/features/qr-transfer.js"];

const { isAIConfigured, saveAIConfig } = modules["src/services/ai.js"];

const { createSync } = modules["src/services/sync.js"];

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

return {  };
})();
})();
