// limpiar-cloudinary.mjs · JSpace · borra de Cloudinary lo que ya no hace falta, para no llenar el plan gratis.
//   node scripts/limpiar-cloudinary.mjs            → solo muestra qué borraría (no toca nada)
//   node scripts/limpiar-cloudinary.mjs --borrar   → lo borra
// Instagram y Facebook copian las imágenes y los videos al publicar: la copia de Cloudinary solo hace falta hasta
// entonces. Se borra lo que tiene más de DIAS días (7 por defecto, --dias N), salvo lo que nombre una noticia que
// todavía no salió (sin publicado.json) o un pedido de Telegram de los últimos 30 días (videos del equipo en espera).
// Necesita CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env (solo en el PC).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(readFileSync(join(RAIZ, '.env'), 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const { CLOUDINARY_CLOUD_NAME: nube, CLOUDINARY_API_KEY: clave, CLOUDINARY_API_SECRET: secreto } = env;
if (!nube || !clave || !secreto) { console.error('faltan las claves de Cloudinary en .env'); process.exit(1); }
const args = process.argv.slice(2), BORRAR = args.includes('--borrar');
const DIAS = Number(args[args.indexOf('--dias') + 1]) || 7;
const auth = 'Basic ' + Buffer.from(`${clave}:${secreto}`).toString('base64');
const api = async (ruta, opciones = {}) => {
  const r = await fetch(`https://api.cloudinary.com/v1_1/${nube}/${ruta}`, { ...opciones, headers: { Authorization: auth } });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status); return j;
};

// lo que todavía se usa: texto de las noticias sin publicar y de los pedidos recientes
const enUso = [];
const noticias = join(RAIZ, 'noticias');
for (const d of readdirSync(noticias, { withFileTypes: true }).filter((x) => x.isDirectory() && x.name !== 'entrada'))
  if (!existsSync(join(noticias, d.name, 'publicado.json')))
    for (const f of readdirSync(join(noticias, d.name)).filter((f) => /\.(json|txt|md)$/.test(f))) enUso.push(readFileSync(join(noticias, d.name, f), 'utf8'));
const entrada = join(noticias, 'entrada');
for (const f of readdirSync(entrada).filter((f) => /\.(json|txt)$/.test(f)))
  if (Date.now() - statSync(join(entrada, f)).mtimeMs < 30 * 86400e3) enUso.push(readFileSync(join(entrada, f), 'utf8'));
const texto = enUso.join('\n');

const limite = Date.now() - DIAS * 86400e3, borrar = [];
let total = 0, bytes = 0;
for (const tipo of ['image', 'video']) {
  let cursor;
  do {
    const j = await api(`resources/${tipo}/upload?max_results=500${cursor ? `&next_cursor=${cursor}` : ''}`);
    for (const r of j.resources) {
      total++;
      if (+new Date(r.created_at) > limite || texto.includes(r.public_id)) continue;
      borrar.push({ tipo, id: r.public_id, mb: r.bytes / 1e6, fecha: r.created_at.slice(0, 10) }); bytes += r.bytes;
    }
    cursor = j.next_cursor;
  } while (cursor);
}
console.log(`${total} archivos en Cloudinary; ${borrar.length} con más de ${DIAS} días y sin uso (${(bytes / 1e6).toFixed(0)} MB)`);
const uso = await api('usage').catch(() => null);
if (uso) console.log(`uso del plan: ${uso.credits?.usage ?? '?'} de ${uso.credits?.limit ?? '?'} créditos (${uso.credits?.used_percent ?? '?'} %)`);
if (!BORRAR) { for (const b of borrar.slice(0, 15)) console.log(`  ${b.fecha} ${b.tipo} ${b.id} (${b.mb.toFixed(1)} MB)`); if (borrar.length > 15) console.log(`  … y ${borrar.length - 15} más`); console.log('Para borrarlos: node scripts/limpiar-cloudinary.mjs --borrar'); process.exit(0); }
for (const tipo of ['image', 'video']) {
  const ids = borrar.filter((b) => b.tipo === tipo).map((b) => b.id);
  for (let i = 0; i < ids.length; i += 100) {
    const q = ids.slice(i, i + 100).map((id) => `public_ids[]=${encodeURIComponent(id)}`).join('&');
    await api(`resources/${tipo}/upload?${q}`, { method: 'DELETE' });
  }
}
console.log(`✓ borrados ${borrar.length} archivos (${(bytes / 1e6).toFixed(0)} MB)`);
