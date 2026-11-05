// publicar.mjs · JSpace · publica en @jspaceco_ con la API oficial de Instagram (Instagram API with Instagram Login)
//   node scripts/publicar.mjs noticias/<carpeta>            → publica ya esa noticia
//   node scripts/publicar.mjs noticias/<carpeta> --a 18:30  → la deja en cola para esa hora (hoy, o mañana si ya pasó)
//   node scripts/publicar.mjs --cola                        → publica lo que esté en cola y ya toque (lo lanza la tarea de Windows)
//   node scripts/publicar.mjs --informe [días=7]               → resultados de los posts de los últimos días (JSON)
//   node scripts/publicar.mjs --cuenta                      → comprueba el token: usuario, tipo de cuenta y cupo de publicaciones
//   node scripts/publicar.mjs --renovar                     → renueva el token (dura 60 días) y lo guarda en .env
//   node scripts/publicar.mjs --subida <archivo>                → solo sube ese archivo a Cloudinary y muestra la URL (prueba)
//   node scripts/publicar.mjs --facebook noticias/<carpeta>     → sube a Facebook un post que ya salió en Instagram
//
// Lee .env (IG_USER_ID, IG_TOKEN). Las slides salen de la carpeta: slide-NN.jpg (imágenes) o slide-NN.mp4 (carrusel
// animado), en orden, y la leyenda de leyenda.txt. Las sube a Cloudinary (o a catbox si no está en .env; la API solo
// acepta URLs públicas; en la nube con un upload preset sin firma), crea los
// contenedores, espera a que Instagram los procese y publica. Al terminar escribe publicado.json y una línea en
// noticias/publicadas.md. Después publica lo mismo en la página de Facebook de JSpace (FB_PUBLICAR=no lo apaga).
// Nunca imprime el token.
import { readFileSync, writeFileSync, readdirSync, existsSync, appendFileSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
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
// En la nube el token NO está en el entorno: es un «Network secret» y el proxy de la nube lo añade como
// `Authorization: Bearer` a cada petición a graph.facebook.com. IG_AUTH=proxy activa ese modo.
const PROXY = env.IG_AUTH === 'proxy';
// El fetch de Node no usa HTTPS_PROXY si no se lo piden, y sin el proxy no llega el secreto: en ese caso el script se
// vuelve a lanzar con NODE_USE_ENV_PROXY=1 (Node ≥ 24) y espera a que termine.
if (PROXY && process.env.NODE_USE_ENV_PROXY !== '1') {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(r.status ?? 1);
}
const falla = (msg) => { console.error('✗ ' + msg); process.exit(1); };
if (!TOKEN && !PROXY) falla('falta IG_TOKEN en .env (mira .env.example)');
// Dos tipos de token: el de «inicio de sesión unificado» (usuario del sistema, empieza por EAA, no caduca) va por
// graph.facebook.com; el de «inicio de sesión de Instagram» (IGAA…, 60 días) va por graph.instagram.com.
const FB = PROXY || TOKEN.startsWith('EAA');
const API = FB ? 'https://graph.facebook.com' : 'https://graph.instagram.com';

// ---------- llamadas a la API (el token va en el cuerpo o en la query, nunca en lo que se imprime) ----------
async function api(metodo, ruta, params = {}) {
  const url = new URL(ruta.startsWith('http') ? ruta : `${API}/${VER}/${ruta}`);
  // un access_token en params (el de la página de Facebook) manda sobre el del usuario del sistema
  const cuerpo = new URLSearchParams(PROXY ? params : { access_token: TOKEN, ...params });
  const res = metodo === 'GET'
    ? await fetch(url + (url.search ? '&' : '?') + cuerpo)
    : await fetch(url, { method: metodo, body: cuerpo });
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
  const { CLOUDINARY_CLOUD_NAME: nube, CLOUDINARY_API_KEY: clave, CLOUDINARY_API_SECRET: secreto, CLOUDINARY_UPLOAD_PRESET: preset } = env;
  if (nube && ((clave && secreto) || preset)) {
    const form = new FormData();
    form.append('file', new Blob([readFileSync(ruta)], { type: tipo }), basename(ruta));
    if (clave && secreto) {
      // en el PC: subida firmada (sha1 de los parámetros ordenados + el secreto; el secreto nunca viaja)
      const { createHash } = await import('node:crypto');
      const params = { folder: 'jspace', timestamp: String(Math.floor(Date.now() / 1000)) };
      const firma = createHash('sha1').update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + secreto).digest('hex');
      for (const [k, v] of Object.entries(params)) form.append(k, v);
      form.append('api_key', clave); form.append('signature', firma);
    } else {
      // en la nube: «upload preset» sin firma (no hace falta el secreto; la carpeta la fija el preset)
      form.append('upload_preset', preset);
    }
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
  const urls = [], urlDe = {};
  for (const f of slides) { const u = await sube(join(carpeta, f)); urls.push(u); urlDe[f] = u; }

  // Collab de Instagram: noticia.json puede traer "colaboradores": ["elkazuotv"] (les llega la invitación)
  let colab = [];
  try { colab = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8')).colaboradores || []; } catch {}
  const conColab = colab.length ? { collaborators: JSON.stringify(colab.map((u) => u.replace(/^@/, ''))) } : {};
  // Etiquetas (Kazuo, 4 nov 2026): en eventos se etiqueta a la productora que lo organiza y al artista.
  // noticia.json "etiquetas": ["breakfast_live", "otobokebeaver"] → van en la primera imagen del post al publicar.
  // Hay que ponerlas aquí: si después se etiqueta desde la app editando el post, Instagram quita la collab.
  let etiquetas = [];
  try { etiquetas = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8')).etiquetas || []; } catch {}
  const tags = etiquetas.slice(0, 20).map((u, i) => ({ username: u.replace(/^@/, ''), x: 0.15 + 0.7 * ((i % 3) / 2), y: 0.12 + 0.1 * Math.floor(i / 3) }));
  const primeraImg = slides.findIndex((f) => f.endsWith('.jpg'));
  const conTags = (i) => tags.length && i === primeraImg ? { user_tags: JSON.stringify(tags) } : {};
  const media = (url, extra) => url.endsWith('.mp4') ? { media_type: 'VIDEO', video_url: url, ...extra } : { image_url: url, ...extra };
  let contenedor;
  if (slides.length === 1) {
    contenedor = (await api('POST', `${USER}/media`, media(urls[0], { caption: leyenda, ...conColab, ...conTags(0) }))).id;
  } else {
    const hijos = [];
    for (let i = 0; i < urls.length; i++) {
      const { id } = await api('POST', `${USER}/media`, media(urls[i], { is_carousel_item: 'true', ...conTags(i) }));
      await listo(id, `slide ${i + 1}`);
      hijos.push(id);
    }
    contenedor = (await api('POST', `${USER}/media`, { media_type: 'CAROUSEL', children: hijos.join(','), caption: leyenda, ...conColab })).id;
  }
  await listo(contenedor, 'post');
  const { id } = await api('POST', `${USER}/media_publish`, { creation_id: contenedor });
  const { permalink } = await api('GET', id, { fields: 'permalink' });
  const ahora = new Date();
  const registro = { id, permalink, fecha: ahora.toISOString() };
  writeFileSync(join(carpeta, 'publicado.json'), JSON.stringify(registro, null, 2));
  console.log(`✓ publicado en Instagram: ${permalink}`);
  // Facebook va después y aparte: si falla, el post de Instagram ya salió y no se repite
  await enFacebook(carpeta, registro, leyenda, urlDe);
  await enHistoria(carpeta, registro);
  await reelDePrueba(carpeta, registro, leyenda);
  const n = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8'));
  const fecha = ahora.toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16);
  appendFileSync(join(RAIZ, 'noticias', 'publicadas.md'),
    `${fecha} · ${n.franja || '-'} · ${n.titular} · ${n.formato || ''} · ${n.link || ''} · ${permalink}${registro.facebook ? ` · FB: ${registro.facebook}` : ''}\n`);
}

// ---------- reel de prueba en Instagram: el reel.mp4 (posts con video) solo para quienes NO siguen la cuenta ----------
// (Kazuo, 4 nov 2026, prueba de un mes) Los seguidores ven el carrusel; el reel sale a buscar gente nueva. Se queda
// como reel de prueba para siempre: graduation_strategy MANUAL y NUNCA se gradúa (ni a mano). Los reels de prueba
// no admiten collab. noticia.json "reel_prueba": false lo apaga para un post.
const REELS_PRUEBA = Date.now() < Date.parse('2026-12-04T05:00:00Z');
async function reelDePrueba(carpeta, registro, leyenda) {
  let n = {}; try { n = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8')); } catch {}
  const reel = join(carpeta, 'reel.mp4');
  if (!REELS_PRUEBA || n.reel_prueba === false || !existsSync(reel)) return;
  try {
    const url = await sube(reel);
    const { id: c } = await api('POST', `${USER}/media`, { media_type: 'REELS', video_url: url, caption: leyenda, share_to_feed: 'false', trial_params: JSON.stringify({ graduation_strategy: 'MANUAL' }) });
    await listo(c, 'reel de prueba');
    const { id } = await api('POST', `${USER}/media_publish`, { creation_id: c });
    registro.reel_prueba = id;
    console.log('✓ reel de prueba publicado (solo para no seguidores)');
  } catch (e) { registro.reel_prueba_error = e.message; console.error(`✗ reel de prueba: ${e.message}`); }
  writeFileSync(join(carpeta, 'publicado.json'), JSON.stringify(registro, null, 2));
}

// ---------- historia de Instagram: la portada del post en vertical, para que lo vean los seguidores ----------
// (Kazuo, 4 nov 2026) La API publica historias de imagen, pero sin stickers (ni encuesta, ni pregunta, ni enlace):
// esos solo se ponen desde la app. HISTORIA=no la apaga; noticia.json puede traer "historia": false.
function historiaJpg(carpeta) {
  const fuente = join(carpeta, 'slide-01.jpg'), salida = join(carpeta, 'historia.jpg');
  const marca = 'plantilla/marca/jspace-marca-agua.png', F = 'plantilla/fuentes/Poppins-Black.ttf';
  const texto = (t, y, color, tam) => `drawtext=fontfile=${F}:text='${t}':fontcolor=${color}:fontsize=${tam}:x=(w-text_w)/2:y=${y}`;
  const filtro = '[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=30,eq=brightness=-0.18[f];' +
    '[b]scale=880:1100[p];[f][p]overlay=100:420[c];[1:v]scale=300:-1[m];[c][m]overlay=(W-w)/2:130,' +
    texto('NUEVO POST', 300, '0xFF3636', 72) + ',' + texto('Míralo en el perfil', 1600, 'white', 54) + '[o]';
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', fuente, '-i', marca, '-filter_complex', filtro, '-map', '[o]', '-q:v', '3', '-frames:v', '1', salida], { cwd: RAIZ });
  return salida;
}
// Prueba de 2 semanas (Kazuo, 4 nov 2026): del 4 al 18 de noviembre; el informe del lunes 16 dice si sirvieron.
const HISTORIAS = Date.now() < Date.parse('2026-11-18T05:00:00Z');
async function enHistoria(carpeta, registro) {
  if (!HISTORIAS) return;
  let n = {}; try { n = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8')); } catch {}
  if (env.HISTORIA === 'no' || process.env.HISTORIA === 'no' || n.historia === false) return;
  try {
    const url = await sube(historiaJpg(carpeta));
    const { id: c } = await api('POST', `${USER}/media`, { media_type: 'STORIES', image_url: url });
    await listo(c, 'historia');
    const { id } = await api('POST', `${USER}/media_publish`, { creation_id: c });
    registro.historia = id;
    console.log('✓ historia publicada');
  } catch (e) { registro.historia_error = e.message; console.error(`✗ historia: ${e.message}`); }
  writeFileSync(join(carpeta, 'publicado.json'), JSON.stringify(registro, null, 2));
}

// ---------- Facebook: la página de JSpace, con las mismas imágenes y la misma leyenda ----------
// Varias fotos en un post (Facebook no mezcla fotos y video: de una slide con video se sube su JPG).
const PAGINA = env.FB_PAGE_ID || '169636513221619';
const PERFIL_FB = '100053164456324'; // la misma página en el formato nuevo (profile.php?id=…): sus links sí abren en el celular
// En Facebook van solo las imágenes de la noticia: la slide de cierre («Sigue a @jspaceco_») no tiene sentido ahí
function slidesFacebook(carpeta) {
  const tipos = (JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8')).slides || []).map((s) => s.tipo);
  return readdirSync(carpeta).filter((f) => /^slide-\d+\.jpg$/.test(f)).sort()
    .filter((f) => !['cierre', 'video'].includes(tipos[Number(f.match(/\d+/)[0]) - 1]));
}
async function enFacebook(carpeta, registro, leyenda, urlDe = {}) {
  if (env.FB_PUBLICAR === 'no' || process.env.FB_PUBLICAR === 'no') return;
  try {
    const { access_token: pt } = await api('GET', PAGINA, { fields: 'access_token' });
    // post con video: en Facebook sale el reel vertical (reel.mp4, de scripts/reel.mjs), no el carrusel (Kazuo, 3 nov
    // 2026). Si el reel falla, salen las fotos como siempre y el error queda anotado.
    if (existsSync(join(carpeta, 'reel.mp4'))) {
      try {
        Object.assign(registro, await reelFacebook(join(carpeta, 'reel.mp4'), leyenda, pt, 'PUBLISHED'));
        delete registro.facebook_reel_error;
        console.log(`✓ reel publicado en Facebook: ${registro.facebook}`);
        writeFileSync(join(carpeta, 'publicado.json'), JSON.stringify(registro, null, 2));
        return;
      } catch (e) {
        registro.facebook_reel_error = e.message;
        console.error(`✗ reel de Facebook: ${e.message} (salen las fotos)`);
      }
    }
    const jpgs = slidesFacebook(carpeta);
    const fotos = [];
    for (const f of jpgs) {
      const url = urlDe[f] || await sube(join(carpeta, f));
      fotos.push((await api('POST', `${PAGINA}/photos`, { url, published: 'false', access_token: pt })).id);
    }
    const params = { message: leyenda, access_token: pt };
    fotos.forEach((fbid, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: fbid }); });
    const { id } = await api('POST', `${PAGINA}/feed`, params);
    // el permalink_url de la API trae un id viejo de la página (1856998409415623) que la app del celular no abre
    // («This isn't available»); se usa el id del perfil nuevo de la página, el mismo que da Facebook como og:url
    const { permalink_url: crudo } = await api('GET', id, { fields: 'permalink_url', access_token: pt });
    const permalink_url = `https://www.facebook.com/${PERFIL_FB}/posts/${id.split('_').pop()}`;
    Object.assign(registro, { facebook: permalink_url, facebook_id: id, facebook_crudo: crudo });
    console.log(`✓ publicado en Facebook: ${permalink_url}`);
  } catch (e) {
    registro.facebook_error = e.message;
    console.error(`✗ Facebook: ${e.message} (Instagram sí salió)`);
  }
  writeFileSync(join(carpeta, 'publicado.json'), JSON.stringify(registro, null, 2));
}

// reel de la página: start → subida por URL (rupload, con el token de la página) → finish → espera a que quede listo
async function reelFacebook(ruta, leyenda, pt, estado) {
  const url = await sube(ruta);
  const { video_id, upload_url } = await api('POST', `${PAGINA}/video_reels`, { upload_phase: 'start', access_token: pt });
  const r = await fetch(upload_url, { method: 'POST', headers: { Authorization: `OAuth ${pt}`, file_url: url } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(`subida del reel: ${j.error?.message || j.debug_info?.message || r.status}`);
  await api('POST', `${PAGINA}/video_reels`, { upload_phase: 'finish', video_id, video_state: estado, description: leyenda, access_token: pt });
  for (let i = 0; i < 60; i++) {
    const { status: s = {} } = await api('GET', video_id, { fields: 'status', access_token: pt });
    if (s.video_status === 'error' || s.processing_phase?.status === 'error') throw new Error(`Facebook no pudo procesar el reel (${JSON.stringify(s.processing_phase?.errors || s.video_status)})`);
    if (s.video_status === 'ready' && (estado !== 'PUBLISHED' || s.publishing_phase?.status === 'complete')) break;
    await espera(5000);
  }
  const { permalink_url: p } = await api('GET', video_id, { fields: 'permalink_url', access_token: pt });
  return { facebook: p?.startsWith('/') ? `https://www.facebook.com${p}` : p, facebook_id: video_id, facebook_tipo: 'reel' };
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
// --esperar: si lo próximo de la cola toca en menos de 8 min, espera a su hora y lo publica (el bot despierta la nube
// un par de minutos antes para que salga puntual)
// Candado para no publicar dos veces (4 nov 2026: Kenshi Yonezu salió doble porque dos rutinas lo publicaron a la
// vez). Antes de publicar, la rutina sube a GitHub un publicando.json con su marca; si el push choca con el de otra
// rutina, gana la que llegó primero y la otra lo salta. Sin git (o sin remoto) no bloquea.
function reclama(c) {
  const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const f = join(c, 'publicando.json'), rel = f.slice(RAIZ.length + 1).replace(/\\/g, '/');
  const yo = `${process.env.HOSTNAME || process.env.COMPUTERNAME || 'pc'}-${process.pid}-${Date.now()}`;
  const ajeno = () => { try { const p = JSON.parse(readFileSync(f, 'utf8')); return p.quien !== yo && Date.now() - new Date(p.fecha) < 20 * 60e3; } catch { return false; } };
  try { git('pull', '-q', '--rebase', '--autostash'); } catch { return true; } // sin remoto: no hay con quién chocar
  for (let i = 0; i < 3; i++) {
    if (existsSync(join(c, 'publicado.json')) || ajeno()) return false;
    writeFileSync(f, JSON.stringify({ quien: yo, fecha: new Date().toISOString() }, null, 2));
    try { git('add', rel); git('commit', '-q', '-m', `Publicando ${basename(c)}`); git('push', '-q'); return true; }
    catch {
      // el push falló: otra rutina subió algo antes; deshacemos el commit propio y miramos qué hay en GitHub
      // (soft: nunca toca otros archivos sin guardar, por si corre en el PC)
      try { git('reset', '-q', '--soft', 'HEAD~1'); git('reset', '-q', '--', rel); unlinkSync(f); git('pull', '-q', '--rebase', '--autostash'); } catch { return false; }
    }
  }
  return false;
}

async function cola(esperar = false) {
  const dir = join(RAIZ, 'noticias');
  const enCola = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(dir, d.name))
    .filter((c) => existsSync(join(c, 'programado.json')) && !existsSync(join(c, 'publicado.json')));
  const horaDe = (c) => new Date(JSON.parse(readFileSync(join(c, 'programado.json'), 'utf8')).hora);
  if (esperar) {
    const proxima = Math.min(...enCola.map((c) => +horaDe(c)).filter((t) => t > Date.now() && t - Date.now() < 8 * 60e3));
    if (Number.isFinite(proxima)) {
      console.log(`esperando a las ${new Date(proxima).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })} para publicar`);
      await new Promise((r) => setTimeout(r, proxima - Date.now() + 1000));
    }
  }
  const pendientes = enCola.filter((c) => horaDe(c) <= new Date());
  if (!pendientes.length) return console.log('nada en cola para ahora');
  for (const c of pendientes) {
    if (!reclama(c)) { console.log(`${basename(c)}: otra rutina ya lo está publicando, lo salto`); continue; }
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
  // Facebook: sacar el token de la página y usarlo en una lectura (en la nube convive con el del proxy)
  try {
    const { access_token: pt } = await api('GET', PAGINA, { fields: 'access_token' });
    const p = await api('GET', PAGINA, { fields: 'name', access_token: pt });
    console.log(`facebook: página «${p.name}» · token de página OK`);
  } catch (e) { console.log(`facebook: ✗ ${e.message}`); }
}
async function renovar() {
  if (FB) return console.log('el token de usuario del sistema no caduca: no hace falta renovarlo');
  const j = await api('GET', `${API}/refresh_access_token`, { grant_type: 'ig_refresh_token' });
  const txt = readFileSync(ENV, 'utf8').replace(/^IG_TOKEN=.*$/m, `IG_TOKEN=${j.access_token}`);
  writeFileSync(ENV, txt);
  console.log(`✓ token renovado: vale ${Math.round(j.expires_in / 86400)} días más`);
}

// ---------- informe de resultados (lo usa la rutina de los lunes) ----------
// Los posts de Instagram de los últimos N días con likes, comentarios y, si el token tiene instagram_manage_insights,
// alcance, guardados, compartidos y vistas. Imprime JSON; la rutina lo lee y escribe el informe.
async function informe(dias = 7) {
  const desde = Date.now() - dias * 86400e3, posts = [];
  let r = await api('GET', `${USER}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count', limit: '50' });
  for (;;) {
    for (const m of r.data || []) if (+new Date(m.timestamp) >= desde) posts.push(m);
    const ultimo = r.data?.[r.data.length - 1];
    if (!r.paging?.next || !ultimo || +new Date(ultimo.timestamp) < desde) break;
    r = await api('GET', r.paging.next);
  }
  let sinInsights = null;
  for (const m of posts) {
    try {
      const i = await api('GET', `${m.id}/insights`, { metric: 'reach,saved,shares,views,total_interactions' });
      m.metricas = Object.fromEntries((i.data || []).map((x) => [x.name, x.values?.[0]?.value ?? x.total_value?.value]));
    } catch (e) { sinInsights = e.message; break; }
  }
  const hora = (t) => new Date(t).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  console.log(JSON.stringify({
    dias, posts: posts.length, ...(sinInsights ? { aviso_insights: `sin alcance ni guardados: ${sinInsights}` } : {}),
    lista: posts.map((m) => ({ fecha: hora(m.timestamp), tipo: m.media_type, likes: m.like_count, comentarios: m.comments_count,
      ...(m.metricas || {}), link: m.permalink, titulo: (m.caption || '').split('\n')[0].slice(0, 90) })),
  }, null, 2));
}

// ---------- entrada ----------
const args = process.argv.slice(2);
try {
  if (args[0] === '--cuenta') await cuenta();
  else if (args[0] === '--historia-prueba') console.log(historiaJpg(resolve(args[1] || falla('uso: --historia-prueba noticias/<carpeta>'))));
  else if (args[0] === '--reel-ig-prueba') {
    // crea el contenedor de un reel de prueba (solo para no seguidores) y NO lo publica: comprueba que Instagram lo acepta
    const url = await sube(resolve(args[1] || falla('uso: --reel-ig-prueba <reel.mp4>')));
    const { id } = await api('POST', `${USER}/media`, { media_type: 'REELS', video_url: url, caption: 'prueba', share_to_feed: 'false', trial_params: JSON.stringify({ graduation_strategy: 'MANUAL' }) });
    await listo(id, 'reel de prueba');
    console.log(`✓ Instagram aceptó y procesó el reel de prueba (contenedor ${id}, sin publicar: caduca solo)`);
  }
  else if (args[0] === '--feed-nuevo') {
    // posts del feed de @jspaceco_ de los últimos N días que no salieron por este script ni están anotados como externos
    // (los que el equipo sube a mano, p. ej. con canción): los revisa la tarea nocturna del PC para el horario
    const dias = Number(args[1]) || 3, desde = Date.now() - dias * 86400e3;
    const conocidos = readFileSync(join(RAIZ, 'noticias', 'publicadas.md'), 'utf8') +
      (existsSync(join(RAIZ, 'noticias', 'externos.json')) ? readFileSync(join(RAIZ, 'noticias', 'externos.json'), 'utf8') : '');
    // los reels de prueba e historias que sube este script también aparecen en el feed: no son posts a mano
    const nuestros = new Set();
    for (const d of readdirSync(join(RAIZ, 'noticias'))) {
      const f = join(RAIZ, 'noticias', d, 'publicado.json');
      if (!existsSync(f)) continue;
      try { const r = JSON.parse(readFileSync(f, 'utf8')); for (const k of ['id', 'reel_prueba', 'historia']) if (r[k]) nuestros.add(String(r[k])); } catch {}
    }
    const { data = [] } = await api('GET', `${USER}/media`, { fields: 'id,timestamp,permalink,media_type,caption', limit: '30' });
    console.log(JSON.stringify(data.filter((m) => +new Date(m.timestamp) >= desde && !nuestros.has(String(m.id)) && !conocidos.includes(m.permalink.split('/').filter(Boolean).pop()))
      .map((m) => ({ fecha: m.timestamp, link: m.permalink, tipo: m.media_type, texto: (m.caption || '').split('\n')[0].slice(0, 120) })), null, 2));
  }
  else if (args[0] === '--informe') await informe(Number(args[1]) || 7);
  else if (args[0] === '--facebook') {
    // sube a Facebook un post que ya salió en Instagram (sin repetirlo en Instagram)
    const c = resolve(args[1] || falla('uso: --facebook noticias/<carpeta>'));
    if (!existsSync(join(c, 'publicado.json'))) falla('esa noticia no está publicada en Instagram');
    const reg = JSON.parse(readFileSync(join(c, 'publicado.json'), 'utf8'));
    if (reg.facebook) falla(`ya está en Facebook: ${reg.facebook}`);
    delete reg.facebook_error;
    await enFacebook(c, reg, readFileSync(join(c, 'leyenda.txt'), 'utf8').trim());
  }
  else if (args[0] === '--reel-prueba') {
    // sube un reel como borrador (no sale en la página), comprueba que Facebook lo procesa y lo borra
    const { access_token: pt } = await api('GET', PAGINA, { fields: 'access_token' });
    const r = await reelFacebook(resolve(args[1] || falla('uso: --reel-prueba <reel.mp4>')), 'prueba', pt, 'DRAFT');
    await api('DELETE', r.facebook_id, { access_token: pt }).catch((e) => console.error(`no se pudo borrar el borrador ${r.facebook_id}: ${e.message}`));
    console.log(`✓ reel de prueba procesado y borrado (${r.facebook_id})`);
  }
  else if (args[0] === '--subida') console.log(`✓ subida de prueba: ${await sube(resolve(args[1] || falla('uso: --subida <archivo>')))}`);
  else if (args[0] === '--renovar') await renovar();
  else if (args[0] === '--cola') await cola(args.includes('--esperar'));
  else if (args[0]) {
    const carpeta = resolve(args[0]);
    const i = args.indexOf('--a');
    if (i > 0) enCola(carpeta, args[i + 1] || ''); else await publica(carpeta);
  } else falla('uso: node scripts/publicar.mjs noticias/<carpeta> [--a HH:MM] | --cola | --cuenta | --renovar');
} catch (e) { falla(e.message); }
