# JSpace · noticias diarias

Posts y carruseles de noticias para @jspaceco_ (anime, manga, J-music, cultura japonesa), dos automáticos al día (J-music
12:30, anime 18:30) más extras a las 15:00 y 21:00 (pedidos del equipo y resúmenes de los domingos), publicados en Instagram y Facebook con la API oficial. **Nada sale sin aprobación del grupo de Telegram**: a las 8:00 se arman los posts del día y se mandan al grupo como preview; las rutinas de publicar solo publican lo aprobado. El flujo completo está en la
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

**Lo aprendido:** lee `aprendido.md` antes de armar o corregir cualquier post: son las correcciones que el equipo ya
hizo y no debe repetir. Cuando el equipo corrija algo que vale para los siguientes posts, añádelo ahí (en el mismo
commit de la corrección).

**Antes de mandar un preview, revísalo tú** (Kazuo, 4 nov 2026: cada corrección cuesta tiempo y créditos, la meta es
que el equipo apruebe a la primera). Abre `hoja.png` con Read y comprueba, slide por slide:
- **Portada sin barra de color abajo:** la foto llena las 1350 px de alto. La plantilla ya ignora `alto_imagen` en la
  portada; si la foto es apaisada (un grupo en fila), busca otra más vertical o encuádrala para que se vean las caras.
- **Lo rojo nunca partido entre renglones con texto blanco delante:** «50 mil CDs en / **solo cinco días**», no
  «50 mil CDs en **solo** / **cinco días**». La plantilla ya baja la frase roja al renglón siguiente; si aun así se ve
  mal, reescribe el título para que la parte roja quede entera.
- Nada cortado por el texto (caras, manos, logos), ningún texto desbordado, fotos nítidas.
- Todo lo de `aprendido.md`.
Si algo falla, corrígelo y vuelve a renderizar ANTES de mandar el preview.

**Historias (prueba del 4 al 18 nov 2026):** cada post publicado sale también en historias de Instagram (la portada en
vertical, `historia.jpg`; la API no pone stickers). El informe del lunes 16 de noviembre dice si sirvieron (alcance o
visitas al perfil si hay métricas; si no, likes de los posts con historia frente a los de antes) y pregunta al grupo
si seguimos. El 18 se apagan solas.

**Reels de prueba en Instagram (prueba de un mes, 4 nov - 4 dic 2026; Kazuo):** solo los ven quienes NO siguen la
cuenta; los seguidores ven el carrusel. NUNCA se gradúan para que los vean todos: se quedan como reels de prueba.
- **Post con video:** automático. `publicar.mjs` sube el `reel.mp4` (el mismo de Facebook) como reel de prueba
  después del carrusel. No admite collab; `"reel_prueba": false` en noticia.json lo apaga.
- **Post sin video que lo valga** (artista o banda con una canción conocida, anime con un opening famoso, sobre todo
  si es de Colombia): corre `node scripts/portada-animada.mjs noticias/<carpeta>` (sale `reel-cancion.mp4`, 8 s, sin
  música) y pon en noticia.json `"cancion": "<artista – canción>"` con la canción que mejor le queda. Cuando el post
  sale, el bot se lo manda a Kazuo POR PRIVADO (no al grupo) y él le pone la canción desde la app. Nunca pegues tú
  música con derechos al video. Máximo uno al día.
- **Sin aprobación aparte** (Kazuo, 4 nov 2026): el reel de prueba va con lo que se aprobó del carrusel. Nunca lo
  mandes a aprobar ni preguntes por él. Pero cada vez que corrijas el carrusel (titular, etiqueta, foto de portada,
  párrafo, créditos, video), vuelve a generar el reel con los mismos cambios ANTES del nuevo preview:
  `node scripts/reel.mjs noticias/<carpeta> <clip> <segundos> <desde>` (los del video del post) y, si existe
  `reel-cancion.mp4`, `node scripts/portada-animada.mjs noticias/<carpeta>`. Así el reel siempre coincide con el
  carrusel aprobado.
- Al terminar el mes, el informe del lunes 7 de diciembre compara el alcance con y sin reel de prueba y pregunta si
  seguimos.
