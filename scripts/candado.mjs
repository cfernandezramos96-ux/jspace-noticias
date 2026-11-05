// candado.mjs · JSpace · que dos rutinas de la nube no hagan lo mismo a la vez.
// 4 nov 2026: Kenshi Yonezu salió doble (dos rutinas de la cola). 5 nov 2026: Fool Night salió doble porque dos
// sesiones del bot de Telegram atendieron el mismo «ya» y publicaron directo, sin pasar por la cola.
// Cómo funciona: antes de trabajar, la rutina sube a GitHub un archivo de candado con su marca. Si el push choca con
// el de otra, gana la que llegó primero y la otra se retira. Un candado de más de `minutos` se da por abandonado.
//
//   node scripts/candado.mjs noticias/entrada/<id>.tomado.json   → sale 0 si es tuyo; 3 si otra sesión lo tiene
//   import { reclama } from './candado.mjs'                       → true / false
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// una marca por proceso: si el mismo proceso vuelve a pedir el candado (la cola y luego publica), es suyo
const YO = `${process.env.HOSTNAME || process.env.COMPUTERNAME || 'pc'}-${process.pid}-${Date.now()}`;
const mios = new Set();

// archivo: ruta del candado. hechos: archivos que, si existen, significan que el trabajo ya se hizo (no se reclama).
export function reclama(archivo, { hechos = [], minutos = 20 } = {}) {
  const f = resolve(RAIZ, archivo), rel = relative(RAIZ, f).replace(/\\/g, '/');
  if (mios.has(f)) return true;
  const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const ajeno = () => { try { const p = JSON.parse(readFileSync(f, 'utf8')); return p.quien !== YO && Date.now() - new Date(p.fecha) < minutos * 60e3; } catch { return false; } };
  const hecho = () => hechos.some((h) => existsSync(resolve(RAIZ, h)));
  try { git('pull', '-q', '--rebase', '--autostash'); } catch { mios.add(f); return true; } // sin remoto: no hay con quién chocar
  for (let i = 0; i < 4; i++) {
    if (hecho() || ajeno()) return false;
    writeFileSync(f, JSON.stringify({ quien: YO, fecha: new Date().toISOString() }, null, 2));
    try { git('add', rel); git('commit', '-q', '-m', `Candado: ${basename(dirname(f))}/${basename(f)}`); git('push', '-q'); mios.add(f); return true; }
    catch {
      // el push falló: otra rutina subió algo antes; deshacemos el commit propio y miramos qué hay en GitHub
      // (soft: nunca toca otros archivos sin guardar, por si corre en el PC)
      try { git('reset', '-q', '--soft', 'HEAD~1'); git('reset', '-q', '--', rel); unlinkSync(f); git('pull', '-q', '--rebase', '--autostash'); } catch { return false; }
    }
  }
  return false;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archivo = process.argv[2];
  if (!archivo) { console.error('uso: node scripts/candado.mjs <archivo de candado> [--hecho <archivo>]...'); process.exit(2); }
  const hechos = process.argv.flatMap((a, i, l) => (l[i - 1] === '--hecho' ? [a] : []));
  // pedidos de Telegram: si ya tiene respuesta, ya lo atendió otra sesión
  const m = archivo.match(/^(.*[\\/])?(\d+)\.tomado\.json$/);
  if (m) hechos.push(`${m[1] || ''}${m[2]}.resultado.txt`, `${m[1] || ''}${m[2]}.enviado.txt`, `${m[1] || ''}${m[2]}.preview.json`, `${m[1] || ''}${m[2]}.preview.enviado.json`);
  if (reclama(archivo, { hechos })) { console.log('✓ es tuyo: sigue'); process.exit(0); }
  console.log('✗ otra sesión ya lo tiene o ya está hecho: NO lo hagas, pasa al siguiente'); process.exit(3);
}
