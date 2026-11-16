// Mantener esta clave permite abrir los datos guardados por la versión monolítica.
export const KEY = 'calc-notas-v2';
// Configuración de la API de IA; se guarda aparte para no incluirla al exportar.
export const AI_KEY = 'calc-notas-ai';
// Clave anterior de DeepSeek; se lee para migrar la conexión existente.
export const LEGACY_DS_KEY = 'calc-notas-deepseek';
// Marca de bienvenida inicial para no volver a abrir el asistente tras el primer uso.
export const ONBOARD_KEY = 'calc-notas-onboarded';
export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
