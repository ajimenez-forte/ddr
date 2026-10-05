import { simulate, recordResult, strengths, matchProbs, fillSchedule, DEFAULT_CONFIG } from './sim.js';
import { LIGA_2026_II } from './liga-2026-ii.js';

const STORE = 'nacional-probabilidades-v1';
const FOCUS_DEFAULT = 'Atlético Nacional';
const $ = id => document.getElementById(id);

let state;
let jevAvailable = false;
const newId = () => Math.random().toString(36).slice(2, 10);

// ---------- Datos iniciales ----------
// Tabla real del 5 de octubre, los partidos de Nacional encontrados en la web y,
// para el resto de la liga, un calendario aproximado hasta tener el oficial.
function ligaState() {
  const L = LIGA_2026_II;
  const teams = L.teams.map(t => ({ ...t }));
  const known = L.fixtures.map(f => ({ ...f, id: newId() }));
  const approx = fillSchedule(teams, known, L.totalMatches).map(f => ({ ...f, id: newId() }));
  return {
    source: L.fuente,
    totalMatches: L.totalMatches,
    focus: FOCUS_DEFAULT,
    teams,
    fixtures: [...known, ...approx],
    history: [],
    undo: [],
    cfg: { sims: DEFAULT_CONFIG.sims, homeAdv: DEFAULT_CONFIG.homeAdv, jevWeight: DEFAULT_CONFIG.jevWeight },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    const s = raw && JSON.parse(raw);
    // Los datos ficticios de versiones anteriores se reemplazan por la tabla real.
    if (s && !s.demo) return normalize(s);
  } catch { /* sin almacenamiento: se usan los datos iniciales */ }
  return ligaState();
}
function normalize(s) {
  s.cfg = { sims: DEFAULT_CONFIG.sims, homeAdv: DEFAULT_CONFIG.homeAdv, jevWeight: DEFAULT_CONFIG.jevWeight, ...s.cfg };
  s.history ??= []; s.undo ??= []; s.totalMatches ??= LIGA_2026_II.totalMatches;
  for (const f of s.fixtures) f.id ??= newId();
  return s;
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* opcional */ }
}

// ---------- Formato ----------
const pct = x => x == null ? '–' : x >= 0.995 && x < 1 ? '>99%' : x > 0 && x < 0.005 ? '<1%' : `${Math.round(x * 100)}%`;
const trio = p => `${Math.round(p.home * 100)} · ${Math.round(p.draw * 100)} · ${Math.round(p.away * 100)}`;
const pct1 = x => `${(x * 100).toFixed(1)}%`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Cálculo ----------
let lastResult = null;
let runId = 0;

function validate() {
  const names = new Set(state.teams.map(t => t.name));
  if (state.teams.length < 8) return 'Hacen falta al menos 8 equipos en la tabla.';
  if (names.size !== state.teams.length) return 'Hay equipos repetidos en la tabla.';
  const bad = state.fixtures.find(f => !names.has(f.home) || !names.has(f.away));
  if (bad) return `El partido "${bad.home} - ${bad.away}" tiene un equipo que no está en la tabla.`;
  return null;
}

function recompute(historyLabel) {
  const err = validate();
  if (err) { $('heroSub').textContent = err; return; }
  const id = ++runId;
  $('heroSub').textContent = 'Calculando…';
  setTimeout(() => {
    if (id !== runId) return;
    const t0 = performance.now();
    const res = simulate(state.teams, state.fixtures, {
      sims: state.cfg.sims, homeAdv: state.cfg.homeAdv, jevWeight: state.cfg.jevWeight, focus: state.focus,
    });
    lastResult = res;
    const f = res.table.find(r => r.name === state.focus);
    if (historyLabel && f) {
      state.history.push({ label: historyLabel, champ: f.champ, top8: f.top8, focus: state.focus });
      save();
    }
    renderResults(res, performance.now() - t0);
  }, 20);
}

