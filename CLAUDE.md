# JSpace · noticias diarias

Posts y carruseles de noticias para @jspaceco_ (anime, manga, J-music, cultura japonesa), uno al día,
publicados solos por Metricool. El flujo completo está en la skill **/jspace**.

- `plantilla/noticia.html`: la slide (1080×1440, 3:4) dibujada desde `noticia.json`. Portada = imagen oficial a sangre con el texto encima (como Koryugi); resto con el estilo de los carruseles de
  ElKazuoTV: negro #0A0A0A con rejilla de rayos, rojo #FF3636, Poppins Black/Medium, línea roja como
  separador. Solo el logo NUEVO de JSpace (recuadro rojo inclinado). Tipos: portada, poster, texto, dato, cierre. Sin fuente.
- `scripts/render.mjs <carpeta>`: noticia.json → slide-NN.png + hoja.png (usa el Chrome instalado).
- `scripts/subir.mjs <carpeta>`: sube las slide-NN.png a catbox.moe → URLs para Metricool.
- `noticias/AAAA-MM-DD-slug/`: una carpeta por noticia (imágenes, noticia.json, PNG, leyenda.txt).
- `noticias/ideas-AAAA-MM-DD.md`: la lista de la mañana (tarea programada de las 8:00).
- `noticias/publicadas.md`: registro de lo publicado (para no repetir).

Reglas: nunca inventar datos; rumores no se publican; un post de JSpace por día; si algo no cuadra, no se
publica y se avisa. Los carruseles animados de collab ElKazuoTV × JSpace siguen yendo por carrusel-animado,
con su propio flujo (estático antes, guion literal).
