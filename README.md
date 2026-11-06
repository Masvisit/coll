# Coll

Entrenador a l'orella per a la pujada del coll: GPS, comparació amb registres anteriors, FC del Pacer Pro i veu per sobre de Spotify.

**App** → https://masvisit.github.io/coll/ (obrir amb **Bluefy** a l'iPhone) · pàgina de proves → https://masvisit.github.io/coll/prova.html

### Com s'usa
1. A casa, amb wifi: obre l'app a Bluefy i prem **Descarrega** (les 1.135 veus queden al mòbil i funciona sense cobertura).
2. Tria el tipus de pujada: **Exigent** (contra la referència, a temps) o **Base** (per zones de pulsacions: Z2, Z2–Z3 o Z3; el temps no compta i necessita el pulsòmetre).
3. Abans de sortir: **Prova** el so amb Spotify sonant (sense mode silenci), **Connecta** el Pacer Pro (córrer → LIGHT → Compartir FC → Visible per a tothom) i **Activa** el GPS.
4. Prem **Comença** i ves a córrer. Uns 25 s abans d'arribar a l'inici sona la **xerrada**: amb quantes pulsacions arribes, l'objectiu i el pla. L'entrenador arrenca sol en passar per l'inici i acaba al cim.
5. Al cim: **anàlisi** de la pujada. Si és rècord (només les exigents), passa a ser la referència.
6. **Historial** (a dalt): totes les pujades per data o en rànquing de temps; toca'n una per veure'n l'anàlisi.
7. **Simula**: passa una pujada teva pel motor (exigent o base) i escolta què t'hauria dit.

