# SPEC 03 — Modo asustado: fantasmas comibles

> **Estado:** Implementado
> **Depende de:** SPEC 01 (Cuatro fantasmas con IA clásica arcade) y SPEC 02 (Power pellets) — ambos implementados
> **Fecha:** 2026-11-06
> **Objetivo:** Al comer un power pellet los fantasmas se vuelven azules, huyen más lento y son comibles durante ~6 s, devolviendo puntos en cadena 200/400/800/1600 y reapareciendo en su spawn.

## Scope

**In:**

- Al comer un power pellet (tile `4`), activar modo asustado global de ~6 s (360 frames): todos los fantasmas, dentro o fuera de la pen, pasan a asustados.
- Fantasmas asustados: color azul arcade (`#2121de`), velocidad reducida (`1/25` celda/frame frente a la normal `1/20`) y comportamiento de huida (maximizar la distancia a Pac-Man en cada intersección).
- En los últimos ~2 s (120 frames), los fantasmas asustados parpadean azul/blanco avisando de que el modo termina; al expirar vuelven a color, velocidad y personalidad normales.
- Chocar con un fantasma asustado lo come: gana puntos en cadena — 200, 400, 800, 1600 (se duplica por fantasma comido dentro del mismo periodo, tope 1600).
- Aparece un floater '+200'/'+400'/'+800'/'+1600' reutilizando el sistema de `game.floaters` del SPEC 02.
- El fantasma comido reaparece por teletransporte en su celda de `GHOST_STARTS`, sale de la pen de inmediato (sin esperar) y queda **inmune** hasta el fin del modo asustado: ni se le puede volver a comer ni le quita vida.
- Comer otro power pellet mientras el modo está activo reinicia el timer a 360 frames y la cadena de puntos vuelve a 200.
- Fantasmas que están en la pen al comerse el pellet salen después ya asustados (su objetivo dentro de la pen sigue siendo la salida).
- Al perder una vida (`resetPositions`) el modo asustado se cancela por completo.

**Out of scope (para futuros specs):**

- Modo ojos (los ojos viajan solos hasta la pen): va por teletransporte, decisión del usuario.
- Ciclos scatter/chase alternados.
- Dificultad por nivel (duración decreciente del asustado).
- Sonido, música y efectos de sonido.
- Bonus de frutas u otros pickups.

## Data model

```js
// game.js — constantes nuevas
const FRIGHT_FRAMES = 360;      // ~6 s de modo asustado
const FRIGHT_SPEED = 0.04;      // 1/25 celda/frame (más lento que GHOST_SPEED)
const FRIGHT_FLASH_FRAMES = 120;// últimos ~2 s: parpadeo
const GHOST_POINTS_BASE = 200;  // cadena 200 -> 400 -> 800 -> 1600

// game.js — estado nuevo por partida, en createGame():
frightUntil: 0,   // frame en el que expira el modo; 0 = inactivo
frightChain: 0,   // fantasmas comidos en el periodo de asustado actual

// game.js — estado nuevo por fantasma (en el map de GHOST_STARTS):
frightened: false, // azul, comible y huye
immune: false,     // devorado: ni comible ni letal hasta el fin del asustado
// g.speed desaparece del fantasma: moveGhost calcula
// g.frightened ? FRIGHT_SPEED : GHOST_SPEED

// render.js — constantes nuevas
const FRIGHT_COLOR = '#2121de';       // azul arcade
const FRIGHT_FLASH_COLOR = '#ffffff'; // parpadeo final
```

- `game.frame` sigue siendo el único reloj; el timer es comparación de frames, sin `setTimeout`.
- Los floaters ganan un campo opcional `text`: los pellets empujan `text: '+50'` y el fantasma comido empuja `text: '+' + puntos`. `drawFloaters` usa `f.text` y cae a `'+' + PELLET_POINTS` si no existe.

## Implementation plan

1. `src/js/game.js`: constantes `FRIGHT_FRAMES`, `FRIGHT_SPEED`, `FRIGHT_FLASH_FRAMES`, `GHOST_POINTS_BASE`; en `createGame()` añadir `frightUntil: 0`, `frightChain: 0` y por fantasma `frightened: false`, `immune: false`; quitar `speed` de los ghosts. Comprobación manual: consola → `createGame()` muestra los campos nuevos.

