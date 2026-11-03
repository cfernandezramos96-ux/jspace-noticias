// telegram.mjs · JSpace · el puente entre el bot de Telegram y la nube. Lo corre GitHub Actions cada pocos minutos.
//   1. Lee los mensajes nuevos del bot (getUpdates). Solo hace caso a los chats de TELEGRAM_CHAT_ID (lista con comas);
//      de cualquier otro chat solo imprime su id en el registro, para poder autorizarlo.
//   2. Cada mensaje con un link o un código de la lista del día (A1…B3) se guarda en noticias/entrada/<id>.json
//      y el bot responde «📥 Recibido». El commit de esa carpeta dispara la rutina «JSpace · Telegram» en la nube.
//   3. Manda a Telegram los resultados que dejó la rutina (noticias/entrada/<id>.resultado.txt) y los marca enviados.
// Usa TELEGRAM_TOKEN (secreto de GitHub Actions; nunca se imprime). Sin dependencias.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'noticias', 'entrada');
const ESTADO = join(DIR, 'estado.json');
const TOKEN = process.env.TELEGRAM_TOKEN;
const PERMITIDOS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!TOKEN) { console.error('falta TELEGRAM_TOKEN'); process.exit(1); }
mkdirSync(DIR, { recursive: true });

const tg = async (metodo, params) => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) });
  const j = await r.json();
  if (!j.ok) throw new Error(`${metodo}: ${j.description}`);
  return j.result;
};

const estado = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : { offset: 0 };

// diagnóstico: qué bot es y si tiene un webhook que se come los mensajes (con webhook, getUpdates no recibe nada)
const yo = await tg('getMe', {});
const hook = await tg('getWebhookInfo', {});
if (hook.url) { console.log('el bot tenía un webhook; lo quito para poder leer los mensajes'); await tg('deleteWebhook', {}); }

// 1-2. mensajes nuevos
const updates = await tg('getUpdates', { offset: estado.offset, timeout: 0, allowed_updates: ['message'] });
console.log(`bot @${yo.username} · ${updates.length} mensajes nuevos (pendientes según Telegram: ${hook.pending_update_count})`);
for (const u of updates) {
  estado.offset = u.update_id + 1;
  const m = u.message; if (!m?.text) continue;
  const chat = String(m.chat.id);
  if (!PERMITIDOS.includes(chat)) {
    console.log(`chat no autorizado: ${chat} (${m.chat.title || m.chat.username || m.chat.first_name || ''}) — añádelo a TELEGRAM_CHAT_ID para usarlo`);
    continue;
  }
  const links = m.text.match(/https?:\/\/\S+/g) || [];
  const codigos = (m.text.toUpperCase().match(/\b[AB][1-3]\b/g) || []);
  if (!links.length && !codigos.length) {
    if (/^\/(start|ayuda|help)/.test(m.text)) await tg('sendMessage', { chat_id: chat, text: '👹 Mándame el link de una noticia o los códigos de la lista del día (por ejemplo A2 B1) y lo armo para JSpace.' });
    continue;
  }
  writeFileSync(join(DIR, `${u.update_id}.json`), JSON.stringify({
    id: u.update_id, chat, de: m.from?.first_name || '', texto: m.text, links, codigos,
    fecha: new Date(m.date * 1000).toISOString(),
  }, null, 2));
  await tg('sendMessage', { chat_id: chat, reply_to_message_id: m.message_id, text: '📥 Recibido. Lo armo y te aviso cuando quede en cola.' });
  console.log(`entrada guardada: ${u.update_id}`);
}
writeFileSync(ESTADO, JSON.stringify(estado, null, 2));

// 3. resultados de la nube
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.resultado.txt'))) {
  const id = f.replace('.resultado.txt', '');
  const pedido = existsSync(join(DIR, `${id}.json`)) ? JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8')) : null;
  const chat = pedido?.chat || PERMITIDOS[0];
  if (!chat) continue;
  await tg('sendMessage', { chat_id: chat, text: readFileSync(join(DIR, f), 'utf8').slice(0, 4000), disable_web_page_preview: false });
  renameSync(join(DIR, f), join(DIR, `${id}.enviado.txt`));
  console.log(`resultado enviado: ${id}`);
}
