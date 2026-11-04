#!/usr/bin/env node
/* Simula una pujada real pel motor de l'entrenador i comprova les regles.
 * Ús: node tools/simula.js [--sortida 2026-11-03] [--ref 2026-10-30] [--soroll 6] [--forats] [--sensefc] [--llavor 1] [--silenci]
 */
const fs = require('fs'), path = require('path');
const Coach = require('../js/coach.js');
const ROOT = path.join(__dirname, '..');
const arg = (k, def) => { const i = process.argv.indexOf('--' + k); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };

const sortida = arg('sortida', '2026-11-03');
const refId = arg('ref', sortida === '2026-10-30' ? '2026-11-03' : '2026-10-30');
const soroll = +arg('soroll', 0), forats = !!arg('forats', false), senseFC = !!arg('sensefc', false), silenci = !!arg('silenci', false);
let seed = +arg('llavor', 1);
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());

const perfil = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/perfil_coll.json')));
const frases = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/frases.json')));
const durs = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio/index.json'))).durations;
const track = JSON.parse(fs.readFileSync(path.join(ROOT, `data/sim/${sortida}.json`))).punts;

const route = Coach.makeRoute(perfil);
const rr = perfil.registres[refId];
const ref = Coach.makeRef(refId, refId, rr.temps_s, rr.fc, route.L);
const bank = Coach.makeBank(frases);
const coach = Coach.createCoach({ route, bank, ref, random: rnd, hrConnected: !senseFC });

const GAP_BETWEEN_CLIPS = 0.25;
const out = []; let busyUntil = null;
const mPerDegLat = 111320, mPerDegLon = 111320 * Math.cos(route.start[0] * Math.PI / 180);
// rellotge d'1 s (com a l'app): les posicions arriben quan n'hi ha; el motor es consulta cada segon
let k = 0;
const tStart = Math.floor(track[0][0] / 1000), tEnd = Math.ceil(track[track.length - 1][0] / 1000) + 5;
for (let t = tStart; t <= tEnd; t++) {
  if (busyUntil != null && t >= busyUntil) { coach.done(busyUntil * 1000); busyUntil = null; }
  while (k < track.length && track[k][0] / 1000 <= t) {
    const [tms, lat0, lon0, fc, vel] = track[k]; k++;
    if (forats && k % 97 > 84) continue;                       // forats de GPS de ~12 s
    const lat = lat0 + (soroll ? gauss() * soroll / mPerDegLat : 0), lon = lon0 + (soroll ? gauss() * soroll / mPerDegLon : 0);
    coach.onFix({ t: tms, lat, lon, acc: soroll ? Math.max(5, soroll * 1.5) : 5, speed: vel });
    if (!senseFC && fc > 0) coach.onHR(fc, tms);
  }
  if (busyUntil == null) {
    const u = coach.next(t * 1000);
    if (u) {
      const dur = u.ids.reduce((a, id) => a + (durs[id] || 2), 0) + GAP_BETWEEN_CLIPS * (u.ids.length - 1);
      busyUntil = t + dur;
      const snap = coach.snapshot();
      out.push({ t, end: t + dur, u, snap: JSON.parse(JSON.stringify(snap)), phaseN: snap.phase ? snap.phase.n : null });
    }
  }
}
if (busyUntil != null) coach.done(busyUntil * 1000);

/* ------------------------------------------------------------- informe */
const st = coach.state, t0 = st.t0;
const fmt = s => { if (s == null) return '  —  '; const neg = s < 0; s = Math.abs(s); const m = Math.floor(s / 60), x = Math.round(s - m * 60); return (neg ? '-' : '') + m + ':' + String(x).padStart(2, '0'); };
if (!silenci) {
  console.log(`\nSimulació ${sortida} contra ${refId} (${fmt(ref.total)})${soroll ? ` · soroll GPS ${soroll} m` : ''}${forats ? ' · forats de GPS' : ''}${senseFC ? ' · sense FC' : ''}`);
  for (const o of out) {
    const rel = t0 != null ? o.t - t0 : null;
    console.log(`${fmt(rel).padStart(6)}  ${String(Math.round(o.snap.s)).padStart(5)} m  ${o.snap.d != null ? ((o.snap.d > 0 ? '+' : '') + o.snap.d.toFixed(0) + ' s').padStart(6) : '      '}  ${o.u.kind.padEnd(8)} ${o.u.text}${o.u.info ? `   [${o.u.info}]` : ''}`);
  }
}