// ---------- Render: resultados ----------
function renderResults(res, ms) {
  const f = res.table.find(r => r.name === state.focus);
  $('pChamp').textContent = pct1(f.champ);
  $('pTop8').textContent = pct(f.top8);
  $('pFinal').textContent = pct(f.final);
  $('pFirst').textContent = pct(f.first);
  $('avgPos').textContent = `${f.avgPos.toFixed(1)}º`;
  const pend = state.fixtures.filter(x => x.home === state.focus || x.away === state.focus).length;
  $('heroSub').textContent = `Le quedan ${pend} partido${pend === 1 ? '' : 's'} de fase regular.`;
  $('simInfo').textContent = `${state.cfg.sims.toLocaleString('es-CO')} simulaciones · ${Math.round(ms)} ms`;

  const nm = res.nextMatch;
  if (nm && nm.W) {
    $('nextTitle').textContent = `Próximo partido: ${nm.home} vs ${nm.away}`;
    const cell = (k, cls, txt) => {
      const c = nm[k];
      if (!c) return `<div><span class="chip ${cls}">${txt}</span><span class="note">Sin casos</span></div>`;
      return `<div><span class="chip ${cls}">${txt}</span><b class="num">${pct1(c.champ)}</b>
        <span class="note">campeón · ${pct(c.top8)} a los 8 · pasa en ${pct(c.share)} de las simulaciones</span></div>`;
    };
    $('scen').innerHTML = cell('W', 'w', 'Si gana') + cell('D', 'd', 'Si empata') + cell('L', 'l', 'Si pierde');
    $('nextBox').hidden = false;
  } else {
    $('nextBox').hidden = true;
  }

  const max = Math.max(...res.table.map(r => r.champ), 0.01);
  $('probTable').innerHTML = `<thead><tr><th>#</th><th>Equipo</th><th>A los 8</th><th>Final</th><th>Campeón</th></tr></thead><tbody>` +
    res.table.map((r, i) => `<tr class="${r.name === state.focus ? 'focus' : ''}"><td class="num">${i + 1}</td><td>${esc(r.name)}</td>
      <td class="num">${pct(r.top8)}</td><td class="num">${pct(r.final)}</td>
      <td class="num">${pct1(r.champ)}<span class="bar" style="width:${Math.round(40 * r.champ / max)}px"></span></td></tr>`).join('') + '</tbody>';

  renderChart(f);
}

function renderChart(current) {
  const pts = state.history.filter(h => h.focus === state.focus);
  if (!pts.length || Math.abs(pts[pts.length - 1].champ - current.champ) > 0.0005) pts.push({ label: 'Ahora', champ: current.champ });
  const W = 560, H = 200, L = 40, R = 14, T = 14, B = 26;
  const top = Math.min(1, Math.max(0.1, Math.ceil(Math.max(...pts.map(p => p.champ)) * 10 + 0.5) / 10));
  const x = i => pts.length === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (pts.length - 1);
  const y = v => T + (1 - v / top) * (H - T - B);
  const ticks = [0, top / 2, top];
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.champ).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const last = pts[pts.length - 1];
  $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Probabilidad de campeón después de cada resultado">
    ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" fill="none"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${Math.round(t * 100)}%</text>`).join('')}
    <path d="${area}" fill="var(--accent-soft)" stroke="none"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.champ)}" r="${i === pts.length - 1 ? 5 : 3}" fill="var(--accent)"><title>${esc(p.label)}: ${pct1(p.champ)}</title></circle>`).join('')}
    <text x="${x(pts.length - 1)}" y="${H - 8}" text-anchor="${pts.length > 1 ? 'end' : 'middle'}">${esc(last.label)} · ${pct1(last.champ)}</text>
    ${pts.length > 1 ? `<text x="${L}" y="${H - 8}">${esc(pts[0].label)}</text>` : ''}
  </svg>
  <p class="note">${pts.length > 1 ? 'Pasa el cursor por cada punto para ver qué resultado lo movió.' : 'Cada resultado que registres agrega un punto a esta línea.'}</p>`;
}

// ---------- Render: datos ----------
function renderFocus() {
  const sel = $('focus');
  sel.innerHTML = state.teams.map(t => `<option ${t.name === state.focus ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
}

