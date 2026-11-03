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
- **Nada se publica sin aprobación del grupo** (Kazuo, 3 nov 2026, después de que salió un automático que nadie
  había visto y que debía llevar video). A las **8:00** la rutina elige y ARMA los dos posts del día y los manda al
  grupo de Telegram como preview (ids `AAAAMMDD01` J-music y `AAAAMMDD02` anime; el domingo también los resúmenes,
  `03` y `04`). Si un post necesita un video que la nube no puede bajar, deja todo lo demás listo
  (`noticias/entrada/<id>.espera.json`), manda al grupo el enlace exacto del video y pide que se lo devuelvan; con el
  video manda el preview con las piezas terminadas. Las rutinas de las 12:30, 15:00, 18:30 y 21:00 solo publican lo
  aprobado (`programado.json`). El bot recuerda 1 h antes lo que nadie ha aprobado y avisa si no salió.
- **Dos posts automáticos al día, todos los días (también el domingo)** (decidido con Kazuo el 2 nov 2026):
  - **12:30 · `"franja": "jmusic"`** · J-music y cultura japonesa: bandas, idols, openings, giras por
    Latinoamérica, curiosidades. Es lo que mejor funciona en la cuenta (Atarashii Gakko ×20, BBTS ×3, Yokai ×3).
  - **18:30 · `"franja": "anime"`** · la noticia de anime o manga más fuerte del día.
- **Extras, aparte de esos dos** (Kazuo, 3 nov 2026): lo que pide el equipo por Telegram y los resúmenes de los
  domingos van con `"franja": "extra"` en las horas extra: **15:00** (20:00 UTC) y **21:00** (02:00 UTC del día
  siguiente). El domingo esas dos horas son de los resúmenes (15:00 J-music, 21:00 anime), así que un pedido del
  equipo para el domingo va al siguiente hueco extra libre (o a la hora que pida el equipo). Un extra nunca cuenta
  como el post automático de su tema.
- **La cola la publica la nube:** las rutinas «JSpace · J-music (12:30)», «JSpace · anime (18:30)» y
  «JSpace · extras (15:00 y 21:00)» hacen `git pull`, `node scripts/publicar.mjs --cola` y suben el resultado. Por eso un post en cola **tiene que
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

### Contar la noticia en varias slides (tipo `historia`, referencia: Tanuki Media)

Cuando la noticia tiene más que contar (un aniversario, un disco con varios adelantos, un anuncio con contexto),
en vez de slides de `texto` usa **varias slides `historia`: foto a sangre + UNA frase**, máximo ~20 palabras,
mayúsculas, con 1-3 palabras clave en rojo. Cada slide es un dato nuevo y la historia se cuenta deslizando.
Así eran los mejores carruseles de JSpace (Atarashii Gakko, 180 likes: portada → «el 8 de mayo se lanzó
"Chanka Chanka"» → «junto con "OI AG!"… en Lollapalooza Berlín» → MV → cierre).

```json
{ "tipo": "historia", "imagen": "foto.jpg", "encuadre": "50% 30%",
  "texto": "Tezuka es conocido por **mangas icónicos** como Astro Boy y Black Jack",
  "circulos": ["astro.jpg", "kimba.jpg", "dororo.jpg"], "nota": "Osamu Tezuka | 3 de noviembre de 1928" }
```
- `circulos` (opcional, hasta 5): personajes, portadas o miembros de la banda en círculos sobre la frase.
- `nota` (opcional): una línea pequeña con fecha o nombre.
- Estructura: `portada` → 2-4 `historia` (o `poster` / video) → `cierre`. Una imagen distinta en cada slide.

### Carrusel informativo (tipos `texto` y `dato`, referencia: el primer borrador de Bocchi, que le gusta a Kazuo)

Para noticias con **datos que contar** (de qué trata, staff, estudio, fechas, cifras de taquilla o ventas):
`portada` → `texto` «¿De qué **trata**?» (subtítulo + 1-2 frases + tarjeta con el póster) → `texto` «El
**equipo**» (líneas `**Dirige:** …`, `**Estudio:** …`, separadas con `\n`) → `dato` con la cifra gigante en rojo
(«La última película hizo / **¥218M** / en sus primeros 3 días…») → `cierre`. Fondo negro con la rejilla de rayos.

**Cuál usar:** anuncio corto → post de 3 (portada + póster + cierre). Historia o aniversario → slides `historia`.
Noticia con datos (staff, cifras, fechas) → carrusel informativo. Tráiler oficial → «tráiler en tarjeta».

### Collab con ElKazuoTV: su plantilla, la de los dos logos (Kazuo, 3 nov 2026)

Si el post va en collab con ElKazuoTV (`"colaboradores": ["elkazuotv", …]` en noticia.json), la plantilla cambia
sola al estilo de los carruseles de ElKazuoTV × JSpace (los de SCANDAL / Sambomaster): la cabecera «ElKazuoTV ×
JSPACE» en todas las slides en lugar del logo solo, y el `cierre` oscuro con los dos logos grandes y «Música japonesa
· Anime» (su `texto` lo cambia). Para que se parezca más a esos carruseles, arma el cuerpo con slides `texto`:
titular en mayúsculas con palabras en rojo + línea roja + texto + foto en tarjeta de borde blanco;
`"imagen_arriba": true` pone la tarjeta primero y el texto debajo (alterna las dos disposiciones); `"tema": "claro"`
es la variante blanca, para una slide que quieras destacar. Sin pie de @ en estas slides.

