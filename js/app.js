/* Coll · app de l'entrenador (Bluefy a l'iPhone).
 * Preparació (veus, so, FC, GPS, referència) → cursa (motor js/coach.js + veu de l'Alba per sobre de Spotify)
 * → resum i desat de la sortida (si és rècord, passa a ser la referència) · simulació amb pujades reals.
 */
'use strict';
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtT = s => { if (s == null || !isFinite(s)) return '—'; s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), x = s % 60; return m + ':' + String(x).padStart(2, '0'); };
const fmtSigned = d => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(Math.round(d));
const fmtDate = iso => { const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'numeric' }); };
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
window.addEventListener('error', e => showErr(e.message));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason && e.reason.message || e.reason)));
function showErr(m) { const el = $('err'); if (el) el.textContent = m; console.error(m); }
function show(id) { for (const s of ['prep', 'run', 'end', 'sim']) $(s).hidden = s !== id; window.scrollTo(0, 0); }
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
    all: n => tx(n, 'readonly', s => s.getAll())
  };
})();

/* ------------------------------------------------------------ dades */
let perfil, frases, audioIdx, route, bank, refs = [];
async function loadData() {
  const j = u => fetch(u, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('No puc carregar ' + u); return r.json(); });
  [perfil, frases, audioIdx] = await Promise.all([j('data/perfil_coll.json'), j('data/frases.json'), j('audio/index.json')]);
  route = Coach.makeRoute(perfil); bank = Coach.makeBank(frases);
  await loadRefs();
}
async function loadRefs() {
  const L = route.L, list = [];
  for (const [id, r] of Object.entries(perfil.registres)) list.push(Coach.makeRef(id, fmtDate(id), r.temps_s, r.fc, L));
  try { for (const run of await DB.all('runs')) if (run.complete && run.curve) list.push(Coach.refFromRun(run.id, fmtDate(run.date) + ' app', run.curve, L)); } catch (e) {}
  list.sort((a, b) => a.total - b.total);
  refs = list;
  const sel = $('selRef'), chosen = store.get('coll_ref', null);
  sel.innerHTML = refs.map((r, i) => `<option value="${r.id}">${r.nom} · ${fmtT(r.total)}${i === 0 ? ' ★' : ''}</option>`).join('');
  sel.value = refs.some(r => r.id === chosen) ? chosen : refs[0].id;
  refInfo();
}
const currentRef = () => refs.find(r => r.id === $('selRef').value) || refs[0];
function refInfo() { const r = currentRef(); $('sRef').textContent = `Et compares amb la pujada del ${r.nom}: ${fmtT(r.total)}${r === refs[0] ? ', el teu millor temps' : ''}.`; }

