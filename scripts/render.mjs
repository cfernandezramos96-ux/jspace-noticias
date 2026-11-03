// render.mjs · JSpace · noticia.json → slide-01.jpg … + hoja.png
//   node scripts/render.mjs noticias/<carpeta>
// Cada slide se dibuja con plantilla/noticia.html (window.DATA) y se guarda en JPG (lo único que acepta la API de
// Instagram) a 1080×1350, o al `alto` de noticia.json. La hoja muestra las slides como en el feed y, al final, la
// portada como la recorta la cuadrícula del perfil (3:4).
import { chromium } from 'playwright';
import { readFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = process.argv[2] && resolve(process.argv[2]);
if (!carpeta) { console.error('uso: node scripts/render.mjs noticias/<carpeta>'); process.exit(1); }
const noticia = JSON.parse(readFileSync(join(carpeta, 'noticia.json'), 'utf8'));
const slides = noticia.slides || [];
if (!slides.length) { console.error('noticia.json no tiene slides'); process.exit(1); }
const ALTO = noticia.alto || 1350;

// borra las slides de una versión anterior (si ahora hay menos)
for (const f of readdirSync(carpeta)) if (/^slide-\d+\.(png|jpg)$|^hoja\.png$/.test(f)) unlinkSync(join(carpeta, f));

// el Chrome instalado (como en los carruseles animados); si no hay, el Chromium de Playwright
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(Boolean).find((p) => existsSync(p));
const nav = await chromium.launch({ executablePath: chrome, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars'] });
const base = pathToFileURL(carpeta).href + '/';
const salidas = [];
for (let i = 0; i < slides.length; i++) {
  // una página por slide: los initScript se acumulan si se reutiliza
  const pag = await nav.newPage({ viewport: { width: 1080, height: ALTO } });
  const data = { noticia, slide: slides[i], indice: i + 1, total: slides.length, base, alto: ALTO };
  await pag.addInitScript((d) => { window.DATA = d; }, data);
  await pag.goto(pathToFileURL(join(RAIZ, 'plantilla', 'noticia.html')).href);
  await pag.waitForFunction(() => window.__listo === true, null, { timeout: 30000 });
  // imágenes que no cargaron = error (mejor parar que publicar un hueco negro)
  const rotas = await pag.evaluate(() => [...document.images].filter((im) => !im.naturalWidth).map((im) => im.getAttribute('src')));
  if (rotas.length) { console.error(`slide ${i + 1}: no cargó ${rotas.join(', ')}`); process.exit(2); }
  const out = join(carpeta, `slide-${String(i + 1).padStart(2, '0')}.jpg`);
  await pag.screenshot({ path: out, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: ALTO } });
  salidas.push(out);
  await pag.close();
}

// hoja: las slides como en el feed (360 de ancho) + la portada recortada como en la cuadrícula (3:4)
const h = Math.round(360 * ALTO / 1080);
const b64 = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;
const caja = (contenido, rotulo) => `<div style="display:inline-block;margin:20px 0 0 20px;vertical-align:top;font:600 15px sans-serif;color:#aaa">${contenido}<div style="margin-top:8px">${rotulo}</div></div>`;
const feed = salidas.map((p, i) => caja(`<img src="${b64(p)}" style="display:block;width:360px;height:${h}px;border-radius:8px">`, `${i + 1} · feed`)).join('');
const grid = caja(`<div style="width:${Math.round(h * 0.75)}px;height:${h}px;overflow:hidden;border-radius:8px"><img src="${b64(salidas[0])}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`, 'portada · cuadrícula');
const hoja = await nav.newPage({ viewport: { width: 380 * salidas.length + Math.round(h * 0.75) + 40, height: h + 70 } });
await hoja.setContent(`<body style="margin:0;background:#222">${feed}${grid}</body>`);
await hoja.waitForLoadState('load');
await hoja.screenshot({ path: join(carpeta, 'hoja.png'), fullPage: true });
await nav.close();
console.log(JSON.stringify({ carpeta, slides: salidas.length, alto: ALTO, hoja: join(carpeta, 'hoja.png') }));