### Anàlisi de cada pujada
- **Recorregut**: ortofoto de l'ICGC (si falla, Esri) amb la línia de la pujada pintada cada 20 m: verd si aquell tram l'has fet més ràpid que la teva mitjana, vermell si més lent (suavitzat ±60 m); en les de base, dins / per sobre / per sota de zona. Arrossegant el dit per la línia o pel perfil d'altitud surt, cada 20 m: ritme i % respecte a la mitjana, pulsacions i com canvien en 100 m, diferència amb la pujada triada, si és el ritme més ràpid o més lent que has fet mai en aquell punt, inici de tram i què et va dir l'entrenador allà. Moments clau numerats (màxim de pulsacions, pujada sobtada, els 200 m on més has guanyat i perdut, pitjor moment, trams rècord). ▶ reprodueix la pujada en 30 s; ⤢ pantalla completa; pessiga per ampliar. Les rajoles es guarden al mòbil en baixar les veus.
- Les gràfiques s'amplien (⤢): pantalla completa, pessigar o +/− per veure un tram de prop.
- Temps, posició al rànquing i diferència amb el rècord; FC mitjana i màxima, ritme i VAM.
- Gràfica de segons per davant/darrere al llarg del coll respecte a la pujada que triïs (per defecte, la referència d'aquell dia).
- Trams: temps, diferència, el teu millor temps a cada tram (★ si és d'aquesta pujada) i FC. La **pujada ideal** suma els millors trams.
- Pulsacions al llarg del coll amb les zones i temps a cada zona (Z1–Z5, FC màx 194).
- Lectura: on has guanyat i perdut, repartiment de l'esforç, forma vs esforç (temps i pulsacions respecte a l'altra pujada), tram on més pots millorar. En les de base: % en zona, on t'has escapat, i comparació amb l'última base de la mateixa zona.
- Tot el que t'ha dit l'entrenador, per tornar-ho a escoltar. Les pujades fetes amb l'app es poden esborrar.

## Estructura
- `index.html`, `js/app.js` — l'app (pantalles, veu, FC, GPS, desat de sortides)
- `js/historial.js` — historial, rànquing i anàlisi de cada pujada (gràfiques SVG, ampliables)
- `js/mapa.js` — mapa del recorregut amb la línia de colors i la informació cada 20 m
- `js/coach.js` — el motor de l'entrenador (pur: també funciona a Node)
- `sw.js` — per obrir l'app sense cobertura
- `tools/simula.js` — simula una pujada real pel motor i comprova les regles: `node tools/simula.js --sortida 2026-11-03 [--soroll 8] [--forats] [--sensefc] [--mode base --zona z2|z23|z3 --fcdesp -20] [--ultima marge|buit|equilibrat --feble 5]`
- `data/sim/` — les pujades del 30/10 i 03/11 (1 Hz, del FIT) per simular
- `prova.html` — pàgina de proves (generada amb `python3 src/build.py` a partir de `src/template.html`)
- `src/assets/` — àudios de la pàgina de proves
- `frases.html` — revisió de les frases de l'entrenador → https://masvisit.github.io/coll/frases.html
- `src/frases.py` — banc de frases (genera `data/frases.json`: `python3 src/frases.py`)
- `data/perfil_coll.json` — ruta de la pujada (cada 5 m), perfil d'altitud (cada 10 m), 8 fases i temps dels registres del 30/10 i 03/11

## La pujada
3,46 km · +290 m · 8,4 % de mitjana

| Fase | Nom | km | Pendent |
|---|---|---|---|
| 1 | Arrencada | 0–0,46 | 7,8 % |
| 2 | Tram de ritme | 0,46–1,25 | 5,6 % |
| 3 | Respir | 1,25–1,65 | 2,1 % |
| 4 | Entrada al mur | 1,65–1,87 | 9,8 % |
| 5 | El mur | 1,87–2,14 | 15,1 % |
| 6 | Replà | 2,14–2,29 | 7,5 % |
| 7 | Quilòmetre dur | 2,29–3,29 | 12,1 % |
| 8 | Coronar | 3,29–3,46 | 4,7 % |

## Frases de l'entrenador
588 frases escrites + 547 amb números (1.135 àudios). Veu: Azure **ca-ES-AlbaNeural**, accelerada ×1,3 (ffmpeg `atempo`, sense canviar el to). Àudios a `audio/<id>.mp3`, durades a `audio/index.json`.
To exigent però proper a tota la pujada (amb paciència a les fases 1–3, a fons a partir del mur); diu el nom de tant en tant i paraulotes sense manies.
Etiquetes: `cat` (categoria), `fase` (1–8), `grup` (ini/mur/fi), `estat` (valor dins la categoria), `niv` (1 tranquil · 2 ferm · 3 a fons), `valora` (positiu / retret: frases que jutgen com vas).

## Regles del motor (quan parla l'entrenador)
**Principi: millor callar que dir una frase que no toca.** Una frase en un mal moment no suma, resta. Cada frase només pot sonar si l'estat del moment la justifica, i es torna a comprovar just abans de reproduir-la.

**Estat (cada segon)**
- `s`: metre de la pujada (posició GPS projectada sobre la ruta) i fase.
- `Δ`: segons respecte al millor registre al mateix metre (+ = vas per darrere).
- Tendència: com ha canviat `Δ` als últims 250 m.
- `ΔFC`: pulsacions respecte al millor registre al mateix metre (mitjana de 10 s).
- Velocitat: caminant (< 1,6 m/s en pendent) o aturat.

**Classificació** (amb marge perquè no canviï d'estat per un segon)
- Gap: `igual` si |Δ| ≤ 3 s, `davant` / `darrere` fins a 15 s, `molt_davant` / `molt_darrere` a partir de 15 s.
- Tendència: `guanyant` / `perdent` si `Δ` canvia ≥ 3 s en 250 m; si no, `estable`.
- Diagnòstic (necessita FC, amb ±4 ppm de marge):
  - `flipant`: davant i FC alta.
  - `dia_bo`: davant i FC igual o baixa.
  - `conservador`: darrere i FC baixa.
  - `dia_dur`: darrere i FC alta.
  - `controlat`: igual de temps i de FC.

**Prioritat** (si n'hi ha diverses alhora, només sona la primera)
sistema (GPS/FC) → punt clau (rampa) → queden X m → entrada de fase → diagnòstic o gap + número → tendència → frase de fase → motivació

**Coherència**
- `valora: positiu` ("Molt bé", "Vas bé", "Ja ho tens"…): només si no vas per darrere (Δ ≤ +3 s) i no estàs perdent temps.
- `valora: retret` ("no a passejar", "massa còmode"): només si vas per darrere, estàs perdent temps o el diagnòstic és `conservador`.
- Gap, diagnòstic i tendència: el `grup` (ini / mur / fi) i l'`estat` han de coincidir amb els del moment. Primer el número (valor actual) i després el comentari. Si hi ha diagnòstic però ja no en queden frases, només el número.
- `valora: frena` (paciència, recuperar): no si vas per darrere amb marge o sense saber si en tens. `valora: empeny` (apreta): sempre al final; abans, no si vas passat de voltes o amb un dia dur.
- Aturat o caminant: només si ho diuen alhora el progrés per la ruta i la velocitat del GPS. «Tornem a córrer» només si abans t'ha dit que caminaves.
- Reflexió final: només si la lectura és clara (has recuperat ≥ 10 s al final → tenies marge; has perdut ≥ 10 s al final venint bé → sortida massa forta; si no, equilibrada o res).
- Frases de fase: només dins la seva fase.
- Entrades de fase: només en creuar el límit (20 m d'histèresi).
- `queden X`, `punt` i `reflexio`: un sol cop per pujada.
- Si el GPS és dolent (precisió > 25 m) o la posició és dubtosa, no sona cap frase que depengui de la posició. Si no hi ha FC, no sona cap diagnòstic ni frase de pulsacions.

**Ritme de parla**
- Mínim 20 s entre frases (8 s als últims 300 m). L'estat (número + comentari) cada 1–2,5 min, o abans si canvia clarament.
- Com a molt una frase de motivació seguida.
- Si no ha passat res de nou, silenci fins a 60 s (14 s als últims 300 m).
- Cap frase repetida en la mateixa pujada; entre sortides, primer les menys usades.

**Xerrada d'arribada** (les dues modalitats)
- Sona una vegada quan t'acostes a l'inici (a 20–220 m, segons la velocitat, perquè acabi just abans d'arrencar). Si vas massa lent o no s'ha pogut dir, a menys de 60 m sona només l'avís curt.
- Cada tros va sencer o no va: pulsacions (amb què arribes i què vol dir: fred < 125, a punt 125–150, calent > 150; en base, respecte a la zona), objectiu (exigent: el temps a batre i si és el rècord; base: la zona) i pla.
- El pla surt de l'última pujada exigent: si et van sobrar forces → sortir més valent; si et vas buidar → paciència fins al respir; si no, el tram on més lluny vas quedar del teu millor (≥ 4 s) o un pla general.

**Pujada de base** (per zones de pulsacions)
- Res de temps, referència, queden X, punts clau, caminar ni reflexió: només pulsacions.
- Zona: dins de (mínim − 3) a màxim. Avís «per sobre» després de 10 s fora (molt per sobre, +8 ppm, després de 6 s); «per sota» després de 40 s i a partir dels 200 m. Si segueixes fora, els avisos s'espaien (×1,5, ×2).
- «Per sobre» en un tram del 9 % o més → frases de caminar fort; en tram suau → afluixa. «Tornes a estar a lloc» només després d'un avís i 15 s dins.
- Dins de zona: les pulsacions + un comentari cada ~2 min (si s'acaben els comentaris, només el número). Motivació de base si fa 60 s que no diu res.
- Final: el % en zona decideix la valoració (≥ 85 %, 65–85 %, 40–65 %, < 40 %); si el que ha fallat és anar per sota, no diu «t'has passat»: només el temps.
