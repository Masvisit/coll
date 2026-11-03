"""Genera index.html (un sol fitxer) a partir de src/template.html, data/perfil_coll.json i src/assets/.
Ús, des de l'arrel del repo:  python3 src/build.py"""
import json, base64, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = json.loads((ROOT / 'data/perfil_coll.json').read_text())
data = {
  "route": src["ruta"], "start": src["punts"]["inici"], "top": src["punts"]["cim"],
  "phases": [{"n": f["n"], "nom": f["nom"], "a": f["ini_m"], "b": f["fi_m"], "pct": f["pendent"]} for f in src["fases"]],
  "rec30": [round(v) for v in src["registres"]["2026-10-30"]["temps_s"]],
  "rec03": [round(v) for v in src["registres"]["2026-11-03"]["temps_s"]],
}
b64 = lambda p: base64.b64encode((ROOT / p).read_bytes()).decode()
html = (ROOT / 'src/template.html').read_text()
html = html.replace('__DATA__', json.dumps(data, ensure_ascii=False, separators=(',', ':')))
html = html.replace('__CHIME__', b64('src/assets/chime.mp3')).replace('__FRASE__', b64('src/assets/frase.mp3'))
(ROOT / 'index.html').write_text(html)
print('index.html', len(html) // 1024, 'KB')
