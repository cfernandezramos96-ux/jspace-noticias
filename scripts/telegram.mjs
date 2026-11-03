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
// <id>.aprobado.json ({ modo: 'cola' | 'ya' }) o <id>.descartado.json.
// Usa TELEGRAM_TOKEN (secreto de GitHub Actions; nunca se imprime). Sin dependencias.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'noticias', 'entrada');
const ESTADO = join(DIR, 'estado.json');
const TOKEN = process.env.TELEGRAM_TOKEN;
const PERMITIDOS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
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
const escribe = (f, datos) => writeFileSync(join(DIR, f), JSON.stringify(datos, null, 2));
const hora = (iso) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const estado = existsSync(ESTADO) ? lee('estado.json') : { offset: 0 };

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
for (const u of updates) {
  estado.offset = u.update_id + 1;
  if (u.callback_query) { await boton(u.callback_query); continue; }
  const m = u.message; if (!m?.text) continue;
  const chat = String(m.chat.id);
  if (!PERMITIDOS.includes(chat)) {
    console.log(`chat no autorizado: ${chat} (${m.chat.title || m.chat.username || m.chat.first_name || ''}) — añádelo a TELEGRAM_CHAT_ID para usarlo`);
    continue;
  }
  const links = m.text.match(/https?:\/\/\S+/g) || [];
  const codigos = (m.text.toUpperCase().match(/\b[AB][1-3]\b/g) || []);
  if (!links.length && !codigos.length) {
    if (/^\/(start|ayuda|help)/.test(m.text)) await tg('sendMessage', { chat_id: chat, text: '👹 Mándame el link de una noticia o los códigos de la lista del día (por ejemplo A2 B1) y lo armo para JSpace. Antes de publicar les mando el preview para que alguno lo apruebe.' });
    continue;
  }
  escribe(`${u.update_id}.json`, {
    id: u.update_id, chat, de: m.from?.first_name || '', texto: m.text, links, codigos,
    fecha: new Date(m.date * 1000).toISOString(),
  });
  await tg('sendMessage', { chat_id: chat, reply_to_message_id: m.message_id, text: '📥 Recibido. Lo armo y les mando el preview para que lo aprueben.' });
  console.log(`entrada guardada: ${u.update_id}`);
  nuevas++;
}
writeFileSync(ESTADO, JSON.stringify(estado, null, 2));

