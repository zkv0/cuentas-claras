import { createCurriculumImport } from './features/curriculum-import.js';
import { createGradeImport } from './features/grade-import.js';
import { exportScheduleImage } from './features/schedule-image.js';
import { searchSubjects } from './domain/search.js';
import { createSubjectsView } from './ui/subjects-view.js';
import { createMotion } from './ui/motion.js';
import { state, save, find, onSave, removeSubject, removeSemester, addSemester, switchSemester, initializeSemesters, commitSemester, importCurriculum } from './core/store.js';
import { uid, num, f, esc } from './core/utils.js';
import { DIAS, MESES, ONBOARD_KEY } from './core/constants.js';
import { classCount as countClasses, allowed as allowedAbsences } from './domain/attendance.js';
import { cleanSubject, applySubjectSnapshot, subjectSnapshot } from './domain/subjects.js';
import { createSchedule } from './features/schedule.js';
import { createOnboarding } from './features/onboarding.js';
import { createQrTransfer } from './features/qr-transfer.js';
import { isAIConfigured, saveAIConfig, clearAIConfig } from './services/ai.js';
import { createSync } from './services/sync.js';

// Estado efímero de interfaz; los datos persistentes pertenecen a core/store.js.
const ui = { anim: {}, dialogMode: '', scheduleMessage: '', reorderId: null, archOpen: false };
const open = {}, open2 = {};
let pendingSemesterDeletion = null;
let gradeSettingsDraft = null;
const themes = [
  ['default', 'Grafito (predeterminado)'],
  ['rose', 'Algodón de fresa'],
  ['red', 'Asfalto carmesí'],
  ['white', 'Porcelana'],
  ['blue', 'Marea azul'],
  ['eclipse', 'Eclipse total'],
  ['jade', 'Bosque de jade'],
  ['amber', 'Ámbar del desierto']
];
const themeKey = 'cuentas-claras-theme';
let currentTheme = 'default';
const typefaces = [
  ['atkinson', 'Atkinson Hyperlegible Next (predeterminada)'],
  ['source-sans', 'Source Sans 3'],
  ['inter', 'Inter'],
  ['lexend', 'Lexend'],
  ['lora', 'Lora'],
  ['plex-mono', 'IBM Plex Mono'],
  ['barlow-condensed', 'Barlow Condensed'],
  ['fraunces', 'Fraunces'],
  ['nunito', 'Nunito'],
  ['space-grotesk', 'Space Grotesk']
];
const typefaceKey = 'cuentas-claras-typeface';
const defaultTypeface = 'atkinson';
let currentTypeface = defaultTypeface;
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
    if(e.target.closest('input[data-k="name"]'))return;
    if(e.target.closest('[data-act="addFalta"]')){openCal();return}
    if(e.target.closest('.attendance-shortcut')){openAttendance('absences');return}
    var t=e.target.closest("[data-toggle]");
    if(t){
      var tid=t.closest(".card").dataset.id;
      if(e.detail>=2)ui.reorderId=tid; // doble clic: entra a modo reordenar
      if(e.detail<2&&open[tid]){var cd=t.closest(".card");shrink(cd.querySelector(".body"),cd.querySelector(".chev"),function(){open[tid]=false;render()});return}
      open[tid]=!open[tid];ui.anim.open=open[tid]?tid:null;render();return;
    }
    var b=e.target.closest("button");if(!b)return;
    var card=b.closest(".card"),sub=card&&find(card.dataset.id),a=b.dataset.act;
    if(a==="openAttendance"||a==="openSchedule"){openAttendance(a==="openSchedule"?"schedule":"absences");return}
    if(a==="addFalta"){openCal();return}
    if(b.hasAttribute("data-arch-toggle")){
      if(ui.archOpen){shrink(document.querySelector(".arch-list"),b.querySelector(".chev"),function(){ui.archOpen=false;render()});return}
      ui.archOpen=true;ui.anim.arch=true;render();return;
    }
    if(b.hasAttribute("data-toggle2")){var sid=sub.id;if(open2[sid]){shrink(card.querySelector(".grpbody"),card.querySelector(".grp .chev"),function(){open2[sid]=false;render()});return}open2[sid]=true;ui.anim.grp=sid;render();return}
    if(a==="addSemester"||a==="renameSemester"){openSemesterSettings(a==="renameSemester");return}
    if(a==="deleteSemester"){openDeleteSemester();return}
    if(a==="importCurriculum"){closeDlg();openCurriculum();return}
    if(a==="updateGradesAI"){closeDlg();openGradeImport();return}
    if(a==="uploadScheduleAI"){closeDlg();openOnboarding();return}
    if(a==="searchSubjects"){openSearch();return}
    if(a==="searchResult"){openSearchResult(b.dataset.semester,b.dataset.subject);return}
    if(a==="gradeSettings"){openGradeSettings();return}
    if(a==="typography"){openTypography();return}
    if(a==="selectTypeface"&&ui.dialogMode==='typography'){selectTypeface(b.dataset.typefaceOption);return}
    if(a==="themes"){openThemes();return}
    if(a==="selectTheme"&&ui.dialogMode==='themes'){selectTheme(b.dataset.theme);return}
    if(a==="export"){openDlg("export");return}
    if(a==="import"){openDlg("import");return}
    if(a==="wipeAll"){openWipe();return}
    if(a==="openOnboard"){openOnboarding();return}
    if(a==="addSched"){openAddSched();return}
    if(a==="doneReorder"){ui.reorderId=null;ui.anim.flip=true;render();return}
    if(a==="move"&&sub){
      var ix=state.subjects.indexOf(sub),dr=+b.dataset.dir,jx=ix+dr;
      while(jx>=0&&jx<state.subjects.length&&!!state.subjects[jx].archived!==!!sub.archived)jx+=dr;
      if(jx>=0&&jx<state.subjects.length){var tmp=state.subjects[jx];state.subjects[jx]=sub;state.subjects[ix]=tmp;save();ui.anim.flip=true}
      render();return;
    }
    if(a==="exportScheduleImage"){exportScheduleImage(state,function(msg){ui.scheduleMessage=msg;var el=$("schmsg");if(el)el.textContent=msg});return}
    if(a==="exportSettingsSchedule"){
      if(state.semesters.length > 1) openScheduleExport();
      else downloadSettingsSchedule(state.activeSemesterId);
      return;
    }
    if(a==="aiConfig"){openAIConfig();return}
    if(a==="editHorario"){openHorList();return}
    if(a==="delFalta"){var fid=b.dataset.fid;state.absences=state.absences.filter(function(x){return x.id!==fid});save();render();return}
    if(!sub)return;
    if(a==="archive"){sub.archived=!sub.archived;if(!sub.archived)sub.cancelled=false;open[sub.id]=false;ui.anim.flip=true;save();render();return}
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
  function openPanel(mode, {title, description='', body='', confirm='', dismiss='Cerrar', danger=false}){
    ui.dialogMode=mode;
    $('dt').textContent=title;
    $('dp').textContent=description;
    $('dta').hidden=true;
    $('dtab').innerHTML=body;
    $('dtab').hidden=!body;
    $('dqrexport').hidden=true;
    $('dqrimport').hidden=true;
    $('dmsg').textContent='';
    $('dgo').textContent=confirm;
    $('dgo').hidden=!confirm;
    $('dgo').className=danger?'p danger':'p';
    $('dx').textContent=dismiss;
    $('dlg').hidden=false;
  }
  function refreshSemesters(){
    $('semesterSelect').innerHTML=state.semesters.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===state.activeSemesterId?' selected':'')+'>'+esc(x.name)+'</option>'}).join('');
  }
  function resetSemesterUI(){
    Object.keys(open).forEach(k=>delete open[k]);Object.keys(open2).forEach(k=>delete open2[k]);
    ui.scheduleMessage='';ui.archOpen=false;ui.reorderId=null;
    refreshSemesters();render();
  }
  $('semesterSelect').addEventListener('change',function(){switchSemester(this.value);resetSemesterUI()});
  function openDeleteSemester(){
    const semester=state.semesters.find(x=>x.id===state.activeSemesterId);
    if(!semester)return;
    pendingSemesterDeletion=semester.id;
    openPanel('deleteSemester', {
      title:'¿Deseas eliminar el semestre «'+semester.name+'»?',
      description:'Se eliminarán sus materias, notas, horario y faltas de asistencia. Esta acción no se puede deshacer.'+(state.semesters.length===1?' Se creará un semestre vacío para continuar.':''),
      confirm:'Eliminar semestre', dismiss:'Cancelar', danger:true
    });
    $('dx').focus();
  }
  function applyDeleteSemester(){
    if($('dlg').hidden||!pendingSemesterDeletion)return;
    removeSemester(pendingSemesterDeletion);
    closeDlg();resetSemesterUI();
  }
  function openSemesterSettings(rename){
    var current=state.semesters.find(x=>x.id===state.activeSemesterId);
    openPanel(rename?'renameSemester':'addSemester', {
      title:rename?'Renombrar semestre':'Nuevo semestre',
      body:'<div class="dsform semester-form"><label>Nombre<input id="semesterName" maxlength="60" placeholder="Ej. 2027-1" value="'+esc(rename?current.name:'')+'"></label>'+(!rename?'<div class="semester-dates"><label>Inicio<input id="semesterStart" type="date" aria-label="Inicio del semestre"></label><label>Fin<input id="semesterEnd" type="date" aria-label="Fin del semestre"></label></div>':'')+'</div>',
      confirm:rename?'Guardar':'Crear'
    });
    $('semesterName').focus();
  }
  function applySemesterSettings(){
    var name=$('semesterName').value.trim();
    if(!name){$('dmsg').textContent='Escribe un nombre.';return}
    if(state.semesters.some(x=>x.name.toLowerCase()===name.toLowerCase()&&(ui.dialogMode==='addSemester'||x.id!==state.activeSemesterId))){$('dmsg').textContent='Ya existe un semestre con ese nombre.';return}
    if(ui.dialogMode==='addSemester'){
      var start=$('semesterStart').value,end=$('semesterEnd').value;
      function validDate(value){var date=new Date(value+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(date)&&date.toISOString().slice(0,10)===value}
      if((start&&!validDate(start))||(end&&!validDate(end))){$('dmsg').textContent='Revisa las fechas ingresadas.';return}
      if(start&&end&&end<start){$('dmsg').textContent='El fin debe ser igual o posterior al inicio.';return}
      addSemester(name,{start:start,end:end});
    }
    else{state.semesters.find(x=>x.id===state.activeSemesterId).name=name;save()}
    closeDlg();resetSemesterUI();
  }
  function openSearch(){
    commitSemester();
    openPanel('search', {
      title:'Buscar materias',
      body:'<div class="subject-search"><input id="subjectSearch" type="search" autocomplete="off" placeholder="Nombre de la materia" aria-label="Buscar materia en todos los semestres"><div id="subjectSearchResults" aria-live="polite"><p class="m search-empty">Busca en todos los semestres.</p></div></div>'
    });
    $('subjectSearch').focus();
  }
  document.addEventListener('input',function(e){
    if(e.target.id!=='subjectSearch'||ui.dialogMode!=='search')return;
    var query=e.target.value,results=searchSubjects(state.semesters,query);
    $('subjectSearchResults').innerHTML=!query.trim()?'<p class="m search-empty">Busca en todos los semestres.</p>':!results.length?'<p class="m search-empty">Sin resultados.</p>':
      '<div class="settings-options">'+results.map(function(x){
        return '<button type="button" class="settings-option" data-act="searchResult" data-semester="'+esc(x.semesterId)+'" data-subject="'+esc(x.subjectId)+'"><span>'+esc(x.name)+'<small class="search-result-semester">'+esc(x.semesterName)+(x.archived?' · Archivada':'')+'</small></span><span aria-hidden="true">›</span></button>';
      }).join('')+'</div>';
  });
  function openSearchResult(semesterId,subjectId){
    var semester=state.semesters.find(x=>x.id===semesterId);
    if(!semester||!semester.subjects.some(x=>x.id===subjectId))return;
    switchSemester(semesterId);closeDlg();resetSemesterUI();
    var subject=find(subjectId);open[subjectId]=true;ui.archOpen=!!subject.archived;render();
    var card=document.querySelector('.card[data-id="'+subjectId+'"]');
    if(card){card.scrollIntoView({block:'center'});var input=card.querySelector('.name');if(input)input.focus({preventScroll:true})}
  }
  function settingsIcon(path){
    return `<svg class="settings-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  }
  const downloadIcon='M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4';
  function settingsOptions(actions){
    return `<div class="settings-options">${actions.map(([action, label, icon]) => `
      <button type="button" class="settings-option${action==='wipeAll'?' settings-delete':''}" data-act="${action}">
        ${settingsIcon(icon)}<span>${label}</span><span aria-hidden="true">›</span>
      </button>`).join('')}</div>`;
  }
  function openGradeSettings(draft){
    const { min, max, absencePct } = draft ?? { ...state.gradeScale, absencePct: state.absencePct };
    const body=`<div class="global-settings">
    <section aria-labelledby="settingsLimitsTitle">
    <h3 id="settingsLimitsTitle">${settingsIcon('M5 18v-4m7 4v-8m7 8V6')}Notas y faltas</h3>
    <div class="dsform compact-global-settings">
      <label>Nota mínima<input id="globalMin" inputmode="decimal" value="${esc(min)}"></label>
      <label>Nota máxima<input id="globalMax" inputmode="decimal" value="${esc(max)}"></label>
      <label>% máx. de faltas<input id="globalAbsencePct" inputmode="decimal" value="${esc(absencePct)}"></label>
    </div>
    </section>
    <section aria-labelledby="settingsScheduleTitle">
    <h3 id="settingsScheduleTitle">${settingsIcon('M4 5h16v15H4zM4 10h16M8 3v4m8-4v4')}Horario</h3>
    ${settingsOptions([['exportSettingsSchedule', 'Descargar imagen del horario', downloadIcon]])}
    </section>
    <section aria-labelledby="settingsAppearanceTitle">
    <h3 id="settingsAppearanceTitle">${settingsIcon('M5 6h14v10H5zm3 14h8m-4-4v4')}Apariencia</h3>
    ${settingsOptions([['themes', 'Temas', 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 1.5 1.5 0 0 1 1-2.5h2A4 4 0 0 0 21 10c-1-4-5-7-9-7zM7 10h.01M10 7h.01M14 7h.01M17 10h.01'], ['typography', 'Tipografía', 'M4 19 10 5l6 14m-10-4h8m3 4 3-8 3 8m-5-2h4']])}
    </section>
    <section aria-labelledby="settingsAITitle">
    <h3 id="settingsAITitle">${settingsIcon('M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z')}Inteligencia artificial</h3>
    ${settingsOptions([
      ['updateGradesAI', 'Actualizar notas con IA', 'M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h3'],
      ['importCurriculum', 'Importar malla curricular', 'M4 4h16v16H4zM4 9h16M9 9v11M14 9v11'],
      ['uploadScheduleAI', 'Subir horario con IA', 'M4 8h16v12H4zM8 8V4m8 4V4m-7 9h6m-6 3h3'],
      ['aiConfig', isAIConfigured() ? 'Gestionar API de IA' : 'Conectar API de IA', 'M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0zm6 9v4']
    ])}
    </section>
    <section aria-labelledby="settingsDataTitle">
    <h3 id="settingsDataTitle">${settingsIcon('M4 7h16v13H4zM3 4h18v3H3zm7 7h4')}Datos</h3>
    ${settingsOptions([
      ['export', 'Exportar datos', 'M12 15V3m-5 5 5-5 5 5M5 15v5h14v-5'],
      ['import', 'Importar datos', downloadIcon],
      ['wipeAll', 'Borrar datos', 'M4 6h16m-14 0 1 14h10l1-14M9 6V3h6v3m-5 4v6m4-6v6']
    ])}
    </section>
    </div>`;
    openPanel('gradeSettings', {title:'Configuración de Cuentas Claras', body, confirm:'Guardar'});
    $('dtab').querySelector('[data-act="exportSettingsSchedule"]')?.focus();
  }
  function openScheduleExport(){
    rememberGradeSettings();
    openPanel('scheduleExport', {
      title:'Descargar horario',
      body:`<label class="settings-schedule-picker">Semestre<select id="exportScheduleSemester">${$('semesterSelect').innerHTML}</select></label>`,
      confirm:'Descargar', dismiss:'Volver'
    });
    $('exportScheduleSemester').focus();
  }
  function rememberGradeSettings(){
    gradeSettingsDraft = { min: $('globalMin').value, max: $('globalMax').value, absencePct: $('globalAbsencePct').value };
  }
  function applyTheme(theme){
    currentTheme=themes.some(([id])=>id===theme)?theme:'default';
    document.documentElement.dataset.theme=currentTheme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  }
  function openThemes(){
    rememberGradeSettings();
    const options=themes.map(([id,label])=>`
      <button type="button" class="settings-option theme-option" data-act="selectTheme" data-theme="${id}" aria-pressed="${id===currentTheme}">
        <span class="theme-preview" data-theme-preview="${id}" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>${label}</span><span class="theme-check" aria-hidden="true">✓</span>
      </button>`).join('');
    openPanel('themes', {title:'Temas', body:`<div class="settings-options">${options}</div>`, dismiss:'Volver'});
    $('dtab').querySelector('[aria-pressed="true"]')?.focus();
  }
  function selectTheme(theme){
    applyTheme(theme);
    try{localStorage.setItem(themeKey,currentTheme)}catch{}
    $('dtab').querySelectorAll('[data-act="selectTheme"]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.theme===currentTheme));
    });
  }
  function applyTypeface(id){
    currentTypeface = typefaces.some(([key]) => key === id) ? id : defaultTypeface;
    document.documentElement.dataset.typeface = currentTypeface;
  }
  function openTypography(){
    rememberGradeSettings();
    const options = typefaces.map(([id,label]) => `
      <button type="button" class="settings-option typeface-option" data-act="selectTypeface"
        data-typeface-option="${id}" aria-pressed="${id === currentTypeface}">
        <span>${label}</span><span class="typeface-check" aria-hidden="true">✓</span>
      </button>`).join('');
    openPanel('typography', {title:'Tipografía', body:`<div class="settings-options">${options}</div>`, dismiss:'Volver'});
    $('dtab').querySelector('[aria-pressed="true"]')?.focus();
  }
  function selectTypeface(id){
    applyTypeface(id);
    try { localStorage.setItem(typefaceKey,currentTypeface); } catch {}
    $('dtab').querySelectorAll('[data-act="selectTypeface"]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.typefaceOption === currentTypeface));
    });
  }
  function returnToGradeSettings(){
    const draft = gradeSettingsDraft;
    gradeSettingsDraft = null;
    openGradeSettings(draft);
  }
  function downloadSettingsSchedule(semesterId){
    const message = $('dmsg');
    message.textContent = '';
    exportScheduleImage(state, error => { message.textContent = error; }, semesterId);
    if(!message.textContent && ui.dialogMode==='scheduleExport') returnToGradeSettings();
  }
  function applyGradeSettings(){
    var min=num($('globalMin').value),max=num($('globalMax').value);
    if(min===null||max===null||min<0||max<=0||min>max){$('dmsg').textContent='La mínima debe estar entre 0 y la máxima. La máxima debe ser mayor que 0.';return}
    var pct=num($('globalAbsencePct').value);
    if($('globalAbsencePct').value.trim()!==''&&(pct===null||pct<0||pct>100)){$('dmsg').textContent='El porcentaje de faltas debe estar entre 0 y 100.';return}
    state.absencePct=pct===null?'':pct;
    state.gradeScale={min:min,max:max};save();render();closeDlg();
  }
  let backupReadId = 0;

  function openDlg(mode){
    backupReadId++;
    const exporting=mode==='export';
    openPanel(mode, exporting ? {
      title:'Exportar datos', confirm:'Copiar',
      description:'Copia este texto y guárdalo donde quieras. Luego puedes importarlo aquí mismo.'
    } : {
      title:'Importar datos', confirm:'Importar',
      description:'Pega el texto exportado. Una copia completa reemplaza tus semestres, materias y faltas. Una lista antigua agrega materias al semestre activo.'
    });
    const textarea=$('dta');
    textarea.readOnly=exporting;
    textarea.value=exporting ? JSON.stringify({version:2,...subjectSnapshot(state)},null,2) : '';
    textarea.placeholder=exporting ? '' : 'Pega aquí tus datos';
    textarea.hidden=false;
    $('dqrexport').hidden=!exporting;
    $('dqrimport').hidden=exporting;
    $(exporting?'backupDownload':'backupOpen').focus();
  }
  function isCompleteBackup(data) {
    return Array.isArray(data?.subjects) && Array.isArray(data.semesters) && data.semesters.length > 0 &&
      data.semesters.every(semester => Array.isArray(semester?.subjects) &&
        semester.subjects.every(subject => Array.isArray(subject?.rows)));
  }

  $('backupDownload').addEventListener('click', function () {
    if (ui.dialogMode !== 'export') return;
    const blob = new Blob([$('dta').value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cuentas-claras-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('backupOpen').addEventListener('click', function () { $('backupFile').click(); });
  $('backupFile').addEventListener('change', async function () {
    const file = this.files?.[0];
    this.value = '';
    if (!file || ui.dialogMode !== 'import') return;
    const readId = ++backupReadId;
    const stillOpen = () => readId === backupReadId && ui.dialogMode === 'import' && !$('dlg').hidden;
    const message = $('dmsg');
    message.textContent = '';
    try {
      const text = (await file.text()).trim();
      if (!stillOpen()) return;
      if (!isCompleteBackup(JSON.parse(text))) throw new Error('Invalid backup');
      $('dta').value = text;
      message.textContent = 'Copia lista. Pulsa Importar para restaurarla.';
    } catch {
      if (stillOpen()) message.textContent = 'No pude leer el archivo. Elige una copia JSON completa de Cuentas Claras.';
    }
  });

  function openWipe(){
    var n=state.semesters.reduce((n,x)=>n+x.subjects.length,0),a=state.semesters.reduce((n,x)=>n+x.absences.length,0);
    $('dta').value='';
    openPanel('wipe', {
      title:'Eliminar todos los datos',
      description:'Se borrarán '+n+(n===1?' materia':' materias')+', '+a+(a===1?' falta':' faltas')+', el semestre y la conexión de IA de este navegador. Esta acción no se puede deshacer.',
      confirm:'Eliminar todo', danger:true
    });
  }
  function applyWipeAll(){
    state.subjects=[];state.absences=[];state.semesters=null;
    state.sem={start:"",end:"",pct:""};state.gradeScale={min:3,max:5};state.absencePct='';
    initializeSemesters();refreshSemesters();
    clearAIConfig();
    try{localStorage.removeItem(ONBOARD_KEY)}catch(e){}
    Object.keys(open).forEach(function(k){delete open[k]});
    Object.keys(open2).forEach(function(k){delete open2[k]});
    ui.archOpen=false;ui.reorderId=null;ui.scheduleMessage="";open.faltas=false;
    save();render();closeDlg();resetQr();
  }
  let returnFromAIConfig = null;
  function closeDlg(){
    const resume = ui.dialogMode === "ai" ? returnFromAIConfig : null;
    returnFromAIConfig = null;
    backupReadId++;
    pendingSemesterDeletion=null;
    ui.dialogMode='';
    $('dx').textContent='Cerrar';
    $('dlg').hidden=true;
    if (resume) resume();
  }
  function restoreSnapshot(data){
    var ai=applySubjectSnapshot(state,data);
    if(!ai&&(!data||!Array.isArray(data.subjects)))return;
    if(ai)saveAIConfig(ai);
    ui.scheduleMessage="Datos restaurados desde QR.";
    ui.reorderId=null;
    save();refreshSemesters();ui.anim.flip=true;render();closeDlg();
  }
  function dismissDlg(){
    if($('dlg').hidden)return;
    if(ui.dialogMode==='scheduleExport'||ui.dialogMode==='themes'||ui.dialogMode==='typography')returnToGradeSettings();
    else closeDlg();
  }
  $("dx").addEventListener("click",dismissDlg);
  $("dlg").addEventListener("click",function(e){if(e.target===$("dlg"))dismissDlg()});
  document.addEventListener("keydown",function(e){
    if(e.key!=="Escape"||$('dlg').hidden)return;
    e.preventDefault();dismissDlg();
  });
  $("dgo").addEventListener("click",function(){
    var ta=$("dta"),msg=$("dmsg");
    if(ui.dialogMode==="addSemester"||ui.dialogMode==="renameSemester"){applySemesterSettings();return}
    if(ui.dialogMode==="deleteSemester"){applyDeleteSemester();return}
    if(ui.dialogMode==="gradeSettings"){applyGradeSettings();return}
    if(ui.dialogMode==="scheduleExport"){downloadSettingsSchedule($('exportScheduleSemester').value);return}
    if(ui.dialogMode==="schedule"){applySched();return}
    if(ui.dialogMode==="editsched"){applyEditSched();return}
    if(ui.dialogMode==="addsched"){applyAddSched();return}
    if(ui.dialogMode==="ai"){applyAIConfig();return}
    if(ui.dialogMode==="wipe"){applyWipeAll();return}
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
      if(d&&Array.isArray(d.semesters)&&d.semesters.length){
        if (!isCompleteBackup(d)) throw new Error('Invalid backup');
        applySubjectSnapshot(state,d);save();refreshSemesters();render();closeDlg();return;
      }
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
  function faltHtml(){
    var n=state.absences.length,scheduled=state.subjects.filter(function(x){return !x.archived&&x.days&&x.days.length}).length;
    function entry(action,title,summary,icon){
      if(action==='openAttendance')return '<div class="attendance-entry attendance-shortcut"><button type="button" class="attendance-main" data-act="openAttendance" aria-haspopup="dialog" aria-controls="attendanceDlg"><span class="attendance-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icon+'</svg></span><span><span class="attendance-title">'+title+'</span><span class="attendance-stat">'+summary+'</span></span></button><button type="button" class="attendance-add" data-act="addFalta" aria-label="Añadir falta" aria-haspopup="dialog" aria-controls="cal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>';

      return '<button type="button" class="attendance-entry" data-act="'+action+'" aria-haspopup="dialog" aria-controls="attendanceDlg"><span class="attendance-card-head"><span class="attendance-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icon+'</svg></span></span><span class="attendance-copy"><span class="attendance-title">'+title+'</span></span><span class="attendance-card-footer"><span class="attendance-stats"><span class="attendance-stat">'+summary+'</span></span><span class="attendance-cta" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span></span></button>';
    }
    return '<div class="attendance-accesses">'+entry('openSchedule','Horario',scheduled+(scheduled===1?' materia':' materias'),'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>')+entry('openAttendance','Faltas de asistencia','<strong>'+n+'</strong> '+(n===1?'falta':'faltas'),'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 15h3m3-2 4 4m0-4-4 4"/>')+'</div>';
  }
  function attendanceHtml(){
    var hs=hasSchedule();
    if(ui.attendanceView==='schedule')return '<section class="attendance-section"><div class="attendance-section-head"><h3>Horario semanal</h3><button class="ghost" data-act="editHorario">Editar horario</button></div>'+
      (hs?schedTable(stateRows()):'<div class="attendance-empty">Sin horario</div>')+
      '<div class="sch"><button data-act="exportScheduleImage">Descargar imagen</button></div><p class="m" id="schmsg" role="status">'+esc(ui.scheduleMessage||'')+'</p></section>';
    var h='<section class="attendance-section semester-dates-section">'+semBox()+'</section>'+
      '<section class="attendance-section absence-list"><div class="attendance-section-head"><h3><span class="attendance-total">'+state.absences.length+'</span> registradas</h3><button class="absence-add" data-act="addFalta" aria-label="Registrar falta" title="Registrar falta"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>';
    var list=state.absences.slice().sort(function(a,b){return a.date<b.date?1:-1});
    if(!list.length)h+='<p class="attendance-empty">Sin faltas registradas</p>';
    list.forEach(function(a){
      var names=a.ids.map(function(i){var x=find(i);return x?(x.name||'Sin nombre'):null}).filter(Boolean).join(', ');
      h+='<div class="frow"><div><span class="fd">'+esc(fmtDate(a.date))+'</span><br><span class="m">'+esc(names)+'</span></div><button class="ghost" data-act="delFalta" data-fid="'+a.id+'">Quitar</button></div>';
    });
    return h+'</section>';
  }
  function renderAttendance(){
    if($("attendanceDlg").hidden)return;
    var body=$("attendanceContent"),scroll=body.scrollTop;
    body.innerHTML=attendanceHtml();body.scrollTop=scroll;
  }
  function openAttendance(view){
    ui.attendanceView=view||"absences";
    $("attendanceTitle").textContent=ui.attendanceView==="schedule"?"Horario":"Faltas de asistencia";
    $("attendanceDlg").classList.toggle("absence-view",ui.attendanceView!=="schedule");
    $("attendanceContent").scrollTop=0;
    $("attendanceDlg").hidden=false;renderAttendance();
    $("app").inert=true;document.querySelector('.top').inert=true;
    document.body.classList.add('attendance-modal-open');$("attendanceClose").focus();
  }
  function closeAttendance(){
    $("attendanceDlg").hidden=true;$("app").inert=false;document.querySelector('.top').inert=false;
    document.body.classList.remove('attendance-modal-open');
    var trigger=document.querySelector('[data-act="'+(ui.attendanceView==='schedule'?'openSchedule':'openAttendance')+'"]');if(trigger)trigger.focus();
  }
  $("attendanceClose").addEventListener('click',closeAttendance);
  $("attendanceDlg").addEventListener('click',function(e){if(e.target===$("attendanceDlg"))closeAttendance()});
  document.addEventListener('keydown',function(e){
    if(e.defaultPrevented||$("attendanceDlg").hidden||!$("dlg").hidden||!$("cal").hidden)return;
    if(e.key==='Escape'){closeAttendance();return}
    if(e.key!=='Tab')return;
    var items=Array.from($("attendanceDlg").querySelectorAll('button,input,select,textarea,[tabindex="0"]')).filter(function(el){return !el.disabled&&el.getClientRects().length});
    if(!items.length)return;
    var first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  });
  function limitLine(x){
    var mx=allowed(x);if(mx===null)return "";
    return '<p class="m hlim">Máx. '+mx+(mx===1?" falta":" faltas")+' de '+classCount(x)+' clases</p>';
  }
  function semBox(){
    var m=state.sem;
    return '<details class="semester-date-details"><summary>'+esc(m.start&&m.end?m.start.split('-').reverse().join('/')+' – '+m.end.split('-').reverse().join('/'):'Fechas del semestre')+'</summary><div class="semg semester-dates"><label>Inicio<input type="date" aria-label="Inicio del semestre" data-sem="start" value="'+esc(m.start)+'"></label><label>Fin<input type="date" aria-label="Fin del semestre" data-sem="end" value="'+esc(m.end)+'"></label></div></details>';
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
    render();
  }
  $("cprev").addEventListener("click",function(){cal.m--;if(cal.m<0){cal.m=11;cal.y--}$("cmsg").textContent="";drawCal()});
  $("cnext").addEventListener("click",function(){cal.m++;if(cal.m>11){cal.m=0;cal.y++}$("cmsg").textContent="";drawCal()});
  $("cx").addEventListener("click",closeCal);
  $("cal").addEventListener("click",function(e){if(e.target===$("cal"))closeCal()});
  $("cgrid").addEventListener("click",function(e){var b=e.target.closest("[data-date]");if(b)addFalta(b.dataset.date)});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")closeCal()});

  const { renderRaw, refreshCard } = createSubjectsView({ state, ui, open, open2, find, allowed, faltHtml, renderAttendance });
  const { render, shrink } = createMotion({ ui, renderRaw });
  const { showSched, openHorList, applyEditSched, applySched, schedTable, stateRows, requestSchedulePhoto, openAddSched, applyAddSched, openAIConfig, applyAIConfig } =
    createSchedule({ state, ui, save, render, find, limitLine, openPanel, closeDlg, removeSubject });
  const { openCurriculum } = createCurriculumImport({state, importCurriculum, refreshSemesters, render, openAIConfig});
  const { openGradeImport } = createGradeImport({ state, save, render, openAIConfig });
  const { openOnboarding } = createOnboarding({ state, ui, save, render, schedTable, openAddSched, reviewExisting: showSched, adjustAI(resume) {
    returnFromAIConfig = resume;
    openAIConfig(false);
  } });
  const { applyImportReview, reset: resetQr } = createQrTransfer({ state, ui, openPanel, restoreSnapshot });
  const { initSync, schedulePush } = createSync({ state, ui, render, refreshSemesters });
  onSave(schedulePush);
  try{
    // Conserva la preferencia guardada antes del cambio de marca.
    const previousThemeKey = ['nota', 'clara', 'theme'].join('-');
    const savedTheme = localStorage.getItem(themeKey) || localStorage.getItem(previousThemeKey);
    applyTheme(savedTheme);
    if(savedTheme){
      localStorage.setItem(themeKey,currentTheme);
      localStorage.removeItem(previousThemeKey);
    }
  }catch{applyTheme('default')}
  try { applyTypeface(localStorage.getItem(typefaceKey)); } catch { applyTypeface(defaultTypeface); }
  refreshSemesters();ui.anim.first=true;render();initSync();
