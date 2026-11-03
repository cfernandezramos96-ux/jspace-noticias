// publicar.mjs · JSpace · publica en @jspaceco_ con la API oficial de Instagram (Instagram API with Instagram Login)
//   node scripts/publicar.mjs noticias/<carpeta>            → publica ya esa noticia
//   node scripts/publicar.mjs noticias/<carpeta> --a 18:30  → la deja en cola para esa hora (hoy, o mañana si ya pasó)
//   node scripts/publicar.mjs --cola                        → publica lo que esté en cola y ya toque (lo lanza la tarea de Windows)
//   node scripts/publicar.mjs --cuenta                      → comprueba el token: usuario, tipo de cuenta y cupo de publicaciones
//   node scripts/publicar.mjs --renovar                     → renueva el token (dura 60 días) y lo guarda en .env
//
// Lee .env (IG_USER_ID, IG_TOKEN). Las slides salen de la carpeta: slide-NN.jpg (imágenes) o slide-NN.mp4 (carrusel
// animado), en orden, y la leyenda de leyenda.txt. Las sube a Cloudinary (o a catbox si no está en .env; la API solo
// acepta URLs públicas), crea los
// contenedores, espera a que Instagram los procese y publica. Al terminar escribe publicado.json y una línea en
// noticias/publicadas.md. Nunca imprime el token.
import { readFileSync, writeFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = join(RAIZ, '.env');

// ---------- .env ----------
const leeEnv = () => Object.fromEntries((existsSync(ENV) ? readFileSync(ENV, 'utf8') : '').split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
// en la nube no hay .env: las claves llegan como variables del entorno (las del .env mandan si están las dos)
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(IG_|CLOUDINARY_)/.test(k))), ...leeEnv() };
const VER = env.IG_API_VERSION || 'v23.0';
const TOKEN = env.IG_TOKEN, USER = env.IG_USER_ID || '17841453083457784'; // el id de @jspaceco_ (panel de Meta)
const falla = (msg) => { console.error('✗ ' + msg); process.exit(1); };
if (!TOKEN) falla('falta IG_TOKEN en .env (mira .env.example)');
// Dos tipos de token: el de «inicio de sesión unificado» (usuario del sistema, empieza por EAA, no caduca) va por
// graph.facebook.com; el de «inicio de sesión de Instagram» (IGAA…, 60 días) va por graph.instagram.com.
const FB = TOKEN.startsWith('EAA');
const API = FB ? 'https://graph.facebook.com' : 'https://graph.instagram.com';

// ---------- llamadas a la API (el token va en el cuerpo o en la query, nunca en lo que se imprime) ----------
async function api(metodo, ruta, params = {}) {
  const url = new URL(ruta.startsWith('http') ? ruta : `${API}/${VER}/${ruta}`);
  const cuerpo = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = metodo === 'GET'
    ? await fetch(url + (url.search ? '&' : '?') + cuerpo)
    : await fetch(url, { method: 'POST', body: cuerpo });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) {
    const e = j.error || {};
    throw new Error(`${metodo} ${ruta}: ${e.message || res.status}${e.error_subcode ? ` (subcódigo ${e.error_subcode})` : ''}`);
  }
  return j;
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// Instagram procesa cada contenedor (sobre todo los videos) antes de dejar publicarlo
async function listo(id, rotulo) {
  for (let i = 0; i < 60; i++) {
    const { status_code: s, status } = await api('GET', id, { fields: 'status_code,status' });
    if (s === 'FINISHED') return;
    if (s === 'ERROR' || s === 'EXPIRED') throw new Error(`${rotulo}: Instagram no lo pudo procesar (${status || s})`);
    await espera(5000);
  }
  throw new Error(`${rotulo}: sigue procesándose después de 5 minutos`);
}

