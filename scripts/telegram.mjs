// telegram.mjs · JSpace · el puente entre el bot de Telegram y la nube. Lo corre GitHub Actions cada pocos minutos.
//   1. Lee los mensajes nuevos del bot (getUpdates). Solo hace caso a los chats de TELEGRAM_CHAT_ID (lista con comas);
//      de cualquier otro chat solo imprime su id en el registro, para poder autorizarlo.
//   2. Cada mensaje con un link o un código de la lista del día (A1…B3) se guarda en noticias/entrada/<id>.json
//      y el bot responde «📥 Recibido». El workflow despierta entonces la rutina «JSpace · Telegram».
//   3. La rutina arma el post y deja noticias/entrada/<id>.preview.json; el bot manda al chat las slides y la leyenda
//      con tres botones: ✅ Aprobar (queda en cola para la hora propuesta), 🚀 Publicar ya (despierta la rutina,
//      que lo publica) y ❌ Descartar. Basta con que uno del chat apruebe.
//   4. Manda a Telegram los demás resultados que dejó la rutina (<id>.resultado.txt) y los marca enviados.
// Estados de un pedido en noticias/entrada/: <id>.json → <id>.preview.json → <id>.preview.enviado.json →
// <id>.aprobado.json ({ modo: 'cola' | 'ya' }), <id>.descartado.json o <id>.manual.json (🎵 lo suben a mano con canción).
// Usa TELEGRAM_TOKEN (secreto de GitHub Actions; nunca se imprime). Sin dependencias.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'noticias', 'entrada');
const ESTADO = join(DIR, 'estado.json');
const TOKEN = process.env.TELEGRAM_TOKEN;
const PERMITIDOS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
// el grupo del equipo (los ids de grupo son negativos): ahí van los previews automáticos y los avisos
const GRUPO = PERMITIDOS.find((c) => c.startsWith('-')) || PERMITIDOS[0];
// el privado de Kazuo (id positivo): ahí le llegan los reels a los que él les pone canción
const KAZUO = PERMITIDOS.find((c) => !c.startsWith('-'));
if (!TOKEN) { console.error('falta TELEGRAM_TOKEN'); process.exit(1); }
mkdirSync(DIR, { recursive: true });

const tg = async (metodo, params, archivos) => {
  let body, headers = {};
  if (archivos) {
    // multipart: los parámetros van como campos de texto y cada archivo como attach://<nombre>
    body = new FormData();
    for (const [k, v] of Object.entries(params)) body.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    for (const [nombre, ruta] of Object.entries(archivos)) body.append(nombre, new Blob([readFileSync(ruta)]), basename(ruta));
  } else { body = JSON.stringify(params); headers = { 'content-type': 'application/json' }; }
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, { method: 'POST', headers, body });
  const j = await r.json();
  if (!j.ok) throw new Error(`${metodo}: ${j.description}`);
  return j.result;
};
const lee = (f) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));
// manda archivos al chat en álbumes: 10 por álbum como máximo y menos de 50 MB por envío (límite de los bots);
// un archivo de más de 49 MB no se puede mandar y vuelve en `pesados`
async function mandaArchivos(chat, carpeta, nombres, comoDocumento = false) {
  const MB = 1024 * 1024, ids = [], pesados = [], tandas = [];
  let tanda = [], suma = 0;
  for (const a of nombres) {
    const peso = statSync(join(carpeta, a)).size;
    if (peso > 49 * MB) { pesados.push(a); continue; }
    if (tanda.length === 10 || suma + peso > 45 * MB) { tandas.push(tanda); tanda = []; suma = 0; }
    tanda.push(a); suma += peso;
  }
  if (tanda.length) tandas.push(tanda);
  const tipo = (a) => comoDocumento ? 'document' : a.endsWith('.mp4') ? 'video' : 'photo';
  for (const t of tandas) {
    if (t.length === 1) { // un álbum necesita 2 o más
      const metodo = { document: 'sendDocument', video: 'sendVideo', photo: 'sendPhoto' }[tipo(t[0])];
      const r = await tg(metodo, { chat_id: chat }, { [tipo(t[0])]: join(carpeta, t[0]) }); // el archivo va en el campo del mismo nombre
      ids.push(r.message_id);
    } else {
      const r = await tg('sendMediaGroup', { chat_id: chat, media: t.map((a, j) => ({ type: tipo(a), media: `attach://f${j}` })) },
        Object.fromEntries(t.map((a, j) => [`f${j}`, join(carpeta, a)])));
      ids.push(...r.map((x) => x.message_id));
    }
  }
  return { ids, pesados };
}
// las mismas slides que publicar.mjs (el MP4 de un slide manda sobre su JPG)
const slidesDe = (carpeta) => {
  const porNum = new Map();
  for (const a of readdirSync(carpeta).filter((n) => /^slide-\d+\.(jpg|mp4)$/.test(n)).sort()) {
    const n = a.match(/\d+/)[0]; if (!porNum.has(n) || a.endsWith('.mp4')) porNum.set(n, a);
  }
  return [...porNum.keys()].sort().map((n) => porNum.get(n));
};
const escribe = (f, datos) => writeFileSync(join(DIR, f), JSON.stringify(datos, null, 2));
const hora = (iso) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const estado = existsSync(ESTADO) ? lee('estado.json') : { offset: 0 };

