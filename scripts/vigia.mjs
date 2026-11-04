// vigia.mjs · JSpace · alarma si algo se rompe (Kazuo, 4 nov 2026: «nos enteramos cuando alguien se queja»).
// Lo corre .github/workflows/vigia.yml cada hora, aparte del bot (si el bot se cae, el que avisa es este).
// Revisa: 1) que el bot de Telegram esté corriendo (si no, lo relanza); 2) que la rutina de las 8:00 haya mandado
// las noticias del día; 3) errores al publicar (error.txt de una noticia, fallos de Facebook o de la historia).
// Avisa al grupo una sola vez por problema (lo anotado en noticias/entrada/vigia.json).
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = join(RAIZ, 'noticias', 'entrada'), NOTICIAS = join(RAIZ, 'noticias');
const ESTADO = join(ENTRADA, 'vigia.json');
const { TELEGRAM_TOKEN: TOKEN, TELEGRAM_CHAT_ID = '', GITHUB_REPOSITORY: REPO, GH_TOKEN } = process.env;
const ids = TELEGRAM_CHAT_ID.split(',').map((s) => s.trim()).filter(Boolean);
const GRUPO = ids.find((c) => c.startsWith('-')) || ids[0];
const estado = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : { avisados: {} };
const lee = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const avisos = [];
const avisa = (clave, texto) => { if (estado.avisados[clave]) return; estado.avisados[clave] = new Date().toISOString(); avisos.push(texto); };
const bogota = new Date(Date.now() - 5 * 3600e3), hoy = bogota.toISOString().slice(0, 10), hora = bogota.getUTCHours() + bogota.getUTCMinutes() / 60;

// 1. el bot: la última ejecución de «JSpace Telegram» tiene que estar corriendo o haber terminado hace menos de 20 min
const gh = async (ruta) => (await fetch(`https://api.github.com/repos/${REPO}/${ruta}`, { headers: { ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}), Accept: 'application/vnd.github+json' } })).json();
const runs = (await gh('actions/workflows/telegram.yml/runs?per_page=5')).workflow_runs || [];
const vivo = runs.some((r) => r.status !== 'completed' || Date.now() - new Date(r.updated_at) < 20 * 60e3);
if (!vivo) {
  try { execFileSync('gh', ['workflow', 'run', 'telegram.yml', '--ref', 'main'], { stdio: 'inherit' }); } catch {}
  avisa(`bot-${hoy}-${Math.floor(hora)}`, '🚨 El bot de Telegram estaba caído. Ya lo relancé; si en 5 minutos no les contesta, avísenle a Kazuo.');
}
const fallo = runs.find((r) => r.conclusion === 'failure' && Date.now() - new Date(r.updated_at) < 2 * 3600e3);
if (fallo) avisa(`bot-falla-${fallo.id}`, `⚠️ El bot tuvo un error (${fallo.html_url}). Sigue corriendo, pero Kazuo debería revisarlo.`);

// 2. la rutina de las 8:00: a las 8:45 ya tienen que haber llegado las noticias del día
const dia = hoy.replace(/-/g, '');
if (hora >= 8.75 && hora < 23 && !['resultado.txt', 'enviado.txt'].some((s) => existsSync(join(ENTRADA, `${dia}00.${s}`))))
  avisa(`manana-${hoy}`, '🚨 Las noticias de hoy no llegaron (la rutina de las 8:00 no terminó). Sin eso no hay posts automáticos: avísenle a Kazuo o pídanme las noticias por aquí.');

// 3. errores al publicar
for (const d of readdirSync(NOTICIAS, { withFileTypes: true }).filter((x) => x.isDirectory() && x.name !== 'entrada')) {
  const c = join(NOTICIAS, d.name), titular = lee(join(c, 'noticia.json'))?.titular || d.name;
  const err = join(c, 'error.txt');
  if (existsSync(err) && Date.now() - statSync(err).mtimeMs < 24 * 3600e3)
    avisa(`error-${d.name}-${statSync(err).mtimeMs}`, `🚨 No se pudo publicar «${titular}»: ${readFileSync(err, 'utf8').split('\n')[1] || 'error desconocido'}`);
  const p = lee(join(c, 'publicado.json'));
  if (p && Date.now() - new Date(p.fecha) < 24 * 3600e3) {
    if (p.facebook_error && !p.facebook) avisa(`fb-${d.name}`, `⚠️ «${titular}» salió en Instagram pero no en Facebook: ${p.facebook_error}`);
    if (p.historia_error) avisa(`hist-${d.name}`, `⚠️ «${titular}» salió, pero la historia no: ${p.historia_error}`);
  }
}

// avisos viejos fuera (30 días)
for (const [k, v] of Object.entries(estado.avisados)) if (Date.now() - new Date(v) > 30 * 86400e3) delete estado.avisados[k];
for (const texto of avisos) {
  console.log(texto);
  if (TOKEN && GRUPO) await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: GRUPO, text: texto, disable_web_page_preview: true }) });
}
writeFileSync(ESTADO, JSON.stringify(estado, null, 2));
console.log(avisos.length ? `${avisos.length} aviso(s)` : 'todo en orden');
