/* Coll · còpia de les pujades al núvol (un gist secret de GitHub).
 * Cada pujada feta amb l'app es guarda al mòbil (IndexedDB) i, si hi ha clau, també al gist «Coll · pujades».
 * Qualsevol mòbil o navegador amb la mateixa clau baixa les que li falten i puja les seves. Els esborrats es
 * propaguen amb una llista (esborrades.json) perquè cap aparell les torni a pujar.
 * La clau només es guarda en aquest navegador. Fa servir les globals de js/app.js ($, store, DB, loadRefs…).
 */
'use strict';
const Nuvol = (() => {
  const API = 'https://api.github.com', DESC = 'Coll · pujades (no esborrar)', TOMB = 'esborrades.json';
  const fname = id => 'pujada-' + id + '.json', idOf = f => f.slice(7, -5);
  const tok = () => store.get('coll_gh_token', null);
  let busy = null, state = store.get('coll_sync', null), running = false;

  async function gh(path, opts = {}) {
    const h = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tok(), 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) h['Content-Type'] = 'application/json';
    let r;
    try { r = await fetch(API + path, { ...opts, headers: h, cache: 'no-store' }); } catch (e) { throw new Error('Sense connexió amb GitHub'); }
    if (r.status === 401) throw new Error('La clau no és vàlida o ha caducat');
    if (r.status === 403 || r.status === 404) { const e = new Error(r.status === 404 ? 'no trobat' : 'La clau no té permís de «gist»'); e.status = r.status; throw e; }
    if (!r.ok) throw new Error('GitHub ha respost ' + r.status);
    return r.status === 204 ? null : r.json();
  }
  async function gist() {
    const id = store.get('coll_gist', null);
    if (id) { try { return await gh('/gists/' + id); } catch (e) { if (e.status !== 404) throw e; store.set('coll_gist', null); } }
    for (let page = 1; page <= 5; page++) {                    // un altre aparell ja el pot haver creat
      const list = await gh(`/gists?per_page=100&page=${page}`);
      const g = list.find(x => x.description === DESC);
      if (g) { store.set('coll_gist', g.id); return gh('/gists/' + g.id); }
      if (list.length < 100) break;
    }
    const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false,
      files: { 'LLEGEIX.md': { content: "Pujades del coll guardades per l'app Coll · entrenador. No l'esborris: és la còpia de seguretat de l'historial.\n" } } }) });
    store.set('coll_gist', g.id);
    return g;
  }
  const text = async f => (f.truncated || f.content == null ? fetch(f.raw_url, { cache: 'no-store' }).then(r => r.text()) : f.content);

  async function doSync() {
    const g = await gist(), files = g.files || {};
    const remote = Object.keys(files).filter(f => /^pujada-.+\.json$/.test(f));
    let tomb = []; try { if (files[TOMB]) tomb = JSON.parse(await text(files[TOMB])) || []; } catch (e) { tomb = []; }
    const dels = [...new Set([...tomb, ...store.get('coll_dels', [])])];
    const local = await DB.all('runs'), have = new Set(local.map(r => r.id));
    // esborrades en un altre aparell: fora d'aquí també
    for (const id of dels) if (have.has(id)) { try { await DB.del('runs', id); } catch (e) {} have.delete(id); }
    // baixar les que falten
    let down = 0;
    for (const f of remote) {
      const id = idOf(f); if (have.has(id) || dels.includes(id)) continue;
      try { const run = JSON.parse(await text(files[f])); if (run && run.id === id && run.complete) { await DB.put('runs', run); down++; } } catch (e) {}
    }
    // pujar les que no hi són (en lots petits) i apuntar els esborrats
    const up = local.filter(r => r.complete && !dels.includes(r.id) && !remote.includes(fname(r.id)));
    for (let i = 0; i < up.length; i += 4) {
      const fl = {}; for (const r of up.slice(i, i + 4)) fl[fname(r.id)] = { content: JSON.stringify(r) };
      await gh('/gists/' + g.id, { method: 'PATCH', body: JSON.stringify({ files: fl }) });
    }
    const gone = remote.filter(f => dels.includes(idOf(f)));
    if (gone.length || dels.length !== tomb.length) {
      const fl = { [TOMB]: { content: JSON.stringify(dels) } }; gone.forEach(f => { fl[f] = null; });
      await gh('/gists/' + g.id, { method: 'PATCH', body: JSON.stringify({ files: fl }) });
    }
    store.set('coll_dels', []);
    return { ok: true, t: Date.now(), n: remote.length - gone.length + up.length, down, up: up.length };
  }
  // sincronitza; si ha baixat o esborrat alguna cosa, recarrega l'historial
  function sync() {
    if (!tok()) return Promise.resolve(null);
    if (busy) return busy;
    state = { ...(state || {}), busy: true }; ui();
    busy = doSync()
      .then(async r => { state = r; store.set('coll_sync', r); await reload(); return r; })
      .catch(e => { state = { ok: false, msg: e.message, t: Date.now() }; store.set('coll_sync', state); return state; })
      .finally(() => { busy = null; ui(); });
    return busy;
  }
  async function reload() {
    await loadRefs();
    if (!$('hist').hidden) Hist.list();
    if (!$('prep').hidden) prepRefresh();
  }
  // una pujada esborrada: s'apunta i s'esborra també del núvol
  function deleted(id) { const d = store.get('coll_dels', []); if (!d.includes(id)) d.push(id); store.set('coll_dels', d); sync(); }

  /* ---------------------------------------------------------------- fila a la preparació */
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'ara mateix' : m < 60 ? `fa ${m} min` : m < 1440 ? `fa ${Math.round(m / 60)} h` : `fa ${Math.round(m / 1440)} dies`; };
  function ui() {
    const d = $('dNuv'), s = $('sNuv'), b = $('bNuv'); if (!d) return;
    if (!tok()) { d.className = 'dot warn'; d.textContent = '!'; s.textContent = 'Ara les pujades només es guarden en aquest mòbil. Configura-ho per veure-les des de tot arreu.'; b.textContent = 'Configura'; return; }
    if (state && state.busy) { d.className = 'dot'; d.textContent = ''; s.textContent = 'Sincronitzant…'; b.textContent = 'Sincronitza'; return; }
    if (state && state.ok) { d.className = 'dot ok'; d.textContent = '✓'; s.innerHTML = `${state.n} ${state.n === 1 ? 'pujada' : 'pujades'} al núvol · ${ago(state.t)}${state.down ? ` · ${state.down} de noves` : ''}. <a href="#" id="nuvKey">Canvia la clau</a>`; b.textContent = 'Sincronitza'; }
    else if (state && state.ok === false) { d.className = 'dot bad'; d.textContent = '!'; s.innerHTML = `No s'ha pogut sincronitzar: ${state.msg}. <a href="#" id="nuvKey">Canvia la clau</a>`; b.textContent = 'Torna-ho a provar'; }
    else { d.className = 'dot'; d.textContent = ''; s.textContent = 'Clau desada. Encara no s\'ha sincronitzat.'; b.textContent = 'Sincronitza'; }
    const k = $('nuvKey'); if (k) k.onclick = ev => { ev.preventDefault(); $('nuvSet').hidden = !$('nuvSet').hidden; };
  }
  function init() {
    $('bNuv').onclick = () => { if (!tok()) { $('nuvSet').hidden = !$('nuvSet').hidden; if (!$('nuvSet').hidden) $('nuvTok').focus(); } else sync(); };
    $('nuvSave').onclick = () => {
      const v = $('nuvTok').value.trim(); $('nuvTok').value = '';
      if (!v) { store.set('coll_gh_token', null); store.set('coll_gist', null); state = null; store.set('coll_sync', null); $('nuvSet').hidden = true; return ui(); }
      store.set('coll_gh_token', v); state = null; $('nuvSet').hidden = true; ui(); sync();
    };
    addEventListener('online', () => { if (!running) sync(); });
    ui();
    if (navigator.onLine !== false) sync();
  }
  return { init, sync, deleted, setRunning: v => { running = v; } };
})();