2. `src/js/game.js`: en `movePacman()`, al pisar un tile `4`, además de lo actual: `game.frightUntil = game.frame + FRIGHT_FRAMES`, `game.frightChain = 0`, y para cada fantasma `frightened = true`, `immune = false`. En `moveGhost()` usar `g.frightened ? FRIGHT_SPEED : GHOST_SPEED`. Comprobación: comer un pellet cambia los flags en consola y se nota que los fantasmas van más despacio.

3. `src/js/game.js`: huida — nueva función `chooseFlee( game, g )` que sobre `legalChoices` elige la dirección que **maximiza** la distancia Manhattan a Pac-Man (simétrico a `chooseToTarget`). En `decideGhost()`: si `inPen( g )` → objetivo salida como ya existe; si no, si `g.frightened` → `chooseFlee`; si no → personalidad actual. Comprobación: tras comer un pellet los fantasmas se alejan de Pac-Man en cada intersección.

4. `src/js/game.js`: comer fantasma — en el bucle de colisiones de `update()`: si `g.frightened` → `puntos = GHOST_POINTS_BASE << Math.min( game.frightChain, 3 )`, sumar a `score`, `frightChain++`, push a `game.floaters` con `{ x, y, born: game.frame, text: '+' + puntos }`, y teletransportar: `x/y` de `GHOST_STARTS`, `dir: 'up'`, `frightened: false`, `immune: true`, `releaseAt: game.frame` (sale enseguida porque está en la pen). Si no está `frightened` ni `immune` → perder vida como ahora. Si `immune` → nada. Comprobación: comer un asustado suma 200, aparece el floater (sin render de texto distinto aún) y el fantasma reaparece y sale por la puerta.

5. `src/js/game.js`: fin del modo y reset — en `update()`, si `game.frightUntil && game.frame >= game.frightUntil`: `frightened = false` e `immune = false` en todos y `frightUntil = 0`. En `resetPositions()`: lo mismo (`frightUntil = 0`, `frightChain = 0`, flags a `false`). Comprobación: pasados ~6 s los fantasmas recuperan su comportamiento normal; al perder vida el modo se cancela.

6. `src/js/render.js`: pintar asustados — en `draw()`, por fantasma: `color = g.frightened ? ... : GHOST_COLORS[ i ]`; si `g.immune` pintarlo en su color normal; si `frightened` azul `FRIGHT_COLOR`, salvo en el parpadeo final (`frightUntil - game.frame < FRIGHT_FLASH_FRAMES` y `game.frame % 10 < 5`) que usa `FRIGHT_FLASH_COLOR`. En `drawFloaters()` usar `f.text ?? '+' + PELLET_POINTS`. Comprobación: fantasmas azules parpadeando al final, '+200' flotante con su valor, los ya devorados se pintan normales.

7. Revisión final manual: partida completa comiendo pellets y fantasmas, consola sin errores, criterios de aceptación.

## Acceptance criteria

- [ ] El juego carga y la consola no muestra errores.
- [ ] Al comer un power pellet los 4 fantasmas (dentro y fuera de la pen) se pintan de azul durante el modo asustado.
- [ ] Los fantasmas asustados se mueven visiblemente más lento que en estado normal.
- [ ] Un fantasma asustado siempre elige, en cada intersección, la dirección que aumenta (o mantiene por empate) su distancia a Pac-Man — nunca la reduce.
- [ ] Los fantasmas que estaban en la pen al comerse el pellet salen de ella en modo asustado.
- [ ] Chocar con un fantasma asustado NO resta vida; suma 200 el primero, 400 el segundo, 800 el tercero y 1600 el cuarto dentro del mismo periodo.
- [ ] Al comer un fantasma aparece un floater con el valor exacto ('+200', '+400', '+800' o '+1600') sobre la celda donde se lo comieron, que sube y se desvanece como el '+50'.
- [ ] El fantasma comido reaparece en su celda de `GHOST_STARTS`, sale de la pen de inmediato y mientras dure el asustado no lo pueden comer ni le quita vida.
- [ ] Comer un segundo pellet reinicia el timer a ~6 s y la cadena de puntos vuelve a 200.
- [ ] En los últimos ~2 s los fantasmas asustados parpadean azul/blanco; al terminar el modo recuperan color, velocidad y personalidad normales.
- [ ] Chocar con un fantasma normal (no asustado) sigue restando vida y reseteando posiciones como hasta ahora.
- [ ] Al perder una vida, el modo asustado se cancela completamente (sin fantasmas azules tras el reset).
- [ ] El '+50' de los pellets sigue funcionando exactamente como en el SPEC 02.

