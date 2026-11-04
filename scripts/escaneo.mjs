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
try { sh('git', ['pull', '-q', '--rebase']); } catch {}
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
  sh('git', ['commit', '-q', '-m', 'Escaneo: posts del feed subidos a mano']);
  try { sh('git', ['push', '-q']); } catch { sh('git', ['pull', '-q', '--rebase']); sh('git', ['push', '-q']); }
}
writeFileSync(marca, new Date().toISOString());
console.log(nuevos.length ? `escaneo: ${nuevos.length} post(s) anotados` : 'escaneo: nada nuevo');