function renderFixtures() {
  const mine = f => f.home === state.focus || f.away === state.focus;
  const cfg = { ...DEFAULT_CONFIG, homeAdv: state.cfg.homeAdv };
  const model = strengths(state.teams, cfg);
  const row = (f, i) => `
    <div class="fx ${mine(f) ? 'mine' : ''}">
      <span class="h" title="${esc(f.home)}">${esc(f.home)}</span>
      <input type="number" min="0" max="20" id="gh${i}" aria-label="Goles ${esc(f.home)}">
      <span>-</span>
      <input type="number" min="0" max="20" id="ga${i}" aria-label="Goles ${esc(f.away)}">
      <span class="a" title="${esc(f.away)}">${esc(f.away)}</span>
      <button class="btn rec" type="button" data-rec="${i}">Registrar</button>
      <button class="x" type="button" data-del="${i}" aria-label="Quitar partido" title="Quitar partido">×</button>
      <div class="meta">
        <span class="probs" title="Local · Empate · Visitante">Modelo ${trio(matchProbs(f.home, f.away, model, cfg))}</span>
        ${f.approx ? '<span class="tag" title="Partido sorteado, no es del calendario oficial">aprox.</span>' : ''}
        ${f.jev ? `<span class="probs jev" title="Pronóstico de Jev: local · empate · visitante">Jev ${trio(f.jev)}</span>` : ''}
        ${jevAvailable ? `<input type="text" class="ctx" data-note="${i}" value="${esc(f.note ?? '')}" maxlength="600" placeholder="Contexto para Jev (opcional): lesiones, suspendidos, rotación…" aria-label="Contexto del partido para Jev">` : ''}
      </div>
    </div>`;
  const all = state.fixtures.map((f, i) => ({ f, i }));
  const own = all.filter(x => mine(x.f)), rest = all.filter(x => !mine(x.f));
  const wasOpen = document.querySelector('#fixtures details')?.open;
  $('jevBar').hidden = !jevAvailable || !all.length;
  $('fixtures').innerHTML = !all.length
    ? '<p class="note">No hay partidos pendientes. La fase regular está completa y la simulación solo juega cuadrangulares y final.</p>'
    : `<p class="label">Partidos de ${esc(state.focus)} (${own.length})</p>${own.map(x => row(x.f, x.i)).join('') || '<p class="note">Ya jugó todos sus partidos.</p>'}
       <details class="others" ${wasOpen ? 'open' : ''}><summary>Resto de la liga (${rest.length} partidos)</summary>${rest.map(x => row(x.f, x.i)).join('')}</details>`;
  $('undo').disabled = !state.undo.length;
}

function renderTeams() {
  const rows = state.teams.map((t, i) => {
    const pts = 3 * t.g + t.e;
    const n = k => `<input type="number" min="0" data-i="${i}" data-k="${k}" value="${t[k]}" aria-label="${k} ${esc(t.name)}">`;
    return { pts, dg: t.gf - t.gc, gf: t.gf, html: `<td><input type="text" data-i="${i}" data-k="name" value="${esc(t.name)}" aria-label="Nombre"></td>
      <td>${n('pj')}</td><td>${n('g')}</td><td>${n('e')}</td><td>${n('p')}</td><td>${n('gf')}</td><td>${n('gc')}</td>
      <td class="num">${t.gf - t.gc}</td><td class="num"><b>${pts}</b></td>
      <td><input type="number" step="0.05" min="0.5" max="1.5" data-i="${i}" data-k="ajuste" value="${t.ajuste ?? 1}" aria-label="Ajuste ${esc(t.name)}"></td>
      <td><button class="x" type="button" data-delteam="${i}" aria-label="Quitar equipo">×</button></td>` };
  });
  rows.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
  $('teamTable').innerHTML = `<thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Ajuste</th><th></th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr><td class="num">${i + 1}</td>${r.html}</tr>`).join('') +
    `</tbody><tfoot><tr><td colspan="12"><button class="btn ghost" type="button" id="addTeam">Agregar equipo</button></td></tr></tfoot>`;
}

function renderBanner() {
  const n = state.fixtures.filter(f => f.approx).length;
  $('banner').hidden = !n;
  $('bannerText').textContent = `${n} de los ${state.fixtures.length} partidos pendientes son aproximados: los rivales y la localía se sortearon porque falta el calendario oficial. `
    + 'Pega el calendario real en Partidos pendientes y quita los aproximados para un cálculo exacto.';
}

function renderAll() {
  renderBanner();
  renderFocus();
  renderFixtures();
  renderTeams();
  $('fxTotal').value = state.totalMatches;
  $('cfgSims').value = state.cfg.sims;
  $('cfgHome').value = state.cfg.homeAdv;
  $('cfgJev').value = state.cfg.jevWeight;
  $('cfgJevVal').textContent = `${Math.round(state.cfg.jevWeight * 100)}%`;
  $('jevOff').hidden = jevAvailable;
}