## Decisions

- **Sí:** flags por fantasma (`frightened`, `immune`) en lugar de derivarlos del timer global. El "inmune hasta fin de asustado" que pidió el usuario no se puede expresar solo con `frightUntil`.
- **Sí:** timer por frames (`frightUntil`) sin `setTimeout`. Consistente con `game.frame`, el reloj único de la partida (SPEC 01).
- **Sí:** teletransporte a la celda de spawn y salida inmediata. Elección del usuario; evita la máquina de estados de los ojos del arcade.
- **No:** modo ojos. Más fiel pero más código y más estados; puede ser su propio spec.
- **Sí:** velocidad asustada `FRIGHT_SPEED = 0.04` (1/25). Múltiplo 1/n como `PACMAN_SPEED`/`GHOST_SPEED`, no rompe el movimiento alineado al grid.
- **Sí:** huida por greedy Manhattan maximizando distancia, utilizando `legalChoices` tal cual. Simétrico a `chooseToTarget`, ~10 líneas, sin pathfinding ni aleatoriedad.
- **No:** huida aleatoria o pathfinding A*. Innecesario y más difícil de verificar.
- **Sí:** fantasmas de la pen también se asustan y salen azules. Elección del usuario; comportamiento dentro de la pen sin cambios (objetivo: salida).
- **Sí:** cadena de puntos por periodo de asustado, reseteada por cada pellet nuevo. Es el comportamiento arcade de 1980.
- **Sí:** parpadeo azul/blanco en los últimos 120 frames. Detalle visual barato que avisa del fin del modo.
- **Sí:** reutilizar `game.floaters` con campo `text` opcional. DRY: el sistema del SPEC 02 ya hace posición, subida y desvanecido.
- **Sí:** quitar `g.speed` de los fantasmas y calcular la velocidad en `moveGhost` con el flag. Evita sincronizar dos estados al activar/desactivar el modo.
- **Sí:** `resetPositions` cancela el asustado. Al reiniciar el frame a 0, un `frightUntil` activo quedaría corrupto; limpiarlo es lo correcto.
- **No:** duración decreciente por nivel. La dificultad por niveles no existe aún (fuera en SPEC 01); sería su propio spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La huida greedy puede oscilar en intersecciones (la dirección que maximiza distancia puede alternarse con la posición de Pac-Man) | Determinismo aceptado para v1 y verificado con los tests manuales; en callejón el 180 de `legalChoices` evita atascos. |
| `frightUntil` queda corrupto si `resetPositions` hace `game.frame = 0` con el modo activo | `resetPositions` limpia `frightUntil`, `frightChain` y los flags en el mismo paso. |
| El fantasma devorado podría colisionar con Pac-Man justo al ser teletransportado | La pen no es alcanzable por Pac-Man (la puerta bloquea su paso); no puede haber colisión ahí. |
| Azul `#2121de` confundible con el `WALL_COLOR` `#2121ff` de las paredes | Las paredes son trazos finos y el cuerpo del fantasma es relleno; sigue el patrón de color del arcade. |
| Comer el pellet justo cuando el juego se gana o se pierde | Comportamiento ya aceptado en el SPEC 02; los overlays tapan y `createGame()` reinicia todo el estado. |

## What is **not** in this spec

- Modo ojos que viaja hasta la pen.
- Ciclos scatter/chase.
- Dificultad por nivel y duración decreciente del modo asustado.
- Sonido y música.
- Frutas y otros pickups.

Cada uno de esos, si llega, va en su propio spec.