// ---------- subida a una URL pública: Cloudinary (si está en .env) o catbox ----------
async function sube(ruta) {
  const tipo = ruta.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
  const { CLOUDINARY_CLOUD_NAME: nube, CLOUDINARY_API_KEY: clave, CLOUDINARY_API_SECRET: secreto } = env;
  if (nube && clave && secreto) {
    // subida firmada: sha1 de los parámetros ordenados + el secreto (el secreto nunca viaja)
    const { createHash } = await import('node:crypto');
    const params = { folder: 'jspace', timestamp: String(Math.floor(Date.now() / 1000)) };
    const firma = createHash('sha1').update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + secreto).digest('hex');
    const form = new FormData();
    form.append('file', new Blob([readFileSync(ruta)], { type: tipo }), basename(ruta));
    for (const [k, v] of Object.entries(params)) form.append(k, v);
    form.append('api_key', clave); form.append('signature', firma);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${nube}/${tipo.startsWith('video') ? 'video' : 'image'}/upload`, { method: 'POST', body: form });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.secure_url) throw new Error(`Cloudinary no aceptó ${basename(ruta)}: ${j.error?.message || res.status}`);
    return j.secure_url;
  }
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', new Blob([readFileSync(ruta)], { type: tipo }), basename(ruta));
  const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  const txt = (await res.text()).trim();
  if (!res.ok || !txt.startsWith('https://files.catbox.moe/')) throw new Error(`no se pudo subir ${basename(ruta)}: ${txt || res.status}`);
  return txt;
}

// ---------- publicar una carpeta ----------
async function publica(carpeta) {
  if (!USER) falla('falta IG_USER_ID en .env (sale con --cuenta)');
  if (existsSync(join(carpeta, 'publicado.json'))) falla(`${basename(carpeta)} ya está publicada`);
  const archivos = readdirSync(carpeta).filter((f) => /^slide-\d+\.(jpg|mp4)$/.test(f)).sort();
  // si hay MP4 de un slide (carrusel animado) se usa ese en vez del JPG
  const porNum = new Map();
  for (const f of archivos) { const n = f.match(/\d+/)[0]; if (!porNum.has(n) || f.endsWith('.mp4')) porNum.set(n, f); }
  const slides = [...porNum.keys()].sort().map((n) => porNum.get(n));
  if (!slides.length) falla('no hay slide-NN.jpg ni slide-NN.mp4 en la carpeta');
  if (slides.length > 20) falla('Instagram admite 20 slides como máximo');
  const leyenda = existsSync(join(carpeta, 'leyenda.txt')) ? readFileSync(join(carpeta, 'leyenda.txt'), 'utf8').trim() : '';
  if (leyenda.length > 2200) falla('la leyenda pasa de 2.200 caracteres');

  console.log(`→ subiendo ${slides.length} archivo(s)`);
  const urls = [];
  for (const f of slides) urls.push(await sube(join(carpeta, f)));

  const media = (url, extra) => url.endsWith('.mp4') ? { media_type: 'VIDEO', video_url: url, ...extra } : { image_url: url, ...extra };
  let contenedor;
  if (slides.length === 1) {
    contenedor = (await api('POST', `${USER}/media`, media(urls[0], { caption: leyenda }))).id;
  } else {
    const hijos = [];
    for (let i = 0; i < urls.length; i++) {
      const { id } = await api('POST', `${USER}/media`, media(urls[i], { is_carousel_item: 'true' }));
      await listo(id, `slide ${i + 1}`);
      hijos.push(id);
    }
    contenedor = (await api('POST', `${USER}/media`, { media_type: 'CAROUSEL', children: hijos.join(','), caption: leyenda })).id;
  }
  await listo(contenedor, 'post');
  const { id } = await api('POST', `${USER}/media_publish`, { creation_id: contenedor });
  const { permalink } = await api('GET', id, { fields: 'permalink' });
  const ahora = new Date();
  writeFileSync(join(carpeta, 'publicado.json'), JSON.stringify({ id, permalink, fecha: ahora.toISOString() }, null, 2));
  const n = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8'));
  const fecha = ahora.toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16);
  appendFileSync(join(RAIZ, 'noticias', 'publicadas.md'), `${fecha} · ${n.titular} · ${n.formato || ''} · ${n.link || ''} · ${permalink}\n`);
  console.log(`✓ publicado: ${permalink}`);
}

// ---------- cola ----------
// programado.json = { "hora": ISO } en la carpeta de la noticia; --cola publica las que ya tocan
function enCola(carpeta, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) falla('la hora va como HH:MM');
  // la hora es de Bogotá (UTC−5, sin horario de verano)
  const hoy = new Date(Date.now() - 5 * 3600e3);
  let t = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), h + 5, m);
  if (t < Date.now()) t += 24 * 3600e3;
  writeFileSync(join(carpeta, 'programado.json'), JSON.stringify({ hora: new Date(t).toISOString() }, null, 2));
  console.log(`✓ en cola para ${new Date(t).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (hora de Bogotá)`);
}
async function cola() {
  const dir = join(RAIZ, 'noticias');
  const pendientes = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(dir, d.name))
    .filter((c) => existsSync(join(c, 'programado.json')) && !existsSync(join(c, 'publicado.json')))
    .filter((c) => new Date(JSON.parse(readFileSync(join(c, 'programado.json'), 'utf8')).hora) <= new Date());
  if (!pendientes.length) return console.log('nada en cola para ahora');
  for (const c of pendientes) {
    try { await publica(c); }
    catch (e) { console.error(`✗ ${basename(c)}: ${e.message}`); writeFileSync(join(c, 'error.txt'), `${new Date().toISOString()}\n${e.message}\n`); }
  }
}

// ---------- cuenta y token ----------
async function cuenta() {
  console.log(`token de ${FB ? 'usuario del sistema (no caduca)' : 'Instagram (60 días)'}`);
  const yo = FB
    ? await api('GET', USER, { fields: 'id,username' })
    : await api('GET', 'me', { fields: 'user_id,username,account_type' });
  console.log(`cuenta: @${yo.username} · IG_USER_ID=${yo.user_id || yo.id}${yo.account_type ? ` · tipo ${yo.account_type}` : ''}`);
  const lim = await api('GET', `${USER}/content_publishing_limit`, { fields: 'quota_usage,config' }).catch(() => null);
  if (lim?.data?.[0]) console.log(`publicaciones en las últimas 24 h: ${lim.data[0].quota_usage} de ${lim.data[0].config?.quota_total ?? '?'}`);
}
async function renovar() {
  if (FB) return console.log('el token de usuario del sistema no caduca: no hace falta renovarlo');
  const j = await api('GET', `${API}/refresh_access_token`, { grant_type: 'ig_refresh_token' });
  const txt = readFileSync(ENV, 'utf8').replace(/^IG_TOKEN=.*$/m, `IG_TOKEN=${j.access_token}`);
  writeFileSync(ENV, txt);
  console.log(`✓ token renovado: vale ${Math.round(j.expires_in / 86400)} días más`);
}

// ---------- entrada ----------
const args = process.argv.slice(2);
try {
  if (args[0] === '--cuenta') await cuenta();
  else if (args[0] === '--renovar') await renovar();
  else if (args[0] === '--cola') await cola();
  else if (args[0]) {
    const carpeta = resolve(args[0]);
    const i = args.indexOf('--a');
    if (i > 0) enCola(carpeta, args[i + 1] || ''); else await publica(carpeta);
  } else falla('uso: node scripts/publicar.mjs noticias/<carpeta> [--a HH:MM] | --cola | --cuenta | --renovar');
} catch (e) { falla(e.message); }
