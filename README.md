# Coll

Entrenador a l'orella per a la pujada del coll: GPS, comparació amb registres anteriors, FC del Pacer Pro i veu per sobre de Spotify.

**Fase actual: pàgina de prova** → https://masvisit.github.io/coll/ (obrir amb Bluefy a l'iPhone).

## Estructura
- `index.html` — pàgina publicada (generada, no editar a mà)
- `src/template.html` — codi de la pàgina
- `src/build.py` — genera `index.html`: `python3 src/build.py`
- `src/assets/` — àudios de prova
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
486 frases escrites + 524 amb números (1.010 àudios). Veu: Azure **ca-ES-AlbaNeural**, accelerada ×1,3 (ffmpeg `atempo`, sense canviar el to). Àudios a `audio/<id>.mp3`, durades a `audio/index.json`.
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
- Gap, diagnòstic i tendència: el `grup` (ini / mur / fi) i l'`estat` han de coincidir amb els del moment. El número va just després i és el valor actual.
- Frases de fase: només dins la seva fase.
- Entrades de fase: només en creuar el límit (20 m d'histèresi).
- `queden X`, `punt` i `reflexio`: un sol cop per pujada.
- Si el GPS és dolent (precisió > 25 m) o la posició és dubtosa, no sona cap frase que depengui de la posició. Si no hi ha FC, no sona cap diagnòstic ni frase de pulsacions.

**Ritme de parla**
- Mínim 20 s entre frases (8 s als últims 300 m).
- Com a molt una frase de motivació seguida.
- Si no ha passat res de nou, silenci fins a 60 s.
- Cap frase repetida en la mateixa pujada; entre sortides, primer les menys usades.
