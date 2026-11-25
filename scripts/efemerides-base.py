# efemerides-base.py · JSpace · genera noticias/efemerides.json (calendario aprobado por Kazuo, 25 nov 2026)
# Cumpleaños de mangakas, cantantes, seiyuus y personajes, más aniversarios redondos de obras, del 25 nov 2026 al
# 31 dic 2027. Las fechas son de conocimiento general y CADA UNA se confirma en una fuente seria antes de diseñarla
# (la rutina de las 8:00, una semana antes). Para añadir una: súmala aquí y vuelve a correr `py -I scripts/efemerides-base.py`
# (conserva el estado y la carpeta de las que ya se armaron).
import json, datetime, os

DESDE, HASTA = datetime.date(2026, 11, 25), datetime.date(2027, 12, 31)

# (MM-DD, año de nacimiento, nombre, de qué lo conocen, tipo, vivo)
PERSONAS = [
    ('01-01', 1975, 'Eiichiro Oda', 'creador de One Piece', 'mangaka', True),
    ('01-02', 1960, 'Naoki Urasawa', 'autor de Monster y 20th Century Boys', 'mangaka', True),
    ('01-05', 1941, 'Hayao Miyazaki', 'director y cofundador de Studio Ghibli', 'director', True),
    ('01-12', 1967, 'Takehiko Inoue', 'autor de Slam Dunk y Vagabond', 'mangaka', True),
    ('01-17', 1952, 'Ryuichi Sakamoto', 'compositor (Merry Christmas Mr. Lawrence, The Last Emperor)', 'músico', False),
    ('01-19', 1983, 'Hikaru Utada', 'cantante de «First Love» y los temas de Kingdom Hearts y Evangelion', 'cantante', True),
    ('01-21', 1980, 'Nana Mizuki', 'cantante y seiyuu (Hinata Hyuga en Naruto)', 'cantante', True),
    ('01-25', 1938, 'Leiji Matsumoto', 'creador de Galaxy Express 999 y Capitán Harlock', 'mangaka', False),
    ('01-25', 1938, 'Shotaro Ishinomori', 'creador de Cyborg 009 y Kamen Rider', 'mangaka', False),
    ('01-28', 1975, 'Hiroshi Kamiya', 'seiyuu de Levi (Attack on Titan)', 'seiyuu', True),
    ('01-29', 1969, 'HYDE', 'vocalista de L\'Arc~en~Ciel', 'cantante', True),
    ('01-29', 1993, 'Kyary Pamyu Pamyu', 'cantante e ícono de Harajuku', 'cantante', True),
    ('02-09', 1973, 'Makoto Shinkai', 'director de Your Name y Suzume', 'director', True),
    ('02-09', 1951, 'Mitsuru Adachi', 'autor de Touch y H2', 'mangaka', True),
    ('02-11', 1969, 'Takeshi Obata', 'dibujante de Death Note y Bakuman', 'mangaka', True),
    ('02-16', 1975, 'Nanase Aikawa', 'cantante de «Yume Miru Shoujo ja Irarenai»', 'cantante', True),
    ('02-19', 1983, 'Mika Nakashima', 'cantante y protagonista de NANA', 'cantante', True),
    ('02-25', 1989, 'Kana Hanazawa', 'seiyuu de Mitsuri Kanroji y Nadeko Sengoku', 'seiyuu', True),
    ('02-26', 1992, 'Gege Akutami', 'autor de Jujutsu Kaisen', 'mangaka', True),
    ('02-27', 1994, 'Rie Takahashi', 'seiyuu de Megumin y Emilia', 'seiyuu', True),
    ('03-05', 1959, 'Tsukasa Hojo', 'autor de City Hunter', 'mangaka', True),
    ('03-07', 1967, 'Ai Yazawa', 'autora de NANA y Paradise Kiss', 'mangaka', True),
    ('03-10', 1991, 'Kenshi Yonezu', 'cantante de «Lemon» y «KICK BACK»', 'cantante', True),
    ('03-15', 1967, 'Naoko Takeuchi', 'creadora de Sailor Moon', 'mangaka', True),
    ('03-18', 1963, 'Yoko Kanno', 'compositora de Cowboy Bebop y Macross Frontier', 'músico', True),
    ('03-20', 1967, 'Yukito Kishiro', 'autor de Battle Angel Alita', 'mangaka', True),
    ('03-26', 1987, 'YUI', 'cantante de «Rolling Star» (Bleach) y «Again» (FMA Brotherhood)', 'cantante', True),
    ('03-30', 1967, 'Megumi Hayashibara', 'seiyuu de Rei Ayanami', 'seiyuu', True),
    ('04-04', 1994, 'Ayase', 'compositor de YOASOBI', 'músico', True),
    ('04-05', 1955, 'Akira Toriyama', 'creador de Dragon Ball', 'mangaka', False),
    ('04-14', 1954, 'Katsuhiro Otomo', 'autor y director de Akira', 'mangaka', True),
    ('04-17', 1988, 'Taka', 'vocalista de ONE OK ROCK', 'cantante', True),
    ('04-26', 1966, 'Yoko Takahashi', 'cantante de «A Cruel Angel\'s Thesis» (Evangelion)', 'cantante', True),
    ('04-27', 1966, 'Yoshihiro Togashi', 'autor de Hunter x Hunter y Yu Yu Hakusho', 'mangaka', True),
    ('05-03', 1977, 'Hiro Mashima', 'autor de Fairy Tail y Rave', 'mangaka', True),
    ('05-05', 1989, 'Koyoharu Gotouge', 'autora de Demon Slayer', 'mangaka', True),
    ('05-08', 1973, 'Hiromu Arakawa', 'autora de Fullmetal Alchemist', 'mangaka', True),
    ('05-22', 1960, 'Hideaki Anno', 'creador de Evangelion', 'director', True),
    ('05-26', 1937, 'Monkey Punch', 'creador de Lupin III', 'mangaka', False),
    ('06-07', 1960, 'Hirohiko Araki', 'autor de JoJo\'s Bizarre Adventure', 'mangaka', True),
    ('06-08', 1983, 'Mamoru Miyano', 'seiyuu de Light Yagami', 'seiyuu', True),
    ('06-14', 1997, 'Fujii Kaze', 'cantante de «Shinunoga E-Wa»', 'cantante', True),
    ('06-24', 1987, 'LiSA', 'cantante de «Gurenge» y «Crossing Field»', 'cantante', True),
    ('06-26', 1977, 'Tite Kubo', 'creador de Bleach', 'mangaka', True),
    ('07-04', 1978, 'Yusuke Murata', 'dibujante de One Punch Man y Eyeshield 21', 'mangaka', True),
    ('07-04', 1973, 'Gackt', 'cantante (ex Malice Mizer)', 'cantante', True),
    ('07-05', 1968, 'Ken Akamatsu', 'autor de Love Hina y Negima', 'mangaka', True),
    ('07-05', 1985, 'Yojiro Noda', 'vocalista de RADWIMPS (Your Name)', 'cantante', True),
    ('07-09', 1990, 'Aimer', 'cantante de «Zankyosanka» y «Kataomoi»', 'cantante', True),
    ('07-11', 1966, 'Kentaro Miura', 'creador de Berserk', 'mangaka', False),
    ('07-26', 1952, 'Yoshitaka Amano', 'ilustrador de Final Fantasy y Vampire Hunter D', 'ilustrador', True),
    ('07-31', 1963, 'Junji Ito', 'maestro del manga de terror (Uzumaki, Tomie)', 'mangaka', True),
    ('08-06', 1965, 'Yuki Kajiura', 'compositora de Demon Slayer, SAO y Madoka', 'músico', True),
    ('08-10', 1988, 'HARUNA', 'vocalista de SCANDAL', 'cantante', True),
    ('08-29', 1986, 'Hajime Isayama', 'creador de Attack on Titan', 'mangaka', True),
    ('09-03', 1985, 'Yuki Kaji', 'seiyuu de Eren Yeager', 'seiyuu', True),
    ('09-06', 1945, 'Go Nagai', 'creador de Mazinger Z y Devilman', 'mangaka', True),
    ('09-12', 1980, 'Hiroyuki Sawano', 'compositor de Attack on Titan', 'músico', True),
    ('09-14', 1981, 'MIYAVI', 'guitarrista y cantante', 'cantante', True),
    ('09-19', 1967, 'Mamoru Hosoda', 'director de Summer Wars y Belle', 'director', True),
    ('09-20', 1977, 'Namie Amuro', 'la reina del J-pop', 'cantante', True),
    ('09-25', 2000, 'Ikura (Lilas Ikuta)', 'voz de YOASOBI', 'cantante', True),
    ('10-02', 1978, 'Ayumi Hamasaki', 'cantante, emperatriz del J-pop', 'cantante', True),
    ('10-10', 1957, 'Rumiko Takahashi', 'autora de Ranma ½ e Inuyasha', 'mangaka', True),
    ('10-10', 1992, 'Tatsuki Fujimoto', 'autor de Chainsaw Man', 'mangaka', True),
    ('10-10', 1965, 'Toshl', 'vocalista de X JAPAN', 'cantante', True),
    ('10-12', 1963, 'Satoshi Kon', 'director de Perfect Blue y Paprika', 'director', False),
    ('10-24', 2002, 'Ado', 'cantante de «Usseewa» y One Piece Film Red', 'cantante', True),
    ('10-25', 1936, 'Masako Nozawa', 'la voz de Goku', 'seiyuu', True),
    ('10-29', 1986, 'ONE', 'autor de One Punch Man y Mob Psycho 100', 'mangaka', True),
    ('11-03', 1928, 'Osamu Tezuka', 'el dios del manga (Astro Boy)', 'mangaka', False),
    ('11-08', 1974, 'Masashi Kishimoto', 'creador de Naruto', 'mangaka', True),
    ('11-20', 1965, 'YOSHIKI', 'líder de X JAPAN', 'músico', True),
    ('11-20', 1986, 'Kohei Horikoshi', 'autor de My Hero Academia', 'mangaka', True),
    ('11-25', 1967, 'Kazuya Nakai', 'seiyuu de Roronoa Zoro', 'seiyuu', True),
    ('11-25', 1978, 'Ringo Sheena', 'cantante y líder de Tokyo Jihen', 'cantante', True),
    ('11-30', 1988, 'Eir Aoi', 'cantante de «Ignite» (SAO)', 'cantante', True),
    ('12-01', 1933, 'Fujiko F. Fujio', 'creador de Doraemon', 'mangaka', False),
    ('12-02', 1995, 'Inori Minase', 'seiyuu de Rem (Re:Zero)', 'seiyuu', True),
    ('12-06', 1950, 'Joe Hisaishi', 'compositor de Studio Ghibli', 'músico', True),
    ('12-10', 1962, 'Masakazu Katsura', 'autor de Video Girl Ai e I"s', 'mangaka', True),
    ('12-13', 1964, 'hide', 'guitarrista de X JAPAN', 'músico', False),
    ('12-19', 1991, 'Sumire Uesaka', 'seiyuu y cantante', 'seiyuu', True),
    ('12-20', 1997, 'SU-METAL', 'voz de BABYMETAL', 'cantante', True),
    ('12-28', 1986, 'Sui Ishida', 'autor de Tokyo Ghoul', 'mangaka', True),
]

