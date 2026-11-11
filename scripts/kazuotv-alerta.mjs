// ElKazuoTV · alerta de reel que despega (Kazuo, 10 nov 2026). Corre en GitHub Actions cada 2 horas, sin Claude.
// Si una publicación de @elkazuotv de las últimas 48 h pasa de 3 veces la mediana de vistas de la cuenta, le escribe a
// Kazuo por privado con el bot de JSpace: responder comentarios, compartirla en grupos de Facebook, pensar una parte 2.
// Necesita el secreto IG_TOKEN (el mismo token de JSpace Publicador, que tiene @elkazuotv con permiso de Estadísticas).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const IG = '17841400068394079';
const TOKEN = process.env.IG_TOKEN;
const TG = process.env.TELEGRAM_TOKEN;
const KAZUO = (process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).find((c) => c && !c.startsWith('-'));
const ESTADO = 'noticias/kazuotv-alertas.json';
const VECES = 3, HORAS = 48;

if (!TOKEN) { console.log('Falta el secreto IG_TOKEN: no hago nada.'); process.exit(0); }
const limpia = (s) => String(s).split(TOKEN).join('***');
async function api(ruta, params = {}) {
  const u = new URL(`https://graph.facebook.com/v23.0/${ruta}`);
  for (const [k, v] of Object.entries({ ...params, access_token: TOKEN })) u.searchParams.set(k, v);
  const j = await (await fetch(u)).json();
  if (j.error) throw new Error(limpia(j.error.message));
  return j;
}
const vistas = async (id) => {
  try { const r = await api(`${id}/insights`, { metric: 'views' }); const d = r.data?.[0]; return d?.values?.[0]?.value ?? d?.total_value?.value ?? 0; }
  catch { return null; }
};
const mediana = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
async function telegram(texto) {
  if (!TG || !KAZUO) { console.log('Sin Telegram configurado:', texto); return; }
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: KAZUO, text: texto, disable_web_page_preview: false }) });
}

const estado = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : { mediana: 0, medianaFecha: '', avisados: [] };
const { data: media = [] } = await api(`${IG}/media`, { fields: 'id,caption,timestamp,permalink,media_product_type', limit: '40' });
const ahora = Date.now(), hoy = new Date().toISOString().slice(0, 10);

// la mediana se recalcula una vez al día con las 30 publicaciones anteriores a las últimas 48 h
if (estado.medianaFecha !== hoy || !estado.mediana) {
  const viejas = media.filter((m) => ahora - Date.parse(m.timestamp) > HORAS * 3600e3).slice(0, 30);
  const v = (await Promise.all(viejas.map((m) => vistas(m.id)))).filter((x) => x != null);
  if (v.length >= 10) { estado.mediana = mediana(v); estado.medianaFecha = hoy; }
}
if (!estado.mediana) { console.log('Sin mediana todavía.'); process.exit(0); }

for (const m of media.filter((x) => ahora - Date.parse(x.timestamp) <= HORAS * 3600e3)) {
  if (estado.avisados.includes(m.id)) continue;
  const v = await vistas(m.id);
  if (v == null || v < VECES * estado.mediana) continue;
  const horas = Math.max(1, Math.round((ahora - Date.parse(m.timestamp)) / 3600e3));
  const titulo = (m.caption || '').replace(/\s+/g, ' ').slice(0, 70);
  await telegram(`🔥 ¡Está despegando! «${titulo}…» lleva ${v.toLocaleString('es-CO')} vistas en ${horas} h: ${(v / estado.mediana).toFixed(1)} veces tu mediana (${Math.round(estado.mediana).toLocaleString('es-CO')}).\n\nAhora:\n1. Responde los comentarios en la primera hora.\n2. Compártelo en 2 o 3 grupos de anime o J-music en Facebook.\n3. Piensa la parte 2 y anótala en el banco del calendario.\n\n${m.permalink}`);
  estado.avisados.push(m.id);
  console.log('Aviso:', m.id, v);
}
estado.avisados = estado.avisados.slice(-100);
writeFileSync(ESTADO, JSON.stringify(estado, null, 1) + '\n');
console.log('Mediana', estado.mediana, '· avisados', estado.avisados.length);
