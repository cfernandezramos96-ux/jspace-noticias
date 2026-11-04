// radar.mjs · JSpace · vigía de noticias grandes, gratis (Kazuo, 4 nov 2026). Lo corre .github/workflows/radar.yml
// cada 2 horas, sin Claude: lee RSS (Anime News Network, Anime Corner, MyAnimeList, Natalie y prensa colombiana por
// Google Noticias) y busca los nombres de noticias/radar.json. Si encuentra algo nuevo, avisa al grupo con «🔥 ¿Lo
// armo?» y un botón; solo si alguien toca «Ármalo» trabaja Claude (el bot lo manda a la rutina como un link más).
// Lo de Colombia va primero. Máximo 3 avisos por vuelta y 6 al día, para no llenar el chat.
//   node scripts/radar.mjs            → avisa al grupo (necesita TELEGRAM_TOKEN y TELEGRAM_CHAT_ID)
//   node scripts/radar.mjs --prueba   → solo muestra lo que avisaría
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESTADO = join(RAIZ, 'noticias', 'entrada', 'radar.json');
const LISTA = JSON.parse(readFileSync(join(RAIZ, 'noticias', 'radar.json'), 'utf8'));
const PRUEBA = process.argv.includes('--prueba');
const { TELEGRAM_TOKEN: TOKEN, TELEGRAM_CHAT_ID = '' } = process.env;
const GRUPO = TELEGRAM_CHAT_ID.split(',').map((s) => s.trim()).find((c) => c.startsWith('-'));
const gn = (q, hl, gl) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
const FUENTES = [
  ['Anime News Network', 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w'],
  ['Anime Corner', 'https://animecorner.me/feed/'],
  ['MyAnimeList', 'https://myanimelist.net/rss/news.xml'],
  ['Natalie', gn('site:natalie.mu when:1d', 'ja', 'JP')],
  ['Prensa de Colombia', gn('(anime OR manga OR J-pop OR otaku OR cosplay OR "concierto japonés" OR "banda japonesa") (Bogotá OR Colombia OR Medellín OR Cali) when:2d', 'es-419', 'CO')],
];
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tiene = (t, lista) => lista.find((k) => norm(t).includes(norm(k)));
const limpia = (t) => t.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// la primera vez solo memoriza lo que ya hay (sin avisar): el radar es para lo que salga de aquí en adelante
const PRIMERA = !existsSync(ESTADO);
const estado = PRIMERA ? { vistos: {}, pendientes: {}, dia: '', avisos: 0 } : JSON.parse(readFileSync(ESTADO, 'utf8'));
const hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
if (estado.dia !== hoy) { estado.dia = hoy; estado.avisos = 0; }
const ya = readFileSync(join(RAIZ, 'noticias', 'publicadas.md'), 'utf8').toLowerCase();

const hallazgos = [];
for (const [fuente, url] of FUENTES) {
  let xml = '';
  try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JSpaceRadar/1.0)' } }); xml = r.ok ? await r.text() : ''; if (!r.ok) console.log(`${fuente}: ${r.status}`); }
  catch (e) { console.log(`${fuente}: ${e.message}`); }
  for (const it of xml.split(/<item[\s>]/).slice(1)) {
    const titulo = limpia((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const link = limpia((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
    const fecha = new Date(limpia((it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '') || Date.now());
    if (!titulo || Date.now() - fecha > 12 * 3600e3) continue; // solo lo de las últimas 12 h
    const clave = createHash('sha1').update(titulo.replace(/ - [^-]+$/, '')).digest('hex').slice(0, 10);
    if (estado.vistos[clave] || ya.includes(link.toLowerCase())) continue;
    // de Colombia cuenta si es anime, manga, J-pop… o un nombre de la lista (no cualquier cosa japonesa: comida, danza)
    const local = (fuente === 'Prensa de Colombia' || tiene(titulo, LISTA.colombia)) && (tiene(titulo, LISTA.cultura) || tiene(titulo, LISTA.nombres));
    const nombre = tiene(titulo, LISTA.nombres);
    // de Colombia: basta con que sea de cultura japonesa; de fuera: un nombre de la lista y algo que pase de verdad
    if (!local && !(nombre && tiene(titulo, LISTA.importante))) continue;
    hallazgos.push({ clave, titulo, link, fuente, local: !!local, nombre });
  }
}
// Colombia primero; un solo aviso por nombre en cada vuelta
hallazgos.sort((a, b) => b.local - a.local);
const vistos = new Set(), avisar = [];
for (const h of hallazgos) {
  estado.vistos[h.clave] = new Date().toISOString();
  if (PRIMERA || avisar.length >= 3 || estado.avisos + avisar.length >= 6) continue;
  const k = norm(h.nombre || h.titulo);
  if (vistos.has(k)) continue;
  vistos.add(k); avisar.push(h);
}
for (const h of avisar) {
  // los links de Google Noticias son larguísimos: en el chat va solo la fuente (la rutina sí recibe el link)
  const texto = `🔥 ${h.local ? 'Noticia de Colombia' : `Salió algo de ${h.nombre}`}\n${h.titulo}\n(${h.fuente})${h.link.includes('news.google.com') ? '' : ` ${h.link}`}\n¿Lo armo?`;
  console.log(texto.replace(/\n/g, ' · '));
  if (PRUEBA || !TOKEN || !GRUPO) continue;
  estado.pendientes[h.clave] = { titulo: h.titulo, link: h.link, fuente: h.fuente, fecha: new Date().toISOString() };
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    chat_id: GRUPO, text: texto, disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: '✅ Ármalo', callback_data: `radar:${h.clave}` }, { text: '❌ No', callback_data: `radarno:${h.clave}` }]] },
  }) });
  estado.avisos++;
}
// limpieza: vistos de más de 7 días y pendientes de más de 2 días
for (const [k, v] of Object.entries(estado.vistos)) if (Date.now() - new Date(v) > 7 * 86400e3) delete estado.vistos[k];
for (const [k, v] of Object.entries(estado.pendientes)) if (Date.now() - new Date(v.fecha) > 2 * 86400e3) delete estado.pendientes[k];
if (!PRUEBA) writeFileSync(ESTADO, JSON.stringify(estado, null, 2));
console.log(`${hallazgos.length} hallazgo(s), ${avisar.length} aviso(s)`);
