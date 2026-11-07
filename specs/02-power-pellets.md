# SPEC 02 — Power pellets con animación de puntuación

> **Estado:** Implementado
> **Depende de:** SPEC 01 (Cuatro fantasmas con IA clásica arcade) — ya implementado
> **Fecha:** 2026-11-06
> **Objetivo:** 4 power pellets en el laberinto (posiciones arcade) que valen 50 puntos y muestran un '+50' flotante justo donde se comieron.

## Scope

**In:**

- Añadir el tile `4` (power pellet) al laberinto: `maze.js` lo parsea desde el carácter `O` en `MAZE_STR`.
- 4 pellets en las celdas arcade: (1, 3), (26, 3), (1, 23), (26, 23). Todas eran dots y siguen transitables.
- Pellet gráfico: círculo grande (~6 px de radio) color `#ffb897` que parpadea (encendido/apagado con el frame).
- Comer un pellet: +50 puntos, el tile pasa a `0`, `dotsRemaining--`.
- Animación '+50' flotante: al comer el pellet aparece el texto '+50' en el centro exacto de esa celda, sube ~6 px y se desvanece durante 60 frames (~1 s a 60 fps), luego desaparece.
- Los pellets cuentan para ganar: `dotsRemaining` también cuenta pellets, así que el nivel se gana solo comiendo todos los dots y los 4 pellets.

**Out of scope (para futuros specs):**

- Modo asustado de los fantasmas (fantasmas azules y comibles). El SPEC 01 también lo dejó fuera; va en su propio spec.
- Efectos adicionales para dots normales: el '+10' flotante NO se hace (solo pellets).
- Destello/onda/explosión visual en el punto de comida. El '+50' flotante es el único efecto.
- Sonido.
- Bonus de frutas u otros pickups.

## Data model

```js
// maze.js — parseTile añade:
if ( ch === 'O' ) return 4;   // power pellet

// game.js — estado nuevo en createGame():
floaters: [],   // cada pellet comido añade { x, y, born: game.frame }
                // x, y: celda donde se comio. born: frame de nacimiento.

// game.js — constantes:
const FLOAT_LIFETIME = 60; // frames (~1 s)
const PELLET_POINTS = 50;
```

- `dotsRemaining` sigue siendo un único contador y **también cuenta pellets**: `createGame()` suma tiles `2` y `4`. No se añade un contador aparte.

## Implementation plan

1. `src/js/maze.js`: `parseTile` reconoce `O` → `4`; reemplazar los 4 dots de las celdas (1,3), (26,3), (1,23), (26,23) por `O` en `MAZE_STR`. Comprobación manual: abrir el juego y ver 4 puntos grandes en las esquinas (aún estáticos → con parpadeo si el render ya está en este paso).

2. `src/js/render.js`: `drawPellets(ctx, grid, frame)` — círculo de radio 6 px, color `#ffb897`, parpadea (visible ~11 frames, oculto ~11 frames, con `frame % 22 < 11`). Llamarlo desde `draw()` después de `drawDots()`; `drawDots` sigue dibujando solo el tile `2`. Comprobación: los pellets parpadean, los dots normales no cambian.

3. `src/js/game.js`: comer pellet y contador — en `createGame()`, contar tiles `2` y `4` en `dotsRemaining`; en `movePacman()`, al pisar un tile `4`: sumar 50 puntos, tile a `0`, `dotsRemaining--`. Comprobación: comer un pellet suma 50 (no 10), y el nivel ya no se gana con todos los dots si queda algún pellet.

4. `src/js/game.js`: animación — constantes `PELLET_POINTS = 50` y `FLOAT_LIFETIME = 60`; al comer pellet añadir `{ x, y, born: game.frame }` a `game.floaters` (estado nuevo `floaters: []` en `createGame()`); en `update()` purgar los que superan `FLOAT_LIFETIME`. Comprobación: consola sin errores y `createGame()` devuelve `floaters: []`.

5. `src/js/render.js`: `drawFloaters(ctx, game, frame)` — por cada floater de edad `age = frame - born`, dibujar `+50` con `textAlign: center`, subiendo unos 6 px a lo largo del lifetime y con alpha decreciente hasta 0 al final. Llamarlo desde `draw()` encima de todo (después de los fantasmas, antes del HUD). Comprobación: comer un pellet muestra '+50' en ese sitio que sube y se desvanece en ~1 s.

6. Revisión final manual: partida completa; consola sin errores, criterios de aceptación.

## Acceptance criteria

- [ ] El juego carga y la consola no muestra errores.
- [ ] Aparecen exactamente 4 pellets grandes en las celdas (1,3), (26,3), (1,23) y (26,23), simétricos respecto al eje vertical del laberinto.
- [ ] Los pellets parpadean y los dots normales se ven como antes.
- [ ] Comer un pellet suma exactamente 50 puntos, y un dot normal sigue sumando exactamente 10.
- [ ] Al comer un pellet aparece el texto '+50' en el centro exacto de la celda donde estaba, sube y se desvanece hasta desaparecer en ~1 segundo; después ya no se ve.
- [ ] Comer un dot normal NO genera ningún texto flotante.
- [ ] El nivel NO se gana con todos los dots comidos si queda un pellet sin comer; sí se gana al comer el último ítem (dot o pellet) que vacía el contador.
- [ ] Al perder una vida, los pellets ya comidos no reaparecen y los que quedan siguen en su sitio.

## Decisions

- **Sí:** pellets sin modo asustado. La petición del usuario fue solo puntos + animación; el modo asustado es un spec propio (el SPEC 01 ya lo dejaba fuera).
- **Sí:** tile numérico `4` para el pellet. Igual patrón de codificación que el dot (`2`) y la puerta (`3`); el render y el conteo ya iteran el grid.
- **Sí:** posiciones arcade (filas 3 y 23, columnas 1 y 26). Elegida por el usuario entre las opciones; fiel al original y simétrica.
- **Sí:** parpadeo del pellet con `frame` del render. Es lo fiel al arcade y no añade estado.
- **Sí:** '+50' flotante durante 60 frames (~1 s), subiendo ~6 px y con alpha que baja a 0. Opción recomendada y elegida por el usuario.
- **Sí:** un solo contador `dotsRemaining` que también cuenta pellets. Evita un segundo contador y la condición de victoria se mantiene en una línea.
- **No:** contador separado `pelletsRemaining`. Redundante con la decisión anterior.
- **No:** renombrar `dotsRemaining` a algo más genérico. Menos diff; se documenta aquí que cuenta ambos.
- **No:** '+10' flotante para los dots normales. El usuario pidió la animación solo para pellets; un floater por cada dot sería ruido visual constante.
- **No:** destello/onda/explosión en el punto de comida. El usuario eligió solo el '+50' flotante.
- **Sí:** la animación va por `game.frame` (la unidad de tiempo del juego), sin `setTimeout` ni relojes externos. Consistente con el resto del código.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El '+50' se congela en pantalla si la partida se gana o se pierde justo mientras flota (en esos estados `update()` ya no corre) | Aceptado: el overlay de GANASTE/PERDISTE tapa el tablero, y al reiniciar `createGame()` lo borra. |
| El pellet (1,23) queda en la misma fila que el inicio de Pac-Man (13,23) | No es problema: la celda es transitable; el pellet es solo un pickup, no bloquea. |

## What is **not** in this spec

- Modo asustado de los fantasmas (fantasmas azules comibles).
- '+10' flotante o cualquier efecto al comer dots normales.
- Destello/onda/explosión al comer un pellet.
- Sonido y música.

Cada uno de esos, si llega, va en su propio spec.
