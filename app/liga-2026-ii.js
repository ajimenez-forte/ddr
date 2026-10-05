// Tabla real de la Liga BetPlay 2026-II (Clausura), transcrita de una captura
// de Google que compartió el usuario el 5 de octubre de 2026.
// Verificado: G+E+P = PJ, 3G+E = Pts y GF-GC = DG en las 20 filas.
export const LIGA_2026_II = {
  fuente: 'Tabla de Google (Categoría Primera A, Clausura), 5 de octubre de 2026',
  // Partidos de fase regular por equipo: 19 fechas todos contra todos + fecha de clásicos.
  // Supuesto sin verificar contra el reglamento.
  totalMatches: 20,
  teams: [
    ['América de Cali', 12, 8, 3, 1, 24, 7],
    ['Deportivo Cali', 12, 7, 3, 2, 20, 9],
    ['Atlético Bucaramanga', 11, 6, 5, 0, 20, 10],
    ['Atlético Nacional', 10, 7, 1, 2, 21, 10],
    ['Millonarios', 13, 5, 6, 2, 18, 11],
    ['Independiente Medellín', 11, 6, 2, 3, 19, 15],
    ['Santa Fe', 11, 5, 4, 2, 18, 12],
    ['Deportes Tolima', 12, 5, 4, 3, 15, 13],
    ['Cúcuta Deportivo', 12, 4, 3, 5, 15, 19],
    ['Llaneros', 12, 4, 2, 6, 15, 16],
    ['Águilas Doradas', 11, 3, 5, 3, 14, 15],
    ['Once Caldas', 12, 3, 4, 5, 15, 16],
    ['Internacional de Bogotá', 13, 2, 7, 4, 14, 18],
    ['Boyacá Chicó', 11, 3, 3, 5, 10, 18],
    ['Alianza Valledupar', 12, 3, 2, 7, 12, 24],
    ['Fortaleza', 12, 1, 7, 4, 13, 18],
    ['Junior', 11, 2, 3, 6, 16, 20],
    ['Deportivo Pasto', 12, 2, 3, 7, 9, 18],
    ['Deportivo Pereira', 11, 1, 5, 5, 7, 17],
    ['Jaguares de Córdoba', 11, 1, 4, 6, 11, 20],
  ].map(([name, pj, g, e, p, gf, gc]) => ({ name, pj, g, e, p, gf, gc, ajuste: 1 })),
  // Partidos que le faltan a Nacional según una búsqueda web (resumen de
  // vavel.com / GolCaracol). Sin verificar: confirmar contra el calendario oficial.
  fixtures: [
    ['Atlético Nacional', 'Millonarios'],
    ['Atlético Nacional', 'Junior'],
    ['Atlético Nacional', 'Deportes Tolima'],
    ['Atlético Nacional', 'Deportivo Pasto'],
    ['Boyacá Chicó', 'Atlético Nacional'],
    ['Cúcuta Deportivo', 'Atlético Nacional'],
    ['Atlético Nacional', 'Independiente Medellín'],
    ['Atlético Bucaramanga', 'Atlético Nacional'],
    ['Atlético Nacional', 'Deportivo Pereira'],
    ['Atlético Nacional', 'Once Caldas'],
  ].map(([home, away]) => ({ home, away })),
};
