# Nacional Campeón

App web que calcula la probabilidad de que Atlético Nacional (o cualquier equipo que elijas) gane la Liga BetPlay, y la recalcula cada vez que registras un resultado.

## Cómo usarla

Necesitas Node 22.9 o más nuevo.

```bash
npm install
cp .env.example .env     # y pon tu key en TYPESAFE_API_KEY (opcional, solo para Jev)
npm start                # http://localhost:8000
npm test
```

Sin key la app funciona igual, solo con el modelo de goles.

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

## Jev (TypeSafe)

Jev aporta lo que la tabla no ve: lesiones, suspensiones, rotaciones por Copa, cambio de técnico.

1. En cada partido pendiente puedes escribir un **contexto** (opcional).
2. **Consultar a Jev** manda en una sola petición la tabla y los partidos del equipo elegido, más los que tengan contexto (máximo 40). Por cada partido Jev responde una probabilidad de local, empate y visitante (pregunta tipo `choice`).
3. La simulación mezcla esa probabilidad con la del modelo de goles. El peso se ajusta en **Modelo y respaldo** (50% por defecto). Con 0% Jev no influye.

Seguridad:

- La key va solo en la variable de entorno `TYPESAFE_API_KEY` (archivo `.env`, que está en `.gitignore`). El navegador nunca la ve: habla con `server/index.mjs` y este con TypeSafe.
- `JEV_ENABLED=0` apaga Jev sin quitar la key.
- La app no manda datos personales, solo nombres de equipos, la tabla y las notas que escribas.

La integración se probó contra un servidor falso que imita la API de TypeSafe. Falta probarla con la API real.

## Formato simulado (verificar contra el reglamento vigente de la Dimayor)

- Clasifican los 8 primeros. Desempate en la tabla: puntos, diferencia de gol, goles a favor y luego sorteo.
- Dos cuadrangulares de 4, ida y vuelta. 1º y 2º son cabeza de grupo, y las parejas 3º-4º, 5º-6º y 7º-8º se reparten al azar entre los grupos. Sin puntos de bonificación.
- Los ganadores de grupo juegan la final de ida y vuelta. Cierra de local el mejor ubicado en la fase regular. Empate en el global: penales 50/50.

Estos supuestos están en `app/sim.js` y son fáciles de cambiar si el reglamento de 2026 dice otra cosa.

## Archivos

- `app/sim.js`: motor de simulación (sin dependencias, se puede probar con Node).
- `server/index.mjs`: servidor local que sirve la app y guarda la key de TypeSafe.
- `server/jev.mjs`: arma la consulta a Jev y lee sus respuestas.
- `app/app.js`: interfaz.
- `app/index.html`: página y estilos.
- `test/`: pruebas del motor y de la consulta a Jev.
