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

**Si una fuente no abre** (bloqueo de la nube, página que carga con JavaScript como Crunchyroll News, muro de pago):
NUNCA le pidas al equipo que te pegue el texto ni que te busque nada: investigar es tu trabajo. Saca el tema del título
o del slug del link y haz al menos 6 búsquedas antes de rendirte: en inglés, en japonés (nombre de la obra en japonés +
la palabra clave: ダンス, PV, 主題歌, アニメ化…) y en español; abre los mejores resultados (Anime Corner, Final Weapon,
Oricon, Natalie, animate Times, Dengeki, PR TIMES, la web o la cuenta oficial de la obra). Con que el hecho central esté
confirmado en una fuente seria, arma el post con lo verificado y deja fuera los detalles que no pudiste confirmar.
Solo si nada confirma el hecho central, no lo armes y di qué buscaste.
Un post de la cuenta oficial (X, YouTube, Instagram, TikTok) de la obra, el estudio, la editorial, el artista o el
seiyuu ES fuente primaria, aunque ningún medio lo haya cubierto. X e Instagram no abren desde la nube: si encuentras el
enlace de ese post oficial (por el buscador o por otra nota), mándaselo al equipo tal cual, con lo que ya sabes, para
que lo abra, baje el video y te lo devuelva por el chat; con eso confirmas y armas el post.

**Si un video no se puede bajar** (YouTube bloquea la nube): NUNCA le pidas al equipo el enlace. Búscalo tú (WebSearch
con `site:youtube.com` + el nombre en japonés o en inglés, o el canal oficial del estudio, la editorial o el artista;
para Precure, el canal oficial de Toei) y mándale al equipo el enlace exacto del video oficial para que lo baje y lo
devuelva por el chat; mientras, deja listo todo lo demás del post (y su preview, si el video es opcional).

**Videos en calidad completa:** el bot de Telegram solo baja archivos de hasta 20 MB, así que el equipo sube los videos
pesados a Cloudinary (Media Library, carpeta `jspace`) y pega en el chat el enlace (`res.cloudinary.com/...`). Un
enlace así no es una noticia: es material para el post del que hablan. Bájalo con curl a la carpeta de la noticia y
úsalo igual que un video mandado por el chat. Lo mismo con enlaces directos a un MP4 (Google Drive compartido, etc.).

**Imágenes: búscalas tú, el equipo no debe tener que mandarte fotos.** La miniatura de YouTube o la primera imagen que
salga es el último recurso, nunca la primera opción. Cuando la noticia es de una persona (artista, seiyuu, banda),
busca fotos buenas de ella: perfil de su agencia o su web oficial, fotos de prensa en las notas de Natalie, Oricon,
animate Times, Mantan Web, Billboard Japan o Real Sound (abre la nota y saca las URLs de las imágenes en alta; las
galerías de Natalie traen varias), y el visual o la portada del single o del anime. Baja 3-5 candidatas, míralas todas
con Read y elige la mejor: nítida, en alta (mínimo 1080 de ancho), la persona de frente o bien encuadrada, que se vea
bien (ojos abiertos, buena luz, nada cortado por el texto de la portada). Si te piden «otra foto donde se vea mejor»,
repite la búsqueda con fuentes nuevas, no recortes la misma. Solo fotos oficiales o de prensa, nunca de fans.

Reglas: nunca inventar datos; rumores no se publican; si algo no cuadra, no se publica y se avisa. Los carruseles
animados de collab ElKazuoTV × JSpace siguen yendo por carrusel-animado, con su propio flujo (estático antes, guion
literal).

**🎵 Subidos a mano:** si existe `noticias/entrada/<id>.manual.json`, el equipo eligió subir ese post a mano desde la
app de Instagram para ponerle una canción (la API no lo permite). No lo publiques ni lo metas en cola; cuéntalo como
publicado al revisar `publicadas.md` para no repetir la noticia.

**Descargas:** nunca pongas correos ni datos personales del equipo en las peticiones (User-Agent, formularios, URLs):
eso queda esperando un permiso que nadie aprueba y la rutina se traba. Si un sitio te limita (Wikimedia, 429), no
insistas: busca la foto en otra fuente.
