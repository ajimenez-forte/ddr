# Nacional Campeón

App web que calcula la probabilidad de que Atlético Nacional (o cualquier equipo que elijas) gane la Liga BetPlay, y la recalcula cada vez que registras un resultado.

## Cómo usarla

```bash
npm start        # sirve la app en http://localhost:8000
npm test         # pruebas del motor de simulación
```

1. En **Tabla actual** pega la tabla real: una línea por equipo, `Equipo PJ G E P GF GC`.
2. En **Partidos pendientes** pega los partidos que faltan de la fase regular, uno por línea: `Local - Visitante`.
3. Cuando termine un partido, escribe el marcador y pulsa **Registrar**. La tabla se actualiza, las probabilidades se recalculan y la gráfica agrega un punto.

La app abre con datos de ejemplo **ficticios** (Nacional y 19 rivales genéricos) para mostrar cómo funciona. No son la tabla real.

Los datos se guardan en el navegador (`localStorage`). Usa **Modelo y respaldo → Copiar respaldo** para guardarlos aparte.

## Modelo

- **Fuerza de cada equipo**: goles a favor y en contra por partido, mezclados con 5 partidos del promedio de la liga para que una racha corta no pese de más. El campo *Ajuste* permite subir o bajar a un equipo a mano.
- **Partidos**: los goles de local y visitante se sortean con una distribución de Poisson. El local tiene un multiplicador de 1.15 (configurable) y el visitante 0.87.
- **Monte Carlo**: se juega 10.000 veces lo que falta del torneo (fase regular, cuadrangulares y final) y se cuenta cuántas veces gana cada equipo.
- **Próximo partido**: muestra la probabilidad de campeón si Nacional gana, empata o pierde su siguiente partido.

## Formato simulado (verificar contra el reglamento vigente de la Dimayor)

- Clasifican los 8 primeros. Desempate en la tabla: puntos, diferencia de gol, goles a favor y luego sorteo.
- Dos cuadrangulares de 4, ida y vuelta. 1º y 2º son cabeza de grupo, y las parejas 3º-4º, 5º-6º y 7º-8º se reparten al azar entre los grupos. Sin puntos de bonificación.
- Los ganadores de grupo juegan la final de ida y vuelta. Cierra de local el mejor ubicado en la fase regular. Empate en el global: penales 50/50.

Estos supuestos están en `app/sim.js` y son fáciles de cambiar si el reglamento de 2026 dice otra cosa.

## Archivos

- `app/sim.js`: motor de simulación (sin dependencias, se puede probar con Node).
- `app/app.js`: interfaz.
- `app/index.html`: página y estilos.
- `test/sim.test.mjs`: pruebas.
