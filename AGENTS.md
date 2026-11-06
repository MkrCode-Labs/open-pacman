# AGENTS.md

## Proyecto

Juego Pac-Man en Vanilla JS + Canvas. Sin build, sin dependencias, sin tests ni linters — no busques `package.json` ni comandos: no existen.

## Ejecutar y verificar

- Entrada: `src/index.html`. Verificar abriéndolo en el navegador o con un servidor estático: `npx serve src` / `python -m http.server -d src`.
- La única "verificación" posible es manual: jugar en el navegador y comprobar consola sin errores.

## Estructura y quirks del código

- Scripts clásicos (no módulos): **no usar `import`/`export` ni añadir `type="module"`**. Todo se comparte por globals: `createGame`/`update` (game.js), `draw` (render.js), grid del laberinto (maze.js), bucle/teclado/overlays (main.js).
- El orden de `<script>` en `index.html` importa: maze.js → game.js → render.js → main.js. Cualquier archivo nuevo debe insertarse ahí en el lugar correcto.
- Movimiento por celdas (grid) con fracciones unidad/frame: `PACMAN_SPEED = 0.125`, `GHOST_SPEED = 0.1` alineados a 8 y 10 frames. Cambiar velocidades puede desalinear el movimiento con el grid.
- Canvas fijo 560×620 (`index.html`); el grid y el render lo asumen.
- Estado del juego: `'playing' | 'won' | 'lost'` en `game.state`; reinicio recrea el juego con `createGame()`.

## Workflow spec-driven

- El desarrollo se maneja con los skills `/spec` y `/spec-impl` (ver `.agents/skills/`). Los specs van en `specs/NN-slug.md` (numeración secuencial, sin carpeta `specs/` aún).
- Un spec solo se implementa tras estado "Approved/Aprobado" — que lo marca el usuario, nunca el agente. Nunca commitear automáticamente; una rama por spec: `spec-NN-slug`.
- Durante `/spec-impl`: implementar paso a paso del plan, pausar tras cada paso para revisión del diff.

## Idioma

- UI, README y specs en **español**; identificadores de código en inglés (states `'playing'`/`'won'`, etc., ya son así). Responder al usuario en su idioma.
- Estilo existente: espacios dentro de paréntesis — `foo( bar )`. Mantener consistencia.
