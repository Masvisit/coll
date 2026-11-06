/* Coll · app de l'entrenador (Bluefy a l'iPhone).
 * Preparació (tipus de pujada, veus, so, FC, GPS, referència) → cursa (motor js/coach.js + veu de l'Alba per sobre de Spotify)
 * → anàlisi i desat de la sortida (si és rècord, passa a ser la referència) · historial (js/historial.js) · simulació.
 */
'use strict';
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtT = s => { if (s == null || !isFinite(s)) return '—'; s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), x = s % 60; return m + ':' + String(x).padStart(2, '0'); };
const fmtRel = s => (s == null ? '' : (s < 0 ? '−' : '') + fmtT(Math.abs(s)));   // abans de l'inici surt en negatiu
const fmtSigned = d => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(Math.round(d));
const fmtDate = iso => { const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'numeric' }); };
const fmtDiff = d => { if (d == null || !isFinite(d)) return '—'; const a = Math.abs(Math.round(d)), sg = d > 0.5 ? '+' : d < -0.5 ? '−' : ''; return a < 60 ? sg + a + ' s' : sg + Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0'); };
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
window.addEventListener('error', e => showErr(e.message));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason && e.reason.message || e.reason)));
function showErr(m) { const el = $('err'); if (el) el.textContent = m || ''; if (m) console.error(m); }
function show(id) { for (const s of ['prep', 'run', 'end', 'sim', 'hist']) $(s).hidden = s !== id; window.scrollTo(0, 0); }
function dot(id, cls, txt) { const d = $(id); d.className = 'dot ' + (cls || ''); d.textContent = txt || (cls === 'ok' ? '✓' : cls === 'bad' ? '!' : ''); }

/* ------------------------------------------------------------ IndexedDB */
const DB = (() => {
  let p = null;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('coll', 1);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio'); if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (name, mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction(name, mode), req = fn(t.objectStore(name));
    t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
  return {
    get: (n, k) => tx(n, 'readonly', s => s.get(k)),
    put: (n, v, k) => tx(n, 'readwrite', s => (k === undefined ? s.put(v) : s.put(v, k))),
    keys: n => tx(n, 'readonly', s => s.getAllKeys()),
    del: (n, k) => tx(n, 'readwrite', s => s.delete(k)),
    all: n => tx(n, 'readonly', s => s.getAll())
  };
})();

/* ------------------------------------------------------------ dades */
let perfil, frases, audioIdx, route, bank, refs = [], hist = [];
async function loadData() {
  const j = u => fetch(u, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('No puc carregar ' + u); return r.json(); });
  [perfil, frases, audioIdx] = await Promise.all([j('data/perfil_coll.json'), j('data/frases.json'), j('audio/index.json')]);
  route = Coach.makeRoute(perfil);
  bank = Coach.makeBank(frases.filter(f => audioIdx.durations[f.id] != null));   // mai una frase sense veu
  await loadRefs();
}
// Totes les pujades (les dues del rellotge i les fetes amb l'app). Les exigents són les referències possibles.
function entry(o) {
  const hasHR = o.hrArr && o.hrArr.some(v => v > 0);
  o.ref = Coach.makeRef(o.id, fmtDate(o.date), o.tArr, hasHR ? o.hrArr : null, route.L);
  if (o.total == null) o.total = o.ref.total; else o.ref.total = o.total;
  o.nom = o.ref.nom; o.hasHR = hasHR;
  return o;
}
async function loadRefs() {
  const list = [];
  for (const [id, r] of Object.entries(perfil.registres)) list.push(entry({ id, date: id, src: 'fit', tipus: 'exigent', tArr: r.temps_s, hrArr: r.fc }));
  try { for (const run of await DB.all('runs')) if (run.complete && run.curve) list.push(entry({ id: run.id, date: run.date, src: 'app', tipus: run.tipus || 'exigent', zona: run.zona || null, total: run.total, tArr: run.curve.t, hrArr: run.curve.hr, run })); } catch (e) {}
  hist = list;
  refs = list.filter(e => e.tipus !== 'base').map(e => e.ref).sort((a, b) => a.total - b.total);
  const sel = $('selRef'), chosen = store.get('coll_ref', null);
  sel.innerHTML = refs.map((r, i) => `<option value="${r.id}">${r.nom} · ${fmtT(r.total)}${i === 0 ? ' ★' : ''}</option>`).join('');
  sel.value = refs.some(r => r.id === chosen) ? chosen : refs[0].id;
  refInfo();
}
const currentRef = () => refs.find(r => r.id === $('selRef').value) || refs[0];
const baseReady = () => frases.filter(f => f.cat === 'base' || f.cat === 'bbrief').every(f => audioIdx.durations[f.id] != null);
const tipusNow = () => (store.get('coll_tipus', 'exigent') === 'base' && baseReady() ? 'base' : 'exigent');
const zonaNow = () => Coach.ZONES[store.get('coll_zona', 'z23')] || Coach.ZONES.z23;
function tipusUI() {
  const t = tipusNow(), z = zonaNow();
  $('segTipus').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.t === t); if (b.dataset.t === 'base') b.disabled = !baseReady(); });
  $('zonaRow').hidden = t !== 'base'; $('selZona').value = z.clau; $('refRow').hidden = t === 'base';
  $('tipusNote').textContent = t === 'base'
    ? `Pujada de base: el temps no compta. L'entrenador et manté entre ${z.lo} i ${z.hi} pulsacions i et diu quan caminar. Necessita el pulsòmetre.`
    : (baseReady() ? `Contra la referència: temps, segons i pulsacions a cada tram. Abans de començar, la xerrada amb el pla.` : `Contra la referència. La pujada de base s'activarà quan tinguis les veus noves.`);
  $('bStart').textContent = t === 'base' ? 'Comença la pujada de base' : 'Comença'; $('bStart').style.background = t === 'base' ? 'var(--ok)' : '';
}
function refInfo() { const r = currentRef(); $('sRef').textContent = `Et compares amb la pujada del ${r.nom}: ${fmtT(r.total)}${r === refs[0] ? ', el teu millor temps' : ''}.`; }