// por privado le puede escribir cualquiera que esté en el grupo del equipo (Kazuo, 4 nov 2026: Don le escribió y no respondía)
const miembros = {};
const autorizado = async (chat, usuario) => {
  if (PERMITIDOS.includes(chat)) return true;
  if (!usuario || chat !== String(usuario) || !GRUPO) return false; // solo chats privados, no otros grupos
  if (!(usuario in miembros)) miembros[usuario] = await tg('getChatMember', { chat_id: GRUPO, user_id: usuario })
    .then((r) => ['creator', 'administrator', 'member'].includes(r.status)).catch(() => false);
  return miembros[usuario];
};

// diagnóstico: qué bot es y si tiene un webhook que se come los mensajes (con webhook, getUpdates no recibe nada)
const yo = await tg('getMe', {});
const hook = await tg('getWebhookInfo', {});
if (hook.url) { console.log('el bot tenía un webhook; lo quito para poder leer los mensajes'); await tg('deleteWebhook', {}); }

// 1-2. mensajes nuevos y botones pulsados
let nuevas = 0; // trabajo nuevo para la rutina: si es > 0, el workflow la despierta
// ESPERA = segundos de long polling (el workflow lo llama en bucle): responde en cuanto llega algo
const updates = await tg('getUpdates', { offset: estado.offset, timeout: Number(process.env.ESPERA || 0), allowed_updates: ['message', 'callback_query'] });
let movimiento = updates.length > 0;
console.log(`bot @${yo.username} · ${updates.length} mensajes nuevos (pendientes según Telegram: ${hook.pending_update_count})`);
// videos y fotos que mandan al chat (el tráiler oficial, un póster): el bot los baja a noticias/entrada/
const albumes = {}; // media_group_id → id del pedido
function adjuntoDe(m) {
  if (m.video) return { ...m.video, ext: 'mp4' };
  if (m.animation) return { ...m.animation, ext: 'mp4' };
  if (m.document && /^(video|image)\//.test(m.document.mime_type || '')) {
    return { ...m.document, ext: (m.document.file_name || '').split('.').pop().toLowerCase() || (m.document.mime_type.startsWith('video') ? 'mp4' : 'jpg') };
  }
  if (m.photo?.length) return { ...m.photo.at(-1), ext: 'jpg' }; // la foto más grande
  return null;
}
async function baja(adjunto, id, n, chat, responderA) {
  const mb = (adjunto.file_size || 0) / 1e6;
  if (mb > 20) {
    // los bots de Telegram solo pueden bajar hasta 20 MB
    await tg('sendMessage', { chat_id: chat, reply_to_message_id: responderA, text: `⚠️ Ese archivo pesa ${mb.toFixed(0)} MB y Telegram solo me deja bajar hasta 20 MB. Mándenlo como video normal (no como archivo), que Telegram lo comprime, o recórtenlo.` });
    return null;
  }
  const f = await tg('getFile', { file_id: adjunto.file_id });
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.file_path}`);
  if (!r.ok) throw new Error(`no pude bajar el archivo (${r.status})`);
  const nombre = `${id}-${n}.${adjunto.ext}`;
  writeFileSync(join(DIR, nombre), Buffer.from(await r.arrayBuffer()));
  console.log(`archivo bajado: ${nombre} (${mb.toFixed(1)} MB)`);
  return `noticias/entrada/${nombre}`;
}

for (const u of updates) {
  estado.offset = u.update_id + 1;
  if (u.callback_query) { await boton(u.callback_query); continue; }
  const m = u.message; if (!m) continue;
  // el texto puede venir como pie de un video o una foto
  const texto = m.text ?? m.caption ?? '';
  const adjunto = adjuntoDe(m);
  if (!texto && !adjunto) continue;
  const chat = String(m.chat.id);
  if (!(await autorizado(chat, m.from?.id))) {
    if (m.chat.type === 'private') await tg('sendMessage', { chat_id: chat, text: '👹 Solo atiendo al equipo de JSpace. Si eres del equipo, pídele a Kazuo que te agregue al grupo.' }).catch(() => {});
    console.log(`chat no autorizado: ${chat} (${m.chat.title || m.chat.username || m.chat.first_name || ''}) — añádelo a TELEGRAM_CHAT_ID para usarlo`);
    continue;
  }
  // un álbum llega como varios mensajes: las fotos o videos que siguen al primero se suman a su pedido
  if (m.media_group_id && albumes[m.media_group_id]) {
    const pid = albumes[m.media_group_id];
    const pedido = lee(`${pid}.json`);
    const ruta = await baja(adjunto, pid, (pedido.archivos || []).length + 1, chat, m.message_id);
    if (ruta) { pedido.archivos = [...(pedido.archivos || []), ruta]; escribe(`${pid}.json`, pedido); }
    continue;
  }
  const links = texto.match(/https?:\/\/\S+/g) || [];
  const codigos = (texto.toUpperCase().match(/\b[AB][1-3]\b/g) || []);
  const quien = m.from?.first_name || 'alguien';
  // ¿le hablan al bot? respondiendo a un mensaje suyo, mencionándolo o por privado
  const respuesta = m.reply_to_message?.from?.username === yo.username;
  const mencion = texto.toLowerCase().includes(`@${yo.username.toLowerCase()}`);
  const privado = m.chat.type === 'private';
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // atajos cortos sobre el último preview: «publícalo ya», «cancela» (los mensajes largos van a la rutina)
  const corto = t.split(/\s+/).length <= 6 && !links.length && !adjunto;
  const accion = !corto ? null
    : /\b(publica|publicalo|sacalo|subelo|dale|mandalo)\b.*\bya\b|^ya\b/.test(t) ? 'ya'
    : /\b(lo subo yo|lo publico yo|con cancion)\b/.test(t) ? 'manual'
    : /\b(cancela|cancelalo|descarta|descartalo|no lo publiques)\b/.test(t) ? 'no' : null;
  if (accion) {
    const id = sobreQue(m) || ultimoPreview();
    if (id) await decide(accion, id, quien, chat, m.message_id);
    else await tg('sendMessage', { chat_id: chat, reply_to_message_id: m.message_id, text: 'No tengo ningún post pendiente para eso.' });
    continue;
  }
  if (/^\/(start|ayuda|help)/.test(texto)) {
    await tg('sendMessage', { chat_id: chat, text: '👹 Mándenme el link de una noticia o los códigos de la lista del día (A2, B1…) y lo armo para JSpace; antes de publicar les mando el preview para que alguno lo apruebe. Si quieren ponerle una canción de Instagram, toquen «🎵 Lo subo yo» y les mando los archivos para subirlo a mano. Para pedir cambios, respondan al preview y explíquenme lo que quieren con sus palabras. Si tienen el tráiler o una imagen oficial, mándenmelos respondiéndome o mencionándome (hasta 20 MB). Para cualquier otra cosa, menciónenme o respóndanme.' });
    continue;
  }
  // un enlace a un video subido (Cloudinary, Drive) es material para un post, no una noticia nueva
  const material = links.length > 0 && links.every((l) => /res\.cloudinary\.com|drive\.google\.com|\.mp4(\?|$)/i.test(l));
  const aMi = respuesta || mencion || privado || material;
  if (aMi && !(privado && (links.length || codigos.length) && !adjunto)) {
    // instrucción libre: la lee la rutina (Claude) tal cual, con el post al que se refiere y los archivos que manden
    const directo = sobreQue(m); // respondió a un preview concreto
    const sobre = directo || ultimoPreview() || null;
    let aviso = adjunto ? '🎬 Recibido el archivo, lo reviso y les respondo.' : '✏️ Recibido, lo reviso y les respondo.';
    if (directo) {
      const prev = lee(`${sobre}.preview.enviado.json`);
      const carpeta = join(RAIZ, prev.carpeta);
      if (existsSync(join(carpeta, 'publicado.json'))) aviso = '✏️ Recibido. Ojo: ese post ya salió, así que no puedo cambiar las imágenes; lo reviso y les digo qué se puede hacer.';
      else if (existsSync(join(DIR, `${sobre}.aprobado.json`)) && lee(`${sobre}.aprobado.json`).modo === 'cola') {
        // si lo cambian, vuelve a necesitar aprobación
        unlinkSync(join(DIR, `${sobre}.aprobado.json`));
        if (existsSync(join(carpeta, 'programado.json'))) unlinkSync(join(carpeta, 'programado.json'));
        aviso = '✏️ Recibido, lo corrijo. Lo saqué de la cola: les mando el preview nuevo para aprobarlo otra vez.';
      } else aviso = '✏️ Recibido, lo corrijo y les mando el preview nuevo.';
    }
    const ruta = adjunto ? await baja(adjunto, u.update_id, 1, chat, m.message_id) : null;
    // el archivo no se pudo bajar (ya se les avisó): esperamos a que lo vuelvan a mandar, con su mensaje
    if (adjunto && !ruta) continue;
    escribe(`${u.update_id}.json`, {
      id: u.update_id, tipo: 'instruccion', sobre, chat, de: quien, texto, links,
      archivos: ruta ? [ruta] : [],
      responde_a: m.reply_to_message?.text || m.reply_to_message?.caption || null,
      fecha: new Date(m.date * 1000).toISOString(),
    });
    if (m.media_group_id) albumes[m.media_group_id] = u.update_id;
    await tg('sendMessage', { chat_id: chat, reply_to_message_id: m.message_id, text: aviso });
    console.log(`instrucción guardada: ${u.update_id}${sobre ? ` (sobre ${sobre})` : ''}${ruta ? ` con ${ruta}` : ''}`);
    nuevas++;
    continue;
  }
  if (!links.length && !codigos.length) continue; // charla del grupo (y fotos o videos que no son para el bot)
  const ruta = adjunto ? await baja(adjunto, u.update_id, 1, chat, m.message_id) : null;
  escribe(`${u.update_id}.json`, {
    id: u.update_id, tipo: 'noticia', chat, de: quien, texto, links, codigos,
    archivos: ruta ? [ruta] : [],
    fecha: new Date(m.date * 1000).toISOString(),
  });
  if (m.media_group_id) albumes[m.media_group_id] = u.update_id;
  await tg('sendMessage', { chat_id: chat, reply_to_message_id: m.message_id, text: '📥 Recibido. Lo armo y les mando el preview para que lo aprueben.' });
  console.log(`entrada guardada: ${u.update_id}`);
  nuevas++;
}
writeFileSync(ESTADO, JSON.stringify(estado, null, 2));

// el último preview que sigue vivo (enviado, sin publicar ni descartar)
function ultimoPreview() {
  // el más reciente por mensaje de Telegram: los ids de los automáticos (AAAAMMDD01…) no van en orden con los del bot
  const ids = readdirSync(DIR).filter((n) => /^\d+\.preview\.enviado\.json$/.test(n)).map((n) => Number(n.split('.')[0]))
    .sort((a, b) => (lee(`${b}.preview.enviado.json`).mensaje || 0) - (lee(`${a}.preview.enviado.json`).mensaje || 0));
  return ids.find((id) => !existsSync(join(DIR, `${id}.descartado.json`)) && !existsSync(join(RAIZ, lee(`${id}.preview.enviado.json`).carpeta, 'publicado.json')));
}

// el preview al que responde un mensaje (al álbum o al texto con los botones)
function sobreQue(m) {
  const r = m.reply_to_message?.message_id;
  if (!r) return null;
  for (const n of readdirSync(DIR).filter((x) => /^\d+\.preview\.enviado\.json$/.test(x))) {
    const p = lee(n);
    if (p.mensaje === r || (p.album || []).includes(r)) return Number(n.split('.')[0]);
  }
  return null;
}

// ✅ / 🚀 / ❌ sobre un preview (botones o texto)
async function boton(q) {
  const chat = String(q.message?.chat.id);
  if (!(await autorizado(chat, q.from?.id))) return tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Este chat no está autorizado' });
  const [accion, id, extra] = String(q.data || '').split(':');
  // botones del radar de noticias (scripts/radar.mjs): «Ármalo» lo manda a la rutina como un link más
  if (accion === 'radar' || accion === 'radarno') {
    const quien = q.from?.first_name || 'alguien', hecho = join(DIR, `radar-${id}.hecho.json`);
    const p = existsSync(join(DIR, 'radar.json')) ? lee('radar.json').pendientes?.[id] : null;
    let texto;
    if (existsSync(hecho)) texto = `Eso ya lo decidió ${lee(`radar-${id}.hecho.json`).por}.`;
    else if (accion === 'radarno') { escribe(`radar-${id}.hecho.json`, { por: quien, armar: false }); texto = `👌 ${quien} lo descartó.`; }
    else if (!p) texto = 'Ese aviso ya venció. Si lo quieren, mándenme el link.';
    else {
      const pid = Date.now();
      escribe(`${pid}.json`, { id: pid, tipo: 'noticia', chat, de: quien, texto: `Del radar de noticias: «${p.titulo}» (${p.fuente}). Si el link no abre (los de Google Noticias redirigen), busca la nota por el titular.`, links: [p.link], codigos: [], archivos: [], fecha: new Date().toISOString() });
      escribe(`radar-${id}.hecho.json`, { por: quien, armar: true, pedido: pid });
      nuevas++; movimiento = true;
      texto = `📥 ${quien} dijo que sí. Lo armo y les mando el preview para que lo aprueben.`;
    }
    await tg('answerCallbackQuery', { callback_query_id: q.id, text: texto.slice(0, 190) });
    await tg('editMessageReplyMarkup', { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    await tg('sendMessage', { chat_id: chat, reply_to_message_id: q.message.message_id, text: texto });
    return;
  }
  const r = await decide(accion, id, q.from?.first_name || 'alguien', chat, q.message.message_id, extra);
  await tg('answerCallbackQuery', { callback_query_id: q.id, text: r || 'Listo' });
  // los botones de cambio rápido no cierran el preview; los de decidir sí (y el de elegir hora se borra al usarlo)
  if (!r && !['foto', 'corto', 'hora'].includes(accion)) await tg('editMessageReplyMarkup', { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
}
// si no se puede hacer, lo dice en el chat y devuelve el motivo (para el aviso del botón)
async function decide(accion, id, quien, chat, responderA, extra) {
  const prev = existsSync(join(DIR, `${id}.preview.enviado.json`)) ? lee(`${id}.preview.enviado.json`) : null;
  const decir = (text, botones) => tg('sendMessage', { chat_id: chat, reply_to_message_id: responderA, text, ...(botones ? { reply_markup: { inline_keyboard: [botones] } } : {}) });
  const no = async (text) => { await decir(text); return text; };
  if (!prev) return no('No encuentro ese preview.');
  const carpeta = join(RAIZ, prev.carpeta);
  const aprobado = existsSync(join(DIR, `${id}.aprobado.json`)) ? lee(`${id}.aprobado.json`) : null;
  if (existsSync(join(carpeta, 'publicado.json'))) return no('Ese ya salió publicado.');
  if (existsSync(join(DIR, `${id}.descartado.json`))) return no(`Ese lo descartó ${lee(`${id}.descartado.json`).por}.`);
  if (aprobado?.modo === 'ya') return no(`${aprobado.por} ya pidió publicarlo ya: está saliendo.`);
  if (aprobado && accion === 'ok') return no(`Ya lo aprobó ${aprobado.por}.`);
  const manual = join(DIR, `${id}.manual.json`);
  if (existsSync(manual) && accion === 'manual') return no(`Ya se lo mandé a ${lee(`${id}.manual.json`).por} para subirlo a mano.`);
  if (existsSync(manual)) unlinkSync(manual); // cambiaron de idea: vuelve al flujo normal
  const fecha = new Date().toISOString();
  // después de aprobar se puede cambiar de idea: publicar ya o cancelar
  const cambiar = [{ text: '🚀 Publicar ya', callback_data: `ya:${id}` }, { text: '❌ Cancelar', callback_data: `no:${id}` }];
  // cambios rápidos (Kazuo, 4 nov 2026): sin escribir la corrección; la rutina la recibe ya redactada
  const RAPIDOS = {
    foto: ['🖼 Busco otra foto para la portada y les mando el preview nuevo.', 'Cambia la foto de la portada por otra mejor de la misma noticia: busca fotos nuevas (fuentes oficiales o de prensa), compara 3-5 y elige la que se vea mejor (sigue aprendido.md). No cambies nada más.'],
    corto: ['✂️ Lo dejo más corto y les mando el preview nuevo.', 'Hazlo más corto: menos texto en las slides (titulares y párrafos más breves) y una leyenda más corta, sin perder el dato central. No cambies las imágenes ni nada más.'],
  };
  if (RAPIDOS[accion]) {
    if (aprobado?.modo === 'cola') { unlinkSync(join(DIR, `${id}.aprobado.json`)); if (existsSync(join(carpeta, 'programado.json'))) unlinkSync(join(carpeta, 'programado.json')); }
    const pid = Date.now();
    escribe(`${pid}.json`, { id: pid, tipo: 'instruccion', sobre: Number(id), chat, de: quien, texto: RAPIDOS[accion][1], links: [], archivos: [], responde_a: null, fecha });
    nuevas++;
    await decir(RAPIDOS[accion][0] + (aprobado?.modo === 'cola' ? ' Lo saqué de la cola: hay que aprobarlo otra vez.' : ''));
  } else if (accion === 'hora') {
    // las próximas horas de publicación (12:30, 3:00, 6:30 y 9:00 p. m. de Bogotá); se elige con un botón
    const horas = [];
    for (let d = -1; d < 3 && horas.length < 6; d++) for (const [hh, mm] of [[17, 30], [20, 0], [23, 30], [26, 0]]) {
      const t = new Date(); t.setUTCHours(0, 0, 0, 0); t.setUTCDate(t.getUTCDate() + d); t.setUTCMinutes(hh * 60 + mm);
      if (t > Date.now() + 10 * 60e3 && +t !== +new Date(prev.hora) && horas.length < 6 && !horas.some((x) => +x === +t)) horas.push(t);
    }
    await tg('sendMessage', { chat_id: chat, reply_to_message_id: responderA, text: '⏰ ¿A qué hora lo pasamos?',
      reply_markup: { inline_keyboard: horas.map((t) => [{ text: hora(t.toISOString()), callback_data: `h:${id}:${Math.round(+t / 60e3)}` }]) } });
  } else if (accion === 'h') {
    const nueva = new Date(Number(extra) * 60e3).toISOString();
    escribe(`${id}.preview.enviado.json`, { ...prev, hora: nueva });
    if (aprobado?.modo === 'cola') {
      writeFileSync(join(carpeta, 'programado.json'), JSON.stringify({ hora: nueva }, null, 2));
      escribe(`${id}.aprobado.json`, { ...aprobado, hora: nueva });
    }
    await decir(`⏰ ${quien} lo pasó al ${hora(nueva)}.${aprobado?.modo === 'cola' ? ' Sigue aprobado.' : ' Falta aprobarlo.'}`);
  } else if (accion === 'ok') {
    // la cola la publican las rutinas de las 12:30 y las 18:30 (publican todo lo que ya tocó)
    writeFileSync(join(carpeta, 'programado.json'), JSON.stringify({ hora: prev.hora }, null, 2));
    escribe(`${id}.aprobado.json`, { modo: 'cola', por: quien, fecha, carpeta: prev.carpeta, hora: prev.hora });
    await decir(new Date(prev.hora) > new Date()
      ? `✅ Aprobado por ${quien}. Sale el ${hora(prev.hora)}`
      : `✅ Aprobado por ${quien}. Su hora ya pasó: sale en la próxima publicación (12:30, 3:00, 6:30 o 9:00 p. m.).`, cambiar);
  } else if (accion === 'ya') {
    escribe(`${id}.aprobado.json`, { modo: 'ya', por: quien, fecha, carpeta: prev.carpeta });
    nuevas++;
    await decir(`🚀 ${quien} pidió publicarlo ya. Sale en un par de minutos y les mando los links.`);
  } else if (accion === 'no') {
    if (existsSync(join(carpeta, 'programado.json'))) unlinkSync(join(carpeta, 'programado.json'));
    if (aprobado) unlinkSync(join(DIR, `${id}.aprobado.json`));
    escribe(`${id}.descartado.json`, { por: quien, fecha, carpeta: prev.carpeta });
    await decir(`❌ ${aprobado ? 'Cancelado' : 'Descartado'} por ${quien}. No se publica.`);
  } else if (accion === 'manual') {
    // la API no pone música de Instagram: sale de la cola y se sube a mano desde la app
    if (existsSync(join(carpeta, 'programado.json'))) unlinkSync(join(carpeta, 'programado.json'));
    if (aprobado) unlinkSync(join(DIR, `${id}.aprobado.json`));
    escribe(`${id}.manual.json`, { por: quien, fecha, carpeta: prev.carpeta });
    await decir(`🎵 ${quien} lo sube a mano con canción: no se publica solo. Ahí van los archivos en calidad completa (en orden) y la leyenda para copiar. Si cambian de idea, toquen aquí.`,
      [{ text: '✅ Aprobar', callback_data: `ok:${id}` }, { text: '🚀 Publicar ya', callback_data: `ya:${id}` }]);
    const { pesados } = await mandaArchivos(chat, carpeta, slidesDe(carpeta), true);
    if (pesados.length) await tg('sendMessage', { chat_id: chat, text: `⚠️ ${pesados.join(', ')} pesa más de 50 MB y no me deja mandarlo: es el video que subieron a Cloudinary, úsenlo de ahí.` });
    const leyenda = existsSync(join(carpeta, 'leyenda.txt')) ? readFileSync(join(carpeta, 'leyenda.txt'), 'utf8').trim() : '';
    if (leyenda) await tg('sendMessage', { chat_id: chat, text: leyenda.slice(0, 4000) });
    await tg('sendMessage', { chat_id: chat, text: 'Recuerden subirlo también en Facebook (sin la slide de cierre) si lo quieren allá.' });
  } else return 'No entendí ese botón.';
  movimiento = true;
  console.log(`${accion} ${id} por ${quien}`);
}

// 3. previews que dejó la rutina
for (const f of readdirSync(DIR).filter((n) => /^\d+\.preview\.json$/.test(n))) {
  const id = f.split('.')[0];
  const prev = lee(f);
  const pedido = existsSync(join(DIR, `${id}.json`)) ? lee(`${id}.json`) : null;
  const chat = pedido?.chat || GRUPO;
  if (!chat) continue;
  const carpeta = join(RAIZ, prev.carpeta);
  // un preview nuevo de un post ya aprobado (lo cambiaron): sale de la cola y hay que aprobarlo otra vez
  if (existsSync(join(DIR, `${id}.aprobado.json`)) && lee(`${id}.aprobado.json`).modo === 'cola') {
    unlinkSync(join(DIR, `${id}.aprobado.json`));
    if (existsSync(join(carpeta, 'programado.json'))) unlinkSync(join(carpeta, 'programado.json'));
  }
  // post cambiado: se decide otra vez (también si lo habían descartado o lo iban a subir a mano)
  for (const s of ['manual.json', 'descartado.json']) if (existsSync(join(DIR, `${id}.${s}`))) unlinkSync(join(DIR, `${id}.${s}`));
  const slides = slidesDe(carpeta);
  const { ids: album, pesados } = await mandaArchivos(chat, carpeta, slides); // album: para saber a qué post responden
  if (pesados.length) await tg('sendMessage', { chat_id: chat, text: `⚠️ No pude mandar ${pesados.join(', ')} (pasa de 50 MB, el límite de Telegram), pero sí va en el post.` });
  // el reel (Facebook y reel de prueba de Instagram) NO se manda al preview: sale igual que el carrusel aprobado y solo
  // llenaría el chat y demoraría el preview (Kazuo, 4 nov 2026)
  const leyenda = existsSync(join(carpeta, 'leyenda.txt')) ? readFileSync(join(carpeta, 'leyenda.txt'), 'utf8').trim() : '(sin leyenda)';
  const texto = `👀 Preview: ${prev.titular || basename(carpeta)}\n🕒 Si lo aprueban sale el ${hora(prev.hora)} (${{ jmusic: 'J-music', anime: 'anime', extra: 'extra, aparte de los dos automáticos' }[prev.franja] || prev.franja}), en Instagram y Facebook${existsSync(join(carpeta, 'reel.mp4')) ? ' (con video: también sale como reel en Facebook e Instagram)' : ''}.\n${prev.nota ? `📝 ${prev.nota}\n` : ''}\n—— Leyenda ——\n${leyenda}`;
  const msj = await tg('sendMessage', {
    chat_id: chat, text: texto.slice(0, 4000), disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[
      { text: '✅ Aprobar', callback_data: `ok:${id}` },
      { text: '🚀 Publicar ya', callback_data: `ya:${id}` },
      { text: '❌ Descartar', callback_data: `no:${id}` },
    ], [
      { text: '🖼 Otra foto', callback_data: `foto:${id}` },
      { text: '✂️ Más corto', callback_data: `corto:${id}` },
      { text: '⏰ Otra hora', callback_data: `hora:${id}` },
    ], [
      { text: '🎵 Lo subo yo con canción', callback_data: `manual:${id}` },
    ]] },
  });
  escribe(`${id}.preview.enviado.json`, { ...prev, chat, mensaje: msj.message_id, album });
  unlinkSync(join(DIR, f));
  console.log(`preview enviado: ${id} (${slides.length} slides)`);
  movimiento = true;
}

// 4. resultados de la nube
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.resultado.txt'))) {
  const id = f.replace('.resultado.txt', '');
  const pedido = existsSync(join(DIR, `${id}.json`)) ? lee(`${id}.json`) : null;
  const chat = pedido?.chat || GRUPO;
  if (!chat) continue;
  await tg('sendMessage', { chat_id: chat, text: readFileSync(join(DIR, f), 'utf8').slice(0, 4000), disable_web_page_preview: false });
  renameSync(join(DIR, f), join(DIR, `${id}.enviado.txt`));
  console.log(`resultado enviado: ${id}`);
}

// 5. nada sale sin aprobación: 1 h antes de la hora de un preview sin decidir, recordatorio; si pasa la hora, aviso.
// Solo el preview más reciente de cada carpeta y solo los de las últimas 12 h (los viejos no se reavisan).
const ultimoDe = {};
for (const f of readdirSync(DIR).filter((n) => /^\d+\.preview\.enviado\.json$/.test(n))) {
  const p = lee(f);
  if (!ultimoDe[p.carpeta] || (p.mensaje || 0) > (ultimoDe[p.carpeta].p.mensaje || 0)) ultimoDe[p.carpeta] = { f, p };
}
for (const { f, p } of Object.values(ultimoDe)) {
  const id = f.split('.')[0], hay = (s) => existsSync(join(DIR, `${id}.${s}`));
  if (hay('aprobado.json') || hay('descartado.json') || hay('manual.json') || existsSync(join(RAIZ, p.carpeta, 'publicado.json'))) continue;
  const falta = new Date(p.hora) - Date.now(), chat = p.chat || GRUPO;
  if (!chat || falta < -12 * 3600e3) continue;
  const responder = p.mensaje ? { reply_to_message_id: p.mensaje, allow_sending_without_reply: 'true' } : {};
  if (falta > 0 && falta <= 3600e3 && !p.recordado) {
    await tg('sendMessage', { chat_id: chat, ...responder, text: `⏰ A las ${hora(p.hora)} toca «${p.titular}» y nadie lo ha aprobado. Si no lo aprueban, no sale.` });
    escribe(f, { ...p, recordado: true }); movimiento = true;
  } else if (falta < -10 * 60e3 && !p.vencido) {
    await tg('sendMessage', { chat_id: chat, ...responder, text: `⚠️ «${p.titular}» no salió a su hora porque nadie lo aprobó. Si lo aprueban ahora, sale en la próxima publicación.` });
    escribe(f, { ...p, vencido: true }); movimiento = true;
  }
}

// 6. publicación a la hora exacta: las rutinas programadas de la nube arrancan 7-9 min tarde, así que 3 min antes de la
// hora de un post aprobado el bot despierta la rutina (el disparador API arranca al momento) y ella espera a la hora
// con `publicar.mjs --cola --esperar`. Cuando sale, el bot avisa al grupo con los links; si a los 15 min no ha salido,
// avisa y la despierta otra vez. Las rutinas de las 12:30, 15:00, 18:30 y 21:00 quedan de respaldo.
const NOTICIAS = join(RAIZ, 'noticias');
const leeJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
for (const d of readdirSync(NOTICIAS, { withFileTypes: true }).filter((x) => x.isDirectory())) {
  const c = join(NOTICIAS, d.name), prog = join(c, 'programado.json'), pub = join(c, 'publicado.json');
  if (!existsSync(prog) && !existsSync(pub)) continue;
  const titular = leeJson(join(c, 'noticia.json'))?.titular || d.name, chat = GRUPO;
  if (existsSync(pub)) {
    const p = leeJson(pub);
    if (p && !p.anunciado && Date.now() - new Date(p.fecha) < 6 * 3600e3 && chat) {
      for (const a of new Set(PERMITIDOS)) await tg('sendMessage', { chat_id: a, text: `✅ Ya salió «${titular}»