/* ------------------------------------------------------------ veu */
const Player = {
  ctx: null, mem: new Map(), muted: false,
  async unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}   // sona per sobre de Spotify, sense aturar-lo
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); }
    if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) {} }
    const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0);
  },
  async raw(id) {
    let ab = null;
    try { ab = await DB.get('audio', id); } catch (e) {}
    if (!ab) {
      const r = await fetch('audio/' + id + '.mp3'); if (!r.ok) throw new Error('No trobo l\'àudio ' + id);
      ab = await r.arrayBuffer(); try { await DB.put('audio', ab, id); } catch (e) {}
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
        const s = this.ctx.createBufferSource(); s.buffer = buf; s.connect(this.ctx.destination);
        let done = false; const fin = () => { if (!done) { done = true; res(); } };
        s.onended = fin; s.start(); setTimeout(fin, buf.duration * 1000 + 600);
      });
      if (i < ids.length - 1) await sleep(250);
    }
  }
};
async function voicesStatus() {
  const all = Object.keys(audioIdx.durations);
  let have = new Set(); try { have = new Set(await DB.keys('audio')); } catch (e) {}
  const n = all.filter(id => have.has(id)).length;
  if (n === all.length) { dot('dVeus', 'ok'); $('sVeus').textContent = `${n} frases de l'Alba al mòbil. Funciona sense cobertura.`; $('bVeus').disabled = true; $('bVeus').textContent = 'Fet'; }
  else { dot('dVeus', n ? 'warn' : ''); $('sVeus').textContent = `${n} de ${all.length} al mòbil (${Math.round(18 * (all.length - n) / all.length)} MB per baixar). Fes-ho amb wifi: després funciona sense cobertura.`; }
  return { n, total: all.length, have };
}
async function downloadVoices() {
  const { have } = await voicesStatus();
  const miss = Object.keys(audioIdx.durations).filter(id => !have.has(id));
  if (!miss.length) return;
  $('bVeus').disabled = true; $('barVeus').hidden = false;
  let done = 0, fails = 0; const total = miss.length;
  const worker = async () => {
    while (miss.length) {
      const id = miss.shift();
      try { const r = await fetch('audio/' + id + '.mp3'); if (!r.ok) throw 0; await DB.put('audio', await r.arrayBuffer(), id); } catch (e) { fails++; }
      done++; $('barVeus').firstElementChild.style.width = (done / total * 100).toFixed(1) + '%';
      $('sVeus').textContent = `Baixant… ${done} de ${total}`;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  $('barVeus').hidden = true; $('bVeus').disabled = false;
  await voicesStatus();
  if (fails) $('sVeus').textContent += ` (${fails} no s'han pogut baixar: torna-ho a provar)`;
}

/* ------------------------------------------------------------ pulsòmetre */
const HR = {
  dev: null, connected: false, bpm: null, last: 0, retry: 0, fns: [],
  on(f) { this.fns.push(f); }, emit(k, v) { this.fns.forEach(f => f(k, v)); },
  async connect() {
    if (!navigator.bluetooth) throw new Error('Aquest navegador no té Bluetooth. Obre l\'app amb Bluefy.');
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
  const ref = currentRef();
  coach = Coach.createCoach({ route, bank, ref, usage, hrConnected: HR.connected });
  run = { id: 'run-' + Date.now(), date: new Date().toISOString(), ref: ref.id, refNom: ref.nom, refTotal: ref.total, samples: [], said: [], complete: false };
  ended = false; speaking = false;
  $('rDL').textContent = `vs ${ref.nom} · ${fmtT(ref.total)}`;
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
  run.complete = true; run.total = f.T; run.d = f.d;
  run.samples.push({ t: f.tf, s: route.L, hr: HR.connected ? HR.bpm || 0 : 0 });
  run.curve = Coach.runCurve(run.samples, route.L, st.t0, f.T);
  run.log = st.log;
  const best = refs[0];
  run.record = f.T < best.total;
  try { await DB.put('runs', JSON.parse(JSON.stringify(run))); } catch (e) { showErr('No s\'ha pogut desar la sortida: ' + e.message); }
  store.set('coll_last', { date: run.date, total: run.total, d: run.d, refNom: run.refNom, record: run.record });
  if (run.record) store.set('coll_ref', run.id);
  await loadRefs();
  $('bStop').textContent = 'Veure el resum';
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
    const d = sn.mode === 'cim' && sn.finish ? sn.finish.d : sn.d;
    if (d != null) { $('rD').innerHTML = fmtSigned(d) + '<small>s</small>'; $('rDelta').className = 'delta ' + (d < -0.5 ? 'ahead' : d > 0.5 ? 'behind' : ''); }
    $('rStrip').querySelectorAll('i').forEach((el, i) => { const p = route.phases[i]; el.style.width = Math.max(0, Math.min(1, (sn.s - p.a) / (p.b - p.a))) * 100 + '%'; });
  }
  $('rT').textContent = fmtT(sn.elapsed);
  $('rRem').innerHTML = armed ? '—' : sn.mode === 'cim' ? '0<em>m</em>' : sn.remaining >= 1000 ? (sn.remaining / 1000).toFixed(2).replace('.', ',') + '<em>km</em>' : Math.round(sn.remaining) + '<em>m</em>';
  $('rHR').innerHTML = HR.connected && HR.bpm ? HR.bpm + (sn.hrRef ? `<em>ref ${Math.round(sn.hrRef)}</em>` : '') : '—';
  $('rPace').innerHTML = sn.speed > 0.6 && sn.mode === 'pujant' ? fmtT(1000 / sn.speed) + '<em>/km</em>' : '—';
}
let stopArmed = 0;
function stopPressed() {
  if (run && run.complete) { ended = true; return showEnd(run); }
  if (Date.now() - stopArmed > 3000) { stopArmed = Date.now(); $('bStop').textContent = 'Segur? Prem de nou'; setTimeout(() => { if ($('bStop').textContent.startsWith('Segur')) $('bStop').textContent = 'Atura'; }, 3000); return; }
  ended = true; coach = null; show('prep'); prepRefresh();
}

/* ------------------------------------------------------------ resum */
function showEnd(r) {
  const ref = refs.find(x => x.id === r.ref) || null;
  $('eT').textContent = fmtT(r.total);
  $('eD').innerHTML = r.d != null ? `${fmtSigned(r.d)} s respecte a ${r.refNom}${r.record ? ' · <span class="badge">Nou rècord</span>' : ''}` : '';
  if (ref && r.curve) {
    const tAt = s => { const i = s / 10, lo = Math.floor(i), t = r.curve.t; return lo + 1 < t.length ? t[lo] + (t[lo + 1] - t[lo]) * (i - lo) : r.total; };
    $('eTab').innerHTML = '<tr><th>Fase</th><th>Tu</th><th>Ref.</th><th>Dif.</th></tr>' + route.phases.map(p => {
      const a = (p.b >= route.L ? r.total : tAt(p.b)) - tAt(p.a), b = (p.b >= route.L ? ref.total : ref.tAt(p.b)) - ref.tAt(p.a), dd = a - b;
      return `<tr><td>${p.n} · ${p.nom}</td><td>${fmtT(a)}</td><td>${fmtT(b)}</td><td class="${dd < -0.5 ? 'g' : dd > 0.5 ? 'r' : ''}">${fmtSigned(dd)} s</td></tr>`;
    }).join('');
  } else $('eTab').innerHTML = '';
  $('eLog').innerHTML = (r.said || []).map((x, i) => `<li><span class="t">${x.rel != null ? fmtT(x.rel) : ''}</span><span>${x.text}<span class="k">${x.kind}</span></span><button data-i="${i}">▶</button></li>`).join('');
  $('eLog').querySelectorAll('button').forEach(b => b.onclick = () => Player.playSeq(r.said[+b.dataset.i].ids));
  show('end');
}

/* ------------------------------------------------------------ simulació */
async function simulate() {
  const simId = $('simRun').value;
  const track = (await fetch('data/sim/' + simId + '.json').then(r => r.json())).punts;
  const ref = refs.find(r => r.id !== simId) || refs[0];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const c = Coach.createCoach({ route, bank, ref, usage: {}, random: rnd, hrConnected: true });
  const out = []; let busy = null, k = 0;
  const t0s = Math.floor(track[0][0] / 1000), t1s = Math.ceil(track[track.length - 1][0] / 1000) + 5;
  for (let t = t0s; t <= t1s; t++) {
    if (busy != null && t >= busy) { c.done(busy * 1000); busy = null; }
    while (k < track.length && track[k][0] / 1000 <= t) { const [tms, lat, lon, fc, vel] = track[k++]; c.onFix({ t: tms, lat, lon, acc: 5, speed: vel }); if (fc > 0) c.onHR(fc, tms); }
    if (busy == null) { const u = c.next(t * 1000); if (u) { busy = t + u.ids.reduce((a, id) => a + (audioIdx.durations[id] || 2), 0) + 0.25 * (u.ids.length - 1); out.push(u); } }
  }
  const st = c.state;
  $('simInfo').textContent = st.finish ? `Pujada del ${fmtDate(simId)} contra ${ref.nom} (${fmtT(ref.total)}): cim en ${fmtT(st.finish.T)} (${fmtSigned(st.finish.d)} s). ${out.length} intervencions.` : 'No s\'ha completat la pujada.';
  $('simLog').innerHTML = out.map((u, i) => `<li><span class="t">${st.t0 != null ? fmtT(u.t - st.t0) : ''}</span><span>${u.text}<span class="k">${u.kind}${u.info ? ' · ' + u.info : ''}</span></span><button data-i="${i}">▶</button></li>`).join('');
  $('simLog').querySelectorAll('button').forEach(b => b.onclick = () => Player.playSeq(out[+b.dataset.i].ids).catch(e => showErr(e.message)));
}

/* ------------------------------------------------------------ preparació */
function prepRefresh() {
  const last = store.get('coll_last', null);
  $('lastRun').textContent = last ? `Última pujada: ${fmtDate(last.date)} · ${fmtT(last.total)}${last.d != null ? ` (${fmtSigned(last.d)} s vs ${last.refNom})` : ''}${last.record ? ' · rècord' : ''}` : '';
}
function gpsPrep(fx) {
  if (!fx) { dot('dGPS', 'bad'); $('sGPS').textContent = 'Error: ' + (GPS.err || 'sense senyal') + '. Dona permís d\'ubicació a Bluefy.'; return; }
  const d = route.dist(fx.lat, fx.lon, route.start[0], route.start[1]);
  dot('dGPS', fx.acc <= 20 ? 'ok' : 'warn');
  $('sGPS').textContent = `Precisió ±${Math.round(fx.acc)} m · a ${d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d) + ' m'} de l'inici de la pujada.`;
}
GPS.on(fx => { gpsPrep(fx); onFixRun(fx); });
HR.on((k, v) => {
  if (k === 'hr') { $('sFC').textContent = `Connectat · ${v} ppm`; dot('dFC', 'ok'); if (coach) coach.onHR(v, Date.now()); }
  else { if (!v) { dot('dFC', 'warn'); $('sFC').textContent = 'Connexió perduda, reintentant…'; } if (coach) coach.onHRStatus(v, Date.now()); }
});

async function init() {
  try { await loadData(); } catch (e) { showErr(e.message + '. Obre l\'app amb connexió el primer cop.'); return; }
  await voicesStatus(); prepRefresh();
  if (!navigator.bluetooth) { dot('dFC', 'bad'); $('sFC').textContent = 'Aquest navegador no té Bluetooth: obre l\'app amb Bluefy per tenir les pulsacions.'; }
  $('selRef').onchange = () => { store.set('coll_ref', $('selRef').value); refInfo(); };
  $('bVeus').onclick = () => downloadVoices().catch(e => showErr(e.message));
  $('bSo').onclick = async () => { try { await Player.playSeq(['sistema_012']); dot('dSo', 'ok'); } catch (e) { dot('dSo', 'bad'); showErr('So: ' + e.message); } };
  $('bFC').onclick = async () => { $('sFC').textContent = 'Buscant… tria el Polar a la llista (pot trigar uns segons).'; try { await HR.connect(); } catch (e) { dot('dFC', 'bad'); $('sFC').textContent = 'No connectat: ' + e.message; } };
  $('bGPS').onclick = () => { try { GPS.start(); $('sGPS').textContent = 'Esperant senyal…'; dot('dGPS', 'warn'); } catch (e) { showErr(e.message); } };
  $('bStart').onclick = async () => { try { await Player.unlock(); } catch (e) {} askWake(); try { GPS.start(); } catch (e) { showErr(e.message); } startRun(); };
  $('bMute').onclick = () => { Player.muted = !Player.muted; $('bMute').textContent = Player.muted ? 'Activa la veu' : 'Silencia'; };
  $('bStop').onclick = stopPressed;
  $('bBack').onclick = () => { coach = null; show('prep'); prepRefresh(); };
  $('toSim').onclick = () => { show('sim'); };
  $('simBack').onclick = () => show('prep');
  $('simRun').innerHTML = Object.keys(perfil.registres).map(id => `<option value="${id}">Pujada del ${fmtDate(id)}</option>`).join('');
  $('simRun').value = Object.keys(perfil.registres).slice(-1)[0];   // la més recent
  $('simGo').onclick = () => simulate().catch(e => showErr(e.message));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
