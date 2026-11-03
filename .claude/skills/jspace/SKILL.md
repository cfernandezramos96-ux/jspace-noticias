---
name: jspace
description: >-
  Convierte el link de una noticia de anime, manga, J-music o cultura japonesa en un post o carrusel de
  JSpace (@jspaceco_) y lo deja en cola para publicarse solo con la API oficial de Instagram. Úsala cuando Kazuo
  mande un link de noticia, diga "/jspace <link>", "hazle un post a esto", "súbelo a JSpace", o responda
  con un número de la lista de ideas del día.
---

# /jspace · de un link a publicado

Proyecto: `E:\Claudio\jspace-noticias`. Plantilla: `plantilla/noticia.html` (estilo de los carruseles de
ElKazuoTV, solo con el logo nuevo de JSpace). Voz: `~/.claude/instagram/voice.md` (en la nube: `instagram/voice.md` de este repositorio).

**Kazuo eligió que se publique solo** (2 nov 2026): no se le pide OK antes de programar. Por eso la
revisión de este flujo la haces tú y tiene que ser estricta. Si algo no cuadra (dato dudoso, imagen
mala, rumor), **no publiques**: para y díselo.

## PC o nube: todo pasa por GitHub

El proyecto vive en el repositorio privado `cfernandezramos96-ux/jspace-noticias`. Puede correr en el PC de
Kazuo (`E:\Claudio\jspace-noticias`) o en una sesión en la nube de Claude Code, cuando el PC está apagado.

- **Al empezar:** `git checkout main && git pull` (en la nube el repositorio arranca sin rama, «detached
  HEAD», y un `git pull` solo falla).
- **Fuentes en la nube:** Anime News Network y Natalie bloquean las peticiones desde la nube (403 o
  «Security check»). Usa WebSearch para encontrar la noticia y confírmala en fuentes que sí abren: Anime
  Corner (animecorner.me), Anime Trending, MyAnimeList News, Crunchyroll News (artículos sueltos), la web
  oficial de la serie o la banda y su cuenta oficial. Si un dato solo sale en una fuente secundaria, dilo.
- **Al terminar** (carpeta de la noticia lista, en cola o publicada): `git add -A && git commit -m "JSpace: <titular>"`
  y `git push`. Si el push falla por cambios remotos: `git pull --rebase` y otra vez `git push`.
- **Dos posts al día, por franjas** (decidido con Kazuo el 2 nov 2026, sin contar los collabs con ElKazuoTV):
  - **12:30 · `"franja": "jmusic"`** · J-music y cultura japonesa: bandas, idols, openings, giras por
    Latinoamérica, curiosidades. Es lo que mejor funciona en la cuenta (Atarashii Gakko ×20, BBTS ×3, Yokai ×3).
  - **18:30 · `"franja": "anime"`** · la noticia de anime o manga más fuerte del día.
- **La cola la publica la nube:** las rutinas «JSpace · J-music (12:30)» y «JSpace · publicar (18:30)» hacen
  `git pull`, `node scripts/publicar.mjs --cola` y suben el resultado. Por eso un post en cola **tiene que
  estar en GitHub antes de su hora**.
- **En la nube** las claves están en las variables del entorno (IG_TOKEN, CLOUDINARY_*), no en `.env`.
  Antes del primer render: `npm ci && npx playwright install chromium` (en la nube no hay Chrome instalado).

## 0. Qué te mandan

- Un link → sigue.
- Un número (o varios) → es de la lista de hoy: `noticias/ideas-AAAA-MM-DD.md`. Toma ese link.
- Nada claro → pregunta qué noticia.

Mira `noticias/publicadas.md`: si la noticia ya salió, dilo y para.

## 1. Leer y verificar

1. Baja la página (`curl -sL -A "Mozilla/5.0" <link> -o <scratchpad>/nota.html`) y saca el texto; si no
   se puede, WebFetch.
2. Anota los hechos: qué, quién, cuándo (fechas exactas), estudio, staff, cifras. **Solo lo que dice la
   nota.** Nunca inventes un dato, una fecha ni una cifra.
3. Si la nota cita otra fuente (Comic Natalie, la web oficial, una cuenta oficial en X), esa es la fuente.
   Si solo es un rumor o filtración sin confirmar, **no se publica**: díselo.
4. Escribe los nombres japoneses bien (las notas en inglés a veces traen erratas: p. ej. «Ichiji» por
   «Ijichi»). Si corriges uno, dilo en el resumen final.

## 2. Formato (1080×1440, 3:4: la proporción de la cuadrícula del perfil)

