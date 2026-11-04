// portada-animada.mjs · JSpace · reel corto (8 s) para un post SIN video: la foto de la portada con un zoom lento
// dentro del diseño del reel (titular arriba, foto en tarjeta, párrafo abajo). Sale SIN música: Kazuo le pone la
// canción a mano desde la app de Instagram y lo sube como reel de prueba (Kazuo, 4 nov 2026). El bot se lo manda por
// privado cuando el post sale.
//   node scripts/portada-animada.mjs noticias/<carpeta> [imagen] [segundos=8]
// Salida: reel-cancion.mp4 en la carpeta (no reel.mp4: ese lo usa Facebook y el reel de prueba automático).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [dir, img, seg = '8'] = process.argv.slice(2);
if (!dir) { console.error('uso: node scripts/portada-animada.mjs noticias/<carpeta> [imagen] [segundos]'); process.exit(1); }
const carpeta = resolve(dir), noticia = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8'));
const imagen = join(carpeta, img || (noticia.slides || []).find((s) => s.tipo === 'portada')?.imagen);
// el zoom conserva la proporción de la foto (si no, se ve aplastada: Kazuo, 4 nov 2026)
const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', imagen]).toString().trim().split(',').map(Number);
const par = (n) => Math.round(n / 2) * 2, W = 1600, H = par(W * h / w);
const clip = join(carpeta, 'portada-animada-clip.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-i', imagen, '-vf',
  `scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0009,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30,format=yuv420p`,
  '-t', seg, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip], { stdio: 'inherit' });
execFileSync(process.execPath, [join(RAIZ, 'scripts', 'reel.mjs'), carpeta, clip, seg, '0', 'reel-cancion.mp4'], { stdio: 'inherit' });
console.log(join(carpeta, 'reel-cancion.mp4'));