# (MM-DD, personaje, obra)
PERSONAJES = [
    ('01-01', 'Kaguya Shinomiya', 'Kaguya-sama: Love is War'), ('01-11', 'Shoto Todoroki', 'My Hero Academia'),
    ('01-20', 'Maki Zenin', 'Jujutsu Kaisen'), ('01-31', 'Tetsuya Kuroko', 'Kuroko no Basket'),
    ('02-02', 'Rem y Ram', 'Re:Zero'), ('02-03', 'Suguru Geto', 'Jujutsu Kaisen'),
    ('02-06', 'Nico Robin', 'One Piece'), ('02-08', 'Giyu Tomioka', 'Demon Slayer'),
    ('02-10', 'Mikasa Ackerman', 'Attack on Titan'), ('02-21', 'Hitori Gotoh (Bocchi)', 'Bocchi the Rock!'),
    ('02-24', 'Shinobu Kocho', 'Demon Slayer'), ('02-28', 'Light Yagami', 'Death Note'),
    ('03-02', 'Sanji', 'One Piece'), ('03-07', 'Yuta Okkotsu', 'Jujutsu Kaisen'),
    ('03-09', 'Franky', 'One Piece'), ('03-20', 'Yuji Itadori', 'Jujutsu Kaisen'),
    ('03-30', 'Eren Yeager', 'Attack on Titan'), ('03-30', 'Rei Ayanami', 'Evangelion'),
    ('04-01', 'Usopp', 'One Piece'), ('04-02', 'Jinbe', 'One Piece'), ('04-03', 'Brook', 'One Piece'),
    ('04-20', 'Katsuki Bakugo', 'My Hero Academia'), ('04-21', 'Ikuyo Kita', 'Bocchi the Rock!'),
    ('04-22', 'Inosuke Hashibira', 'Demon Slayer'), ('05-04', 'Shinichi Kudo', 'Detective Conan'),
    ('05-05', 'Monkey D. Luffy', 'One Piece'), ('05-05', 'Gon Freecss', 'Hunter x Hunter'),
    ('05-09', 'Goku (Día de Goku)', 'Dragon Ball'), ('05-10', 'Kyojuro Rengoku', 'Demon Slayer'),
    ('05-29', 'Nijika Ijichi', 'Bocchi the Rock!'), ('06-01', 'Mitsuri Kanroji', 'Demon Slayer'),
    ('06-06', 'Shinji Ikari', 'Evangelion'), ('06-10', 'All Might', 'My Hero Academia'),
    ('06-21', 'Shoyo Hinata', 'Haikyu!!'), ('06-26', 'Spike Spiegel', 'Cowboy Bebop'),
    ('06-30', 'Usagi Tsukino', 'Sailor Moon'), ('07-03', 'Nami', 'One Piece'), ('07-03', 'Kento Nanami', 'Jujutsu Kaisen'),
    ('07-07', 'Killua Zoldyck', 'Hunter x Hunter'), ('07-14', 'Tanjiro Kamado', 'Demon Slayer'),
    ('07-15', 'Izuku Midoriya', 'My Hero Academia'), ('07-15', 'Ichigo Kurosaki', 'Bleach'),
    ('07-23', 'Sasuke Uchiha', 'Naruto'), ('08-07', 'Nobara Kugisaki', 'Jujutsu Kaisen'),
    ('08-08', 'Muichiro Tokito', 'Demon Slayer'), ('09-03', 'Zenitsu Agatsuma', 'Demon Slayer'),
    ('09-03', 'Doraemon', 'Doraemon'), ('09-15', 'Kakashi Hatake', 'Naruto'), ('09-15', 'Obanai Iguro', 'Demon Slayer'),
    ('09-18', 'Ryo Yamada', 'Bocchi the Rock!'), ('09-30', 'Asuna', 'Sword Art Online'),
    ('10-07', 'Kirito', 'Sword Art Online'), ('10-10', 'Naruto Uzumaki', 'Naruto'), ('10-31', 'L', 'Death Note'),
    ('11-11', 'Roronoa Zoro', 'One Piece'), ('11-29', 'Sanemi Shinazugawa', 'Demon Slayer'),
    ('12-04', 'Asuka Langley', 'Evangelion'), ('12-04', 'Megumin', 'KonoSuba'),
    ('12-05', 'Lelouch Lamperouge', 'Code Geass'), ('12-07', 'Satoru Gojo', 'Jujutsu Kaisen'),
    ('12-22', 'Megumi Fushiguro', 'Jujutsu Kaisen'), ('12-22', 'Tobio Kageyama', 'Haikyu!!'),
    ('12-24', 'Tony Tony Chopper', 'One Piece'), ('12-25', 'Levi Ackerman', 'Attack on Titan'),
    ('12-27', 'Hinata Hyuga', 'Naruto'), ('12-28', 'Nezuko Kamado', 'Demon Slayer'),
]

