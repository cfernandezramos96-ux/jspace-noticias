# JSpace · noticias diarias

Posts y carruseles de noticias para @jspaceco_ (anime, manga, J-music, cultura japonesa), dos al día (J-music
12:30, anime 18:30), publicados solos en Instagram y Facebook con la API oficial. El flujo completo está en la
skill **/jspace** (`.claude/skills/jspace/SKILL.md`).

- `plantilla/noticia.html`: la slide (1080×1350) dibujada desde `noticia.json`. Portada = imagen oficial a sangre con
  el texto encima (como Koryugi); resto con el estilo de los carruseles de ElKazuoTV: negro #0A0A0A con rejilla de
  rayos, rojo #FF3636, Poppins Black/Medium, línea roja como separador. Solo el logo NUEVO de JSpace (recuadro rojo
  inclinado). Tipos: portada, poster, historia, semanal, mosaico, texto, dato, cierre. Sin fuente.
- `scripts/render.mjs <carpeta>`: noticia.json → slide-NN.jpg + hoja.png.
- `scripts/publicar.mjs`: publica en Instagram y Facebook (Facebook sin la slide de cierre), o deja en cola.
- `scripts/telegram.mjs`: el bot de Telegram del equipo (lo corre GitHub Actions); lo que piden por ahí pasa por
  aprobación en el grupo antes de publicarse.
- `noticias/AAAA-MM-DD-slug/`: una carpeta por noticia (imágenes, noticia.json, JPG, leyenda.txt).
- `noticias/ideas-AAAA-MM-DD.md`: la lista de la mañana (rutina de las 8:00).
- `noticias/publicadas.md`: registro de lo publicado (para no repetir).

**Hora:** manda la de Bogotá (UTC−5, sin horario de verano). En la nube el reloj está en UTC: antes de decir «hoy»,
«mañana», un día de la semana o elegir franja, saca la fecha con `TZ=America/Bogota date`. De 19:00 a 24:00 de Bogotá,
en UTC ya es el día siguiente (ej.: lunes 11:40 p. m. en Bogotá = martes 04:40 UTC). Al equipo, las horas siempre en
hora de Bogotá.

**Si una fuente no abre** (bloqueo de la nube, página que carga con JavaScript, muro de pago): no te rindas ni pidas
al equipo el texto. Saca el tema del título o del slug del link y búscalo tú en otras fuentes (Anime Corner, Crunchyroll
en otros idiomas, Oricon, Natalie por buscador, la web o la cuenta oficial de la obra, PR TIMES, medios en japonés).
Verifica ahí y arma el post. Solo si de verdad nada lo confirma, no lo publiques y explica qué buscaste.

**Si un video no se puede bajar** (YouTube bloquea la nube): no le pidas al equipo que busque el enlace. Búscalo tú
(canal oficial del estudio, la editorial o el artista) y mándale al equipo el enlace exacto para que lo baje y lo
devuelva por el chat; mientras, deja listo todo lo demás del post.

Reglas: nunca inventar datos; rumores no se publican; si algo no cuadra, no se publica y se avisa. Los carruseles
animados de collab ElKazuoTV × JSpace siguen yendo por carrusel-animado, con su propio flujo (estático antes, guion
literal).
