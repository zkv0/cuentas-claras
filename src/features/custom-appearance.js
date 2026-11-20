import { esc, uid } from '../core/utils.js';

export const themeColors = [
  ['background', 'Fondo', '--bg', '#000000'],
  ['surface', 'Superficies', '--surface', '#121212'],
  ['text', 'Texto', '--ink', '#e8e8e8'],
  ['muted', 'Subtextos', '--muted', '#a8a8a8'],
  ['accent', 'Acento', '--accent', '#e6e6e6'],
  ['border', 'Bordes', '--outline', '#4d4d4d']
];

function readList(key){
  try {
    const list = JSON.parse(localStorage.getItem(key));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function toHex(color, fallback){
  if (/^#[\da-f]{6}$/i.test(color)) return color;
  if (/^#[\da-f]{3}$/i.test(color)) return '#' + [...color.slice(1)].map(digit => digit.repeat(2)).join('');
  const rgb = color.match(/^rgb\(\s*(\d{1,3})[, ]+\s*(\d{1,3})[, ]+\s*(\d{1,3})\s*\)$/);
  if (rgb?.slice(1).some(channel => Number(channel) > 255)) return fallback;
  return rgb ? '#' + rgb.slice(1).map(channel => Number(channel).toString(16).padStart(2, '0')).join('') : fallback;
}

function readableInk(hex){
  const channels = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

function bounded(value, max, fallback){
  return value === '' || value == null || !Number.isFinite(Number(value))
    ? fallback : Math.min(max, Math.max(0, Math.round(Number(value))));
}

export function normalizeCustomTheme(theme){
  const colors = Object.fromEntries(themeColors.map(([key, , , fallback]) =>
    [key, toHex(String(theme[key] ?? ''), fallback)]));
  return {
    id: theme.id, name: String(theme.name ?? '').trim().slice(0, 40),
    ...colors, radius: bounded(theme.radius, 48, 16), stroke: bounded(theme.stroke, 8, 0),
    contrast: ['normal', 'high'].includes(theme.contrast) ? theme.contrast : 'system'
  };
}

export function themeFromPage(root){
  const style = getComputedStyle(root);
  return normalizeCustomTheme(Object.fromEntries(themeColors.map(([key, , token]) =>
    [key, style.getPropertyValue(token).trim()])));
}

export function customContrast(theme, preference){
  return theme?.contrast && theme.contrast !== 'system' ? theme.contrast === 'high' : preference;
}

export function customThemeStyle(element, theme, highContrast){
  const tokens = ['background', 'surface', 'text', 'muted', 'accent', 'accent-ink', 'border', 'stroke', 'scheme', 'contrast-base'];
  if (!theme) {
    if (element.dataset.theme === 'custom') {
      tokens.forEach(token => element.style.removeProperty('--custom-' + token));
    }
    return;
  }
  const backgroundInk = readableInk(theme.background);
  const light = backgroundInk === '#000000';
  const surface = highContrast && readableInk(theme.surface) !== backgroundInk ? theme.background : theme.surface;
  const values = [
    theme.background, surface, highContrast ? backgroundInk : theme.text,
    highContrast ? backgroundInk : theme.muted, theme.accent, readableInk(theme.accent), highContrast ? backgroundInk : theme.border,
    theme.stroke + 'px', light ? 'light' : 'dark',
    highContrast ? (light ? '#ffffff' : '#000000') : theme.text
  ];
  tokens.forEach((token, index) => element.style.setProperty('--custom-' + token, values[index]));
}

export function themeEditorHtml(theme){
  return `<div class="appearance-editor">
    <div class="custom-theme-sample" id="customThemeSample">
      <header><strong>Vista previa</strong><small>Semestre 1</small></header>
      <article><header><strong>Cálculo integral</strong><b>3,8</b></header>
        <p>Primer parcial <span>30 % · 4,2</span></p>
        <p>Segundo parcial <span>30 % · Pendiente</span></p>
        <span class="custom-theme-action">Añadir nota</span>
      </article>
      <article><header><strong>Horario semanal</strong><small>Lunes</small></header>
        <p class="sample-class"><b>08:00</b><span>Cálculo integral</span></p>
      </article>
    </div>
    <label class="appearance-field">Nombre<input id="customThemeName" maxlength="40" value="${esc(theme.name)}" placeholder="Mi tema"></label>
    <div class="appearance-colors">${themeColors.map(([key, label]) =>
      `<label>${label}<input type="color" id="customColor-${key}" value="${theme[key]}"></label>`).join('')}</div>
    <div class="appearance-dimensions">
      <label class="appearance-field">Grosor del borde (px)<input type="number" id="customStroke" min="0" max="8" step="1" value="${theme.stroke}"></label>
    </div>
    <label class="appearance-field">Contraste<select id="customContrast">
      ${[['system','Usar ajuste general'],['normal','Normal'],['high','Alto']].map(([value,label]) =>
        `<option value="${value}"${theme.contrast === value ? ' selected' : ''}>${label}</option>`).join('')}
    </select></label>
    ${theme.id ? '<button type="button" class="ghost settings-delete" data-act="removeCustomTheme">Eliminar tema</button>' : ''}
  </div>`;
}

export const customThemesKey = 'cuentas-claras-custom-themes';
export const customFontsKey = 'cuentas-claras-custom-fonts';

export function createCustomAppearance(){
  let themes = readList(customThemesKey).filter(item => /^theme-[\da-z]+$/.test(item?.id)).map(normalizeCustomTheme);
  let fonts = readList(customFontsKey).filter(item => /^font-[\da-z]+$/.test(item?.id) &&
    typeof item.name === 'string' && typeof item.data === 'string');
  const faces = new Map();

  function saveTheme(theme){
    const saved = { ...theme, id: theme.id || 'theme-' + uid() };
    const next = theme.id ? themes.map(item => item.id === theme.id ? saved : item) : [...themes, saved];
    localStorage.setItem(customThemesKey, JSON.stringify(next));
    themes = next;
    return saved.id;
  }

  function removeTheme(id){
    const next = themes.filter(item => item.id !== id);
    localStorage.setItem(customThemesKey, JSON.stringify(next));
    themes = next;
  }

  async function readFont(file){
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) throw new Error('Elige un archivo WOFF2, WOFF, TTF u OTF.');
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reader.onabort = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
    const font = { id: 'font-' + uid(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 80), data };
    try { return { font, face: await decodeFont(font) }; }
    catch { throw new Error('El navegador no pudo cargar esta fuente.'); }
  }

  function decodeFont(font){
    return new FontFace(font.id, Uint8Array.from(atob(font.data), char => char.charCodeAt(0))).load();
  }

  function addFont({ font, face }){
    const next = [...fonts, font];
    localStorage.setItem(customFontsKey, JSON.stringify(next));
    fonts = next;
    document.fonts.add(face);
    faces.set(font.id, face);
    return font.id;
  }

  async function loadFont(font){
    if (faces.has(font.id)) return;
    const face = await decodeFont(font);
    if (fonts.includes(font) && !faces.has(font.id)) {
      document.fonts.add(face);
      faces.set(font.id, face);
    }
  }

  function removeFont(id){
    const next = fonts.filter(font => font.id !== id);
    localStorage.setItem(customFontsKey, JSON.stringify(next));
    fonts = next;
    if (faces.has(id)) document.fonts.delete(faces.get(id));
    faces.delete(id);
  }

  function reset(){
    for (const face of faces.values()) document.fonts.delete(face);
    faces.clear();
    themes = [];
    fonts = [];
  }

  return {
    get themes(){ return themes; },
    get fonts(){ return fonts; },
    saveTheme, removeTheme, readFont, addFont, loadFont, removeFont, reset
  };
}