# (AAAA-MM-DD, qué, fecha original): aniversarios redondos que caen en el rango
ANIVERSARIOS = [
    ('2026-11-25', 'Paprika de Satoshi Kon cumple 20 años', 'estreno en cines de Japón, 25-11-2006'),
    ('2027-02-15', 'Naruto Shippuden cumple 20 años', 'estreno del anime, 15-02-2007'),
    ('2027-03-03', '5 Centímetros por Segundo cumple 20 años', 'estreno en Japón, 03-03-2007'),
    ('2027-03-07', 'el anime de Sailor Moon cumple 35 años', 'estreno, 07-03-1992'),
    ('2027-04-01', 'el anime de Pokémon cumple 30 años', 'estreno, 01-04-1997'),
    ('2027-04-01', 'Tengen Toppa Gurren Lagann cumple 20 años', 'estreno, 01-04-2007'),
    ('2027-04-13', 'el anime de Crayon Shin-chan cumple 35 años', 'estreno, 13-04-1992'),
    ('2027-07-12', 'La Princesa Mononoke cumple 30 años', 'estreno en Japón, 12-07-1997'),
    ('2027-07-18', 'Porco Rosso cumple 35 años', 'estreno en Japón, 18-07-1992'),
    ('2027-07-19', 'The End of Evangelion cumple 30 años', 'estreno en Japón, 19-07-1997'),
    ('2027-07-22', 'el manga de One Piece cumple 30 años', 'primer capítulo en Weekly Shonen Jump, 22-07-1997'),
    ('2027-08-31', 'Hatsune Miku cumple 20 años', 'lanzamiento, 31-08-2007'),
    ('2027-09-14', 'Millennium Actress cumple 25 años', 'estreno en Japón, 14-09-2002'),
    ('2027-10-03', 'el anime de Naruto cumple 25 años', 'estreno, 03-10-2002'),
    ('2027-10-05', 'Mobile Suit Gundam SEED cumple 25 años', 'estreno, 05-10-2002'),
    ('2027-10-07', 'el anime de Berserk (1997) cumple 30 años', 'estreno, 07-10-1997'),
    ('2027-10-10', 'el anime de Yu Yu Hakusho cumple 35 años', 'estreno, 10-10-1992'),
    ('2027-11-03', 'Morning Musume cumple 30 años', 'single indie «Ai no Tane», 03-11-1997'),
]