La referencia es el competidor principal, Koryugi (@koryugi), y el post de Ao no Hako de JSpace:
**la portada es la imagen oficial a sangre con el texto encima**, y la historia va en la leyenda.

- **Post (lo normal, 3 slides):** `portada` (la imagen oficial + logo + titular + una línea) → `poster`
  (la imagen oficial completa, sin recortar) → `cierre`. Si hay dos imágenes oficiales buenas (póster y
  frame del tráiler, o dos visuales), la segunda va en el `poster`.
- **Carrusel (solo si la noticia trae historia que no cabe en la leyenda):** `portada` → `poster` →
  `texto` / `dato` (contexto, cifras, staff) → `cierre`. Máximo 6.
- **Video (no lo olvides, lo pidió Kazuo):** si la noticia trae tráiler, teaser o clip oficial, el
  carrusel lleva una slide de video con ese clip (normalmente la 2, en lugar del `poster`): MP4 1080×1350
  (el clip centrado sobre su versión desenfocada, como el `poster`), H.264 + AAC 48 kHz, `-movflags
  +faststart`, de 3 a 60 s. Se guarda como `slide-NN.mp4` y `publicar.mjs` lo usa en vez del JPG de ese número.
- **Siempre termina en `cierre`** (la slide blanca con el logo grande y «Sigue a @jspaceco_»): lo pidió
  Kazuo el 2 nov 2026 para todos los posts.

## 3. Imágenes

- Solo material oficial: el key visual o póster, un frame del tráiler
  (`https://i.ytimg.com/vi/<ID>/maxresdefault.jpg`), fotos oficiales de la banda.
- **Busca siempre la versión grande en la web oficial** (la de la serie, la película o la banda): las
  notas de prensa traen miniaturas de 400-600 px. Ej.: Bocchi → `bocchi.rocks`, visual de 4368×6200
  en `.../mainvisual/ph_main.webp`. Comic Natalie también suele tener la imagen grande.
- La portada necesita **≥ 1080 px de ancho**. Si no aparece nada de ese tamaño, usa el frame del tráiler
  (1280×720) en la portada y la imagen pequeña en `poster` o en una tarjeta.
- Comprueba que el archivo sea imagen de verdad (no una página HTML de error) y su tamaño, y míralo (Read):
  que sea de la noticia y que el encuadre de la portada no corte caras.

## 4. noticia.json

Carpeta: `noticias/AAAA-MM-DD-slug/` (fecha de hoy, slug corto en minúsculas). Archivo `noticia.json`:

```json
{
  "titular": "frase corta para el registro",
  "link": "<link original>",
  "formato": "post | carrusel",
  "slides": [
    { "tipo": "portada", "imagen": "poster.webp", "encuadre": "50% 40%", "etiqueta": "Película · 2027",
      "titulo": "**Bocchi the Rock!** tendrá nueva película en 2027",
      "texto": "Hoshi no Ashiato contará el pasado de **Nijika y Seika**." },
    { "tipo": "poster", "imagen": "poster.webp" },
    { "tipo": "texto", "titulo": "¿De qué **trata**?", "subtitulo": "…", "texto": "…",
      "imagen": "visual.jpg", "proporcion": 0.75, "encuadre": "50% 30%" },
    { "tipo": "dato", "antes": "frase corta", "dato": "¥218M", "texto": "…" },
    { "tipo": "cierre" }
  ]
}
```

Portada:
- `posicion`: `"abajo"` (por defecto, con sombra oscura) o `"arriba"` si la imagen tiene el aire arriba.
- `tema`: `"oscuro"` (texto blanco, por defecto) o `"claro"` (texto negro sobre sombra blanca, para imágenes
  claras, como el post de Ao no Hako).
- `sombra`: de 0 a 1 (1 por defecto). Bájala si la imagen ya es oscura donde va el texto.
- `etiqueta` (opcional): el tipo de noticia en 2-3 palabras, en rojo: «Película · 2027», «Nuevo tráiler».
- `subtitulo` (opcional): el nombre alternativo de la serie, p. ej. `/Blue Box/`.

Resto:
- `**palabra**` = rojo: el nombre de la serie o la banda, o el dato clave. No frases enteras.
- `\n` = salto de línea.
- `proporcion` = ancho/alto de la tarjeta (0,75 vertical, 1,33 horizontal, 1 cuadrada).
- Todos los posts terminan en `cierre`.
- **Sin fuente en las slides ni en la leyenda:** son noticias que da todo el mundo.