/* ------------------------------------------------------------ comprovacions */
const errs = [], warns = [];
const P = Coach.DEF;
for (let i = 1; i < out.length; i++) {
  const a = out[i - 1], b = out[i];
  const gap = b.t - a.end, rem = b.snap.L - b.snap.s;
  const crit = ['sistema', 'inici', 'final', 'reflexio', 'baixada'].includes(b.u.kind);
  const min = b.snap.mode !== 'pujant' ? 4 : crit ? 6 : rem <= P.finalZone ? P.minGapFinal : P.minGap;
  if (gap < min - 1.01) errs.push(`Massa juntes (${gap.toFixed(1)} s < ${min}) abans de: ${b.u.text}`);
}
const seen = new Set();
for (const o of out) for (const c of o.u.clips) {
  if (c.cat === 'num') continue;
  if (seen.has(c.id)) errs.push('Repetida: ' + c.id + ' ' + c.text); seen.add(c.id);
  if (c.valora === 'positiu' && !(o.snap.d != null && o.snap.d <= P.gapIgual && o.snap.trend !== 'perdent' && o.snap.diag !== 'flipant' && o.snap.diag !== 'dia_dur')) errs.push(`Positiva fora de lloc (Δ ${o.snap.d?.toFixed(1)}, ${o.snap.trend}): ${c.text}`);
  if (c.valora === 'retret' && !(o.snap.d > P.gapIgual || o.snap.trend === 'perdent' || o.snap.diag === 'conservador')) errs.push(`Retret fora de lloc (Δ ${o.snap.d?.toFixed(1)}): ${c.text}`);
  const behind = o.snap.gap === 'darrere' || o.snap.gap === 'molt_darrere';
  if (c.valora === 'frena' && !(o.snap.d == null || o.snap.diag === 'dia_dur' || o.snap.diag === 'flipant' || (!behind && o.snap.diag !== 'conservador'))) errs.push(`Demana frenar fora de lloc (Δ ${o.snap.d?.toFixed(1)}, ${o.snap.diag}): ${c.text}`);
  if (c.valora === 'empeny' && !(o.snap.grup === 'fi' || !(o.snap.diag === 'flipant' || o.snap.diag === 'dia_dur' || o.snap.gap === 'molt_davant'))) errs.push(`Demana apretar fora de lloc (${o.snap.diag}, ${o.snap.gap}): ${c.text}`);
  if (['gap', 'diag', 'tend', 'motiva'].includes(c.cat) && c.grup && c.grup !== o.snap.grup) errs.push(`Grup equivocat (${c.grup} vs ${o.snap.grup}): ${c.text}`);
  if (c.cat === 'gap' && c.estat !== o.snap.gap) errs.push(`Estat de gap equivocat (${c.estat} vs ${o.snap.gap}): ${c.text}`);
  if (c.cat === 'diag' && c.estat !== o.snap.diag) errs.push(`Diagnòstic equivocat (${c.estat} vs ${o.snap.diag}): ${c.text}`);
  if (c.cat === 'fase' && c.fase !== o.phaseN) errs.push(`Frase de fase ${c.fase} dita a la fase ${o.phaseN}: ${c.text}`);
  if (c.cat === 'entrada' && c.fase !== o.phaseN) errs.push(`Entrada de fase ${c.fase} dita a la fase ${o.phaseN}: ${c.text}`);
  if (c.cat === 'queden') { const rem = o.snap.L - o.snap.s; if (rem > c.estat + 5 || rem < c.estat - 45) errs.push(`"Queden ${c.estat}" dit amb ${Math.round(rem)} m: ${c.text}`); }
  if (c.cat === 'num' && (c.estat === 'davant' || c.estat === 'darrere')) { const n = Math.round(Math.abs(o.snap.d)); if (n !== c.n) errs.push(`Número ${c.n} però Δ = ${o.snap.d.toFixed(1)}`); }
}
// números: el signe ha de coincidir
for (const o of out) for (const c of o.u.clips) if (c.cat === 'num') {
  if (c.estat === 'davant' && !(o.snap.d < 0)) errs.push(`Diu "per davant" amb Δ ${o.snap.d.toFixed(1)}`);
  if (c.estat === 'darrere' && !(o.snap.d > 0)) errs.push(`Diu "per darrere" amb Δ ${o.snap.d.toFixed(1)}`);
}
// silencis llargs durant la pujada
const climb = out.filter(o => o.snap.mode === 'pujant');
for (let i = 1; i < climb.length; i++) { const g = climb[i].t - climb[i - 1].end; if (g > 75) warns.push(`Silenci de ${g.toFixed(0)} s abans de: ${climb[i].u.text}`); }
if (st.t0 == null) errs.push('No ha detectat l\'inici de la pujada');
if (!st.finish) errs.push('No ha detectat el cim');
const total = st.finish ? st.finish.T : null;
console.log(`\nInici detectat: ${st.t0 != null ? new Date(st.t0 * 1000).toISOString().slice(11, 19) + ' UTC' : 'NO'} · cim: ${total != null ? fmt(total) + ` (${total.toFixed(1)} s)` : 'NO'} · referència ${fmt(ref.total)} · Δ final ${st.finish && st.finish.d != null ? st.finish.d.toFixed(1) + ' s' : '—'}`);
console.log(`Intervencions: ${out.length} (pujada ${climb.length}) · per tipus: ${JSON.stringify(out.reduce((a, o) => (a[o.u.kind] = (a[o.u.kind] || 0) + 1, a), {}))}`);
console.log(`Errors: ${errs.length}${errs.length ? '\n  - ' + errs.join('\n  - ') : ''}`);
console.log(`Avisos: ${warns.length}${warns.length ? '\n  - ' + warns.join('\n  - ') : ''}`);
process.exitCode = errs.length ? 1 : 0;
