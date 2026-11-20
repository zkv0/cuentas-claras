import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Empaquetador local sin dependencias para los imports nombrados de este proyecto.
// Cada módulo conserva su ámbito; la distribución funciona también bajo file://.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = new Map();
const visiting = new Set();
const importsPattern = /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm;

async function collect(filename) {
  const id = path.relative(root, filename).split(path.sep).join('/');
  if (modules.has(id)) return id;
  if (visiting.has(id)) throw new Error(`Dependencia circular: ${id}`);
  visiting.add(id);
  let source = await readFile(filename, 'utf8');
  const imports = [...source.matchAll(importsPattern)];
  for (const match of imports) {
    const dependency = await collect(path.resolve(path.dirname(filename), match[2]));
    const names = match[1].trim().replace(/\s+as\s+/g, ': ');
    source = source.replace(match[0], `const { ${names} } = modules[${JSON.stringify(dependency)}];\n`);
  }
  const exports = [...source.matchAll(/\bexport\s+(?:function|const|let|var)\s+(\w+)/g)].map(match => match[1]);
  source = source.replace(/\bexport\s+(?=(?:function|const|let|var)\b)/g, '');
  if (/^\s*(?:import|export)\s/m.test(source)) throw new Error(`Sintaxis de módulo no admitida en ${id}`);
  modules.set(id, `// ${id}\nmodules[${JSON.stringify(id)}] = (() => {\n${source}\nreturn { ${exports.join(', ')} };\n})();`);
  visiting.delete(id);
  return id;
}

await collect(path.join(root, 'src/app.js'));
await mkdir(path.join(root, 'assets'), { recursive: true });
await writeFile(path.join(root, 'assets/app.bundle.js'),
  '// Generado por node tools/build.mjs. Edita los módulos de src/.\n' +
  '(() => {\n"use strict";\nconst modules = Object.create(null);\n' +
  [...modules.values()].join('\n\n') + '\n})();\n', 'utf8');
console.log(`JavaScript empaquetado: ${modules.size} módulos.`);

// A different shell produces a different worker, so GitHub Pages can serve updates.
const shell = [
  'index.html', 'manifest.webmanifest',
  'styles/main.css', 'styles/base.css', 'styles/components.css', 'styles/themes.css',
  'assets/app.bundle.js', 'assets/cuentas-claras.svg', 'assets/qrcode.js',
  'assets/lz-string.min.js', 'assets/jsQR.js',
  'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png'
];
const workerTemplate = await readFile(path.join(root, 'tools/sw-template.js'), 'utf8');
const hash = createHash('sha256').update(workerTemplate);
for (const name of shell) hash.update(name).update(await readFile(path.join(root, name)));
const worker = workerTemplate
  .replace('__CACHE_VERSION__', hash.digest('hex').slice(0, 16))
  .replace('__SHELL_FILES__', JSON.stringify(shell));
await writeFile(path.join(root, 'sw.js'), '// Generado por node tools/build.mjs.\n' + worker, 'utf8');
