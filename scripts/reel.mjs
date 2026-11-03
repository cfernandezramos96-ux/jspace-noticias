// reel.mjs · JSpace · la versión de Facebook de un post con video: reel vertical 1080×1920 con el titular de la portada
// arriba, el video en tarjeta en medio y un párrafo corto abajo (el primer párrafo largo de la leyenda, o `reel.texto`).
//   node scripts/reel.mjs noticias/<carpeta> <clip.mp4> [segundos=60]
// Salida: reel.mp4 y reel.jpg (el marco) en la carpeta. noticia.json puede traer "reel": { "titulo", "etiqueta",
// "texto" } para cambiar lo que sale de la portada y la leyenda.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [dir, clip, seg = '60'] = process.argv.slice(2);
if (!dir || !clip) { console.error('uso: node scripts/reel.mjs noticias/<carpeta> <clip.mp4> [segundos]'); process.exit(1); }
const carpeta = resolve(dir), noticia = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8'));
const portada = (noticia.slides || []).find((s) => s.tipo === 'portada') || {};
// el párrafo: el primero de la leyenda con algo de largo (el de la noticia), sin hashtags
const leyenda = existsSync(join(carpeta, 'leyenda.txt')) ? readFileSync(join(carpeta, 'leyenda.txt'), 'utf8') : '';
const parrafo = leyenda.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p.length > 80 && !p.startsWith('#')) || portada.texto || '';
// proporción del clip ya girado (los videos del celular vienen con rotación)
const [w, h, rot] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation',
  '-of', 'csv=p=0:s=,', clip]).toString().split(/[\s,]+/).filter(Boolean).map(Number);
const prop = Math.abs(rot || 0) === 90 ? h / w : w / h;
const slide = { tipo: 'reel', etiqueta: portada.etiqueta, titulo: portada.titulo, texto: parrafo, proporcion: prop < 1 ? 4 / 5 : 16 / 9, ...(noticia.reel || {}) };

const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean).find((p) => existsSync(p));
const nav = await chromium.launch({ executablePath: chrome, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars'] });
const pag = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
await pag.addInitScript((d) => { window.DATA = d; }, { noticia, slide, indice: 1, total: 1, base: pathToFileURL(carpeta).href + '/', alto: 1920 });
await pag.goto(pathToFileURL(join(RAIZ, 'plantilla', 'noticia.html')).href);
await pag.waitForFunction(() => window.__listo === true, null, { timeout: 30000 });
const hueco = await pag.evaluate(() => window.__hueco);
const marco = join(carpeta, 'reel.jpg');
await pag.screenshot({ path: marco, type: 'jpeg', quality: 92 });
await nav.close();

// el clip recortado al hueco con esquinas redondeadas y la marca de agua, sobre el marco
const { x, y, w: W, h: H } = hueco, R = 18;
const marca = join(RAIZ, 'plantilla', 'marca', 'jspace-marca-agua.png'), MARCA = existsSync(marca);
const mascara = `geq=lum='if(gt(abs(W/2-X),W/2-${R})*gt(abs(H/2-Y),H/2-${R})*gt(hypot(abs(W/2-X)-(W/2-${R}),abs(H/2-Y)-(H/2-${R})),${R}),0,255)':cb=128:cr=128`;
const filtro = `[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,format=yuva420p[v];` +
  `color=c=white:s=${W}x${H},format=gray,${mascara}[m];[v][m]alphamerge[vm];[0:v][vm]overlay=${x}:${y}:shortest=1[b];` +
  (MARCA ? `[2:v]scale=170:-1,format=rgba,colorchannelmixer=aa=0.85[w];[b][w]overlay=${x + W - 190}:${y + 28},format=yuv420p[o]` : `[b]format=yuv420p[o]`);
const salida = join(carpeta, 'reel.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-framerate', '30', '-i', marco, '-i', clip, ...(MARCA ? ['-i', marca] : []), '-t', seg,
  '-filter_complex', filtro, '-map', '[o]', '-map', '1:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-r', '30',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-b:a', '160k', '-shortest', '-movflags', '+faststart', salida], { stdio: 'inherit' });
console.log(JSON.stringify({ reel: salida, marco, hueco }));
