import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, recordResult } from '../app/sim.js';

// Liga ficticia para pruebas: 10 equipos, nombres genéricos.
function liga(n = 10) {
  return Array.from({ length: n }, (_, i) => ({
    name: `E${i + 1}`, pj: 5, g: Math.max(0, 4 - Math.floor(i / 2)), e: 1,
    p: 5 - 1 - Math.max(0, 4 - Math.floor(i / 2)), gf: 10 - i, gc: 3 + i,
  }));
}
function calendario(teams) {
  const f = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      f.push({ home: teams[i].name, away: teams[j].name });
  return f;
}

test('las probabilidades suman lo que deben', () => {
  const t = liga();
  const r = simulate(t, calendario(t), { sims: 3000, focus: 'E1' });
  const sum = k => r.table.reduce((s, x) => s + x[k], 0);
  assert.ok(Math.abs(sum('champ') - 1) < 1e-9);
  assert.ok(Math.abs(sum('first') - 1) < 1e-9);
  assert.ok(Math.abs(sum('final') - 2) < 1e-9);
  assert.ok(Math.abs(sum('top8') - 8) < 1e-9);
});

test('el equipo más fuerte es favorito', () => {
  const t = liga();
  const r = simulate(t, calendario(t), { sims: 3000 });
  const p = n => r.table.find(x => x.name === n).champ;
  assert.ok(p('E1') > p('E10'));
});

test('sin partidos pendientes, quien está fuera del top 8 tiene 0%', () => {
  const t = liga();
  const r = simulate(t, [], { sims: 500 });
  assert.equal(r.table.find(x => x.name === 'E10').top8, 0);
  assert.equal(r.table.find(x => x.name === 'E10').champ, 0);
});

test('recordResult actualiza tabla y saca el partido', () => {
  const t = liga();
  const f = calendario(t);
  const { teams, fixtures } = recordResult(t, f, 0, 2, 1);
  assert.equal(fixtures.length, f.length - 1);
  const e1 = teams.find(x => x.name === 'E1');
  assert.equal(e1.g, t[0].g + 1);
  assert.equal(e1.gf, t[0].gf + 2);
  assert.equal(teams.find(x => x.name === 'E2').p, t[1].p + 1);
});

test('el análisis del próximo partido es coherente', () => {
  const t = liga();
  const r = simulate(t, calendario(t), { sims: 4000, focus: 'E5' });
  const m = r.nextMatch;
  assert.ok(m);
  assert.ok(Math.abs(m.W.share + m.D.share + m.L.share - 1) < 1e-9);
  assert.ok(m.W.top8 >= m.L.top8);
});

test('matchProbs suma 1 y favorece al más fuerte', async () => {
  const { strengths, matchProbs } = await import('../app/sim.js');
  const t = liga();
  const p = matchProbs('E1', 'E10', strengths(t));
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-9);
  assert.ok(p.home > p.away);
});

test('un pronóstico de Jev con peso 1 manda en el resultado del partido', () => {
  const t = liga();
  // E10 (el más débil) recibe a E1, pero Jev dice que E10 gana seguro.
  const fx = [{ home: 'E10', away: 'E1', jev: { home: 1, draw: 0, away: 0 } }];
  const r = simulate(t, fx, { sims: 300, jevWeight: 1, focus: 'E10' });
  assert.equal(r.nextMatch.W.share, 1);
  const r0 = simulate(t, fx, { sims: 300, jevWeight: 0, focus: 'E10' });
  assert.ok(r0.nextMatch.W.share < 1);
});
