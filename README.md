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
475 frases escrites + 524 amb números (999 àudios). Veu: Azure **ca-ES-AlbaNeural**.
To proper a les fases 1–3, exigent a partir del mur; diu el nom de tant en tant i algun renec quan apreta.
Etiquetes: `cat` (categoria), `fase` (1–8), `grup` (ini/mur/fi), `estat` (valor dins la categoria), `niv` (1 tranquil · 2 ferm · 3 a fons).
