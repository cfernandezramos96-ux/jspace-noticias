// video.mjs · «tráiler en tarjeta»: monta un clip dentro del marco que dibuja render.mjs (slide tipo `video`).
//   node scripts/video.mjs noticias/<carpeta> <N° de slide> <clip.mp4> [segundos=60]
// Salida: slide-NN.mp4 (1080×1350, H.264 + AAC). Correr render.mjs antes (hace slide-NN.jpg, el marco).
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const [carpeta, n, clip, seg = '60'] = process.argv.slice(2);
if (!carpeta || !n || !clip) { console.error('uso: node scripts/video.mjs noticias/<carpeta> <N> <clip.mp4> [segundos]'); process.exit(1); }
const nn = String(n).padStart(2, '0'), marco = join(resolve(carpeta), `slide-${nn}.jpg`), salida = join(resolve(carpeta), `slide-${nn}.mp4`);
const W = 944, H = 530, R = 20;
const mascara = `geq=lum='if(gt(abs(W/2-X),W/2-${R})*gt(abs(H/2-Y),H/2-${R})*gt(hypot(abs(W/2-X)-(W/2-${R}),abs(H/2-Y)-(H/2-${R})),${R}),0,255)':cb=128:cr=128`;
const filtro = `[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,format=yuva420p[v];` +
  `color=c=white:s=${W}x${H},format=gray,${mascara}[m];[v][m]alphamerge[vm];[0:v][vm]overlay=68:568:shortest=1,format=yuv420p[o]`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-framerate', '30', '-i', marco, '-i', clip, '-t', seg,
  '-filter_complex', filtro, '-map', '[o]', '-map', '1:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-r', '30',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-b:a', '160k', '-shortest', '-movflags', '+faststart', salida], { stdio: 'inherit' });
console.log(salida);