// ✅ / 🚀 / ❌ sobre un preview
async function boton(q) {
  const chat = String(q.message?.chat.id);
  const quien = q.from?.first_name || 'alguien';
  if (!PERMITIDOS.includes(chat)) return tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Este chat no está autorizado' });
  const [accion, id] = String(q.data || '').split(':');
  const prev = existsSync(join(DIR, `${id}.preview.enviado.json`)) ? lee(`${id}.preview.enviado.json`) : null;
  if (!prev) return tg('answerCallbackQuery', { callback_query_id: q.id, text: 'No encuentro ese preview' });
  for (const f of [`${id}.aprobado.json`, `${id}.descartado.json`]) {
    if (existsSync(join(DIR, f))) return tg('answerCallbackQuery', { callback_query_id: q.id, text: `Ya lo decidió ${lee(f).por}` });
  }
  const fecha = new Date().toISOString();
  let aviso;
  if (accion === 'ok') {
    // la cola la publican las rutinas de las 12:30 y las 18:30 (publican todo lo que ya tocó)
    const carpeta = join(RAIZ, prev.carpeta);
    writeFileSync(join(carpeta, 'programado.json'), JSON.stringify({ hora: prev.hora }, null, 2));
    escribe(`${id}.aprobado.json`, { modo: 'cola', por: quien, fecha, carpeta: prev.carpeta, hora: prev.hora });
    aviso = new Date(prev.hora) > new Date()
      ? `✅ Aprobado por ${quien}. Sale el ${hora(prev.hora)}`
      : `✅ Aprobado por ${quien}. Su hora ya pasó: sale en la próxima franja (12:30 o 18:30).`;
  } else if (accion === 'ya') {
    escribe(`${id}.aprobado.json`, { modo: 'ya', por: quien, fecha, carpeta: prev.carpeta });
    nuevas++;
    aviso = `🚀 Aprobado por ${quien} para publicar ya. Les aviso cuando salga.`;
  } else if (accion === 'no') {
    escribe(`${id}.descartado.json`, { por: quien, fecha, carpeta: prev.carpeta });
    aviso = `❌ Descartado por ${quien}. No se publica.`;
  } else return tg('answerCallbackQuery', { callback_query_id: q.id });
  await tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Listo' });
  await tg('editMessageReplyMarkup', { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  await tg('sendMessage', { chat_id: chat, reply_to_message_id: q.message.message_id, text: aviso });
  console.log(`${accion} ${id} por ${quien}`);
}

// 3. previews que dejó la rutina
for (const f of readdirSync(DIR).filter((n) => /^\d+\.preview\.json$/.test(n))) {
  const id = f.split('.')[0];
  const prev = lee(f);
  const pedido = existsSync(join(DIR, `${id}.json`)) ? lee(`${id}.json`) : null;
  const chat = pedido?.chat || PERMITIDOS[0];
  if (!chat) continue;
  const carpeta = join(RAIZ, prev.carpeta);
  // las mismas slides que publicar.mjs (el MP4 de un slide manda sobre su JPG)
  const porNum = new Map();
  for (const a of readdirSync(carpeta).filter((n) => /^slide-\d+\.(jpg|mp4)$/.test(n)).sort()) {
    const n = a.match(/\d+/)[0]; if (!porNum.has(n) || a.endsWith('.mp4')) porNum.set(n, a);
  }
  const slides = [...porNum.keys()].sort().map((n) => porNum.get(n));
  for (let i = 0; i < slides.length; i += 10) { // un álbum de Telegram lleva 10 como máximo
    const tanda = slides.slice(i, i + 10);
    const archivos = Object.fromEntries(tanda.map((a, j) => [`f${j}`, join(carpeta, a)]));
    await tg('sendMediaGroup', {
      chat_id: chat,
      media: tanda.map((a, j) => ({ type: a.endsWith('.mp4') ? 'video' : 'photo', media: `attach://f${j}` })),
    }, archivos);
  }
  const leyenda = existsSync(join(carpeta, 'leyenda.txt')) ? readFileSync(join(carpeta, 'leyenda.txt'), 'utf8').trim() : '(sin leyenda)';
  const texto = `👀 Preview: ${prev.titular || basename(carpeta)}\n🕒 Si lo aprueban sale el ${hora(prev.hora)} (${prev.franja === 'jmusic' ? 'J-music' : 'anime'}), en Instagram y Facebook.\n${prev.nota ? `📝 ${prev.nota}\n` : ''}\n—— Leyenda ——\n${leyenda}`;
  await tg('sendMessage', {
    chat_id: chat, text: texto.slice(0, 4000), disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[
      { text: '✅ Aprobar', callback_data: `ok:${id}` },
      { text: '🚀 Publicar ya', callback_data: `ya:${id}` },
      { text: '❌ Descartar', callback_data: `no:${id}` },
    ]] },
  });
  renameSync(join(DIR, f), join(DIR, `${id}.preview.enviado.json`));
  console.log(`preview enviado: ${id} (${slides.length} slides)`);
  movimiento = true;
}

// 4. resultados de la nube
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.resultado.txt'))) {
  const id = f.replace('.resultado.txt', '');
  const pedido = existsSync(join(DIR, `${id}.json`)) ? lee(`${id}.json`) : null;
  const chat = pedido?.chat || PERMITIDOS[0];
  if (!chat) continue;
  await tg('sendMessage', { chat_id: chat, text: readFileSync(join(DIR, f), 'utf8').slice(0, 4000), disable_web_page_preview: false });
  renameSync(join(DIR, f), join(DIR, `${id}.enviado.txt`));
  console.log(`resultado enviado: ${id}`);
}

// el workflow despierta la rutina de la nube solo si hay trabajo nuevo para ella (DESPERTAR = archivo de aviso)
if (nuevas && process.env.DESPERTAR) writeFileSync(process.env.DESPERTAR, String(nuevas));

// actividad reciente: mientras haya movimiento (30 min), el workflow se relanza solo en vez de esperar al cron
if (movimiento) { estado.ultima = new Date().toISOString(); writeFileSync(ESTADO, JSON.stringify(estado, null, 2)); }
