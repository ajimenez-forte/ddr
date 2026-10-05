// Pregunta a Jev (TypeSafe) por el resultado probable de partidos pendientes.
// Una sola petición: la tabla y los partidos van en el estado, y cada partido
// es una pregunta de tipo choice (local / empate / visitante).
import { choice } from '@typesafe-ai/sdk';

export const MAX_FIXTURES = 40;
const MAX_NOTE = 600;

const clean = (s, n = 80) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function buildRequest(table, fixtures) {
  if (!Array.isArray(table) || table.length < 2) throw new Error('Falta la tabla.');
  if (!Array.isArray(fixtures) || !fixtures.length) throw new Error('No hay partidos para consultar.');
  if (fixtures.length > MAX_FIXTURES) throw new Error(`Máximo ${MAX_FIXTURES} partidos por consulta.`);

  const tabla = table.map((t, i) => ({
    posicion: i + 1,
    equipo: clean(t.name),
    jugados: +t.pj || 0, ganados: +t.g || 0, empatados: +t.e || 0, perdidos: +t.p || 0,
    goles_a_favor: +t.gf || 0, goles_en_contra: +t.gc || 0,
    puntos: 3 * (+t.g || 0) + (+t.e || 0),
  }));
  const names = new Set(tabla.map(t => t.equipo));
  const partidos = fixtures.map(f => {
    const home = clean(f.home), away = clean(f.away);
    if (!names.has(home) || !names.has(away)) throw new Error(`Equipo desconocido en ${home} - ${away}.`);
    const p = { local: home, visitante: away };
    const note = clean(f.note, MAX_NOTE);
    if (note) p.contexto = note;
    return p;
  });

  const questions = {};
  partidos.forEach((p, i) => {
    questions[`p${i}`] = choice(
      {
        tarea: `Pronostica el resultado del partido \`partidos[${i}]\` de la Liga BetPlay de Colombia: ${p.local} de local contra ${p.visitante}.`,
        tener_en_cuenta: [
          'El rendimiento de ambos equipos en `tabla` (puntos, goles a favor y en contra por partido jugado).',
          'La ventaja de jugar de local en el fútbol colombiano.',
          'El campo `contexto` del partido si existe: lesiones, suspensiones, rotaciones, cambios de técnico u otros hechos que la tabla no muestra.',
        ],
      },
      {
        local: `Gana ${p.local}, el equipo local.`,
        empate: 'El partido termina empatado.',
        visitante: `Gana ${p.visitante}, el equipo visitante.`,
      },
    );
  });

  return {
    state: {
      torneo: 'Liga BetPlay (Colombia), fase todos contra todos',
      tabla,
      partidos,
    },
    questions,
  };
}

export function parseAnswers(fixtures, answers) {
  return fixtures.map((f, i) => {
    const a = answers[`p${i}`];
    return {
      id: f.id,
      home: a.probabilities.local,
      draw: a.probabilities.empate,
      away: a.probabilities.visitante,
      confidence: a.confidence,
    };
  });
}
