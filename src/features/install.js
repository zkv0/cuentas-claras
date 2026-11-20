export function createInstallApp({openPanel, showMessage, isInstallOpen}) {
  let promptEvent = null;
  let installed = false;
  const standalone = () => installed || window.matchMedia?.('(display-mode: standalone)')?.matches || globalThis.navigator?.standalone === true;

  window.addEventListener?.('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    if (isInstallOpen()) openInstall();
  });
  window.addEventListener?.('appinstalled', () => {
    installed = true;
    promptEvent = null;
    if (isInstallOpen()) openInstall();
  });

  function openInstall() {
    if (standalone()) {
      openPanel('installApp', {
        title:'Cuentas Claras instalada',
        description:'Puedes consultar tus notas y horarios sin conexión después de la primera carga.',
        dismiss:'Volver'
      });
      return;
    }
    const ios = /iPhone|iPad|iPod/.test(globalThis.navigator?.userAgent || '') ||
      (globalThis.navigator?.platform === 'MacIntel' && globalThis.navigator.maxTouchPoints > 1);
    openPanel('installApp', {
      title:'Instalar como app',
      body:promptEvent ? '<p>Abre Cuentas Claras desde un icono y consulta tus datos sin conexión.</p>'
        : ios ? '<ol><li>Abre esta página en Safari y toca Compartir.</li><li>Elige Añadir a pantalla de inicio.</li><li>Activa Abrir como app web, si aparece, y toca Añadir.</li></ol>'
        : '<p>En el menú de tu navegador, busca Instalar aplicación o Añadir a pantalla de inicio.</p>',
      confirm:promptEvent ? 'Instalar' : '',
      dismiss:'Volver'
    });
  }

  async function install() {
    const offer = promptEvent;
    if (!offer) return;
    promptEvent = null;
    try {
      const result = await offer.prompt();
      installed = result.outcome === 'accepted' || installed;
      if (isInstallOpen()) openInstall();
    } catch {
      if (isInstallOpen()) {
        openInstall();
        showMessage('Usa la opción de instalación del menú del navegador.');
      }
    }
  }

  if (globalThis.isSecureContext && globalThis.navigator?.serviceWorker) {
    navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'})
      .catch(error => console.warn('No se pudo preparar el acceso sin conexión.', error));
  }
  return {openInstall, install};
}