function touched() { renderBanner(); }

// ---------- Eventos ----------
$('focus').addEventListener('change', e => {
  state.focus = e.target.value; save(); renderFixtures(); recompute();
});

$('fixtures').addEventListener('click', e => {
  const rec = e.target.closest('[data-rec]');
  const del = e.target.closest('[data-del]');
  if (rec) {
    const i = +rec.dataset.rec;
    const gh = $(`gh${i}`).value, ga = $(`ga${i}`).value;
    if (gh === '' || ga === '' || +gh < 0 || +ga < 0) { $(`gh${i}`).focus(); return; }
    const f = state.fixtures[i];
    if (!state.history.some(h => h.focus === state.focus) && lastResult) {
      const cur = lastResult.table.find(r => r.name === state.focus);
      state.history.push({ label: 'Inicio', champ: cur.champ, top8: cur.top8, focus: state.focus });
    }
    state.undo.push({ teams: state.teams, fixtures: state.fixtures, historyLen: state.history.length });
    if (state.undo.length > 30) state.undo.shift();
    const next = recordResult(state.teams, state.fixtures, i, +gh, +ga);
    state.teams = next.teams; state.fixtures = next.fixtures;
    touched(); save(); renderFixtures(); renderTeams();
    recompute(`${f.home} ${+gh}-${+ga} ${f.away}`);
  } else if (del) {
    state.fixtures.splice(+del.dataset.del, 1);
    touched(); save(); renderFixtures(); recompute();
  }
});

$('fixtures').addEventListener('change', e => {
  const el = e.target.closest('[data-note]');
  if (!el) return;
  state.fixtures[+el.dataset.note].note = el.value.trim();
  save();
});

$('askJev').addEventListener('click', async () => {
  const st = $('jevStatus');
  const pick = state.fixtures.filter(f => f.home === state.focus || f.away === state.focus || f.note);
  const send = pick.slice(0, 40);
  if (!send.length) { st.className = 'status err'; st.textContent = 'No hay partidos de este equipo ni partidos con contexto para consultar.'; return; }
  $('askJev').disabled = true;
  st.className = 'status'; st.textContent = `Consultando a Jev por ${send.length} partido(s)…`;
  try {
    const r = await fetch('/api/jev', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: state.teams, fixtures: send.map(f => ({ id: f.id, home: f.home, away: f.away, note: f.note })) }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    for (const fc of data.forecasts) {
      const f = state.fixtures.find(x => x.id === fc.id);
      if (f) f.jev = { home: fc.home, draw: fc.draw, away: fc.away, note: f.note ?? '' };
    }
    st.textContent = `Jev pronosticó ${data.forecasts.length} partido(s)` + (pick.length > 40 ? ` (de ${pick.length}; máximo 40 por consulta).` : '.') + ' La simulación ya los usa.';
    save(); renderFixtures(); recompute();
  } catch (err) {
    st.className = 'status err'; st.textContent = err.message;
  } finally {
    $('askJev').disabled = false;
  }
});

$('jevClear').addEventListener('click', () => {
  for (const f of state.fixtures) delete f.jev;
  $('jevStatus').className = 'status'; $('jevStatus').textContent = 'Quité los pronósticos de Jev. La simulación usa solo el modelo.';
  save(); renderFixtures(); recompute();
});

$('fxFill').addEventListener('click', () => {
  const st = $('fxStatus');
  const total = Math.round(+$('fxTotal').value);
  if (!(total >= 2)) { st.className = 'status err'; st.textContent = 'Escribe cuántos partidos juega cada equipo en la fase regular.'; return; }
  try {
    const extra = fillSchedule(state.teams, state.fixtures, total, Date.now() % 100000).map(f => ({ ...f, id: newId() }));
    state.totalMatches = total;
    state.fixtures.push(...extra);
    st.className = 'status'; st.textContent = `Agregué ${extra.length} partido(s) aproximado(s).`;
    touched(); save(); renderFixtures(); recompute();
  } catch (err) {
    st.className = 'status err'; st.textContent = err.message;
  }
});