### Noticias con video: «tráiler en tarjeta» (referencia: Koryugi, Naruto × Ninku)

Decidido con Kazuo el 3 nov 2026; **aún no construido ni probado: hazlo la primera vez que llegue una noticia con
tráiler oficial** y revisa el resultado con cuidado (hojas de fotogramas con ffmpeg, no solo un frame).
- Diseño fijo durante todo el video: fondo con el key visual oscurecido, arriba el logo de JSpace + etiqueta
  «Tráiler», el **titular** grande con la serie en rojo y una línea de contexto; en el medio **el tráiler 16:9
  en una tarjeta** con bordes redondeados (con su audio); debajo los créditos (© del estudio) en pequeño; abajo
  «@jspaceco_». El tercio inferior del 9:16 queda libre (lo tapan la leyenda y los botones de Reels).
- Cómo: renderiza el marco como imagen con la plantilla (un tipo de slide nuevo `video`, con el hueco de la
  tarjeta) y monta el clip con ffmpeg (`scale` al tamaño de la tarjeta + `overlay` en su posición, esquinas
  redondeadas con una máscara, audio del tráiler, `-c:v libx264 -pix_fmt yuv420p -c:a aac -ar 48000 -movflags +faststart`).
  Máximo 60-90 s.
- Salidas: **Reel 1080×1920** para Instagram y Facebook (en `publicar.mjs` falta el tipo REELS: añádelo) y la
  versión **1080×1350** como `slide-NN.mp4` dentro del carrusel. En Facebook, el post es solo el video con la
  portada como miniatura.
- El tráiler: `pip install yt-dlp` y bájalo del canal oficial. Si YouTube bloquea la nube, búscalo en la web
  oficial o en la cuenta oficial; si no se consigue, haz el post con imágenes y dilo.
- Efemérides (cumpleaños de personajes, aniversarios): como carrusel de slides `historia`, no con escenas del
  anime (no hay clips oficiales y es donde más riesgo de derechos hay), salvo que exista un clip oficial.

### Resumen de la semana (domingos)

Los domingos hay dos resúmenes **además** de los dos posts normales del día (referencia: Recoanii, «Noticias de
anime destacadas de la semana»): **15:00 → J-music de la semana** y **21:00 → anime de la semana**, con el estilo de
JSpace. Los arma la rutina de las 8:00 y salen solo si el grupo los aprueba.

1. Junta las 5-8 noticias más destacadas de la semana (lunes a domingo) de esa franja: las que publicó JSpace
   (`noticias/publicadas.md`) y las más grandes que no se publicaron (búscalas). Sin rumores.
2. Slides: `semanal` → una `portada` por noticia (imagen oficial, titular de 6-10 palabras, una línea con el dato;
   sin `etiqueta`) → `mosaico` con las imágenes de la semana → `cierre`. Máximo 11 slides.
   ```json
   { "tipo": "semanal", "imagen": "la-mejor.jpg", "encuadre": "65% 30%",
     "titulo": "Lo más\n**destacado**\nde la semana", "tema": "Anime", "rango": "Semana 45 · 2 al 8 de noviembre" }
   { "tipo": "mosaico", "imagenes": ["n1.jpg", "n2.jpg", "n3.jpg", "n4.jpg"], "texto": "¿Cuál fue tu **favorita**?" }
   ```
   En `semanal`, `tema` es «Anime» o «J-Music». Elige como fondo la imagen más llamativa de la semana.
3. Leyenda: «🔥 Lo más destacado de la semana en el anime/la J-music» + una línea por noticia con un emoji +
   «¿Cuál fue tu favorita? 👇» + 5 hashtags. `"franja": "extra"`, `"tema": "jmusic"` o `"anime"`, `"formato": "semanal"`.

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
2. Franja y hora: pon `"franja": "jmusic"` o `"franja": "anime"` en noticia.json (o `"extra"` si es un pedido del
   equipo o un resumen, a las 15:00 o 21:00). **Un post por franja y por día**: J-music a las **12:30**, anime a
   las **18:30** (hora de Bogotá). Mira las carpetas de esa
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

## 9. Lecciones del equipo (aplicar siempre)

- **Sé propositivo en el diseño**, en los carruseles automáticos y en los que manda el equipo: no te quedes con la plantilla por defecto; propón composiciones con más personalidad (ver la guía de abajo).
- Aprendido con el post de Otoboke Beaver (nov 2026): en portada y slide 2, **las personas deben verse grandes** (subir las fotos, que el texto no las tape); si la foto es buena, a veces mejor **foto completa en marco con el texto arriba**; oscurecer el degradado inferior para que no se note el borde de la imagen; el copy de cada slide se ajusta al texto que pide el equipo (nombres exactos).
- **Lo que mande el equipo por el chat es EXTRA** a los dos posts automáticos del día: `"franja": "extra"`, a las 15:00 o 21:00 (ver arriba). Si crees que no conviene (día saturado, tema flojo, repetido), díselo al pedir la aprobación y **pregunta el horario** (en la nota del preview), en vez de asumirlo.
