import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, parseAnswers } from '../server/jev.mjs';

const table = [
  { name: 'Atlético Nacional', pj: 10, g: 6, e: 2, p: 2, gf: 18, gc: 8 },
  { name: 'Rival A', pj: 10, g: 3, e: 3, p: 4, gf: 10, gc: 12 },
];

test('arma una pregunta choice por partido con el contexto en el estado', () => {
  const req = buildRequest(table, [{ id: 'x', home: 'Rival A', away: 'Atlético Nacional', note: 'Nacional sin su goleador' }]);
  assert.deepEqual(Object.keys(req.questions), ['p0']);
  assert.equal(req.questions.p0.type, 'choice');
  assert.deepEqual(Object.keys(req.questions.p0.criteria), ['local', 'empate', 'visitante']);
  assert.equal(req.state.partidos[0].contexto, 'Nacional sin su goleador');
  assert.equal(req.state.tabla[0].puntos, 20);
});

test('rechaza equipos que no están en la tabla', () => {
  assert.throws(() => buildRequest(table, [{ home: 'Otro', away: 'Rival A' }]), /desconocido/);
});

test('convierte las respuestas en probabilidades por partido', () => {
  const out = parseAnswers([{ id: 'x' }], { p0: { probabilities: { local: 0.3, empate: 0.3, visitante: 0.4 }, confidence: 0.4 } });
  assert.deepEqual(out[0], { id: 'x', home: 0.3, draw: 0.3, away: 0.4, confidence: 0.4 });
});