$('fxApproxClear').addEventListener('click', () => {
  const before = state.fixtures.length;
  state.fixtures = state.fixtures.filter(f => !f.approx);
  $('fxStatus').className = 'status';
  $('fxStatus').textContent = `Quité ${before - state.fixtures.length} partido(s) aproximado(s).`;
  touched(); save(); renderFixtures(); recompute();
});

$('undo').addEventListener('click', () => {
  const u = state.undo.pop();
  if (!u) return;
  state.teams = u.teams; state.fixtures = u.fixtures;
  state.history.length = Math.min(state.history.length, u.historyLen);
  save(); renderAll(); recompute();
});

$('teamTable').addEventListener('change', e => {
  const el = e.target;
  if (!el.dataset.k) return;
  const t = state.teams[+el.dataset.i];
  const k = el.dataset.k;
  if (k === 'name') {
    const old = t.name, nu = el.value.trim();
    if (!nu) { el.value = old; return; }
    t.name = nu;
    for (const f of state.fixtures) { if (f.home === old) f.home = nu; if (f.away === old) f.away = nu; }
    if (state.focus === old) state.focus = nu;
  } else {
    t[k] = k === 'ajuste' ? Math.min(1.5, Math.max(0.5, +el.value || 1)) : Math.max(0, Math.round(+el.value || 0));
    if (['g', 'e', 'p'].includes(k)) t.pj = t.g + t.e + t.p;
  }
  touched(); save(); renderFocus(); renderTeams(); renderFixtures(); recompute();
});

$('teamTable').addEventListener('click', e => {
  if (e.target.id === 'addTeam') {
    let n = 1; while (state.teams.some(t => t.name === `Equipo nuevo ${n}`)) n++;
    state.teams.push({ name: `Equipo nuevo ${n}`, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, ajuste: 1 });
  } else if (e.target.dataset.delteam != null) {
    const t = state.teams[+e.target.dataset.delteam];
    state.teams.splice(+e.target.dataset.delteam, 1);
    state.fixtures = state.fixtures.filter(f => f.home !== t.name && f.away !== t.name);
    if (state.focus === t.name) state.focus = state.teams[0]?.name;
  } else return;
  touched(); save(); renderAll(); recompute();
});

// Pegar tabla: nombre = texto antes del primer número; se toman los 6 primeros números.
$('tbLoad').addEventListener('click', () => {
  const lines = $('tbPaste').value.split('\n').map(s => s.trim()).filter(Boolean);
  const teams = [], bad = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+[.)]?\s+)?(.+?)[\s;,\t]+(\d+)[\s;,\t]+(\d+)[\s;,\t]+(\d+)[\s;,\t]+(\d+)[\s;,\t]+(\d+)[\s;,\t]+(\d+)/);
    if (!m) { bad.push(line); continue; }
    const [, name, pj, g, e, p, gf, gc] = m;
    const old = state.teams.find(t => t.name === name.trim());
    teams.push({ name: name.trim(), pj: +pj, g: +g, e: +e, p: +p, gf: +gf, gc: +gc, ajuste: old?.ajuste ?? 1 });
  }
  const st = $('tbStatus');
  if (bad.length || teams.length < 8) {
    st.className = 'status err';
    st.textContent = bad.length ? `No pude leer ${bad.length} línea(s), por ejemplo: "${bad[0]}". Usa Equipo PJ G E P GF GC.` : 'Hacen falta al menos 8 equipos.';
    return;
  }
  const incoherent = teams.find(t => t.g + t.e + t.p !== t.pj);
  state.teams = teams;
  if (!teams.some(t => t.name === state.focus)) state.focus = teams.find(t => /nacional/i.test(t.name))?.name ?? teams[0].name;
  const names = new Set(teams.map(t => t.name));
  const before = state.fixtures.length;
  state.fixtures = state.fixtures.filter(f => names.has(f.home) && names.has(f.away));
  state.history = []; state.undo = [];
  st.className = 'status';
  st.textContent = `Tabla cargada con ${teams.length} equipos.` +
    (before !== state.fixtures.length ? ` Quité ${before - state.fixtures.length} partido(s) pendiente(s) con equipos que ya no están.` : '') +
    (incoherent ? ` Ojo: en ${incoherent.name} G+E+P no da PJ.` : '');
  touched(); save(); renderAll(); recompute();
});

