/* Coll · mapa del recorregut d'una pujada.
 * Ortofoto (ICGC; si falla, Esri) amb la línia de la pujada pintada per trams de 20 m: verd si aquell tros l'has fet
 * més ràpid que la teva mitjana, vermell si més lent (en les de base: dins, per sobre o per sota de zona).
 * Traçant amb el dit sobre la línia (o sobre el perfil de sota) surt què ha passat a cada punt.
 * Fa servir les globals de js/app.js (route, perfil, hist, $, fmtT, fmtDiff…) i Hist (js/historial.js).
 */
'use strict';
const Mapa = (() => {
  const SRC = [
    (z, x, y) => `https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/orto/MON3857NW/${z}/${x}/${y}.png`,
    (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  ];
  const ATTR = ['Ortofoto © ICGC', 'Imatge © Esri'];
  const OK = '#3ecf8e', BAD = '#ff5f5f', NEU = '#fff3d6', BLUE = '#5aa9ff', ACC = '#ffb020', MUT = '#97a0ab';
  const STEP = 20, REL_FULL = 0.08;          // ±8 % de ritme respecte a la mitjana = color ple
  let G = null;                              // geometria de la ruta (coordenades de món a zoom 0)
  let V = null;                              // estat del mapa obert
  const km = s => (s / 1000).toFixed(2).replace('.', ',');

  /* ---------------------------------------------------------------- geometria */
  function wpx(lat, lon) { const r = lat * Math.PI / 180; return [(lon + 180) / 360 * 256, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 256]; }
  function geo() {
    if (G) return G;
    const pts = perfil.ruta.map(([lat, lon, s]) => { const [x, y] = wpx(lat, lon); return { x, y, s }; });
    const bb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const p of pts) { bb.x0 = Math.min(bb.x0, p.x); bb.x1 = Math.max(bb.x1, p.x); bb.y0 = Math.min(bb.y0, p.y); bb.y1 = Math.max(bb.y1, p.y); }
    G = { pts, bb };
    return G;
  }
  function posAt(s) {
    const p = geo().pts; if (s <= 0) return p[0]; if (s >= p[p.length - 1].s) return p[p.length - 1];
    let a = 0, b = p.length - 1; while (b - a > 1) { const m = (a + b) >> 1; if (p[m].s <= s) a = m; else b = m; }
    const k = (s - p[a].s) / ((p[b].s - p[a].s) || 1);
    return { x: p[a].x + (p[b].x - p[a].x) * k, y: p[a].y + (p[b].y - p[a].y) * k, s };
  }
  // punts de món d'un tros [a, b] de la ruta
  function piece(a, b) { const out = [posAt(a)]; for (const p of geo().pts) if (p.s > a && p.s < b) out.push(p); out.push(posAt(b)); return out; }

  /* ---------------------------------------------------------------- dades cada 20 m */
  const median = v => { const a = v.slice().sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
  function hrAtS(e, s) { if (!e.hasHR) return null; const i = Math.round(s / 10); if (!(e.hrArr[i] > 0)) return null; return Hist.sm(e.hrArr, i); }
  function sFromT(e, t) {
    if (t == null || !isFinite(t)) return null;
    let a = 0, b = route.L; if (t <= 0) return 0; if (t >= e.total) return route.L;
    for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (Hist.tAt(e, m) < t) a = m; else b = m; }
    return (a + b) / 2;
  }
  function analyze(e, c) {
    const L = route.L, tA = Hist.tAt, N = Math.ceil(L / STEP), S = [];
    for (let i = 0; i <= N; i++) S.push(Math.min(L, i * STEP));
    const base = !Hist.isEx(e), zona = base ? Hist.zonaOf(e) : null;
    const others = base ? [] : Hist.exigents().filter(x => x !== e);
    // temps en una finestra de 80 m centrada al punt (treu el soroll del GPS sense amagar els canvis)
    const win = (x, s) => tA(x, Math.min(L, s + 40)) - tA(x, Math.max(0, s - 40));
    const dist = s => Math.min(L, s + 40) - Math.max(0, s - 40);
    const w = S.map(s => win(e, s));
    const ow = others.map(o => S.map(s => win(o, s)));
    const med = S.map((s, i) => (others.length ? median(ow.map(a => a[i])) : null));
    const best = S.map((s, i) => (others.length ? Math.min(...ow.map(a => a[i])) : null));
    const worst = S.map((s, i) => (others.length ? Math.max(...ow.map(a => a[i])) : null));
    const rel = w.map((v, i) => (med[i] ? (v - med[i]) / med[i] : null));
    const pace = w.map((v, i) => v / dist(S[i]) * 1000);
    const hr = S.map(s => hrAtS(e, s));
    const dHR = hr.map((h, i) => (h != null && i >= 5 && hr[i - 5] != null ? h - hr[i - 5] : null));
    const d = c ? S.map(s => tA(e, s) - tA(c, s)) : null;
    const valid = i => S[i] >= 100 && S[i] <= L - 40;
    const rec = w.map((v, i) => others.length >= 2 && valid(i) && v < best[i] * 0.985);
    const low = w.map((v, i) => others.length >= 2 && valid(i) && v > worst[i] * 1.015);
    // per pintar, el ritme relatiu suavitzat ±60 m: el color diu com ha anat el tram, no cada passa
    const relS = rel.map((r, i) => { let a = 0, n = 0; for (let k = i - 3; k <= i + 3; k++) if (rel[k] != null) { a += rel[k]; n++; } return n ? a / n : null; });
    const zoneOf = h => (h == null ? null : h > zona.hi ? 'alta' : h < zona.lo - 3 ? 'baixa' : 'dins');

    // color de cada tros de 20 m
    const col = [], tone = [];
    for (let i = 0; i < N; i++) {
      if (base) {
        const h = hr[i] != null && hr[i + 1] != null ? (hr[i] + hr[i + 1]) / 2 : hr[i] ?? hr[i + 1], z = zoneOf(h);
        col.push(z === 'alta' ? BAD : z === 'baixa' ? BLUE : z === 'dins' ? OK : NEU); tone.push(z);
      } else {
        const r = relS[i] != null && relS[i + 1] != null ? (relS[i] + relS[i + 1]) / 2 : null;
        const t = r == null ? 0 : Math.max(-1, Math.min(1, r / REL_FULL)), q = Math.round(t * 5) / 5;   // 11 tons
        col.push(q < 0 ? mix(NEU, OK, -q) : mix(NEU, BAD, q)); tone.push(q);
      }
    }

    // el que va dir l'entrenador, situat al seu punt
    const said = ((e.run && e.run.said) || []).filter(x => x.kind !== 'brief')
      .map(x => ({ s: x.s != null ? x.s : sFromT(e, x.rel), text: x.text })).filter(x => x.s != null);

    // moments clau (numerats al mapa)
    const K = [];
    const iMaxHR = hr.reduce((m, h, i) => (h != null && (m < 0 || h > hr[m]) ? i : m), -1);
    if (iMaxHR >= 0) K.push({ s: S[iMaxHR], col: BAD, txt: `Màxim de pulsacions: <b>${Math.round(hr[iMaxHR])}</b>` });
    const iJump = dHR.reduce((m, v, i) => (v != null && (m < 0 || v > dHR[m]) ? i : m), -1);
    if (iJump >= 0 && dHR[iJump] >= 8) K.push({ s: S[iJump], col: ACC, txt: `La pujada de pulsacions més forta: <b>+${Math.round(dHR[iJump])}</b> en 100 m (de ${Math.round(hr[iJump - 5])} a ${Math.round(hr[iJump])})` });
    if (d) {
      let gi = -1, gv = 0, li = -1, lv = 0;
      for (let i = 0; i + 10 <= N; i++) { const v = d[i + 10] - d[i]; if (v < gv) { gv = v; gi = i; } if (v > lv) { lv = v; li = i; } }
      if (gi >= 0 && gv <= -3) K.push({ s: S[gi + 5], col: OK, txt: `Els 200 m on més temps has guanyat al ${c.nom}: <b>${fmtDiff(gv)}</b> (km ${km(S[gi])}–${km(S[gi + 10])})` });
      if (li >= 0 && lv >= 3) K.push({ s: S[li + 5], col: BAD, txt: `Els 200 m on més temps has perdut amb el ${c.nom}: <b>${fmtDiff(lv)}</b> (km ${km(S[li])}–${km(S[li + 10])})` });
      const iw = d.reduce((m, v, i) => (S[i] >= 300 && v > d[m] ? i : m), 0), dF = d[d.length - 1];
      if (d[iw] > 0 && d[iw] - dF >= 10 && S[iw] < route.L - 100) K.push({ s: S[iw], col: MUT, txt: `El pitjor moment respecte al ${c.nom} (${fmtDiff(d[iw])}). D'aquí al cim has recuperat <b>${Math.round(d[iw] - dF)} s</b>` });
    }
    const stretch = flags => { let bi = -1, bl = 0, i0 = -1; flags.forEach((f, i) => { if (f) { if (i0 < 0) i0 = i; if (i - i0 + 1 > bl) { bl = i - i0 + 1; bi = i0; } } else i0 = -1; }); return bl >= 3 ? { a: bi, b: bi + bl - 1 } : null; };
    const sr = stretch(rec), sl = stretch(low);
    if (sr) K.push({ s: S[Math.round((sr.a + sr.b) / 2)], col: OK, txt: `Tram rècord: del km ${km(S[sr.a])} al ${km(S[sr.b])}, el més ràpid que has passat mai per aquí` });
    if (sl) K.push({ s: S[Math.round((sl.a + sl.b) / 2)], col: BAD, txt: `Tram més lent que mai: del km ${km(S[sl.a])} al ${km(S[sl.b])}` });
    if (base) {
      const sa = stretch(hr.map(h => zoneOf(h) === 'alta'));
      if (sa) K.push({ s: S[Math.round((sa.a + sa.b) / 2)], col: BAD, txt: `El tros més llarg per sobre de zona: ${(sa.b - sa.a + 1) * STEP} m (km ${km(S[sa.a])}–${km(S[sa.b])})` });
      const iin = hr.findIndex(h => zoneOf(h) === 'dins');
      if (iin > 0) K.push({ s: S[iin], col: OK, txt: `Aquí entres a la zona (${Math.round(hr[iin])} ppm)` });
    }
    K.sort((a, b) => a.s - b.s).forEach((k, i) => { k.n = i + 1; });
    // trossos seguits del mateix color, amb els seus punts (per dibuixar-los d'un sol traç)
    const runs = [];
    for (let i = 0; i < N;) { let j = i; while (j + 1 < N && col[j + 1] === col[i]) j++; runs.push({ col: col[i], a: S[i], b: S[j + 1], pts: piece(S[i], S[j + 1]) }); i = j + 1; }
    return { runs, S, N, w, pace, rel, hr, dHR, d, rec, low, col, tone, said, K, base, zona, zoneOf, others: others.length, c, best, worst, med };
  }
  function mix(a, b, t) {
    const p = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)), A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  /* ---------------------------------------------------------------- informació d'un punt */
  function info(i) {
    const A = V.A, e = V.e, s = A.S[i], p = Hist.phaseAtS(Math.min(s, route.L - 0.1)), t = Hist.tAt(e, s);
    const pace = A.pace[i], rel = A.rel[i], h = A.hr[i], dh = A.dHR[i];
    const relTxt = rel == null ? '' : Math.abs(rel) < 0.02 ? 'com la mitjana' : `${Math.round(Math.abs(rel) * 100)} % ${rel < 0 ? 'més ràpid' : 'més lent'}`;
    const cells = [
      `<div><small>Ritme</small><b>${fmtT(pace)}<em>/km</em></b><span class="${rel == null ? '' : rel < -0.02 ? 'g' : rel > 0.02 ? 'r' : ''}">${relTxt || '&nbsp;'}</span></div>`,
      `<div><small>Pulsacions</small><b>${h != null ? Math.round(h) : '—'}</b><span>${dh != null && Math.abs(dh) >= 3 ? `${dh > 0 ? '↑ +' : '↓ '}${Math.round(dh)} en 100 m` : h != null ? zLabel(h) : '&nbsp;'}</span></div>`,
    ];
    if (A.base) {
      const z = A.zoneOf(h);
      cells.push(`<div><small>Zona ${A.zona.nom}</small><b class="${z === 'dins' ? 'g' : z === 'alta' ? 'r' : ''}" style="${z === 'baixa' ? 'color:' + BLUE : ''}">${z === 'dins' ? 'Dins' : z === 'alta' ? '+' + Math.round(h - A.zona.hi) : z === 'baixa' ? '−' + Math.round(A.zona.lo - h) : '—'}</b><span>${z === 'alta' ? 'per sobre' : z === 'baixa' ? 'per sota' : '&nbsp;'}</span></div>`);
    } else if (A.d) {
      const dv = A.d[i], d100 = i >= 5 ? A.d[i] - A.d[i - 5] : null;
      cells.push(`<div><small>vs ${A.c.nom}</small><b class="${dv < -0.5 ? 'g' : dv > 0.5 ? 'r' : ''}">${fmtDiff(dv)}</b><span>${d100 != null && Math.abs(d100) >= 1 ? `${fmtDiff(d100)} en 100 m` : '&nbsp;'}</span></div>`);
    }
    // el que ha passat en aquest punt
    const chips = [];
    for (const q of route.phases) if (q.a > 0 && q.a >= s - 10 && q.a < s + 10) chips.push([MUT, `Comença ${q.nom} · ${String(q.pct).replace('.', ',')} %`]);
    if (A.rec[i]) chips.push([OK, 'El ritme més ràpid que has fet mai en aquest punt']);
    if (A.low[i]) chips.push([BAD, 'El ritme més lent que has fet mai aquí']);
    if (dh != null && dh >= 10) chips.push([ACC, `Pujada sobtada de pulsacions: +${Math.round(dh)} en 100 m`]);
    if (dh != null && dh <= -10) chips.push([BLUE, `Les pulsacions baixen ${Math.round(-dh)} en 100 m`]);
    for (const k of A.K) if (k.s >= s - 10 && k.s < s + 10) chips.push([k.col, `${k.n} · ${k.txt}`]);
    const quotes = A.said.filter(x => x.s >= s - 10 && x.s < s + 10).map(x => `<div class="mq">«${x.text}»</div>`).join('');
    return `<div class="mh"><b>km ${km(s)}</b><span>${p.n} · ${p.nom} · ${String(p.pct).replace('.', ',')} %</span><b class="mt2">${fmtT(t)}</b></div>` +
      `<div class="mg">${cells.join('')}</div>` +
      (chips.length ? `<div class="mc">${chips.map(([c, t]) => `<span style="border-color:${c}"><i style="background:${c}"></i>${t}</span>`).join('')}</div>` : '') + quotes;
  }
  function zLabel(h) { const z = Hist.ZN.find(z => h >= z.lo && h <= z.hi); return z ? z.k : ''; }

  /* ---------------------------------------------------------------- dibuix */
  const sz = () => { const r = V.el.getBoundingClientRect(); return { W: r.width, H: r.height }; };
  const w2s = (x, y) => { const k = 2 ** V.Z; return { x: (x - V.cx) * k + V.W / 2, y: (y - V.cy) * k + V.H / 2 }; };
  const s2w = (x, y) => { const k = 2 ** V.Z; return { x: V.cx + (x - V.W / 2) / k, y: V.cy + (y - V.H / 2) / k }; };
  function sizeCard() {
    const card = $('mapCard'); if (card.classList.contains('fs')) { V.el.style.height = ''; return; }
    const { bb } = geo(), w = V.el.getBoundingClientRect().width || 360;
    V.el.style.height = Math.round(Math.max(300, Math.min(innerHeight * 0.62, w * (bb.y1 - bb.y0) / (bb.x1 - bb.x0) + 110))) + 'px';
  }
  function fit() {
    sizeCard();
    const { bb } = geo(), { W, H } = sz(), pad = 36;
    V.W = W; V.H = H;
    V.Z = Math.log2(Math.min((W - pad * 2) / (bb.x1 - bb.x0), (H - pad * 2) / (bb.y1 - bb.y0)));
    V.Zmin = V.Z - 1.5; V.cx = (bb.x0 + bb.x1) / 2; V.cy = (bb.y0 + bb.y1) / 2;
  }
  function tiles() {
    const box = V.el.querySelector('.mt'), used = new Set();
    const zt = Math.max(10, Math.min(19, Math.round(V.Z + 0.35)));
    for (const z of [zt - 1, zt]) {
      const n = 2 ** z, sc = 2 ** (V.Z - z), tlx = V.cx / 256 * n * 256 - V.W / 2 / sc, tly = V.cy / 256 * n * 256 - V.H / 2 / sc;
      const x0 = Math.floor(tlx / 256), x1 = Math.floor((tlx + V.W / sc) / 256), y0 = Math.floor(tly / 256), y1 = Math.floor((tly + V.H / sc) / 256);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const key = z + '/' + x + '/' + y; used.add(key);
        let im = V.pool.get(key);
        if (!im) {
          im = new Image(); im.alt = ''; im.draggable = false; im.decoding = 'async'; im.dataset.k = 0;
          im.onerror = () => { const k = +im.dataset.k + 1; if (k < SRC.length) { im.dataset.k = k; im.src = SRC[k](z, x, y); V.attr.add(k); attr(); } else im.style.visibility = 'hidden'; };
          im.src = SRC[0](z, x, y); V.pool.set(key, im);
        }
        im.style.zIndex = z === zt ? 2 : 1;
        im.style.width = im.style.height = (256 * sc + 0.75) + 'px';
        im.style.transform = `translate(${((x * 256 - tlx) * sc).toFixed(2)}px,${((y * 256 - tly) * sc).toFixed(2)}px)`;
        if (im.parentNode !== box) box.appendChild(im);
      }
    }
    for (const [k, im] of V.pool) if (!used.has(k) && im.parentNode) im.remove();
    if (V.pool.size > 220) for (const k of [...V.pool.keys()].slice(0, 60)) if (!used.has(k)) V.pool.delete(k);
  }
  function attr() { V.el.querySelector('.mattr').textContent = [...V.attr].sort().map(k => ATTR[k]).join(' · '); }
  function overlay() {
    const A = V.A, pts = geo().pts, P = q => { const p = w2s(q.x, q.y); return p.x.toFixed(1) + ',' + p.y.toFixed(1); };
    let g = `<path d="M${pts.map(P).join('L')}" fill="none" stroke="#06080a" stroke-opacity=".78" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const r of A.runs) g += `<path d="M${r.pts.map(P).join('L')}" fill="none" stroke="${r.col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    const a = w2s(pts[0].x, pts[0].y), b = w2s(pts[pts.length - 1].x, pts[pts.length - 1].y);
    g += `<circle cx="${a.x}" cy="${a.y}" r="6" fill="#fff" stroke="#06080a" stroke-width="3"/><circle cx="${b.x}" cy="${b.y}" r="7" fill="#06080a" stroke="#fff" stroke-width="3"/>`;
    const placed = [];
    for (const k of A.K) {
      const p = posAt(k.s), q = w2s(p.x, p.y); let x = q.x, y = q.y, tries = 0;
      while (placed.some(o => Math.hypot(o.x - x, o.y - y) < 21) && tries < 8) { tries++; const ang = -Math.PI / 2 + (tries - 1) * Math.PI / 4; x = q.x + Math.cos(ang) * 24 * Math.ceil(tries / 8 + 0.01); y = q.y + Math.sin(ang) * 24; }
      placed.push({ x, y });
      if (tries) g += `<line x1="${q.x}" y1="${q.y}" x2="${x}" y2="${y}" stroke="#fff" stroke-width="1.5"/><circle cx="${q.x}" cy="${q.y}" r="3" fill="#fff"/>`;
      g += `<g class="mk" data-s="${k.s}"><circle cx="${x}" cy="${y}" r="10" fill="${k.col}" stroke="#06080a" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle">${k.n}</text></g>`;
    }
    const m = posAt(V.s), q = w2s(m.x, m.y);
    g += `<circle cx="${q.x}" cy="${q.y}" r="15" fill="${ACC}" fill-opacity=".28"/><circle cx="${q.x}" cy="${q.y}" r="8" fill="#fff" stroke="#06080a" stroke-width="3"/>`;
    const svg = V.el.querySelector('svg.mo'); svg.setAttribute('viewBox', `0 0 ${V.W} ${V.H}`); svg.innerHTML = g;
  }
  function draw() {
    if (!V) return;
    const { W, H } = sz(); V.W = W; V.H = H;
    V.Z = Math.max(V.Zmin, Math.min(19.5, V.Z));
    tiles(); overlay();
  }
  function schedule() { if (V && !V.raf) V.raf = requestAnimationFrame(() => { V.raf = 0; draw(); }); }

  /* ---------------------------------------------------------------- perfil d'altitud (també serveix per traçar) */
  function profile() {
    const el = $('mProf'), A = V.A, Wp = Math.max(260, Math.round(el.clientWidth || 340)), Hp = 64, el10 = perfil.perfil_cada_10m;
    const lo = Math.min(...el10), hi = Math.max(...el10), X = s => s / route.L * Wp, Y = v => Hp - 4 - (v - lo) / (hi - lo) * (Hp - 12);
    const alt = s => { const i = s / 10, a = Math.floor(i), b = Math.min(el10.length - 1, a + 1); return el10[Math.min(a, el10.length - 1)] + (el10[b] - el10[Math.min(a, el10.length - 1)]) * (i - a); };
    let g = '';
    for (const r of A.runs) {
      const pts = []; for (let s = r.a; s < r.b; s += 10) pts.push(`${X(s).toFixed(1)},${Y(alt(s)).toFixed(1)}`); pts.push(`${X(r.b).toFixed(1)},${Y(alt(r.b)).toFixed(1)}`);
      g += `<path d="M${X(r.a).toFixed(1)},${Hp} L${pts.join(' L')} L${X(r.b).toFixed(1)},${Hp} Z" fill="${r.col}" fill-opacity=".85"/>`;
    }
    for (const p of route.phases) if (p.a > 0) g += `<line x1="${X(p.a)}" x2="${X(p.a)}" y1="0" y2="${Hp}" stroke="#0b0d10" stroke-opacity=".55"/>`;
    g += `<line class="pc" x1="${X(V.s)}" x2="${X(V.s)}" y1="0" y2="${Hp}" stroke="#fff" stroke-width="2"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${Wp} ${Hp}" preserveAspectRatio="none">${g}</svg>`;
    V.profW = Wp;
  }
  function profCursor() { const l = $('mProf').querySelector('.pc'); if (l) { const x = V.s / route.L * V.profW; l.setAttribute('x1', x); l.setAttribute('x2', x); } }

  /* ---------------------------------------------------------------- posició triada */
  function setS(s, center) {
    if (!V) return;
    const ns = Math.max(0, Math.min(route.L, Math.round(s / STEP) * STEP)), i = Math.round(Math.min(route.L, ns) / STEP);
    if (ns !== V.s || V.i !== i || !V.infoOk) {
      V.s = ns; V.i = Math.min(i, V.A.N); V.infoOk = true;
      $('mInfo').innerHTML = info(V.i); $('mKm').textContent = 'km ' + km(V.s); profCursor();
    }
    if (center) { const p = posAt(V.s), q = w2s(p.x, p.y), m = 0.18; if (q.x < V.W * m || q.x > V.W * (1 - m) || q.y < V.H * m || q.y > V.H * (1 - m)) { V.cx = p.x; V.cy = p.y; } }
    schedule();
  }
  function nearest(pt, prefer) {
    const pts = geo().pts; let best = null;
    const scan = (a, b) => { for (const p of pts) { if (p.s < a || p.s > b) continue; const q = w2s(p.x, p.y), d = Math.hypot(q.x - pt.x, q.y - pt.y); if (!best || d < best.d) best = { d, s: p.s }; } };
    if (prefer != null) { scan(prefer - 160, prefer + 160); if (best && best.d <= 45) return best; best = null; }   // continuïtat a les ziga-zagues
    scan(0, route.L); return best;
  }

  /* ---------------------------------------------------------------- gestos */
  function bind() {
    const el = V.el, P = new Map(); let mode = null, g0 = null;
    const pt = ev => { const r = el.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    el.addEventListener('pointerdown', ev => {
      if (ev.target.closest('button')) return;
      P.set(ev.pointerId, pt(ev)); try { el.setPointerCapture(ev.pointerId); } catch (e) {}
      if (P.size === 1) {
        const p = pt(ev), mk = ev.target.closest && ev.target.closest('.mk');
        const hit = nearest(p);
        if (mk) { stop(); setS(+mk.dataset.s); mode = null; return; }
        if (hit && hit.d <= 30) { mode = 'scrub'; stop(); setS(hit.s); }
        else { mode = 'pan'; g0 = { p, cx: V.cx, cy: V.cy }; }
      } else if (P.size === 2) {
        const [a, b] = [...P.values()], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        mode = 'pinch'; g0 = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, Z: V.Z, w: s2w(m.x, m.y) };
      }
    });
    el.addEventListener('pointermove', ev => {
      if (!P.has(ev.pointerId)) return; P.set(ev.pointerId, pt(ev));
      if (mode === 'scrub') { const hit = nearest(pt(ev), V.s); if (hit) setS(hit.s); }
      else if (mode === 'pan') { const p = pt(ev), k = 2 ** V.Z; V.cx = g0.cx - (p.x - g0.p.x) / k; V.cy = g0.cy - (p.y - g0.p.y) / k; schedule(); }
      else if (mode === 'pinch' && P.size >= 2) {
        const [a, b] = [...P.values()], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        V.Z = Math.max(V.Zmin, Math.min(19.5, g0.Z + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / g0.d)));
        const k = 2 ** V.Z; V.cx = g0.w.x - (m.x - V.W / 2) / k; V.cy = g0.w.y - (m.y - V.H / 2) / k; schedule();
      }
    });
    const up = ev => { P.delete(ev.pointerId); if (!P.size) mode = null; else if (mode === 'pinch') mode = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', ev => {
      ev.preventDefault(); const p = pt(ev), w = s2w(p.x, p.y);
      V.Z = Math.max(V.Zmin, Math.min(19.5, V.Z - ev.deltaY / 400)); const k = 2 ** V.Z; V.cx = w.x - (p.x - V.W / 2) / k; V.cy = w.y - (p.y - V.H / 2) / k; schedule();
    }, { passive: false });
    // perfil: arrossegar per recórrer la pujada
    const pr = $('mProf'), prS = ev => { const r = pr.getBoundingClientRect(); return (ev.clientX - r.left) / r.width * route.L; };
    let prOn = false;
    pr.addEventListener('pointerdown', ev => { prOn = true; try { pr.setPointerCapture(ev.pointerId); } catch (e) {} stop(); setS(prS(ev), true); });
    pr.addEventListener('pointermove', ev => { if (prOn) setS(prS(ev), true); });
    pr.addEventListener('pointerup', () => { prOn = false; }); pr.addEventListener('pointercancel', () => { prOn = false; });
  }

  /* ---------------------------------------------------------------- reproducció */
  function play() {
    if (V.play) return stop();
    if (V.s >= route.L) setS(0, true);
    V.play = true; $('mPlay').textContent = '❚❚';
    let last = performance.now();
    const tick = now => {
      if (!V || !V.play) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      V.ps = (V.ps ?? V.s) + route.L / 30 * dt;                       // tota la pujada en 30 s
      if (V.ps >= route.L) { setS(route.L, true); return stop(); }
      setS(V.ps, true); requestAnimationFrame(tick);
    };
    V.ps = V.s; requestAnimationFrame(tick);
  }
  function stop() { if (!V) return; V.play = false; V.ps = null; const b = $('mPlay'); if (b) b.textContent = '▶'; }

  /* ---------------------------------------------------------------- obrir / tancar */
  function legend(A) {
    return A.base
      ? `<span><i style="background:${OK}"></i>Dins</span><span><i style="background:${BAD}"></i>Per sobre</span><span><i style="background:${BLUE}"></i>Per sota</span>`
      : A.others ? `<span class="gr"><em>Més ràpid</em><i class="grad"></i><em>Més lent</em></span><small>que la teva mitjana</small>` : '';
  }
  function open(e, c) {
    const card = $('mapCard'), first = !V || V.e !== e;
    if (!V) { V = { el: $('map'), pool: new Map(), attr: new Set([0]) }; bind(); addEventListener('resize', () => { if (V && V.A && !$('end').hidden) { draw(); profile(); } }); }
    stop();
    V.e = e; V.A = analyze(e, c); V.infoOk = false;
    $('mLeg').innerHTML = legend(V.A);
    $('mKeys').innerHTML = V.A.K.length ? '<b>Moments clau</b><ol>' + V.A.K.map(k => `<li><button data-s="${k.s}"><span style="background:${k.col}">${k.n}</span><em>${k.txt}</em></button></li>`).join('') + '</ol>' : '';
    $('mKeys').querySelectorAll('button').forEach(b => b.onclick = () => { stop(); setS(+b.dataset.s, true); V.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    card.hidden = false;
    if (first) { fit(); V.s = 0; }
    attr(); draw(); profile(); setS(V.s ?? 0);
  }
  function toggleFs() {
    const card = $('mapCard'), on = !card.classList.contains('fs');
    card.classList.toggle('fs', on); document.body.style.overflow = on ? 'hidden' : '';
    $('mFs').textContent = on ? '✕' : '⤢';
    requestAnimationFrame(() => { const keep = V.s; fit(); draw(); profile(); setS(keep, true); });
  }
  function init() {
    $('mFs').onclick = toggleFs;
    $('mFit').onclick = () => { fit(); draw(); };
    $('mPlay').onclick = () => play();
  }
  function hide() { stop(); if ($('mapCard').classList.contains('fs')) toggleFs(); }

  // Guarda les rajoles de la zona al mòbil (via el service worker) per poder veure el mapa sense cobertura.
  async function prefetch(onProgress) {
    const { bb } = geo(), list = [];
    for (let z = 14; z <= 17; z++) {
      const n = 2 ** z, k = n / 256, m = 0.25 * Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
      for (let x = Math.floor((bb.x0 - m) * k); x <= Math.floor((bb.x1 + m) * k); x++)
        for (let y = Math.floor((bb.y0 - m) * k); y <= Math.floor((bb.y1 + m) * k); y++) list.push(SRC[0](z, x, y));
    }
    let done = 0;
    const worker = async () => { while (list.length) { const u = list.pop(); try { await fetch(u, { mode: 'no-cors' }); } catch (e) {} done++; onProgress && onProgress(done); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return done;
  }
  return { open, hide, init, prefetch, analyze, dbg: () => V, dbgPt: s => { const p = posAt(s), q = w2s(p.x, p.y); return [q.x, q.y]; } };
})();
