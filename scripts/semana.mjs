// semana.mjs · JSpace · junta el estado de cada post (publicado, aprobado, esperando aprobación, descartado, a mano)
// en docs/semana/datos.json, que lee la página del horario semanal (docs/semana/index.html, en GitHub Pages).
// Lo corre el bot en cada vuelta: solo escribe si algo cambió, así el commit y la página quedan al día solos.
//   node scripts/semana.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOTICIAS = join(RAIZ, 'noticias'), ENTRADA = join(NOTICIAS, 'entrada');
const lee = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

// el preview más reciente de cada carpeta y lo que decidió el grupo sobre él
const decision = {};
for (const f of readdirSync(ENTRADA).filter((n) => /^\d+\.preview\.enviado\.json$/.test(n))) {
  const p = lee(join(ENTRADA, f)); if (!p?.carpeta) continue;
  const id = f.split('.')[0], previo = decision[p.carpeta];
  if (previo && (previo.mensaje || 0) > (p.mensaje || 0)) continue;
  const hay = (s) => existsSync(join(ENTRADA, `${id}.${s}`));
  decision[p.carpeta] = { mensaje: p.mensaje, hora: p.hora, franja: p.franja,
    estado: hay('descartado.json') ? 'descartado' : hay('manual.json') ? 'manual' : hay('aprobado.json') ? 'aprobado' : 'pendiente' };
}

const posts = [];
for (const d of readdirSync(NOTICIAS, { withFileTypes: true }).filter((x) => x.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(x.name))) {
  const c = join(NOTICIAS, d.name), carpeta = `noticias/${d.name}`;
  const n = lee(join(c, 'noticia.json')); if (!n) continue;
  const pub = lee(join(c, 'publicado.json')), prog = lee(join(c, 'programado.json')), dec = decision[carpeta];
  let estado = pub ? 'publicado' : prog ? 'aprobado' : dec?.estado || null;
  const hora = prog?.hora || dec?.hora || null;
  if (!estado || (!hora && !pub)) continue; // borradores sin preview (pruebas) no van al horario
  if (estado === 'pendiente' && hora && Date.now() - new Date(hora) > 10 * 60e3) estado = 'vencido';
  if (estado === 'aprobado' && existsSync(join(c, 'error.txt'))) estado = 'error';
  const portada = ['slide-01.jpg', 'slide-01.mp4'].find((f) => existsSync(join(c, f)));
  posts.push({
    carpeta, titular: n.titular, franja: n.franja || dec?.franja || null, estado,
    // noticias que son de anime y de J-music a la vez (un opening, una seiyuu que canta): "temas": ["anime", "jmusic"]
    temas: n.temas || (n.tema ? [n.tema] : []),
    hora: pub?.fecha || hora, programado: hora, colaboradores: n.colaboradores || [],
    portada: portada === 'slide-01.jpg' ? `${carpeta}/slide-01.jpg` : null, video: existsSync(join(c, 'reel.mp4')),
    ...(pub ? { ig: pub.permalink, fb: pub.facebook || null, fb_tipo: pub.facebook_tipo || null,
      reel_prueba: !!pub.reel_prueba, historia: !!pub.historia } : {}),
  });
}
// lo que no subimos nosotros: collabs publicadas desde ElKazuoTV u otra cuenta, que el equipo anota pegando el link en
// el grupo (la API de Instagram no las trae)
for (const e of lee(join(NOTICIAS, 'externos.json')) || []) {
  posts.push({ externo: true, cuenta: e.cuenta || 'otra cuenta', titular: e.texto || 'Collab', estado: 'externo', hora: e.hora || e.fecha,
    temas: e.temas || [], colaboradores: [], ig: e.link, de: e.de });
}
posts.sort((a, b) => new Date(a.hora) - new Date(b.hora));

const salida = join(RAIZ, 'docs', 'semana', 'datos.json');
mkdirSync(dirname(salida), { recursive: true });
const cuerpo = JSON.stringify({ posts }, null, 2);
const antes = existsSync(salida) ? lee(salida) : null;
if (JSON.stringify({ posts: antes?.posts }, null, 2) !== cuerpo) {
  writeFileSync(salida, JSON.stringify({ actualizado: new Date().toISOString(), posts }, null, 2));
  console.log(`horario: ${posts.length} posts`);
}
