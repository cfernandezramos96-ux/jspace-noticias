// escaneo.mjs · JSpace · anota en el horario semanal los posts del feed de @jspaceco_ que no salieron por nuestros
// scripts (los que el equipo sube a mano, p. ej. con canción). Sin Claude, para no gastar créditos (Kazuo, 4 nov 2026):
// lo corre el hook de inicio de Claude en el PC, como mucho una vez cada 6 horas. Las collabs que publica ElKazuoTV no
// salen en la API de JSpace: esas se anotan pegando el link en el grupo con «collab».
//   node scripts/escaneo.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: RAIZ, encoding: 'utf8' });
const marca = join(homedir(), '.claude', 'jspace-escaneo.txt');
// 17 nov 2026: un pull que chocó dejó la copia trabada a medio rebase del 14 al 17 de noviembre. Con la copia vieja, el
// escaneo creía que los posts automáticos eran «a mano» (no veía sus publicado.json) y los anotaba mal. Ahora: si hay
// un rebase a medias se deshace, y si no se puede traer lo último de GitHub, no se escanea.
const traer = () => {
  try { execFileSync('git', ['rebase', '--abort'], { cwd: RAIZ, stdio: 'ignore' }); } catch {} // solo hace algo si quedó uno a medias
  const pull = () => { try { execFileSync('git', ['pull', '-q', '--rebase', '--autostash'], { cwd: RAIZ, stdio: 'ignore' }); return true; } catch { try { execFileSync('git', ['rebase', '--abort'], { cwd: RAIZ, stdio: 'ignore' }); } catch {} return false; } };
  if (pull()) return true;
  // si choca por escaneos viejos que no se alcanzaron a subir, se descartan (el escaneo se rehace con datos frescos);
  // cualquier otro commit local sin subir se deja quieto
  try {
    const propios = sh('git', ['log', '--format=%s', '@{u}..HEAD']).trim().split('\n').filter(Boolean);
    if (propios.length && propios.every((m) => m.startsWith('Escaneo:'))) { sh('git', ['reset', '-q', '--keep', '@{u}']); return pull(); }
  } catch {}
  return false;
};
if (!traer()) { console.log('escaneo: no pude traer lo último de GitHub; no escaneo con datos viejos'); process.exit(0); }
const nuevos = JSON.parse(sh(process.execPath, ['scripts/publicar.mjs', '--feed-nuevo', '7']));
if (nuevos.length) {
  const archivo = join(RAIZ, 'noticias', 'externos.json');
  const lista = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : [];
  for (const m of nuevos) {
    const codigo = m.link.split('/').filter(Boolean).pop();
    if (!lista.some((e) => e.codigo === codigo)) lista.push({ codigo, link: m.link, fecha: m.fecha, de: 'feed', cuenta: 'JSpace (a mano)', texto: m.texto });
  }
  writeFileSync(archivo, JSON.stringify(lista, null, 2) + '\n');
  sh(process.execPath, ['scripts/semana.mjs']);
  sh('git', ['add', 'noticias/externos.json', 'docs/semana/datos.json']);
  let hay = true;
  try { execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: RAIZ }); hay = false; } catch {} // sin cambios: ya estaban anotados
  if (hay) sh('git', ['commit', '-q', '-m', 'Escaneo: posts del feed subidos a mano']);
  let subido = !hay;
  try { sh('git', ['push', '-q']); subido = true; } catch { if (traer()) try { sh('git', ['push', '-q']); subido = true; } catch {} }
  if (!subido) {
    // se deshace el commit propio (sin tocar otros cambios sin guardar) y se reintenta en la próxima vuelta
    try { sh('git', ['reset', '-q', '--keep', 'HEAD~1']); } catch {}
    console.log('escaneo: no pude subirlo a GitHub; lo intento la próxima vez');
    process.exit(0);
  }
}
writeFileSync(marca, new Date().toISOString());
console.log(nuevos.length ? `escaneo: ${nuevos.length} post(s) anotados` : 'escaneo: nada nuevo');
