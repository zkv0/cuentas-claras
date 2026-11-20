import { initializeSemesters, commitSemester } from '../core/store.js';
import { KEY } from '../core/constants.js';
import { subjectSnapshot } from '../domain/subjects.js';

/** Sincronización opcional: prevalece la copia con updatedAt más reciente.
 * La app continúa localmente cuando el SDK no existe o la cuenta no está disponible.
 */
export function createSync({ state, ui, render, refreshSemesters }) {
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
    sync.ref.set({ json: JSON.stringify(subjectSnapshot(state)), updatedAt: state.updatedAt }).then(
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
          refreshSemesters();
          pushNow();
          return;
        }
        if (rt > lt) {
          var ae = document.activeElement;
          if (!first && ae && /INPUT|TEXTAREA/.test(ae.tagName)) return;
          state.subjects = r.subjects;
          state.absences = Array.isArray(r.absences) ? r.absences : [];
          if (r.sem) state.sem = r.sem;
          state.absencePct=r.absencePct??r.sem?.pct??'';
          if (r.gradeScale) state.gradeScale = r.gradeScale;
          if(r.semesters){state.semesters=r.semesters;state.activeSemesterId=r.activeSemesterId;initializeSemesters()}else{commitSemester()}
          state.updatedAt = rt;
          localOnly();
          ui.anim.flip = true;
          render();
          refreshSemesters();
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
