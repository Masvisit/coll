/* Coll · motor de l'entrenador.
 * Pur (sense DOM ni àudio): rep posicions GPS i pulsacions, decideix QUAN i QUÈ diu l'entrenador.
 * Principi: millor callar que dir una frase que no toca. Regles completes al README («Regles del motor»).
 * Funciona al navegador (window.Coach) i a Node (require) per poder-lo simular amb pujades reals.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Coach = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const R = 6371000;

  /* ------------------------------------------------------------------ ruta */
  function makeRoute(perfil) {
    const pts = perfil.ruta;
    const cos0 = Math.cos(pts[0][0] * Math.PI / 180);
    const toXY = (lat, lon) => [lon * Math.PI / 180 * R * cos0, lat * Math.PI / 180 * R];
    const X = [], Y = [], D = [];
    for (const [la, lo, d] of pts) { const [x, y] = toXY(la, lo); X.push(x); Y.push(y); D.push(d); }
    const L = perfil.longitud_m || D[D.length - 1];
    const phases = perfil.fases.map(f => ({ n: f.n, nom: f.nom, a: f.ini_m, b: f.fi_m, pct: f.pendent }));
    function project(lat, lon, sMin = -Infinity, sMax = Infinity) {
      const [px, py] = toXY(lat, lon); let best = Infinity, s = 0;
      for (let i = 0; i < X.length - 1; i++) {
        if (D[i + 1] < sMin || D[i] > sMax) continue;
        const vx = X[i + 1] - X[i], vy = Y[i + 1] - Y[i], L2 = vx * vx + vy * vy || 1e-9;
        let u = ((px - X[i]) * vx + (py - Y[i]) * vy) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const d = Math.hypot(px - (X[i] + u * vx), py - (Y[i] + u * vy));
        if (d < best) { best = d; s = D[i] + u * (D[i + 1] - D[i]); }
      }
      return { s, off: best };
    }
    function dist(lat1, lon1, lat2, lon2) { const [a, b] = toXY(lat1, lon1), [c, d] = toXY(lat2, lon2); return Math.hypot(a - c, b - d); }
    const phaseAt = s => phases.find(p => s >= p.a && s < p.b) || (s < 0 ? phases[0] : phases[phases.length - 1]);
    const grupOf = n => (n <= 3 ? 'ini' : n <= 6 ? 'mur' : 'fi');
    return { L, phases, project, dist, phaseAt, grupOf, start: perfil.punts.inici, top: perfil.punts.cim };
  }

  /* --------------------------------------------------------- referència */
  // t[i] i hr[i] cada 10 m (s = 10·i); l'últim punt és el cim (s = L).
  function makeRef(id, nom, temps, fc, L) {
    const t = temps.slice(), hr = fc ? fc.slice() : null, n = t.length;
    const lastS = (n - 1) * 10;
    const tL = t[n - 1] + (t[n - 1] - t[n - 2]) / 10 * (L - lastS);
    const at = (arr, s, endVal) => {
      if (s <= 0) return arr[0];
      if (s >= lastS) return endVal != null ? arr[n - 1] + (endVal - arr[n - 1]) * Math.min(1, (s - lastS) / (L - lastS)) : arr[n - 1];
      const i = s / 10, lo = Math.floor(i); return arr[lo] + (arr[lo + 1] - arr[lo]) * (i - lo);
    };
    return { id, nom, total: tL, tAt: s => at(t, s, tL), hrAt: hr ? s => at(hr, s, null) : null };
  }
  function refFromRun(id, nom, run, L) { return makeRef(id, nom, run.t, run.hr && run.hr.some(v => v > 0) ? run.hr : null, L); }

  /* ------------------------------------------------------------- frases */
  function makeBank(frases) {
    const byId = {}; const idx = {};
    for (const f of frases) {
      byId[f.id] = f;
      const k = [f.cat, f.grup || '', f.estat == null ? '' : String(f.estat), f.fase || ''].join('|');
      (idx[k] = idx[k] || []).push(f);
    }
    const get = (cat, grup, estat, fase) => idx[[cat, grup || '', estat == null ? '' : String(estat), fase || ''].join('|')] || [];
    const num = (estat, n) => byId[`num_${estat}_${n}`] || null;
    return { byId, get, num };
  }

  /* --------------------------------------------------------------- motor */
  const DEF = {
    gapIgual: 3, gapMolt: 15, fcMarge: 4, trendM: 250, trendS: 4,
    minGap: 20, minGapFinal: 8, fillerGap: 60, fillerGapFinal: 14, statusMin: 60, statusMax: 150,
    statusJump: 8, hrFresh: 5, accMax: 30, offMax: 35, fcAlta: 182, finalZone: 300
  };

  function createCoach(opts) {
    const route = opts.route, bank = opts.bank, ref = opts.ref || null, P = Object.assign({}, DEF, opts.params || {});
    const usage = opts.usage || {};          // {id: vegades dita} entre sortides
    const rand = opts.random || Math.random;
    const L = route.L;

    const st = {
      mode: 'armat',          // armat → pujant → cim
      t0: null, s: 0, sRaw: 0, off: null, acc: null, lastFixT: null, fix: null,
      prev: null, hist: [],   // historial {t, s} per velocitat i inici
      dHist: [],              // {s, d} per tendència
      hr: [], hrLastT: null, hrConnected: !!opts.hrConnected,
      d: null, gap: null, gapSince: null, trend: 'estable', diag: null,
      phase: null, grup: 'ini', speed: null,
      spoken: new Set(), once: new Set(), pending: [],
      busy: false, lastEnd: -Infinity, lastStartT: -Infinity,
      lastStatus: { t: -Infinity, d: null, gap: null }, lastTrend: { s: -Infinity, state: null },
      lastFiller: null, lastFcAlert: -Infinity, walkSince: null, stopSince: null, moveState: 'corre',
      lastMoveAlert: -Infinity, gpsLost: false, offSince: null, offRoute: false,
      finish: null, log: [], now: 0
    };

    const remaining = () => L - st.s;
    const inFinal = () => st.mode === 'pujant' && remaining() <= P.finalZone;

    /* ---------- selecció de frases (sense repetir, primer les menys usades) */
    function pick(list, extraOk) {
      const ok = list.filter(f => !st.spoken.has(f.id) && valoraOk(f) && (!extraOk || extraOk(f)));
      if (!ok.length) return null;
      const minU = Math.min(...ok.map(f => usage[f.id] || 0));
      const pool = ok.filter(f => (usage[f.id] || 0) === minU);
      return pool[Math.floor(rand() * pool.length)];
    }
    function valoraOk(f) {
      if (!f.valora) return true;
      const behind = st.gap === 'darrere' || st.gap === 'molt_darrere';
      switch (f.valora) {
        case 'positiu': return !!ref && st.d != null && st.d <= P.gapIgual && st.trend !== 'perdent' && st.diag !== 'flipant' && st.diag !== 'dia_dur';
        case 'retret': return !!ref && st.d != null && (st.d > P.gapIgual || st.trend === 'perdent' || st.diag === 'conservador');
        // demanar paciència / recuperar: no quan vas per darrere amb marge (o sense saber si en tens)
        case 'frena': return st.d == null || st.diag === 'dia_dur' || st.diag === 'flipant' || (!behind && st.diag !== 'conservador');
        // demanar més: sempre al final; abans, no si ja vas passat de voltes o amb un dia dur
        case 'empeny': return st.grup === 'fi' || !(st.diag === 'flipant' || st.diag === 'dia_dur' || st.gap === 'molt_davant');
      }
      return true;
    }

    /* ---------- esdeveniments puntuals (amb prioritat i validesa) */
    function push(ev) { if (ev.once && st.once.has(ev.once)) return; if (ev.once) st.once.add(ev.once); st.pending.push(ev); }
    // prio: 1 sistema · 2 punt · 3 queden · 4 entrada · 4.5 moviment/FC alta · 5 estat · 6 tendència · 7 fase · 8 motivació

    /* ---------- entrades */
    function onFix(fx) {   // {t: ms, lat, lon, acc, speed}
      const t = fx.t / 1000; st.now = Math.max(st.now, t);
      if (st.gpsLost && st.mode === 'pujant') { st.gpsLost = false; push({ prio: 1, kind: 'sistema', estat: 'gps_recuperat', exp: t + 15 }); }
      st.lastFixT = t; st.acc = fx.acc; st.fix = fx;
      if (fx.acc != null && fx.acc > P.accMax) return;            // posició dolenta: no la fem servir
      if (st.mode === 'armat') return armedFix(fx, t);
      if (st.mode === 'pujant') return climbFix(fx, t);
      st.hist.push({ t, s: st.s });
    }
    function armedFix(fx, t) {
      const pr = route.project(fx.lat, fx.lon);
      const dStart = route.dist(fx.lat, fx.lon, route.start[0], route.start[1]);
      st.off = pr.off; st.sRaw = pr.s;
      if (dStart < 150 && dStart > 25) push({ prio: 1, kind: 'sistema', estat: 'a_prop_inici', once: 'a_prop_inici', exp: t + 20 });
      const near = pr.off <= 30 || dStart <= 30;
      const cur = { t, s: near ? pr.s : null, off: pr.off, speed: fx.speed };
      // inici: venim de prop de la sortida (s < 8 m) i ara som ≥ 12 m pujant per la ruta
      const prevNear = st.hist.filter(h => h.s != null && h.s < 8 && t - h.t <= 60).pop();
      if (cur.s != null && cur.s >= 12 && cur.s <= 80 && pr.off <= 30 && prevNear && cur.s - prevNear.s > 5) {
        let t0;
        if (prevNear.s > 0.5) t0 = prevNear.t + (t - prevNear.t) * (0 - prevNear.s) / (cur.s - prevNear.s);
        else { const v = Math.max(1.5, fx.speed || (cur.s - prevNear.s) / Math.max(1, t - prevNear.t)); t0 = Math.max(prevNear.t, t - cur.s / v); }
        t0 = Math.min(t0, t);
        st.mode = 'pujant'; st.t0 = t0; st.s = cur.s; st.hist = [{ t: t0, s: 0 }, { t, s: cur.s }];
        st.phase = route.phaseAt(st.s); st.grup = route.grupOf(st.phase.n); st.lastEnd = -Infinity;
        st.pending = st.pending.filter(e => e.estat !== 'a_prop_inici');
        push({ prio: 0, kind: 'inici', exp: t + 15 });
        logEv(t, 'inici', `Inici detectat (t0 = ${t0.toFixed(1)})`);
        return;
      }
      st.hist.push(cur); if (st.hist.length > 120) st.hist.shift();
    }
    function climbFix(fx, t) {
      let pr = route.project(fx.lat, fx.lon, st.s - 40, st.s + 120);
      if (pr.off > P.offMax) { const g = route.project(fx.lat, fx.lon); if (g.off < pr.off - 10) pr = g; }
      st.off = pr.off;
      // fora de ruta
      if (pr.off > 45) {
        st.offSince = st.offSince ?? t;
        if (!st.offRoute && t - st.offSince >= 10) { st.offRoute = true; push({ prio: 1, kind: 'sistema', estat: 'fora_ruta', exp: t + 20 }); }
        return;
      }
      if (st.offRoute) { st.offRoute = false; push({ prio: 1, kind: 'sistema', estat: 'ruta_ok', exp: t + 20 }); }
      st.offSince = null;
      if (pr.s < st.s - 25) return;                     // retrocés estrany: no movem la posició
      // mediana de les 3 últimes projeccions: un salt de GPS sol no ens avança ni ens fa dir res
      st.raw = (st.raw || []).concat(pr.s).slice(-3);
      const sMed = st.raw.length < 3 ? pr.s : st.raw.slice().sort((a, b) => a - b)[1];
      const sPrev = st.s; st.s = Math.max(st.s, sMed);
      st.gpsSpeed = fx.speed != null && fx.speed >= 0 ? fx.speed : null;
      st.hist.push({ t, s: st.s }); while (st.hist.length > 2 && t - st.hist[0].t > 30) st.hist.shift();
      // velocitat dels últims ~15 s (amb la posició suavitzada)
      const h15 = st.hist.find(h => t - h.t <= 15.5) || st.hist[0];
      st.speed = t > h15.t ? (st.s - h15.s) / (t - h15.t) : st.speed;
      // cim: hi has arribat (s ≥ L − 4) o ets a menys de 15 m del punt del cim
      const nearTop = st.s >= L - 40 && route.dist(fx.lat, fx.lon, route.top[0], route.top[1]) <= 15;
      if (st.s >= L - 4 || nearTop) {
        const h = st.hist[st.hist.length - 2];
        let tf;
        if (st.s >= L && sPrev < L && st.s > sPrev && h) tf = h.t + (t - h.t) * (L - sPrev) / (st.s - sPrev);
        else tf = t + Math.max(0, L - st.s) / Math.max(1.5, st.speed || 2.5);   // encara no hi som del tot: estimem quan hi arribem
        return finishAt(Math.max(st.t0, Math.min(tf, t + 10)));
      }
      const ph = route.phaseAt(st.s);
      if (!st.phase || ph.n !== st.phase.n) {
        if (st.phase && ph.n > st.phase.n) push({ prio: 4, kind: 'entrada', fase: ph.n, once: 'entrada' + ph.n, expS: ph.a + 120, exp: t + 40 });
        st.phase = ph; st.grup = route.grupOf(ph.n);
      }
      if (st.s >= 120) push({ prio: 7.5, kind: 'entrada', fase: 1, once: 'entrada1', expS: 320, exp: t + 120 });
      // queden X
      for (const X of [2000, 1000, 500, 300, 200, 100, 50]) {   // 3000 i 1500 coincidien amb entrades de fase i no aportaven res
        if (remaining() <= X && remaining() > X - 40) push({ prio: 3, kind: 'queden', estat: X, once: 'q' + X, expS: L - X + 40, exp: t + 25 });
      }
      // punts clau
      if (st.s >= 2385 && st.s < 2440) push({ prio: 2, kind: 'punt', estat: 'rampa', once: 'rampa', expS: 2470, exp: t + 15 });
      if (st.s >= 2780 && st.s < 2830) push({ prio: 2, kind: 'punt', estat: 'mig_km_dur', once: 'mig', expS: 2880, exp: t + 25 });
      // diferència amb la referència
      if (ref) {
        const d = (t - st.t0) - ref.tAt(st.s); st.d = d;
        st.dHist.push({ s: st.s, d }); while (st.dHist.length > 2 && st.s - st.dHist[0].s > P.trendM + 60) st.dHist.shift();
        const back = st.dHist.find(h => st.s - h.s <= P.trendM + 5);
        if (back && st.s - back.s >= P.trendM - 30) {
          const dd = d - back.d, tr = dd <= -P.trendS ? 'guanyant' : dd >= P.trendS ? 'perdent' : 'estable';
          if (tr !== st.trend) { st.trend = tr; st.trendSince = t; }
        }
        const g = gapState(d);
        if (g !== st.gap) { st.gap = g; st.gapSince = t; }
        st.diag = diagState();
      }
      movement(t);
    }
    function gapState(d) {
      const t1 = P.gapIgual, t2 = P.gapMolt, h = 1, cur = st.gap;
      const B = { molt_davant: [-Infinity, -t2], davant: [-t2, -t1], igual: [-t1, t1], darrere: [t1, t2], molt_darrere: [t2, Infinity] };
      // marge d'1 s: no canviem d'estat fins que la diferència surt clarament de l'interval actual
      if (cur && d >= B[cur][0] - h && d <= B[cur][1] + h) return cur;
      return d <= -t2 ? 'molt_davant' : d < -t1 ? 'davant' : d <= t1 ? 'igual' : d < t2 ? 'darrere' : 'molt_darrere';
    }
    function hrNow(t) {
      const fresh = st.hr.filter(h => t - h.t <= 10);
      if (!fresh.length || t - st.hrLastT > P.hrFresh) return null;
      return fresh.reduce((a, h) => a + h.bpm, 0) / fresh.length;
    }
    function diagState() {
      if (!ref || !ref.hrAt || st.d == null) return null;
      const hr = hrNow(st.now); if (hr == null) return null;
      const dfc = hr - ref.hrAt(st.s), m = P.fcMarge;
      if (st.d < -P.gapIgual) return dfc > m ? 'flipant' : 'dia_bo';
      if (st.d > P.gapIgual) return dfc < -m ? 'conservador' : dfc > m ? 'dia_dur' : null;
      return Math.abs(dfc) <= m ? 'controlat' : null;
    }
    function movement(t) {
      // aturat o caminant només si ho diuen alhora el progrés per la ruta (15 s) i la velocitat del GPS (si n'hi ha)
      const v = st.speed, g = st.gpsSpeed; if (v == null || st.s < 60) return;
      const pct = st.phase ? st.phase.pct : 0;
      const stopped = v < 0.4 && (g == null || g < 0.6);
      const walking = !stopped && v < 1.6 && (g == null || g < 1.8) && pct >= 7;
      const running = v > 2.0 && (g == null || g > 2.0);
      st.stopSince = stopped ? (st.stopSince ?? t) : null;
      st.walkSince = walking ? (st.walkSince ?? t) : null;
      if (st.stopSince != null && t - st.stopSince >= 8 && st.moveState !== 'aturat' && t - st.lastMoveAlert >= 60) {
        st.moveState = 'aturat'; st.lastMoveAlert = t; push({ prio: 4.5, kind: 'aturat', exp: t + 15 });
      } else if (st.walkSince != null && t - st.walkSince >= 10 && st.moveState === 'corre' && t - st.lastMoveAlert >= 90) {
        st.moveState = 'camina'; st.lastMoveAlert = t; push({ prio: 4.5, kind: 'caminar', exp: t + 15 });
      } else if (st.moveState !== 'corre' && running) {
        st.moveState = 'corre'; push({ prio: 4.5, kind: 'represa', exp: t + 10 });
      }
    }
    function onHR(bpm, tMs) {
      const t = tMs / 1000; st.now = Math.max(st.now, t);
      if (!(bpm > 30 && bpm < 230)) return;
      st.hr.push({ t, bpm }); while (st.hr.length && t - st.hr[0].t > 15) st.hr.shift();
      st.hrLastT = t;
      if (st.mode === 'pujant' && bpm >= P.fcAlta && t - st.lastFcAlert >= 120 && hrNow(t) >= P.fcAlta) {
        st.lastFcAlert = t; push({ prio: 4.6, kind: 'fc', estat: 'molt_alta', exp: t + 15 });
      }
    }
    function onHRStatus(connected, tMs) {
      const t = tMs / 1000;
      if (st.hrConnected && !connected && st.mode === 'pujant') push({ prio: 1, kind: 'sistema', estat: 'fc_perdut', exp: t + 20 });
      if (!st.hrConnected && connected && st.mode === 'pujant') push({ prio: 1, kind: 'sistema', estat: 'fc_recuperat', exp: t + 20 });
      st.hrConnected = connected;
    }
    function finishAt(tf) {
      st.mode = 'cim'; st.s = L;
      const T = tf - st.t0;
      st.finish = { T, d: ref ? T - ref.total : null, tf };
      st.pending = [];
      push({ prio: 0, kind: 'final', exp: tf + 60 });
      if (ref) push({ prio: 0.5, kind: 'reflexio', exp: tf + 120 });
      push({ prio: 0.8, kind: 'baixada', notBefore: tf + 50, exp: tf + 240 });
      logEv(tf, 'cim', `Cim en ${T.toFixed(1)} s${ref ? ` (Δ ${(T - ref.total).toFixed(1)} s)` : ''}`);
    }

    /* ---------- construcció d'una intervenció concreta (es valida ara mateix) */
    function build(ev, t) {
      const g = st.grup;
      switch (ev.kind) {
        case 'sistema': { const f = pick(bank.get('sistema', null, ev.estat)); return f && [f]; }
        case 'inici': { const f = pick(bank.get('inici', 'ini')); return f && [f]; }
        case 'entrada': {
          if (ev.expS != null && st.s > ev.expS) return null;
          if (!st.phase || st.phase.n !== ev.fase) return null;
          const f = pick(bank.get('entrada', route.grupOf(ev.fase), null, ev.fase)); return f && [f];
        }
        case 'queden': {
          if (remaining() < ev.estat - 45) return null;
          const f = pick(bank.get('queden', null, ev.estat)); return f && [f];
        }
        case 'punt': { if (ev.expS != null && st.s > ev.expS) return null; const f = pick(bank.get('punt', 'fi', ev.estat, 7)); return f && [f]; }
        case 'caminar': { if (st.moveState !== 'camina') return null; const f = pick(bank.get('caminar')); return f && [f]; }
        case 'aturat': { if (st.moveState !== 'aturat') return null; const f = pick(bank.get('aturat')); return f && [f]; }
        case 'represa': { if (st.moveState !== 'corre' || !st.moveSpoken) return null; st.moveSpoken = false; const f = pick(bank.get('represa')); return f && [f]; }
        case 'fc': {
          const hr = hrNow(t); if (hr == null || hr < P.fcAlta) return null;
          const f = pick(bank.get('fc', g === 'fi' ? 'fi' : 'ini', 'molt_alta')); return f && [f];
        }
        case 'final': return buildFinal();
        case 'reflexio': return buildReflexio();
        case 'baixada': { const f = pick(bank.get('baixada')); return f && [f]; }
      }
      return null;
    }
    function numFor(d) {
      const n = Math.round(Math.abs(d));
      if (n === 0) return bank.num('igual', 0);
      return d < 0 ? (n <= 60 ? bank.num('davant', n) : null) : (n <= 90 ? bank.num('darrere', n) : null);
    }
    function buildStatus(t) {
      if (!ref || st.d == null || st.gap == null || st.s < 100) return null;
      const d = st.d, g = st.grup;
      let comment = null, kind = 'gap';
      const dg = st.diag;
      if (dg) { comment = pick(bank.get('diag', g, dg)); kind = 'diag'; }
      // si tenim diagnòstic però ja no queden frases d'aquest diagnòstic, només el número:
      // una frase de gap genèrica podria contradir-lo (p. ex. «avui costa» quan vas sobrat)
      else comment = pick(bank.get('gap', g, st.gap));
      const n = numFor(d);
      const out = [n, comment].filter(Boolean);
      if (!out.length) return null;
      return { clips: out, kind, info: `Δ ${d.toFixed(1)} s · ${st.gap}${dg ? ' · ' + dg : ''} · tendència ${st.trend}` };
    }
    function buildFinal() {
      const f = st.finish, out = [];
      if (ref) {
        const n = Math.round(Math.abs(f.d));
        const cat = n === 0 ? 'igual' : f.d < 0 ? (n >= 15 ? 'record_gran' : 'record') : (n <= 20 ? 'lent' : 'molt_lent');
        const c = pick(bank.get('final', null, cat)); if (c) out.push(c);
      }
      const M = Math.floor(f.T / 60), S = Math.round(f.T - M * 60);
      const mm = S === 60 ? M + 1 : M, ss = S === 60 ? 0 : S;
      const cm = bank.num('minuts', mm), cs = bank.num('isegons', ss);
      if (cm && cs) out.push(cm, cs);
      if (ref) {
        const n = Math.round(Math.abs(f.d));
        if (n > 0) { const c = f.d < 0 ? bank.num('record_per', n) : bank.num('a_del_record', n); if (c) out.push(c); }
      }
      return out.length ? out : null;
    }
    function buildReflexio() {
      // Lectura del repartiment de l'esforç. Si no és clara, no diem res.
      if (!ref || !st.finish || !st.dHistAll.length) return null;
      const H = st.dHistAll, dF = st.finish.d;
      const mid = H.find(h => h.s >= 1650); if (!mid) return null;
      const late = H.filter(h => h.s >= 1650);
      const worst = late.reduce((a, h) => (h.d > a.d ? h : a), late[0]);
      let estat = null;
      if (worst.d - dF >= 10) estat = 'marge';                                  // has recuperat ≥ 10 s al final: tenies més del que vas gastar al principi
      else if (dF - mid.d >= 10 && mid.d <= 5) estat = 'buit';                 // anaves bé a la meitat i ho has perdut al final: sortida massa forta
      else if (Math.abs(dF - mid.d) < 10 && dF <= 15) estat = 'equilibrat';
      if (!estat) return null;
      const f = pick(bank.get('reflexio', null, estat)); return f && [f];
    }

    /* ---------- decidir què es diu ara (o res) */
    function next(tMs) {
      const t = tMs / 1000; st.now = Math.max(st.now, t);
      if (st.busy) return null;
      if (st.mode === 'pujant' && st.lastFixT != null && t - st.lastFixT > 10 && !st.gpsLost) {
        st.gpsLost = true; push({ prio: 1, kind: 'sistema', estat: 'gps_perdut', exp: t + 15 });
      }
      st.pending = st.pending.filter(e => (e.exp == null || t <= e.exp) && (e.expS == null || st.s <= e.expS));
      const gapNeeded = st.mode !== 'pujant' ? 4 : inFinal() ? P.minGapFinal : P.minGap;
      const since = t - st.lastEnd;
      // esdeveniments: els crítics (prio ≤ 1) poden anar a 6 s; la resta respecten l'espai mínim
      const ready = st.pending.filter(e => (e.notBefore == null || t >= e.notBefore) && since >= (e.prio <= 1 ? 6 : gapNeeded)).sort((a, b) => a.prio - b.prio);
      for (const ev of ready) {
        if (ev.prio >= 7 && st.mode === 'pujant' && wantStatus(t)) break;   // l'estat té preferència sobre l'entrada de la fase 1
        const clips = build(ev, t);
        st.pending.splice(st.pending.indexOf(ev), 1);
        if (clips) return emit(t, clips, ev.kind, ev.kind === 'queden' ? `queden ${ev.estat} m` : ev.estat || '');
      }
      if (st.mode !== 'pujant' || since < gapNeeded) return null;
      // estat (número + comentari)
      if (wantStatus(t)) {
        const b = buildStatus(t);
        if (b) { st.lastStatus = { t, d: st.d, gap: st.gap }; return emit(t, b.clips, b.kind, b.info); }
      }
      // tendència
      // tendència: només si dura ≥ 15 s (no pel soroll d'un moment) i és nova
      if (ref && st.trend !== 'estable' && t - (st.trendSince || 0) >= 15 && st.s - st.lastTrend.s >= P.trendM && t - st.lastStatus.t >= 25 && st.trend !== st.lastTrend.state) {
        const f = pick(bank.get('tend', st.grup, st.trend));
        st.lastTrend = { s: st.s, state: st.trend };
        if (f) return emit(t, [f], 'tend', st.trend);
      }
      // farciment: frase de la fase o motivació (mai dues motivacions seguides)
      const fg = inFinal() ? P.fillerGapFinal : P.fillerGap;
      if (since >= fg) {
        const useMot = st.lastFiller === 'fase' || (st.lastFiller !== 'motiva' && rand() < 0.4);
        const faseF = () => pick(bank.get('fase', st.grup, null, st.phase.n));
        const motF = () => (st.lastFiller === 'motiva' ? null : pick(bank.get('motiva', st.grup)));
        let f = useMot ? motF() || faseF() : faseF() || motF(), k;
        if (f) { k = f.cat; st.lastFiller = k; return emit(t, [f], k, ''); }
      }
      return null;
    }
    function wantStatus(t) {
      if (!ref || st.d == null || st.s < 100) return false;
      const ls = st.lastStatus, since = t - ls.t;
      if (since >= P.statusMax) return true;
      if (since < P.statusMin && ls.t > -Infinity) return st.gap !== ls.gap && t - st.gapSince >= 5 && since >= 25;
      if (st.gap !== ls.gap && t - st.gapSince >= 5) return true;
      if (ls.d != null && Math.abs(st.d - ls.d) >= P.statusJump) return true;
      return ls.t === -Infinity;
    }
    function emit(t, clips, kind, info) {
      st.busy = true; st.lastStartT = t;
      for (const c of clips) if (c.cat !== 'num') st.spoken.add(c.id);
      if (kind === 'caminar' || kind === 'aturat') st.moveSpoken = true;   // «tornem a córrer» només si abans li hem dit que caminava
      const u = { t, clips, ids: clips.map(c => c.id), text: clips.map(c => c.text).join(' '), kind, info, s: st.s, d: st.d, mode: st.mode };
      logEv(t, kind, u.text, u);
      return u;
    }
    function done(tMs) { st.busy = false; st.lastEnd = tMs / 1000; }
    function logEv(t, kind, text, u) { st.log.push({ t, rel: st.t0 != null ? t - st.t0 : null, kind, text, s: st.s, d: st.d, gap: st.gap, trend: st.trend, diag: st.diag, ids: u ? u.ids : null }); }

    // per a la reflexió final guardem tot l'historial de Δ
    st.dHistAll = [];
    function trackAll() { if (st.d != null) { const last = st.dHistAll[st.dHistAll.length - 1]; if (!last || st.s - last.s >= 10) st.dHistAll.push({ s: st.s, d: st.d }); } }

    return {
      onFix(fx) { onFix(fx); trackAll(); },
      onHR, onHRStatus, next, done,
      get state() { return st; },
      snapshot() {
        return { mode: st.mode, s: st.s, L, remaining: remaining(), d: st.d, gap: st.gap, trend: st.trend, diag: st.diag,
          phase: st.phase, grup: st.grup, speed: st.speed, off: st.off, acc: st.acc, t0: st.t0, hr: hrNow(st.now),
          hrRef: ref && ref.hrAt && st.mode === 'pujant' ? ref.hrAt(st.s) : null, finish: st.finish, elapsed: st.t0 != null ? (st.finish ? st.finish.T : st.now - st.t0) : null };
      },
      log: st.log
    };
  }

  /* ------------------------------------------- corba d'una sortida nova */
  // A partir de les posicions (t, s) i pulsacions d'una pujada feta amb l'app: temps i FC cada 10 m.
  function runCurve(samples, L, t0, T) {
    const pts = samples.filter(p => p.s != null).sort((a, b) => a.t - b.t);
    const t = [], hr = []; let j = 0;
    for (let s = 0; s <= Math.floor(L / 10) * 10; s += 10) {
      while (j < pts.length - 1 && pts[j + 1].s < s) j++;
      const a = pts[j], b = pts[Math.min(j + 1, pts.length - 1)];
      const tt = s <= 0 ? 0 : b.s > a.s ? (a.t + (b.t - a.t) * (s - a.s) / (b.s - a.s)) - t0 : a.t - t0;
      t.push(Math.max(0, Math.min(T, tt)));
      hr.push(a.hr || 0);
    }
    return { t, hr };
  }

  return { makeRoute, makeRef, refFromRun, makeBank, createCoach, runCurve, DEF };
});