**Copy:** español latino, de tú, tono de fan que sabe (ver voice.md). Titular de portada como el de un medio:
la noticia entera en 6-10 palabras («Bocchi the Rock! tendrá nueva película en 2027»), con el nombre de la
serie en rojo. Una línea debajo con el dato que engancha. Interiores: titular de 2-5 palabras y ≤ 30 palabras
de texto. Sin emojis en las slides.

## 5. Render y revisión

```bash
cd E:/Claudio/jspace-noticias && node scripts/render.mjs noticias/<carpeta>
```

Mira `hoja.png` y **cada** `slide-NN.png` (Read). Revisa, y corrige y vuelve a renderizar si falla algo:
- Ningún texto montado sobre otro ni cortado.
- La portada se lee en miniatura: titular grande, contraste sobre la imagen, ninguna palabra sola en una línea.
- La imagen se ve nítida (si se ve pixelada, no es la versión grande: búscala).
- Nombres, fechas y cifras iguales a la nota.
- El logo de JSpace arriba y nada importante en la esquina superior derecha (contador de Instagram).

## 6. Leyenda

`leyenda.txt` en la carpeta:
1. Primera línea ≤ 125 caracteres: la noticia en una frase con el dato clave (es lo que se ve antes del «… más»).
2. 2-3 párrafos cortos con el contexto (fechas, staff, de qué trata): aquí va la historia, no en slides.
3. Una pregunta corta para los comentarios, si sale natural.
4. Una sola llamada: «Síguenos para más noticias de anime y J-music 👹».
5. Máximo **5 hashtags** (el límite actual de Instagram): `#JSpace` + 3-4 del tema (#BocchiTheRock #anime …).
Sin «Fuente:».

Comprueba el corte y los hashtags:
```bash
py -I ~/.claude/skills/ig-caption/caption.py noticias/<carpeta>/leyenda.txt
```
(Las notas de «hook» de ese script están pensadas para inglés: fíjate solo en la caja del corte, el largo y los hashtags.)

## 7. Publicar (sin pedir OK) con la API oficial de Instagram

Todo lo hace `scripts/publicar.mjs` (lee el token de `.env`; nunca lo muestres ni lo pidas por el chat).
La API **solo acepta JPG y de 4:5 a 1.91:1**: por eso las slides salen a 1080×1350 en JPG. No pongas
`"alto": 1440` en una noticia que se vaya a publicar por API.

1. Si no existe `.env` con `IG_TOKEN`, **para**: dile a Kazuo que falta conectar la API (pasos en
   `E:\Claudio\jspace-noticias\API-INSTAGRAM.md`) y deja todo listo en la carpeta.
2. Franja y hora: pon `"franja": "jmusic"` o `"franja": "anime"` en noticia.json. **Un post por franja y
   por día**: J-music a las **12:30**, anime a las **18:30** (hora de Bogotá). Mira las carpetas de esa
   franja con `programado.json` sin `publicado.json` y las líneas de hoy en `noticias/publicadas.md` (la
   segunda columna es la franja). Si la franja de hoy está libre y su hora no ha pasado, hoy; si no, el
   siguiente día libre. Si es de última hora y Kazuo dice «ya», publica ya.
3. En cola: `node scripts/publicar.mjs noticias/<carpeta> --a 12:30` (o `--a 18:30`) y **push a GitHub**
   (la nube la publica a esa hora). Ya: `node scripts/publicar.mjs noticias/<carpeta>` y push.
4. Si la API devuelve un error, cópialo tal cual a Kazuo y no cambies la leyenda. Los errores de la cola
   quedan en `noticias/<carpeta>/error.txt`.
5. El script publica también en la **página de Facebook de JSpace** (misma leyenda y las imágenes de la noticia, **sin la slide de cierre**, que en Facebook no tiene sentido; las slides de video van como su JPG) y escribe `publicado.json` y la línea de `noticias/publicadas.md` solo. Si Facebook falla, Instagram ya salió: el error queda en `publicado.json` y se reintenta con `node scripts/publicar.mjs --facebook noticias/<carpeta>`.

Carrusel animado (los MP4 de carrusel-animado, 1080×1350): copia los `slide-NN.mp4` a la carpeta de la
noticia y el script los usa en vez de los JPG. La API acepta videos e imágenes mezclados, hasta 20.

## 8. Resumen para Kazuo (corto)

La hoja (`hoja.png`, con la vista del feed y de la cuadrícula), la primera línea de la leyenda y la hora a la
que sale (o el link si ya salió). Si corregiste algún nombre o dejaste algo fuera, dilo. Si quiere cambiar
algo antes de la hora, se edita la carpeta y se vuelve a renderizar: la cola publica lo que haya en ese momento.