Instagram: ${p.permalink}${p.facebook ? `
Facebook: ${p.facebook}` : ''}${p.historia ? `
📲 Ya salió también en historias. Si el post vale la pena, compártanlo a mano desde la app (avión de papel → «Agregar a tu historia») con una encuesta o una pregunta.` : ''}${p.reel_prueba ? `
🎬 Y como reel de prueba (solo lo ven quienes no nos siguen).` : ''}`, disable_web_page_preview: true });
      writeFileSync(pub, JSON.stringify({ ...p, anunciado: true }, null, 2)); movimiento = true;
    }
    // posts sin video que valen un reel con canción: la portada animada le llega a Kazuo por privado, NO al grupo; él le
    // pone la canción desde la app y lo sube como reel de prueba (Kazuo, 4 nov 2026)
    const rc = join(c, 'reel-cancion.mp4'), q = leeJson(pub);
    if (q && !q.cancion_enviada && existsSync(rc) && KAZUO && Date.now() - new Date(q.fecha) < 24 * 3600e3) {
      const n = leeJson(join(c, 'noticia.json')) || {};
      await tg('sendVideo', { chat_id: KAZUO, supports_streaming: 'true', caption: `🎵 Reel para ponerle canción: «${titular}»` }, { video: rc });
      const ley = existsSync(join(c, 'leyenda.txt')) ? readFileSync(join(c, 'leyenda.txt'), 'utf8').trim() : '';
      await tg('sendMessage', { chat_id: KAZUO, disable_web_page_preview: true, text: `${n.cancion ? `Canción sugerida: ${n.cancion}
` : ''}Súbelo desde la app como reel, ponle la canción de la biblioteca de Instagram y en «Opciones avanzadas» activa «Reel de prueba» (no lo gradúes después).

