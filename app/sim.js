// Motor de simulación Monte Carlo para la Liga BetPlay.
// Modelo: goles Poisson con fuerza de ataque/defensa por equipo, estimada
// desde la tabla actual y encogida hacia el promedio de la liga.

export const DEFAULT_CONFIG = {
  sims: 10000,
  qualifiers: 8,          // clasificados a cuadrangulares
  homeAdv: 1.15,          // multiplicador de goles del local
  awayFactor: 0.87,       // multiplicador de goles del visitante
  priorMatches: 5,        // partidos "ficticios" de promedio para encoger la estimación
  penaltiesHomeEdge: 0.5, // probabilidad de ganar penales para el local de la vuelta
};

// Generador pseudoaleatorio con semilla (mulberry32) para resultados reproducibles.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda, rand) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// Calcula fuerzas de ataque y defensa a partir de la tabla.
export function strengths(teams, cfg = DEFAULT_CONFIG) {
  const played = teams.reduce((s, t) => s + t.pj, 0);
  const goals = teams.reduce((s, t) => s + t.gf, 0);
  const mu = played > 0 ? goals / played : 1.2;
  const k = cfg.priorMatches;
  const out = {};
  for (const t of teams) {
    const adj = t.ajuste ?? 1;
    out[t.name] = {
      att: ((t.gf + k * mu) / (t.pj + k) / mu) * adj,
      def: ((t.gc + k * mu) / (t.pj + k) / mu) / adj,
    };
  }
  return { mu, s: out };
}

function playMatch(home, away, model, cfg, rand) {
  const h = model.s[home], a = model.s[away];
  const lh = model.mu * h.att * a.def * cfg.homeAdv;
  const la = model.mu * a.att * h.def * cfg.awayFactor;
  return [poisson(lh, rand), poisson(la, rand)];
}

function emptyRow(name) {
  return { name, pj: 0, pts: 0, gf: 0, gc: 0 };
}

function apply(table, home, away, gh, ga) {
  const H = table[home], A = table[away];
  H.pj++; A.pj++;
  H.gf += gh; H.gc += ga; A.gf += ga; A.gc += gh;
  if (gh > ga) H.pts += 3; else if (gh < ga) A.pts += 3; else { H.pts++; A.pts++; }
}

// Orden: puntos, diferencia de gol, goles a favor, desempate aleatorio.
function rankLeague(rows, tieKey) {
  return rows.slice().sort((x, y) =>
    y.pts - x.pts ||
    (y.gf - y.gc) - (x.gf - x.gc) ||
    y.gf - x.gf ||
    tieKey[x.name] - tieKey[y.name]);
}

// Orden en cuadrangular: puntos, DG, GF, posición en la fase regular.
function rankGroup(rows, leaguePos) {
  return rows.slice().sort((x, y) =>
    y.pts - x.pts ||
    (y.gf - y.gc) - (x.gf - x.gc) ||
    y.gf - x.gf ||
    leaguePos[x.name] - leaguePos[y.name]);
}

// Sorteo: 1º y 2º son cabeza de grupo; (3,4), (5,6), (7,8) se reparten al azar.
function drawGroups(top8, rand) {
  const A = [top8[0]], B = [top8[1]];
  for (let i = 2; i < 8; i += 2) {
    if (rand() < 0.5) { A.push(top8[i]); B.push(top8[i + 1]); }
    else { A.push(top8[i + 1]); B.push(top8[i]); }
  }
  return [A, B];
}

function playGroup(group, model, cfg, rand, leaguePos) {
  const t = {};
  for (const n of group) t[n] = emptyRow(n);
  for (const h of group) for (const a of group) {
    if (h === a) continue;
    const [gh, ga] = playMatch(h, a, model, cfg, rand);
    apply(t, h, a, gh, ga);
  }
  return rankGroup(Object.values(t), leaguePos)[0].name;
}

// Final ida y vuelta. Cierra de local el mejor ubicado en la fase regular.
function playFinal(x, y, model, cfg, rand, leaguePos) {
  const [first, second] = leaguePos[x] < leaguePos[y] ? [y, x] : [x, y];
  const [g1h, g1a] = playMatch(first, second, model, cfg, rand);
  const [g2h, g2a] = playMatch(second, first, model, cfg, rand);
  const aggSecond = g1a + g2h, aggFirst = g1h + g2a;
  if (aggSecond > aggFirst) return second;
  if (aggFirst > aggSecond) return first;
  return rand() < cfg.penaltiesHomeEdge ? second : first;
}