$('fxAdd').addEventListener('click', () => {
  const names = new Set(state.teams.map(t => t.name));
  const lines = $('fxPaste').value.split('\n').map(s => s.trim()).filter(Boolean);
  const add = [], bad = [];
  for (const line of lines) {
    const parts = line.split(/\s+(?:-|vs\.?|v)\s+|\t|;/i).map(s => s.trim()).filter(Boolean);
    if (parts.length === 2 && names.has(parts[0]) && names.has(parts[1]) && parts[0] !== parts[1]) add.push({ id: newId(), home: parts[0], away: parts[1] });
    else bad.push(line);
  }
  state.fixtures.push(...add);
  const st = $('fxStatus');
  st.className = bad.length ? 'status err' : 'status';
  st.textContent = `Agregué ${add.length} partido(s).` + (bad.length ? ` No reconocí ${bad.length}, por ejemplo "${bad[0]}". Revisa que los nombres sean iguales a los de la tabla.` : '');
  if (add.length) { $('fxPaste').value = bad.join('\n'); touched(); save(); renderFixtures(); recompute(); }
});

let clearArmed = false;
$('fxClear').addEventListener('click', e => {
  if (!clearArmed) { clearArmed = true; e.target.textContent = 'Pulsa otra vez para confirmar'; setTimeout(() => { clearArmed = false; e.target.textContent = 'Borrar todos los pendientes'; }, 4000); return; }
  clearArmed = false; e.target.textContent = 'Borrar todos los pendientes';
  state.fixtures = []; touched(); save(); renderFixtures(); recompute();
});

$('cfgSims').addEventListener('change', e => {
  state.cfg.sims = Math.min(100000, Math.max(1000, Math.round(+e.target.value || DEFAULT_CONFIG.sims)));
  e.target.value = state.cfg.sims; save(); recompute();
});
$('cfgHome').addEventListener('change', e => {
  state.cfg.homeAdv = Math.min(1.6, Math.max(0.8, +e.target.value || DEFAULT_CONFIG.homeAdv));
  e.target.value = state.cfg.homeAdv; save(); recompute();
});

$('cfgJev').addEventListener('input', e => {
  $('cfgJevVal').textContent = `${Math.round(+e.target.value * 100)}%`;
});
$('cfgJev').addEventListener('change', e => {
  state.cfg.jevWeight = Math.min(1, Math.max(0, +e.target.value));
  save(); recompute();
});

$('copyBackup').addEventListener('click', () => {
  const { undo, ...rest } = state;
  const txt = JSON.stringify(rest);
  $('backup').value = txt;
  const done = () => { $('cfgStatus').className = 'status'; $('cfgStatus').textContent = 'Respaldo copiado. Guárdalo en un archivo o nota.'; };
  navigator.clipboard?.writeText(txt).then(done, () => { $('backup').select(); $('cfgStatus').textContent = 'Selecciona el texto de abajo y cópialo.'; }) ?? $('backup').select();
});
$('restore').addEventListener('click', () => {
  try {
    const s = JSON.parse($('backup').value);
    if (!Array.isArray(s.teams) || !Array.isArray(s.fixtures)) throw new Error();
    state = normalize({ ...s, undo: [] });
    state.focus ??= state.teams[0]?.name;
    save(); renderAll(); recompute();
    $('cfgStatus').className = 'status'; $('cfgStatus').textContent = 'Datos restaurados.';
  } catch {
    $('cfgStatus').className = 'status err'; $('cfgStatus').textContent = 'Ese texto no es un respaldo válido. Pega el JSON completo que copiaste antes.';
  }
});
let demoArmed = false;
$('loadDemo').addEventListener('click', e => {
  const label = 'Volver a la tabla del 5 de octubre';
  if (!demoArmed) { demoArmed = true; e.target.textContent = 'Pulsa otra vez: se borran tus cambios'; setTimeout(() => { demoArmed = false; e.target.textContent = label; }, 4000); return; }
  demoArmed = false; e.target.textContent = label;
  state = ligaState(); save(); renderAll(); recompute();
});

document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  document.querySelectorAll('.tabs [data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tab; });
});

// ---------- Inicio ----------
state = load();
renderAll();
recompute();
// Jev solo está disponible cuando la app corre con su servidor (npm start) y hay API key.
fetch('/api/status').then(r => r.ok ? r.json() : null).then(s => {
  jevAvailable = !!s?.jev;
  if (jevAvailable) renderAll();
}).catch(() => {});
