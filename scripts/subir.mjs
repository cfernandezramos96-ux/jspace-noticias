#!/usr/bin/env node
// subir.mjs · JSpace · sube las slide-NN.jpg de una noticia a catbox.moe, en orden, y devuelve sus URL públicas
// (la API de Instagram solo acepta imágenes por URL). Copiado de metricool-carousel-agent/scripts/upload-catbox.mjs.
// Uso: node scripts/subir.mjs noticias/<carpeta>

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const folder = process.argv[2];
if (!folder) {
  process.stderr.write('Usage: node scripts/upload-catbox.mjs <folder>\n');
  process.exit(1);
}

const abs = resolve(folder);
let entries;
try {
  entries = readdirSync(abs);
} catch (err) {
  process.stderr.write(`Cannot read ${abs}: ${err.message}\n`);
  process.exit(1);
}

const pngs = entries
  .filter((n) => /^slide-\d+\.jpg$/.test(n)) // solo las slides, nunca hoja.png
  .filter((n) => {
    try { return statSync(join(abs, n)).isFile(); }
    catch { return false; }
  })
  .sort();

if (pngs.length === 0) {
  process.stderr.write(`No PNG files in ${abs}\n`);
  process.exit(1);
}

const results = [];
let hadFailure = false;

for (const file of pngs) {
  const fullPath = join(abs, file);
  try {
    const buf = readFileSync(fullPath);
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', new Blob([buf], { type: 'image/jpeg' }), file);
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
    const text = (await res.text()).trim();
    if (!res.ok || !text.startsWith('https://files.catbox.moe/')) {
      results.push({ file, error: text || `HTTP ${res.status}` });
      hadFailure = true;
    } else {
      results.push({ file, url: text });
    }
  } catch (err) {
    results.push({ file, error: err.message });
    hadFailure = true;
  }
}

process.stdout.write(JSON.stringify({ folder: abs, slides: results }, null, 2) + '\n');
process.exit(hadFailure ? 2 : 0);