/**
 * Corre la simulación completa.
 * teams:    [{ name, pj, g, e, p, gf, gc, ajuste? }]
 * fixtures: [{ home, away }] partidos de fase regular aún sin jugar
 * focus:    nombre del equipo para el análisis condicional del próximo partido
 */
export function simulate(teams, fixtures, opts = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...opts };
  const rand = rng(cfg.seed ?? 12345);
  const model = strengths(teams, cfg);
  const names = teams.map(t => t.name);
  const stats = {};
  for (const n of names) stats[n] = { top8: 0, first: 0, final: 0, champ: 0, posSum: 0 };

  const focus = cfg.focus;
  const nextIdx = focus ? fixtures.findIndex(f => f.home === focus || f.away === focus) : -1;
  const cond = { W: { n: 0, top8: 0, champ: 0 }, D: { n: 0, top8: 0, champ: 0 }, L: { n: 0, top8: 0, champ: 0 } };

  for (let i = 0; i < cfg.sims; i++) {
    const table = {};
    const tieKey = {};
    for (const t of teams) {
      table[t.name] = { name: t.name, pj: t.pj, pts: 3 * t.g + t.e, gf: t.gf, gc: t.gc };
      tieKey[t.name] = rand();
    }
    let focusRes = null;
    fixtures.forEach((f, idx) => {
      const [gh, ga] = playMatch(f.home, f.away, model, cfg, rand);
      apply(table, f.home, f.away, gh, ga);
      if (idx === nextIdx) {
        const forFocus = f.home === focus ? gh - ga : ga - gh;
        focusRes = forFocus > 0 ? 'W' : forFocus < 0 ? 'L' : 'D';
      }
    });

    const ranked = rankLeague(Object.values(table), tieKey);
    const leaguePos = {};
    ranked.forEach((r, p) => { leaguePos[r.name] = p; stats[r.name].posSum += p + 1; });
    stats[ranked[0].name].first++;
    const top = ranked.slice(0, cfg.qualifiers).map(r => r.name);
    for (const n of top) stats[n].top8++;

    const [A, B] = drawGroups(top, rand);
    const wa = playGroup(A, model, cfg, rand, leaguePos);
    const wb = playGroup(B, model, cfg, rand, leaguePos);
    stats[wa].final++; stats[wb].final++;
    const champ = playFinal(wa, wb, model, cfg, rand, leaguePos);
    stats[champ].champ++;

    if (focusRes) {
      const c = cond[focusRes];
      c.n++;
      if (top.includes(focus)) c.top8++;
      if (champ === focus) c.champ++;
    }
  }

  const N = cfg.sims;
  const table = names.map(n => ({
    name: n,
    top8: stats[n].top8 / N,
    first: stats[n].first / N,
    final: stats[n].final / N,
    champ: stats[n].champ / N,
    avgPos: stats[n].posSum / N,
  })).sort((a, b) => b.champ - a.champ || b.top8 - a.top8);

  let nextMatch = null;
  if (nextIdx >= 0) {
    const f = fixtures[nextIdx];
    const pct = c => c.n ? { share: c.n / N, top8: c.top8 / c.n, champ: c.champ / c.n } : null;
    nextMatch = { home: f.home, away: f.away, W: pct(cond.W), D: pct(cond.D), L: pct(cond.L) };
  }
  return { table, nextMatch, mu: model.mu };
}

// Registra un resultado real: lo suma a la tabla y lo saca de los pendientes.
export function recordResult(teams, fixtures, idx, gh, ga) {
  const f = fixtures[idx];
  const upd = teams.map(t => ({ ...t }));
  const H = upd.find(t => t.name === f.home), A = upd.find(t => t.name === f.away);
  H.pj++; A.pj++;
  H.gf += gh; H.gc += ga; A.gf += ga; A.gc += gh;
  if (gh > ga) { H.g++; A.p++; } else if (gh < ga) { A.g++; H.p++; } else { H.e++; A.e++; }
  return { teams: upd, fixtures: fixtures.filter((_, i) => i !== idx) };
}