def dias():
    d = DESDE
    while d <= HASTA:
        yield d; d += datetime.timedelta(days=1)

def peso_persona(nac, edad, vivo):  # redondos primero
    return 3 if edad % 10 == 0 or (vivo and edad % 5 == 0 and edad >= 25) else 1

lista = []
for d in dias():
    md, cands = d.strftime('%m-%d'), []
    for f, q, orig in ANIVERSARIOS:
        if f == d.isoformat():
            cands.append((5, {'tipo': 'aniversario', 'que': q, 'detalle': orig}))
    for f, nac, nom, de, tipo, vivo in PERSONAS:
        if f == md:
            edad = d.year - nac
            if vivo:
                q, det = f'cumpleaños de {nom}', f'cumple {edad} años · {de}'
            else:
                q, det = f'natalicio de {nom} (homenaje)', f'habría cumplido {edad} años · {de}'
            cands.append((peso_persona(nac, edad, vivo) + (1 if tipo in ('mangaka', 'cantante') else 0), {'tipo': tipo, 'que': q, 'detalle': det}))
    for f, nom, obra in PERSONAJES:
        if f == md:
            cands.append((1, {'tipo': 'personaje', 'que': f'cumpleaños de {nom}', 'detalle': obra}))
    for i, (_, c) in enumerate(sorted(cands, key=lambda x: -x[0])):
        lista.append({'fecha': d.isoformat(), 'orden': i + 1, **c, 'estado': 'aprobada', 'carpeta': None})

RUTA = os.path.join(os.path.dirname(__file__), '..', 'noticias', 'efemerides.json')
viejo = {}
if os.path.exists(RUTA):
    for e in json.load(open(RUTA, encoding='utf-8'))['lista']:
        viejo[(e['fecha'], e['que'])] = e
for e in lista:
    v = viejo.get((e['fecha'], e['que']))
    if v: e.update({k: v[k] for k in ('estado', 'carpeta', 'nota') if k in v})

out = {
    'nota': ('Calendario de efemérides APROBADO por Kazuo el 25 nov 2026: no necesita aprobación del grupo. La rutina de '
             'las 8:00 arma y programa sola cada fecha una semana antes (orden 1 = la que sale; las demás del mismo día, '
             'solo si el equipo las pide). Antes de diseñar, confirma la fecha en una fuente seria; si no cuadra, '
             'estado «descartada» con la nota del porqué. Estados: aprobada → programada (con carpeta) → publicada, o descartada.'),
    'lista': lista,
}
json.dump(out, open(RUTA, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(lista), 'efemérides;', len({e['fecha'] for e in lista}), 'días con al menos una')