/* ------------------------------------------------------------ veu */
const VOLUMS = { normal: { g: 1.0, nom: 'Normal' }, fort: { g: 1.7, nom: 'Fort' }, maxim: { g: 2.6, nom: 'Màxim' } };
const V = () => (audioIdx && audioIdx.versio) || 1;                 // versió dels àudios (quan canvien, es tornen a baixar)
const akey = id => id + '@' + V();
const Player = {
  ctx: null, out: null, gain: null, mem: new Map(), muted: false,
  async unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}   // sona per sobre de Spotify, sense aturar-lo
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC();
      // guany + limitador: la veu pot pujar per sobre de la música sense distorsionar
      this.gain = this.ctx.createGain();
      const lim = this.ctx.createDynamicsCompressor();
      lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
      this.gain.connect(lim); lim.connect(this.ctx.destination); this.out = this.gain;
      this.setVolume(store.get('coll_volum', 'fort'));
    }
    if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) {} }
    const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0);
  },
  setVolume(k) { const v = VOLUMS[k] || VOLUMS.fort; if (this.gain) this.gain.gain.value = v.g; },
  async raw(id) {
    let ab = null;
    try { ab = await DB.get('audio', akey(id)); } catch (e) {}
    if (!ab) {
      const r = await fetch('audio/' + id + '.mp3?v=' + V()); if (!r.ok) throw new Error('No trobo l\'àudio ' + id);
      ab = await r.arrayBuffer(); try { await DB.put('audio', ab, akey(id)); } catch (e) {}
    }
    return ab;
  },
  async buffer(id) {
    if (this.mem.has(id)) return this.mem.get(id);
    const ab = await this.raw(id);
    const buf = await new Promise((res, rej) => { const p = this.ctx.decodeAudioData(ab.slice(0), res, rej); if (p && p.then) p.then(res, rej); });
    this.mem.set(id, buf); if (this.mem.size > 60) this.mem.delete(this.mem.keys().next().value);
    return buf;
  },
  async playSeq(ids) {
    await this.unlock();
    for (let i = 0; i < ids.length; i++) {
      const buf = await this.buffer(ids[i]);
      if (this.muted) continue;
      await new Promise(res => {
        const s = this.ctx.createBufferSource(); s.buffer = buf; s.connect(this.out);
        let done = false; const fin = () => { if (!done) { done = true; res(); } };
        s.onended = fin; s.start(); setTimeout(fin, buf.duration * 1000 + 600);
      });
      if (i < ids.length - 1) await sleep(250);
    }
  }
};
async function voicesStatus() {
  const all = Object.keys(audioIdx.durations), suf = '@' + V();
  let keys = []; try { keys = await DB.keys('audio'); } catch (e) {}
  const have = new Set(keys.filter(k => String(k).endsWith(suf)).map(k => String(k).slice(0, -suf.length)));
  const old = keys.some(k => !String(k).endsWith(suf));
  const n = all.filter(id => have.has(id)).length;
  if (n === all.length) { dot('dVeus', 'ok'); $('sVeus').textContent = `${n} frases de l'Alba al mòbil. Funciona sense cobertura.`; $('bVeus').disabled = true; $('bVeus').textContent = 'Fet'; }
  else {
    dot('dVeus', n ? 'warn' : ''); $('bVeus').disabled = false; $('bVeus').textContent = 'Descarrega';
    $('sVeus').textContent = (old && !n ? 'Hi ha veus noves, més fortes: torna-les a baixar. ' : `${n} de ${all.length} al mòbil. `) + `${Math.round(20 * (all.length - n) / all.length)} MB, millor amb wifi; després funciona sense cobertura.`;
  }
  return { n, total: all.length, have, old: keys.filter(k => !String(k).endsWith(suf)) };
}
async function downloadVoices() {
  const { have, old } = await voicesStatus();
  const miss = Object.keys(audioIdx.durations).filter(id => !have.has(id));
  if (!miss.length) return;
  $('bVeus').disabled = true; $('barVeus').hidden = false;
  let done = 0, fails = 0; const total = miss.length;
  const worker = async () => {
    while (miss.length) {
      const id = miss.shift();
      try { const r = await fetch('audio/' + id + '.mp3?v=' + V()); if (!r.ok) throw 0; await DB.put('audio', await r.arrayBuffer(), akey(id)); } catch (e) { fails++; }
      done++; $('barVeus').firstElementChild.style.width = (done / total * 100).toFixed(1) + '%';
      $('sVeus').textContent = `Baixant… ${done} de ${total}`;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  for (const k of old) { try { await DB.del('audio', k); } catch (e) {} }        // fora les veus antigues
  Player.mem.clear();
  $('barVeus').hidden = true;
  await voicesStatus();
  if (fails) $('sVeus').textContent += ` (${fails} no s'han pogut baixar: torna-ho a provar)`;
}

/* ------------------------------------------------------------ pulsòmetre */
const HR = {
  dev: null, connected: false, connecting: false, bpm: null, last: 0, retry: 0, fns: [], err: null,
  on(f) { this.fns.push(f); }, emit(k, v) { this.fns.forEach(f => f(k, v)); },
  async connect() {
    if (!navigator.bluetooth) throw new Error('Aquest navegador no té Bluetooth. Obre l\'app amb Bluefy.');
    this.connecting = true; this.err = null;
    try { return await this._connect(); } catch (e) { this.err = e.message || String(e); throw e; } finally { this.connecting = false; }
  },
  async _connect() {
    let dev = null;
    try { if (navigator.bluetooth.getDevices) { const ds = await navigator.bluetooth.getDevices(); dev = ds.find(d => /polar/i.test(d.name || '')) || null; } } catch (e) {}
    if (dev) { try { return await this.attach(dev); } catch (e) {} }
    // la cerca filtrada no troba el Pacer Pro a Bluefy; amb «qualsevol dispositiu» sí
    dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['heart_rate'] });
    return this.attach(dev);
  },
  async attach(dev) {
    this.dev = dev;
    if (!dev._collListen) { dev.addEventListener('gattserverdisconnected', () => this.lost()); dev._collListen = true; }
    const server = await dev.gatt.connect();
    const ch = await (await server.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    ch.addEventListener('characteristicvaluechanged', e => {
      const v = e.target.value, f = v.getUint8(0), bpm = (f & 1) ? v.getUint16(1, true) : v.getUint8(1);
      this.bpm = bpm; this.last = Date.now(); this.emit('hr', bpm);
    });
    await ch.startNotifications();
    this.connected = true; this.retry = 0; this.emit('status', true);
  },
  lost() {
    if (this.connected) { this.connected = false; this.emit('status', false); }
    if (this.dev && this.retry < 10) { this.retry++; setTimeout(() => this.attach(this.dev).catch(() => this.lost()), 1500 * Math.min(this.retry, 5)); }
  }
};

/* ------------------------------------------------------------ GPS */
const GPS = {
  id: null, last: null, err: null, fns: [],
  on(f) { this.fns.push(f); },
  start() {
    if (this.id != null) return;
    if (!navigator.geolocation) throw new Error('Aquest navegador no té GPS.');
    this.id = navigator.geolocation.watchPosition(p => {
      const c = p.coords;
      this.last = { t: Date.now(), lat: c.latitude, lon: c.longitude, acc: c.accuracy, speed: c.speed != null && c.speed >= 0 ? c.speed : null };
      this.err = null; this.fns.forEach(f => f(this.last));
    }, e => { this.err = e.message || ('codi ' + e.code); this.fns.forEach(f => f(null)); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }
};

/* ------------------------------------------------------------ pantalla encesa */
let wl = null, wantWake = false;
async function askWake() {
  wantWake = true;
  try { if ('wakeLock' in navigator && (!wl || wl.released)) wl = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantWake) askWake(); });

/* ------------------------------------------------------------ cursa */
let coach = null, run = null, speaking = false, ended = false;
const usage = store.get('coll_usage', {});
function startRun() {
  const ref = currentRef(), tipus = tipusNow(), zona = zonaNow();
  coach = Coach.createCoach({ route, bank, ref, usage, hrConnected: HR.connected, tipus, zona,
    ultima: tipus === 'exigent' ? Hist.ultima() : {}, refIsBest: ref === refs[0] });
  run = { id: 'run-' + Date.now(), date: new Date().toISOString(), tipus, zona: tipus === 'base' ? zona.clau : null,
    ref: ref.id, refNom: ref.nom, refTotal: ref.total, samples: [], said: [], complete: false };
  ended = false; speaking = false;
  $('rDL').textContent = tipus === 'base' ? `${zona.nom} · ${zona.lo}–${zona.hi} pulsacions` : `vs ${ref.nom} · ${fmtT(ref.total)}`;
  $('rHRl').textContent = tipus === 'base' ? 'En zona' : 'Pulsacions';
  $('rStrip').innerHTML = route.phases.map(p => `<span style="flex:${p.b - p.a}"><i style="width:0"></i></span>`).join('');
  $('bStop').textContent = 'Atura'; $('rSaid').textContent = '—';
  show('run');
}
async function speak(u) {
  speaking = true;
  $('rSaid').textContent = u.text;
  run.said.push({ rel: coach.state.t0 != null ? u.t - coach.state.t0 : null, kind: u.kind, text: u.text, ids: u.ids });
  try { await Player.playSeq(u.ids); } catch (e) { showErr('Àudio: ' + e.message); }
  for (const id of u.ids) if (!id.startsWith('num_')) usage[id] = (usage[id] || 0) + 1;
  store.set('coll_usage', usage);
  coach.done(Date.now()); speaking = false;
}
function onFixRun(fx) {
  if (!coach || !fx) return;
  coach.onFix(fx);
  const sn = coach.snapshot();
  if (sn.mode === 'pujant') run.samples.push({ t: fx.t / 1000, s: sn.s, hr: HR.connected && Date.now() - HR.last < 5000 ? HR.bpm : 0 });
  if (sn.mode === 'cim' && !run.complete) finishRun();
}
async function finishRun() {
  const st = coach.state, f = st.finish;
  run.complete = true; run.total = f.T; run.d = f.d; run.zonaPct = f.zonaPct; run.zStats = f.zStats;
  run.samples.push({ t: f.tf, s: route.L, hr: HR.connected ? HR.bpm || 0 : 0 });
  run.curve = Coach.runCurve(run.samples, route.L, st.t0, f.T);
  run.log = st.log;
  const best = refs[0];
  run.record = run.tipus !== 'base' && f.T < best.total;   // una pujada de base no és mai rècord ni referència
  try { await DB.put('runs', JSON.parse(JSON.stringify(run))); } catch (e) { showErr('No s\'ha pogut desar la sortida: ' + e.message); }
  store.set('coll_last', { id: run.id, date: run.date, total: run.total, d: run.d, refNom: run.refNom, record: run.record, tipus: run.tipus, zonaPct: run.zonaPct });
  if (run.record) store.set('coll_ref', run.id);
  await loadRefs();
  $('bStop').textContent = 'Veure l\'anàlisi';
}
function tick() {
  if (!coach) return;
  const now = Date.now();
  if (!speaking && !ended) { const u = coach.next(now); if (u) speak(u); }
  if (!$('run').hidden) drawRun();
}
setInterval(tick, 500);
function drawRun() {
  const sn = coach.snapshot(), g = GPS.last;
  $('rGPS').textContent = g ? `GPS ±${Math.round(g.acc)} m${GPS.err ? ' · ' + GPS.err : ''}${HR.connected ? '' : ' · sense pulsòmetre'}` : (GPS.err ? 'GPS: ' + GPS.err : 'Esperant el GPS…');
  const armed = sn.mode === 'armat';
  $('rWait').hidden = !armed; $('rDelta').hidden = armed;
  if (armed) {
    $('rPhase').textContent = 'Esperant l\'inici'; $('rPct').textContent = '';
    if (g) {
      const d = route.dist(g.lat, g.lon, route.start[0], route.start[1]);
      $('rWaitV').textContent = d < 30 ? 'A punt: comença a pujar' : 'Ves cap a l\'inici';
      $('rWaitL').textContent = d < 30 ? 'El compte comença sol quan passis per la sortida.' : `Ets a ${d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d) + ' m'} de l'inici de la pujada.`;
    }
  } else {
    const ph = sn.phase || route.phases[route.phases.length - 1];
    $('rPhase').textContent = sn.mode === 'cim' ? 'Cim!' : `${ph.n} · ${ph.nom}`;
    $('rPct').textContent = sn.mode === 'cim' ? '' : `${String(ph.pct).replace('.', ',')} %`;
    if (sn.tipus === 'base') {
      const h = HR.connected && Date.now() - HR.last < 5000 ? HR.bpm : null, z = sn.zona;
      $('rD').innerHTML = h ? h + '<small>ppm</small>' : '—';
      $('rDelta').className = 'delta ' + (h == null ? '' : h > z.hi ? 'behind' : h < z.lo - 3 ? 'low' : 'ahead');
    } else {
      const d = sn.mode === 'cim' && sn.finish ? sn.finish.d : sn.d;
      if (d != null) { $('rD').innerHTML = fmtSigned(d) + '<small>s</small>'; $('rDelta').className = 'delta ' + (d < -0.5 ? 'ahead' : d > 0.5 ? 'behind' : ''); }
    }
    $('rStrip').querySelectorAll('i').forEach((el, i) => { const p = route.phases[i]; el.style.width = Math.max(0, Math.min(1, (sn.s - p.a) / (p.b - p.a))) * 100 + '%'; });
  }
  $('rT').textContent = fmtT(sn.elapsed);
  $('rRem').innerHTML = armed ? '—' : sn.mode === 'cim' ? '0<em>m</em>' : sn.remaining >= 1000 ? (sn.remaining / 1000).toFixed(2).replace('.', ',') + '<em>km</em>' : Math.round(sn.remaining) + '<em>m</em>';
  if (sn.tipus === 'base') $('rHR').innerHTML = sn.zonaPct != null ? Math.round(sn.zonaPct * 100) + '<em>%</em>' : '—';
  else $('rHR').innerHTML = HR.connected && HR.bpm ? HR.bpm + (sn.hrRef ? `<em>ref ${Math.round(sn.hrRef)}</em>` : '') : '—';
  $('rPace').innerHTML = sn.speed > 0.6 && sn.mode === 'pujant' ? fmtT(1000 / sn.speed) + '<em>/km</em>' : '—';
}
let stopArmed = 0;
function stopPressed() {
  if (run && run.complete) { ended = true; coach = null; return Hist.open(run.id, 'prep'); }
  if (Date.now() - stopArmed > 3000) { stopArmed = Date.now(); $('bStop').textContent = 'Segur? Prem de nou'; setTimeout(() => { if ($('bStop').textContent.startsWith('Segur')) $('bStop').textContent = 'Atura'; }, 3000); return; }
  ended = true; coach = null; show('prep'); prepRefresh();
}

/* ------------------------------------------------------------ simulació */
async function simulate() {
  const simId = $('simRun').value;
  const track = (await fetch('data/sim/' + simId + '.json').then(r => r.json())).punts;
  const ref = refs.find(r => r.id !== simId) || refs[0], tv = $('simTipus').value, tipus = tv === 'exigent' ? 'exigent' : 'base', zona = Coach.ZONES[tv] || Coach.ZONES.z23;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const c = Coach.createCoach({ route, bank, ref, usage: {}, random: rnd, hrConnected: true, tipus, zona, ultima: tipus === 'exigent' ? Hist.ultima() : {}, refIsBest: ref === refs[0] });
  const out = []; let busy = null, k = 0;
  const t0s = Math.floor(track[0][0] / 1000), t1s = Math.ceil(track[track.length - 1][0] / 1000) + 5;
  for (let t = t0s; t <= t1s; t++) {
    if (busy != null && t >= busy) { c.done(busy * 1000); busy = null; }
    while (k < track.length && track[k][0] / 1000 <= t) { const [tms, lat, lon, fc, vel] = track[k++]; c.onFix({ t: tms, lat, lon, acc: 5, speed: vel }); if (fc > 0) c.onHR(fc, tms); }
    if (busy == null) { const u = c.next(t * 1000); if (u) { busy = t + u.ids.reduce((a, id) => a + (audioIdx.durations[id] || 2), 0) + 0.25 * (u.ids.length - 1); out.push(u); } }
  }
  const st = c.state;
  $('simInfo').textContent = !st.finish ? 'No s\'ha completat la pujada.' : tipus === 'base'
    ? `Pujada del ${fmtDate(simId)} com si fos de base ${zona.nom} (${zona.lo}–${zona.hi}): ${st.finish.zonaPct != null ? Math.round(st.finish.zonaPct * 100) : '—'} % en zona amb les pulsacions d'aquell dia. ${out.length} intervencions.`
    : `Pujada del ${fmtDate(simId)} contra ${ref.nom} (${fmtT(ref.total)}): cim en ${fmtT(st.finish.T)} (${fmtSigned(st.finish.d)} s). ${out.length} intervencions.`;
  $('simLog').innerHTML = out.map((u, i) => `<li><span class="t">${st.t0 != null ? fmtRel(u.t - st.t0) : ''}</span><span>${u.text}<span class="k">${u.kind}${u.info ? ' · ' + u.info : ''}</span></span><button data-i="${i}">▶</button></li>`).join('');
  $('simLog').querySelectorAll('button').forEach(b => b.onclick = () => Player.playSeq(out[+b.dataset.i].ids).catch(e => showErr(e.message)));
}

/* ------------------------------------------------------------ preparació */
function prepRefresh() {
  const last = store.get('coll_last', null);
  $('lastRun').textContent = last ? `Última pujada: ${fmtDate(last.date)} · ${fmtT(last.total)}${last.tipus === 'base' ? (last.zonaPct != null ? ` · base, ${Math.round(last.zonaPct * 100)} % en zona` : ' · base') : last.d != null ? ` (${fmtSigned(last.d)} s vs ${last.refNom})` : ''}${last.record ? ' · rècord' : ''}  ›` : '';
  $('lastRun').dataset.id = last && last.id ? last.id : '';
  tipusUI();
}
function gpsPrep(fx) {
  if (!fx) { dot('dGPS', 'bad'); $('sGPS').textContent = 'Error: ' + (GPS.err || 'sense senyal') + '. Dona permís d\'ubicació a Bluefy.'; return; }
  const d = route.dist(fx.lat, fx.lon, route.start[0], route.start[1]);
  dot('dGPS', fx.acc <= 20 ? 'ok' : 'warn');
  $('sGPS').textContent = `Precisió ±${Math.round(fx.acc)} m · a ${d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d) + ' m'} de l'inici de la pujada.`;
}
GPS.on(fx => { gpsPrep(fx); onFixRun(fx); });
HR.on((k, v) => {
  if (k === 'hr') { if (coach) coach.onHR(v, Date.now()); }
  else if (coach) coach.onHRStatus(v, Date.now());
  hrRow();
});
// la fila del pulsòmetre es pinta sempre a partir de l'estat real (connectat, rebent pulsacions, perdut…)
function hrRow() {
  const fresh = HR.connected && Date.now() - HR.last < 5000;
  if (!navigator.bluetooth) { dot('dFC', 'bad'); $('sFC').textContent = 'Aquest navegador no té Bluetooth: obre l\'app amb Bluefy per tenir les pulsacions.'; return; }
  if (fresh) { dot('dFC', 'ok'); $('sFC').textContent = `Connectat${HR.dev && HR.dev.name ? ' a ' + HR.dev.name : ''} · ${HR.bpm} ppm`; $('bFC').textContent = 'Connectat'; return; }
  $('bFC').textContent = HR.dev ? 'Reconnecta' : 'Connecta';
  if (HR.connecting) { dot('dFC', 'warn'); $('sFC').textContent = 'Buscant… tria el Polar a la llista (pot trigar uns segons).'; }
  else if (HR.connected) { dot('dFC', 'warn'); $('sFC').textContent = 'Connectat, esperant les pulsacions…'; }
  else if (HR.dev) { dot('dFC', 'warn'); $('sFC').textContent = 'Connexió perduda, reintentant…'; }
  else if (HR.err) { dot('dFC', 'bad'); $('sFC').textContent = 'No connectat: ' + HR.err; }
  else { dot('dFC', ''); $('sFC').textContent = 'Al rellotge: córrer → LIGHT → Compartir FC → Visible per a tothom.'; }
}
setInterval(() => { if (!$('prep').hidden) hrRow(); }, 1000);

async function init() {
  try { await loadData(); } catch (e) { showErr(e.message + '. Obre l\'app amb connexió el primer cop.'); return; }
  await voicesStatus(); prepRefresh();
  $('segTipus').querySelectorAll('button').forEach(b => b.onclick = () => { store.set('coll_tipus', b.dataset.t); tipusUI(); });
  $('selZona').onchange = () => { store.set('coll_zona', $('selZona').value); tipusUI(); };
  $('toHist').onclick = () => Hist.list();
  $('lastRun').onclick = () => { const id = $('lastRun').dataset.id; if (id && hist.some(e => e.id === id)) Hist.open(id, 'prep'); else Hist.list(); };
  hrRow();
  $('selRef').onchange = () => { store.set('coll_ref', $('selRef').value); refInfo(); };
  $('bVeus').onclick = () => downloadVoices().catch(e => showErr(e.message));
  $('bSo').onclick = async () => { try { await Player.playSeq(['sistema_012']); dot('dSo', 'ok'); } catch (e) { dot('dSo', 'bad'); showErr('So: ' + e.message); } };
  $('selVol').value = store.get('coll_volum', 'fort');
  $('selVol').onchange = () => { store.set('coll_volum', $('selVol').value); Player.setVolume($('selVol').value); };
  $('bFC').onclick = async () => { const p = HR.connect(); hrRow(); try { await p; } catch (e) {} hrRow(); };
  $('bGPS').onclick = () => { try { GPS.start(); $('sGPS').textContent = 'Esperant senyal…'; dot('dGPS', 'warn'); } catch (e) { showErr(e.message); } };
  $('bStart').onclick = async () => {
    if (tipusNow() === 'base' && !HR.connected) { showErr('La pujada de base va per pulsacions: connecta el pulsòmetre abans de començar (o tria Exigent).'); return; }
    showErr(''); try { await Player.unlock(); } catch (e) {} askWake(); try { GPS.start(); } catch (e) { showErr(e.message); } startRun(); };
  $('bMute').onclick = () => { Player.muted = !Player.muted; $('bMute').textContent = Player.muted ? 'Activa la veu' : 'Silencia'; };
  $('bStop').onclick = stopPressed;
  $('bBack').onclick = () => { coach = null; show('prep'); prepRefresh(); };
  Hist.init();
  $('toSim').onclick = () => { show('sim'); };
  $('simBack').onclick = () => show('prep');
  $('simRun').innerHTML = Object.keys(perfil.registres).map(id => `<option value="${id}">Pujada del ${fmtDate(id)}</option>`).join('');
  $('simRun').value = Object.keys(perfil.registres).slice(-1)[0];   // la més recent
  $('simGo').onclick = () => simulate().catch(e => showErr(e.message));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', init);   // després de carregar js/historial.js