—— Leyenda ——
${ley}`.slice(0, 4000) });
      writeFileSync(pub, JSON.stringify({ ...q, cancion_enviada: true }, null, 2)); movimiento = true;
    }
    continue;
  }
  const g = leeJson(prog);
  if (!g?.hora) continue;
  const falta = new Date(g.hora) - Date.now();
  if (falta <= 3 * 60e3 && !g.despertado) { // también si lo aprobaron cuando su hora ya había pasado: sale ya
    writeFileSync(prog, JSON.stringify({ ...g, despertado: new Date().toISOString() }, null, 2));
    nuevas++; movimiento = true;
    console.log(`a publicar: ${d.name}`);
  } else if (g.despertado && Date.now() - new Date(g.despertado) > 15 * 60e3 && !g.avisado && chat) {
    await tg('sendMessage', { chat_id: chat, text: `⚠️ «${titular}» debía salir a las ${hora(g.hora)} y todavía no ha salido. Lo vuelvo a intentar y les aviso.` });
    writeFileSync(prog, JSON.stringify({ ...g, avisado: true }, null, 2));
    nuevas++; movimiento = true;
  }
}

// 7. tiempo máximo: un pedido sin respuesta a los 20 min (la rutina se trabó) se relanza una vez; si a los otros 20
// sigue igual, se avisa al chat. <id>.reintento.json guarda cuándo se relanzó y si ya se avisó.
const LIMITE = 20 * 60 * 1000;
for (const f of readdirSync(DIR).filter((n) => /^\d+\.json$/.test(n))) {
  const id = f.replace('.json', '');
  const hay = (s) => existsSync(join(DIR, `${id}.${s}`));
  if (hay('resultado.txt') || hay('enviado.txt')) continue;
  const p = lee(f);
  if (p.tipo !== 'instruccion' && (hay('preview.json') || hay('preview.enviado.json'))) continue;
  if (!p.fecha || Date.now() - new Date(p.fecha) < LIMITE) continue;
  const chat = p.chat || GRUPO;
  const r = hay('reintento.json') ? lee(`${id}.reintento.json`) : null;
  if (!r) {
    escribe(`${id}.reintento.json`, { fecha: new Date().toISOString() });
    nuevas++; movimiento = true;
    if (chat) await tg('sendMessage', { chat_id: chat, text: '⏳ Uno de sus pedidos se me está demorando más de la cuenta. Lo vuelvo a intentar.' });
    console.log(`reintento: ${id}`);
  } else if (!r.avisado && Date.now() - new Date(r.fecha) > LIMITE) {
    escribe(`${id}.reintento.json`, { ...r, avisado: true });
    movimiento = true;
    if (chat) await tg('sendMessage', { chat_id: chat, text: `😕 No pude terminar este pedido: «${String(p.texto || '').slice(0, 120)}». Vuelvan a mandármelo o avísenle a Kazuo.` });
    console.log(`sin respuesta: ${id}`);
  }
}

// el workflow despierta la rutina de la nube solo si hay trabajo nuevo para ella (DESPERTAR = archivo de aviso)
if (nuevas && process.env.DESPERTAR) writeFileSync(process.env.DESPERTAR, String(nuevas));

// actividad reciente: mientras haya movimiento (30 min), el workflow se relanza solo en vez de esperar al cron
if (movimiento) { estado.ultima = new Date().toISOString(); writeFileSync(ESTADO, JSON.stringify(estado, null, 2)); }
