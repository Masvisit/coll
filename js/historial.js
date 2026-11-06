/* Coll · historial i anàlisi de cada pujada.
 * Llista per data o rànquing de temps (només les exigents), i per a cada pujada: temps per trams, diferència amb
 * una altra pujada al llarg del coll, pulsacions per zones i una lectura de què millorar.
 * Fa servir les globals de js/app.js (route, perfil, hist, refs, DB, store, show, fmt…).
 */
'use strict';
const Hist = (() => {
  // Zones Polar (FC màx 194). Un sol to, de fosc a clar: més intensitat, més brillant.
  const ZN = [{ k: 'Z1', lo: 0, hi: 136, c: '#3a3f47' }, { k: 'Z2', lo: 137, hi: 150, c: '#6e5a2a' }, { k: 'Z3', lo: 151, hi: 165, c: '#9c7524' },
    { k: 'Z4', lo: 166, hi: 179, c: '#d08f1a' }, { k: 'Z5', lo: 180, hi: 999, c: '#ffb020' }];
  const OK = '#3ecf8e', BAD = '#ff5f5f', ACC = '#ffb020', MUT = '#97a0ab', GRID = '#1d2129', SEP = '#2a3039';
  let order = 'data', cur = null, backTo = 'hist', delArmed = 0;

  /* ---------------------------------------------------------------- càlculs */
  const isEx = e => e.tipus !== 'base';
  const byDate = (a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0);          // més recent primer
  const dt = iso => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtDay = iso => cap(dt(iso).toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' }));
  const fmtHour = iso => (iso.length === 10 ? '' : dt(iso).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' }));
  const ph = i => route.phases[i].nom;
  const km = s => (s / 1000).toFixed(1).replace('.', ',');
  const zIdx = h => ZN.findIndex(z => h >= z.lo && h <= z.hi);
  const tAt = (e, s) => (s >= route.L ? e.total : e.ref.tAt(s));
  const exigents = () => hist.filter(isEx);
  const ranked = () => exigents().sort((a, b) => a.total - b.total);
  const zonaOf = e => Coach.ZONES[e.zona] || Coach.ZONES.z23;

  function partials(e) { return route.phases.map(p => tAt(e, Math.min(p.b, route.L)) - tAt(e, p.a)); }
  function segs(e) {
    const t = e.tArr, h = e.hrArr || [], out = [];
    for (let i = 0; i < t.length - 1; i++) { const d = t[i + 1] - t[i]; if (d > 0) out.push({ s: i * 10, dt: d, hr: h[i] > 0 ? h[i] : null }); }
    return out;
  }
  function hrStats(e, a = 0, b = Infinity) {
    if (!e.hasHR) return null;
    let sw = 0, w = 0, mx = 0, mxS = null;
    for (const g of segs(e)) if (g.s >= a && g.s < b && g.hr) { sw += g.hr * g.dt; w += g.dt; if (g.hr > mx) { mx = g.hr; mxS = g.s; } }
    return w >= 30 ? { avg: sw / w, max: mx, maxS: mxS } : null;
  }
  function zoneTimes(e, a = 0, b = Infinity) {
    const z = [0, 0, 0, 0, 0];
    for (const g of segs(e)) if (g.s >= a && g.s < b && g.hr) z[zIdx(g.hr)] += g.dt;
    return z;
  }
  // mateix criteri que el motor: dins = de (lo − 3) a hi
  function inZone(e, zona, a = 0, b = Infinity) {
    if (!e.hasHR) return null;
    let dins = 0, alta = 0, baixa = 0;
    for (const g of segs(e)) if (g.s >= a && g.s < b && g.hr) { if (g.hr > zona.hi) alta += g.dt; else if (g.hr < zona.lo - 3) baixa += g.dt; else dins += g.dt; }
    const tot = dins + alta + baixa;
    return tot >= 20 ? { pct: dins / tot, dins, alta, baixa, tot } : null;
  }
  // de la corba desada (GPS + FC cada 10 m), igual per a totes; el del motor només si no hi ha pulsacions a la corba
  const zonaPct = e => { const r = inZone(e, zonaOf(e)); return r ? r.pct : e.run && e.run.zonaPct != null ? e.run.zonaPct : null; };
  function bestPartials() {
    const bp = route.phases.map(() => ({ t: Infinity, e: null }));
    for (const e of exigents()) partials(e).forEach((v, i) => { if (v < bp[i].t) bp[i] = { t: v, e }; });
    return bp;
  }
  // amb qui es compara per defecte: la referència d'aquell dia; si no n'hi ha, la millor de les altres
  function cmpDefault(e) {
    if (e.run && e.run.ref && e.run.ref !== e.id) { const r = hist.find(x => x.id === e.run.ref); if (r && isEx(r)) return r; }
    return ranked().find(x => x.id !== e.id) || null;
  }
  function dCurve(e, c) {
    const H = [];
    for (let s = 0; s < route.L; s += 10) H.push({ s, d: tAt(e, s) - tAt(c, s) });
    H.push({ s: route.L, d: e.total - c.total });
    return H;
  }
  // per a la xerrada d'arribada: com va anar l'última pujada exigent
  function ultima() {
    const e = exigents().sort(byDate)[0]; if (!e) return {};
    const out = {}, c = cmpDefault(e);
    if (c) { const p = Coach.pacing(dCurve(e, c), e.total - c.total); if (p) out.reflexio = p; }
    const bp = bestPartials(); let w = null;
    partials(e).forEach((v, i) => { const loss = v - bp[i].t; if (loss >= 4 && (!w || loss > w.loss)) w = { fase: i + 1, loss }; });
    if (w) out.feble = w.fase;
    return out;
  }

  /* ---------------------------------------------------------------- llista */
  function list() { renderList(); show('hist'); }
  function renderList() {
    const ex = ranked(), best = ex[0], nb = hist.length - ex.length, bp = bestPartials(), ideal = bp.reduce((a, x) => a + x.t, 0);
    $('histSum').innerHTML =
      `<div><b>${best ? fmtT(best.total) : '—'}</b><small>Rècord${best ? ' · ' + best.nom : ''}</small></div>` +
      `<div><b>${ex.length > 1 ? fmtT(ideal) : '—'}</b><small>Pujada ideal</small></div>` +
      `<div><b>${hist.length}</b><small>${hist.length === 1 ? 'pujada' : 'pujades'}${nb ? ` · ${nb} de base` : ''}</small></div>`;
    $('segHist').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.o === order));
    const items = order === 'rank' ? ex : hist.slice().sort(byDate);
    $('histList').innerHTML = items.map(e => row(e, ex, best)).join('');
    $('histList').querySelectorAll('button').forEach(b => b.onclick = () => open(b.dataset.id, 'hist'));
    $('histNote').textContent = order === 'rank'
      ? 'Només les pujades exigents. La pujada ideal suma el teu millor temps a cada tram.' + (nb ? ' Les de base no entren al rànquing.' : '')
      : 'Toca una pujada per veure\'n l\'anàlisi.';
  }
  function row(e, ex, best) {
    const pos = isEx(e) ? ex.indexOf(e) + 1 : null, hs = hrStats(e), z = zonaOf(e), zp = isEx(e) ? null : zonaPct(e);
    const meta = [fmtHour(e.date), isEx(e) ? 'Exigent' : 'Base ' + z.nom, hs ? 'FC ' + Math.round(hs.avg) : '', e.src === 'fit' ? 'rellotge' : ''].filter(Boolean).join(' · ');
    const sub = isEx(e) ? (e === best ? '<small class="g">rècord</small>' : `<small>${fmtDiff(e.total - best.total)} del rècord</small>`)
      : `<small class="g">${zp != null ? Math.round(zp * 100) + ' % en zona' : 'base'}</small>`;
    const badge = pos != null ? `<span class="pos${pos === 1 ? ' p1' : ''}">${pos}</span>` : '<span class="pos" style="color:#3ecf8e">B</span>';
    return `<li><button data-id="${e.id}">${badge}<span class="hl"><b>${fmtDay(e.date)}</b><small>${meta}</small></span><span class="hr"><b>${fmtT(e.total)}</b>${sub}</span></button></li>`;
  }

  /* ---------------------------------------------------------------- anàlisi */
  async function open(id, back) {
    let e = hist.find(x => x.id === id);
    if (!e) { await loadRefs(); e = hist.find(x => x.id === id); }
    if (!e) return list();
    cur = e; backTo = back || 'hist'; delArmed = 0;
    const ex = ranked(), rank = ex.indexOf(e) + 1, z = zonaOf(e);
    $('aDate').textContent = fmtDay(e.date) + (fmtHour(e.date) ? ' · ' + fmtHour(e.date) : '') + (e.src === 'fit' ? ' · rellotge' : '');
    $('aPills').innerHTML = (isEx(e) ? '<span class="pill ex">Exigent</span>' : `<span class="pill bs">Base ${z.nom}</span>`) + (rank === 1 ? ' <span class="pill rec">Rècord</span>' : '');
    $('eT').textContent = fmtT(e.total);
    if (isEx(e)) {
      // la referència d'aquell dia, només si no era el rècord (si ho era, ja ho diu la línia de dalt)
      const day = e.run && e.run.d != null && rank !== 1 && e.run.ref !== (ex[0] && ex[0].id) ? `${fmtDiff(e.run.d)} respecte a la referència del dia (${e.run.refNom})` : '';
      const pos = rank === 1 ? (ex.length > 1 ? `El teu millor temps, ${fmtDiff(ex[1].total - e.total).replace('+', '')} millor que el segon` : 'El teu millor temps')
        : `${rank}a de ${ex.length} · ${fmtDiff(e.total - ex[0].total)} del rècord`;
      $('eD').innerHTML = pos + (day ? '<br>' + day : '');
    } else {
      const zp = zonaPct(e);
      $('eD').textContent = zp != null ? `${Math.round(zp * 100)} % del temps dins de ${z.nom} (${z.lo}–${z.hi} pulsacions)` : 'Pujada de base sense pulsacions';
    }
    // amb qui comparar (només pujades exigents)
    const opts = ex.filter(x => x !== e), c = isEx(e) ? cmpDefault(e) : null;
    $('aCmp').innerHTML = opts.map(x => `<option value="${x.id}">${x.nom} · ${fmtT(x.total)}${x === ex[0] ? ' ★' : ''}</option>`).join('');
    if (c) $('aCmp').value = c.id;
    $('aDeltaCard').hidden = !c;
    $('aDel').hidden = e.src !== 'app'; $('aDel').textContent = 'Esborra aquesta pujada';
    const said = (e.run && e.run.said) || [];
    $('aLogCard').hidden = !said.length;
    $('eLog').innerHTML = said.map((x, i) => `<li><span class="t">${x.rel != null ? fmtRel(x.rel) : x.kind === 'brief' ? 'abans' : ''}</span><span>${x.text}<span class="k">${x.kind}</span></span><button data-i="${i}">▶</button></li>`).join('');
    $('eLog').querySelectorAll('button').forEach(b => b.onclick = () => Player.playSeq(said[+b.dataset.i].ids).catch(err => showErr(err.message)));
    show('end');                           // primer visible, perquè les gràfiques i el mapa tinguin amplada
    render(e, c);
    try { Mapa.open(e, c); } catch (err) { $('mapCard').hidden = true; console.warn('mapa', err); }
  }
  function render(e, c) {
    const hs = hrStats(e), pace = e.total / (route.L / 1000), vam = perfil.desnivell_m / (e.total / 3600), zp = isEx(e) ? null : zonaPct(e);
    const tiles = isEx(e)
      ? [['FC mitj.', hs ? Math.round(hs.avg) : '—', ''], ['FC màx.', hs ? hs.max : '—', ''], ['Ritme', fmtT(pace), '/km'], ['VAM', Math.round(vam), 'm/h']]
      : [['En zona', zp != null ? Math.round(zp * 100) : '—', '%'], ['FC mitj.', hs ? Math.round(hs.avg) : '—', ''], ['Ritme', fmtT(pace), '/km'], ['VAM', Math.round(vam), 'm/h']];
    $('aTiles').innerHTML = tiles.map(([k, v, u]) => `<div><small>${k}</small><b>${v}${u && v !== '—' ? `<em>${u}</em>` : ''}</b></div>`).join('');
    if (c) drawDelta($('aDelta'), e, c);
    table(e, c);
    $('aHRCard').hidden = !e.hasHR;
    if (e.hasHR) {
      const cc = c && c.hasHR ? c : null;
      drawHR($('aHR'), e, cc, isEx(e) ? null : zonaOf(e));
      $('aHRleg').innerHTML = `<span><i style="border-color:${ACC}"></i>Aquest dia</span>` + (cc ? `<span><i style="border-color:${MUT};border-top-style:dashed"></i>${cc.nom}</span>` : '') +
        (isEx(e) ? '' : `<span><i style="border-color:${OK};border-top-width:6px;opacity:.5"></i>Zona objectiu</span>`);
      const zt = zoneTimes(e);
      $('aZbar').innerHTML = zt.map((v, i) => (v > 0 ? `<span style="flex:${v};background:${ZN[i].c}" title="${ZN[i].k} ${fmtT(v)}"></span>` : '')).join('');
      $('aZleg').innerHTML = ZN.map((z, i) => `<div><i style="background:${z.c}"></i>${z.k}<b>${fmtT(zt[i])}</b></div>`).join('');
    }
    const ins = isEx(e) ? insExigent(e, c) : insBase(e);
    $('aIns').innerHTML = ins.length ? ins.map(x => `<li>${x}</li>`).join('') : '<li>Encara no hi ha prou dades per comparar.</li>';
  }

  function table(e, c) {
    const pp = partials(e);
    if (isEx(e)) {
      const pc = c ? partials(c) : null, bp = bestPartials();
      let h = `<tr><th>Tram</th><th>Temps</th><th>${c ? 'vs ' + c.nom : ''}</th><th>Millor</th><th>FC</th></tr>`;
      h += route.phases.map((p, i) => {
        const d = pc ? pp[i] - pc[i] : null, mine = bp[i].e === e, hs = hrStats(e, p.a, p.b);
        return `<tr><td>${p.n} · ${p.nom}</td><td>${fmtT(pp[i])}</td><td class="${d == null ? '' : d < -0.5 ? 'g' : d > 0.5 ? 'r' : ''}">${d == null ? '' : fmtDiff(d)}</td>` +
          `<td class="${mine ? 'best' : ''}">${mine ? '★ ' : ''}${fmtT(bp[i].t)}</td><td>${hs ? Math.round(hs.avg) : '—'}</td></tr>`;
      }).join('');
      const hs = hrStats(e), ideal = bp.reduce((a, x) => a + x.t, 0), d = c ? e.total - c.total : null;
      h += `<tr><th>Total</th><th>${fmtT(e.total)}</th><th class="${d == null ? '' : d < -0.5 ? 'g' : d > 0.5 ? 'r' : ''}">${d == null ? '' : fmtDiff(d)}</th><th>${fmtT(ideal)}</th><th>${hs ? Math.round(hs.avg) : '—'}</th></tr>`;
      $('eTab').innerHTML = h;
    } else {
      const z = zonaOf(e);
      $('eTab').innerHTML = '<tr><th>Tram</th><th>Temps</th><th>FC</th><th>En zona</th></tr>' + route.phases.map((p, i) => {
        const hs = hrStats(e, p.a, p.b), r = inZone(e, z, p.a, p.b), pc = r ? Math.round(r.pct * 100) : null;
        return `<tr><td>${p.n} · ${p.nom}</td><td>${fmtT(pp[i])}</td><td>${hs ? Math.round(hs.avg) : '—'}</td><td class="${pc == null ? '' : pc >= 80 ? 'g' : pc < 50 ? 'r' : ''}">${pc == null ? '—' : pc + ' %'}</td></tr>`;
      }).join('');
    }
  }

  /* ---------------------------------------------------------------- lectura de millora */
  function insExigent(e, c) {
    const L = [], pp = partials(e), bp = bestPartials();
    if (c) {
      const pc = partials(c), dd = pp.map((v, i) => ({ i, d: v - pc[i] }));
      const gains = dd.filter(x => x.d <= -2).sort((a, b) => a.d - b.d).slice(0, 2), loss = dd.filter(x => x.d >= 2).sort((a, b) => b.d - a.d)[0];
      if (gains.length) L.push(`On més has guanyat respecte al ${c.nom}: ${gains.map(x => `<b>${ph(x.i)}</b> (${fmtDiff(x.d)})`).join(' i ')}.`);
      if (loss) L.push(`On més has perdut: <b>${ph(loss.i)}</b> (${fmtDiff(loss.d)}).`);
      else if (gains.length) L.push(`Cap tram més lent que el ${c.nom}.`);
      // repartiment de l'esforç (mateixa lectura que la reflexió final de l'entrenador)
      const H = dCurve(e, c), dF = e.total - c.total, pac = Coach.pacing(H, dF), mid = H.find(h => h.s >= 1650), late = H.filter(h => h.s >= 1650);
      const worst = late.reduce((a, h) => (h.d > a.d ? h : a), late[0]);
      if (pac === 'marge') L.push(`Repartiment: el pitjor moment va ser al km ${km(worst.s)} (${fmtDiff(worst.d)}) i d'allà al cim has recuperat ${Math.round(worst.d - dF)} s. T'han sobrat forces: pots sortir més valent.`);
      else if (pac === 'buit') L.push(`Repartiment: a l'entrada del mur anaves ${fmtDiff(mid.d)} i has acabat ${fmtDiff(dF)}. La sortida va ser massa forta: guarda una mica per al quilòmetre dur.`);
      else if (pac === 'equilibrat') L.push(`Repartiment equilibrat: a l'entrada del mur anaves ${fmtDiff(mid.d)} i has acabat ${fmtDiff(dF)}.`);
      // pulsacions: forma o només esforç
      const he = hrStats(e), hc = hrStats(c);
      if (he && hc) {
        const dT = e.total - c.total, dH = he.avg - hc.avg, a = Math.round(he.avg), b = Math.round(hc.avg);
        if (dT <= -5 && dH <= 2) L.push(`Més ràpid amb les mateixes pulsacions o menys (FC mitjana ${a} vs ${b}): això és forma, no només ganes.`);
        else if (dT <= -5) L.push(`Més ràpid, però amb més pulsacions (${a} vs ${b}): hi has posat més esforç.`);
        else if (dT >= 5 && dH <= -3) L.push(`Més lent i amb menys pulsacions (${a} vs ${b}): dia conservador, hi havia marge per apretar.`);
        else if (dT >= 5) L.push(`Més lent amb pulsacions iguals o més altes (${a} vs ${b}): cames cansades o dia dur. Mira com arribes de descans.`);
        else L.push(`Temps molt semblant al ${c.nom}, amb FC mitjana ${a} vs ${b}.`);
      }
    }
    if (exigents().length > 1) {
      const ideal = bp.reduce((a, x) => a + x.t, 0), gaps = pp.map((v, i) => ({ i, d: v - bp[i].t, from: bp[i].e }));
      const mine = gaps.filter(x => x.from === e).length, w = gaps.filter(x => x.d >= 3).sort((a, b) => b.d - a.d)[0];
      L.push(`Pujada ideal (el teu millor temps a cada tram, sumat): <b>${fmtT(ideal)}</b>. Avui hi has quedat a ${fmtDiff(e.total - ideal).replace('+', '')}` +
        (mine ? `, i ${mine === 1 ? 'un tram és' : mine + ' trams són'} el teu millor de sempre.` : '.'));
      if (w) L.push(`Per millorar: <b>${ph(w.i)}</b> és on més lluny ets del teu millor (${fmtDiff(w.d)} respecte al ${w.from.nom}).`);
    }
    const zt = e.hasHR ? zoneTimes(e) : null;
    if (zt && zt[4] >= 30) {
      const per = route.phases.map((p, i) => ({ i, t: zoneTimes(e, p.a, p.b)[4] })).sort((a, b) => b.t - a.t)[0];
      L.push(`${fmtT(zt[4])} per sobre de 180 pulsacions (Z5), sobretot a <b>${ph(per.i)}</b>.`);
    }
    return L;
  }
  function insBase(e) {
    const z = zonaOf(e), iz = inZone(e, z), L = [];
    if (!iz) return ['Sense pulsacions no es pot llegir una pujada de base.'];
    L.push(`<b>${Math.round(iz.pct * 100)} %</b> del temps dins de ${z.nom} (${z.lo}–${z.hi}). Per sobre: ${fmtT(iz.alta)} · per sota: ${fmtT(iz.baixa)}.`);
    const per = route.phases.map((p, i) => ({ i, r: inZone(e, z, p.a, p.b) })).filter(x => x.r);
    const top = per.filter(x => x.r.alta / x.r.tot >= 0.2).sort((a, b) => b.r.alta / b.r.tot - a.r.alta / a.r.tot)[0];
    if (top) L.push(`On més t'has escapat: <b>${ph(top.i)}</b> (${Math.round(100 * top.r.alta / top.r.tot)} % del tram per sobre de ${z.hi}).`);
    // per sota: l'arrencada no compta (és normal que les pulsacions encara estiguin pujant)
    const low = per.filter(x => x.i > 0 && x.r.baixa / x.r.tot >= 0.3).sort((a, b) => b.r.baixa / b.r.tot - a.r.baixa / a.r.tot)[0];
    if (low && iz.baixa >= 60) L.push(`Per sota de zona sobretot a <b>${ph(low.i)}</b> (${Math.round(100 * low.r.baixa / low.r.tot)} % del tram): allà pots anar una mica més viu.`);
    const steep = per.filter(x => route.phases[x.i].pct >= 9).reduce((a, x) => a + x.r.alta, 0);
    if (iz.alta >= 60 && steep / iz.alta >= 0.6) L.push(`Gairebé tot el temps per sobre és als trams drets: allà, camina abans que les pulsacions passin de ${z.hi}.`);
    else if (iz.baixa > iz.alta && iz.pct < 0.65 && !low) L.push('Has anat més còmode del que tocava: la propera, una mica més viu als trams suaus.');
    const prev = hist.filter(x => !isEx(x) && x !== e && x.zona === e.zona && x.date < e.date && x.hasHR).sort(byDate)[0];
    if (prev) {
      const ip = inZone(prev, z), hs = hrStats(e), hp = hrStats(prev), dT = e.total - prev.total;
      if (ip) L.push(`L'última base ${z.nom} (${prev.nom}): ${Math.round(ip.pct * 100)} % en zona i ${fmtT(prev.total)}.`);
      if (hs && hp && Math.abs(hs.avg - hp.avg) <= 3) {
        if (dT <= -10) L.push(`Amb les mateixes pulsacions (${Math.round(hs.avg)} vs ${Math.round(hp.avg)}) has pujat ${fmtDiff(-dT).replace('+', '')} més ràpid: el motor aeròbic millora.`);
        else if (dT >= 10) L.push(`Amb les mateixes pulsacions has pujat ${fmtDiff(dT).replace('+', '')} més lent: potser cansament acumulat.`);
      }
    }
    return L;
  }

  /* ---------------------------------------------------------------- gràfiques (SVG) */
  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  // xr: tram de distància visible [s0, s1] (tota la pujada si no s'amplia)
  function frame(el, yMin, yMax, ticks, fmtY, H, xr) {
    const [s0, s1] = xr || [0, route.L];
    const W = Math.max(280, Math.round(el.clientWidth || 340)), P = { l: 34, r: 34, t: 16, b: 22 };   // marge dret per a les etiquetes
    const X = s => P.l + (W - P.l - P.r) * (s - s0) / (s1 - s0);
    const Y = v => P.t + (H - P.t - P.b) * (1 - (v - yMin) / (yMax - yMin));
    const sOf = x => s0 + (x - P.l) / (W - P.l - P.r) * (s1 - s0);
    const cid = 'c' + Math.random().toString(36).slice(2, 8);
    let g = `<defs><clipPath id="${cid}"><rect x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}"/></clipPath></defs>`;
    for (const v of ticks) g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${GRID}"/><text x="${P.l - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${fmtY(v)}</text>`;
    for (const p of route.phases) {
      if (p.b <= s0 || p.a >= s1) continue;
      if (p.a > s0) g += `<line x1="${X(p.a).toFixed(1)}" x2="${X(p.a).toFixed(1)}" y1="${P.t}" y2="${H - P.b}" stroke="${SEP}" stroke-dasharray="2 3"/>`;
      const mx = (X(Math.max(p.a, s0)) + X(Math.min(p.b, s1))) / 2;
      g += `<text x="${mx.toFixed(1)}" y="${P.t - 5}" text-anchor="middle">${(s1 - s0) < 1500 ? p.n + ' · ' + p.nom : p.n}</text>`;
    }
    const span = s1 - s0, st = span > 2500 ? 1000 : span > 1200 ? 500 : span > 500 ? 200 : 100;
    for (let k = Math.ceil(s0 / st) * st; k <= s1 + 0.1; k += st) g += `<text x="${X(k).toFixed(1)}" y="${H - 6}" text-anchor="middle">${st >= 1000 ? k / 1000 : km(k).replace(/,0$/, '')} km</text>`;
    return { W, H, P, X, Y, sOf, g, clip: `clip-path="url(#${cid})"`, xr: [s0, s1] };
  }
  function mount(el, f, body, hoverFn) {
    el.innerHTML = `<svg viewBox="0 0 ${f.W} ${f.H}" height="${f.H}" preserveAspectRatio="xMidYMid meet" role="img">${f.g}<g ${f.clip}>${body}</g>` +
      `<line class="cross" y1="${f.P.t}" y2="${f.H - f.P.b}" stroke="#ffffff55" style="display:none"/><g class="dots"></g></svg><div class="tip" hidden></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cross = svg.querySelector('.cross'), dots = svg.querySelector('.dots');
    const move = ev => {
      const r = svg.getBoundingClientRect(), k = f.W / r.width;
      if (el.__pinch) return;                                        // amb dos dits s'està ampliant, no es mostra el punt
      const x = Math.max(f.P.l, Math.min(f.W - f.P.r, (ev.clientX - r.left) * k)), s = Math.max(0, Math.min(route.L, f.sOf(x)));
      const o = hoverFn(s);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.style.display = '';
      dots.innerHTML = o.dots.filter(d => d[1] != null).map(([c, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${c}" stroke="#15181d" stroke-width="2"/>`).join('');
      tip.innerHTML = o.html; tip.hidden = false;
      tip.style.left = Math.max(80, Math.min(r.width - 80, x / k)) + 'px';
    };
    const hide = () => { cross.style.display = 'none'; dots.innerHTML = ''; tip.hidden = true; };
    svg.addEventListener('pointerdown', move); svg.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') hide(); });
  }
  const phaseAtS = s => route.phases.find(p => s >= p.a && s < p.b) || route.phases[route.phases.length - 1];

  function drawDelta(el, e, c, o = {}) {
    const raw = dCurve(e, c), dv = raw.map(x => x.d), H0 = raw.map((h, i) => (i === raw.length - 1 ? h : { s: h.s, d: smS(dv, i) }));
    const [a, b] = o.xr || [0, route.L], vis = H0.filter(h => h.s >= a - 10 && h.s <= b + 10).map(h => h.d);
    const zoomed = b - a < route.L - 1;                                // ampliada: l'eix s'ajusta al tram, sense forçar el 0
    let lo = zoomed ? Math.min(...vis) : Math.min(0, ...vis), hi = zoomed ? Math.max(...vis) : Math.max(0, ...vis); const span = Math.max(zoomed ? 4 : 10, hi - lo); lo -= span * 0.1; hi += span * 0.1;
    const step = niceStep(span / (o.H > 300 ? 6 : 4)), ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Math.round(v));
    const f = frame(el, lo, hi, ticks, v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), o.H || 190, o.xr), y0 = f.Y(0);
    const pts = H0.map(h => `${f.X(h.s).toFixed(1)},${f.Y(h.d).toFixed(1)}`).join(' L');
    const area = `M${f.X(0)},${y0} L${pts} L${f.X(route.L)},${y0} Z`, id = 'd' + Math.random().toString(36).slice(2, 7);
    const showEnd = b >= route.L - 1;
    const last = H0[H0.length - 1];
    const body = `<defs><clipPath id="${id}a"><rect x="0" y="0" width="${f.W}" height="${y0}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${y0}" width="${f.W}" height="${f.H}"/></clipPath></defs>` +
      `<path d="${area}" fill="${BAD}" fill-opacity=".16" clip-path="url(#${id}a)"/><path d="${area}" fill="${OK}" fill-opacity=".16" clip-path="url(#${id}b)"/>` +
      `<line x1="${f.P.l}" x2="${f.W - f.P.r}" y1="${y0}" y2="${y0}" stroke="${MUT}" stroke-opacity=".6"/>` +
      `<path d="M${pts}" fill="none" stroke="${BAD}" stroke-width="2" stroke-linejoin="round" clip-path="url(#${id}a)"/>` +
      `<path d="M${pts}" fill="none" stroke="${OK}" stroke-width="2" stroke-linejoin="round" clip-path="url(#${id}b)"/>` +
      '';
    const endLbl = showEnd ? `<text x="${f.W - f.P.r + 4}" y="${(f.Y(last.d) + 4).toFixed(1)}" style="fill:${last.d > 0 ? BAD : OK};font-weight:700">${fmtDiff(last.d).replace(' s', '')}</text>` : '';
    f.g += endLbl;
    mount(el, f, body, s => {
      const d = tAt(e, s) - tAt(c, s), p = phaseAtS(s);
      return { dots: [[d > 0 ? BAD : OK, f.Y(d)]],
        html: `${km(s)} km · ${p.nom}<br><b>${fmtDiff(d)}</b> ${Math.abs(d) < 0.5 ? 'igual' : d < 0 ? 'per davant' : 'per darrere'} · ${fmtT(tAt(e, s))}` };
    });
    return f;
  }
  function drawHR(el, e, c, zona, o = {}) {
    const vals = (e.hrArr || []).filter(v => v > 0).concat(c ? c.hrArr.filter(v => v > 0) : []);
    const yMin = Math.min(130, Math.floor((Math.min(...vals) - 4) / 10) * 10), yMax = Math.max(190, Math.ceil((Math.max(...vals) + 3) / 5) * 5);
    const tk = o.H > 300 ? 10 : 20, ticks = []; for (let v = Math.ceil(yMin / tk) * tk; v <= yMax; v += tk) ticks.push(v);
    const f = frame(el, yMin, yMax, ticks, v => v, o.H || 200, o.xr);
    let bands = '';
    if (zona) {
      bands += `<rect x="${f.P.l}" width="${f.W - f.P.l - f.P.r}" y="${f.Y(zona.hi)}" height="${f.Y(zona.lo - 3) - f.Y(zona.hi)}" fill="${OK}" fill-opacity=".13"/>`;
      bands += `<text x="${f.W - f.P.r + 4}" y="${(f.Y(zona.hi) + f.Y(zona.lo - 3)) / 2 + 4}" style="fill:${OK}">${zona.clau === 'z23' ? 'Z2-3' : zona.nom}</text>`;
    } else {
      for (const z of ZN.slice(1)) {
        const a = Math.max(yMin, z.lo - 0.5), b = Math.min(yMax, z.hi + 0.5); if (b <= a) continue;
        bands += `<rect x="${f.P.l}" width="${f.W - f.P.l - f.P.r}" y="${f.Y(b)}" height="${f.Y(a) - f.Y(b)}" fill="${z.c}" fill-opacity=".14"/>`;
        if (f.Y(a) - f.Y(b) >= 10) bands += `<text x="${f.W - f.P.r + 4}" y="${((f.Y(a) + f.Y(b)) / 2 + 4).toFixed(1)}">${z.k}</text>`;
      }
    }
    const path = arr => { let d = '', pen = false; arr.forEach((v, i) => { const s = i * 10; if (s > route.L) return; if (v > 0) { d += `${pen ? 'L' : 'M'}${f.X(s).toFixed(1)},${f.Y(sm(arr, i)).toFixed(1)}`; pen = true; } else pen = false; }); return d; };
    const body = bands + (c ? `<path d="${path(c.hrArr)}" fill="none" stroke="${MUT}" stroke-width="1.5" stroke-dasharray="4 3"/>` : '') +
      `<path d="${path(e.hrArr)}" fill="none" stroke="${ACC}" stroke-width="2" stroke-linejoin="round"/>`;
    mount(el, f, body, s => {
      const i = Math.min(e.hrArr.length - 1, Math.round(s / 10)), h = e.hrArr[i] > 0 ? Math.round(sm(e.hrArr, i)) : null;
      const hc = c && c.hrArr[i] > 0 ? Math.round(sm(c.hrArr, i)) : null, p = phaseAtS(s);
      return { dots: [[ACC, h != null ? f.Y(h) : null], [MUT, hc != null ? f.Y(hc) : null]],
        html: `${km(s)} km · ${p.nom}<br><b>${h != null ? h + ' ppm' : 'sense FC'}</b>${hc != null ? ` · ${c.nom}: ${hc}` : ''}` };
    });
    return f;
  }
  // mitjana mòbil curta (±2 punts = ±20 m) per treure el soroll del pulsòmetre a la gràfica
  function sm(arr, i) { let a = 0, n = 0; for (let k = i - 2; k <= i + 2; k++) if (arr[k] > 0) { a += arr[k]; n++; } return n ? a / n : 0; }
  // el mateix per a valors amb signe (diferència de temps): aquí 0 i negatius són vàlids
  function smS(arr, i) { let a = 0, n = 0; for (let k = i - 2; k <= i + 2; k++) if (k >= 0 && k < arr.length && isFinite(arr[k])) { a += arr[k]; n++; } return n ? a / n : 0; }

  /* ---------------------------------------------------------------- gràfica ampliada (pantalla completa) */
  const FS = { draw: null, xr: null, f: null, P: new Map(), g0: null, raf: 0 };
  function fsOpen(title, draw) {
    FS.draw = draw; FS.xr = [0, route.L];
    $('fsTitle').textContent = title; $('fsChart').hidden = false; document.body.style.overflow = 'hidden';
    fsDraw();
  }
  function fsClose() { $('fsChart').hidden = true; document.body.style.overflow = ''; FS.draw = null; }
  function fsDraw() {
    if (!FS.draw) return;
    const el = $('fsBody'), H = Math.max(240, Math.round(el.clientHeight || (innerHeight - 170)));
    FS.f = FS.draw(el, { H, xr: FS.xr });
    $('fsAll').disabled = FS.xr[0] <= 0 && FS.xr[1] >= route.L;
  }
  function fsSet(a, b) {
    const L = route.L, span = Math.max(150, Math.min(L, b - a));
    a = Math.max(0, Math.min(L - span, a)); FS.xr = [a, a + span];
    cancelAnimationFrame(FS.raf); FS.raf = requestAnimationFrame(fsDraw);
  }
  function fsZoom(k, sMid) {
    const [a, b] = FS.xr, m = sMid != null ? sMid : (a + b) / 2, span = (b - a) / k;
    fsSet(m - (m - a) / k, m - (m - a) / k + span);
  }
  function fsBind() {
    const el = $('fsBody');
    const pos = ev => { const r = el.getBoundingClientRect(); return { x: (ev.clientX - r.left) * (FS.f ? FS.f.W / r.width : 1), y: ev.clientY - r.top }; };
    el.addEventListener('pointerdown', ev => {
      FS.P.set(ev.pointerId, pos(ev));
      if (FS.P.size === 2) { const [p, q] = [...FS.P.values()]; el.__pinch = true; FS.g0 = { d: Math.abs(p.x - q.x) || 1, m: (p.x + q.x) / 2, xr: FS.xr.slice(), f: FS.f }; }
    });
    el.addEventListener('pointermove', ev => {
      if (!FS.P.has(ev.pointerId)) return; FS.P.set(ev.pointerId, pos(ev));
      if (FS.P.size !== 2 || !FS.g0) return;
      const [p, q] = [...FS.P.values()], g = FS.g0, d = Math.max(20, Math.abs(p.x - q.x)), m = (p.x + q.x) / 2;
      const span0 = g.xr[1] - g.xr[0], span = span0 * g.d / d, sMid = g.f.sOf(g.m);           // el punt sota els dits es queda sota els dits
      const frac = (m - g.f.P.l) / (g.f.W - g.f.P.l - g.f.P.r), a = sMid - frac * span;
      fsSet(a, a + span);
    });
    const up = ev => { FS.P.delete(ev.pointerId); if (FS.P.size < 2) { FS.g0 = null; if (!FS.P.size) el.__pinch = false; } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', ev => { ev.preventDefault(); if (FS.f) fsZoom(ev.deltaY < 0 ? 1.25 : 0.8, FS.f.sOf(pos(ev).x)); }, { passive: false });
    $('fsIn').onclick = () => fsZoom(2); $('fsOut').onclick = () => fsZoom(0.5); $('fsAll').onclick = () => fsSet(0, route.L);
    $('fsClose').onclick = fsClose;
    addEventListener('resize', () => { if (FS.draw) { cancelAnimationFrame(FS.raf); FS.raf = requestAnimationFrame(fsDraw); } });
  }

  /* ---------------------------------------------------------------- esdeveniments */
  async function del() {
    if (!cur || cur.src !== 'app') return;
    if (Date.now() - delArmed > 3000) { delArmed = Date.now(); $('aDel').textContent = 'Segur? Toca de nou per esborrar-la'; return; }
    const id = cur.id;
    try { await DB.del('runs', id); } catch (err) { return showErr('No s\'ha pogut esborrar: ' + err.message); }
    if (store.get('coll_ref', null) === id) store.set('coll_ref', null);
    const last = store.get('coll_last', null); if (last && last.id === id) store.set('coll_last', null);
    await loadRefs(); list();
  }
  function expandDelta() { const e = cur, c = hist.find(x => x.id === $('aCmp').value); if (e && c) fsOpen(`Temps respecte a ${c.nom}`, (el, o) => drawDelta(el, e, c, o)); }
  function expandHR() {
    const e = cur; if (!e || !e.hasHR) return;
    const c0 = isEx(e) ? hist.find(x => x.id === $('aCmp').value) : null, c = c0 && c0.hasHR ? c0 : null;
    fsOpen('Pulsacions', (el, o) => drawHR(el, e, c, isEx(e) ? null : zonaOf(e), o));
  }
  function init() {
    fsBind();
    $('aDeltaX').onclick = expandDelta; $('aHRX').onclick = expandHR;
    $('segHist').querySelectorAll('button').forEach(b => b.onclick = () => { order = b.dataset.o; renderList(); });
    $('histBack').onclick = () => { show('prep'); prepRefresh(); };
    $('aBack').onclick = () => { Mapa.hide(); if (backTo === 'hist') list(); else { show('prep'); prepRefresh(); } };
    $('aCmp').onchange = () => { const c = hist.find(x => x.id === $('aCmp').value); if (cur && c) { render(cur, c); Mapa.open(cur, c); } };
    Mapa.init();
    $('aDel').onclick = () => del().catch(err => showErr(err.message));
  }
  return { init, list, open, ultima, partials, bestPartials, zonaPct, tAt, zonaOf, isEx, exigents, phaseAtS, cmpDefault, sm, smS, ZN, current: () => cur };
})();
