# SPEC 01 — Cuatro fantasmas con IA clásica arcade

> **Estado:** Aprovado
> **Depende de:** — (ninguno)
> **Fecha:** 2026-11-06
> **Objetivo:** Cuatro fantasmas con personalidades distintas (Blinky persigue agresivamente, Pinky embosca, Inky flanquea, Clyde es temeroso) con salida escalonada de la pen.

## Scope

**In:**

- Reemplazar los 2 fantasmas actuales (`hunter`, `random`) por 4 fantasmas con IA clásica arcade: `blinky`, `pinky`, `inky`, `clyde`.
- **Blinky:** persigue AGRESIVAMENTE — en cada intersección elige la dirección que minimiza la distancia Manhattan a Pac-Man (comportamiento del actual `hunter`, ahora siempre activo).
- **Pinky:** embosca — su objetivo es la celda 4 casillas por delante de Pac-Man según su dirección actual.
- **Inky:** flanquea — toma el punto 2 casillas delante de Pac-Man, lo refleja respecto a Blinky y persigue ese punto.
- **Clyde:** temeroso — si está a 8 o más casillas de Pac-Man persigue directo; si está a menos de 8, huye hacia su rincón (esquina inferior izquierda del tablero).
- Salida escalonada de la pen: Blinky sale en el frame 0, Pinky a los ~3 s (frame 180), Inky a los ~6 s (frame 360), Clyde a los ~9 s (frame 540).
- Lógica de salida de la pen: mientras el fantasma está dentro de la pen, persigue la celda (13, 11), la salida sobre la puerta.
- Prohibir a los fantasmas reentrar en la pen desde fuera (la celda puerta no es destino válido de una elección hecha desde fuera).
- Reloj por partida: `game.frame` en `createGame()`, incrementado en `update()`.

**Out of scope (para futuros specs):**

- Power-ups y modo asustado de los fantasmas.
- Ciclos de épocas scatter/chase alternadas (decisión: comportamiento fijo).
- Velocidades distintas por fantasma (decisión: todos a `GHOST_SPEED` 0.1).
- Dificultad progresiva por nivel.
- Sonido y animaciones extra.

## Data model

```js
// maze.js — reemplaza GHOST_STARTS
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', releaseAt: 0 },   // agresivo
  { x: 14, y: 14, kind: 'pinky',  releaseAt: 180 }, // embosca (3 s)
  { x: 15, y: 14, kind: 'inky',   releaseAt: 360 }, // flanquea (6 s)
  { x: 16, y: 14, kind: 'clyde',  releaseAt: 540 }, // temeroso (9 s)
];

// game.js — cada partida lleva su reloj de frames
// createGame() añade: frame: 0
// ghosts: { x, y, dir, speed, kind, releaseAt }

// game.js — región de la pen (para salida y anti-reentrada)
const PEN = { xMin: 11, xMax: 16, yMin: 12, yMax: 15 };
const PEN_EXIT = { x: 13, y: 11 };    // celda objetivo para salir
const PINKY_AHEAD = 4;                // casillas de anticipación
const INKY_AHEAD = 2;
const CLYDE_SHY_DIST = 8;             // huye si dist < 8
const CLYDE_CORNER = { x: 1, y: 29 }; // rincón inferior izquierda
```

- Colores: `GHOST_COLORS` en `render.js` ya define 4 (rojo, cian, rosa, naranja) y el orden del array coincide con `GHOST_STARTS`: blinky=rojo, pinky=cian, inky=rosa, clyde=naranja.

## Implementation plan

1. `src/js/maze.js`: reemplazar `GHOST_STARTS` por los 4 fantasmas con `kind` y `releaseAt`. Comprobación manual: abrir el juego y ver 4 fantasmas en la pen (parados, aún sin lógica de salida).
2. `src/js/game.js`: refactorizar la elección de dirección — extraer `chooseToTarget(game, g, tx, ty)` que hace el greedy Manhattan actual (elige sin volver atrás, con el giro de 180 en callejón), y hacer que `blinky` la use con objetivo Pac-Man. Comprobación: solo blinky se mueve desde el frame 0 persiguiendo; Pinky/Inky/Clyde todavía parados.
3. `src/js/game.js`: añadir lógica de salida: `game.frame` contando en `update()`; fantasma con `game.frame < releaseAt` no se mueve; fantasma en la pen usa `chooseToTarget` hacia `PEN_EXIT`. Comprobación: los 4 salen escalonados por la puerta superior.
4. `src/js/game.js`: implementar `pinky`, `inky` y `clyde` calculando su celda objetivo (funciones puras `pinkyTarget`/`inkyTarget`/`clydeTarget` sobre el estado del juego) y pasándosela a `chooseToTarget`; añadir `inPen()` y la regla anti-reentrada al filtrar opciones. Comprobación: observar los 4 comportamientos en juego.
5. Revisión final manual: partida completa, con los 4 fantasmas, confirmando consola sin errores y criterios de aceptación.

## Acceptance criteria

- [ ] El juego carga y la consola no muestra errores.
- [ ] Se ven 4 fantasmas con los 4 colores de `GHOST_COLORS` (rojo, cian, rosa, naranja).
- [ ] Todos los fantasmas se mueven a la misma velocidad (`GHOST_SPEED` 0.1).
- [ ] Blinky sale de la pen ni bien arranca la partida y en cada intersección reduce (o mantiene por empate) la distancia a Pac-Man — nunca huye.
- [ ] Pinky sale a los ~3 s y avanza hacia un punto por delante de Pac-Man: cuando Pac-Man va hacia la izquierda, Pinky avanza hacia la izquierda de Pac-Man (no hacia él).
- [ ] Inky sale a los ~6 s y su trayectoria refleja la posición de Blinky respecto a un punto 2 casillas delante de Pac-Man.
- [ ] Clyde sale a los ~9 s: lejos de Pac-Man avanza hacia él; a menos de 8 casillas se aleja hacia el rincón inferior izquierdo.
- [ ] Un fantasma parado no se mueve hasta su tiempo de salida, y no se solapan dos fantasmas en la misma celda al arrancar.
- [ ] Ningún fantasma en la pen se queda atrapado: los 4 acaban saliendo.
- [ ] Ningún fantasma vuelve a entrar en la pen una vez fuera.
- [ ] Una colisión fantasma–Pac-Man sigue restando vida y reseteando posiciones (y después vuelven a salir escalonados).

## Decisions

- **Sí:** personalidades clásicas arcade (Blinky/Pinky/Inky/Clyde). Eran la petición del usuario y los 4 comportamientos son claramente distinguibles entre sí.
- **No:** fantasmas inventados. Las clásicas son conocidas, documentadas y más fáciles de verificar que 4 intros propias.
- **Sí:** salida escalonada por tiempo fijo (`releaseAt` en frames). Es lo más simple que da progresión y no acopla el contador de dots a la salida.
- **No:** salida por dots comidos. Fiel al arcade pero añade acoplamiento con la mecánica de comer.
- **Sí:** velocidad única `GHOST_SPEED` 0.1 para los 4. La diferencia de peligro la da la IA, no la velocidad; 0.125 (igual que Pac-Man) rompería el equilibrio.
- **No:** velocidades distintas por fantasma. Complica el movimiento alineado al grid y no aporta a la petición.
- **Sí:** sin ciclos scatter/chase, comportamiento fijo. Cumple la petición con menos máquina de estados; los ciclos pueden ser su propio spec.
- **Sí:** objetivo de Pinky = `pacman + 4·dir` simple (sin el overflow-up del arcade de 1980). El bug original es una curiosidad histórica, no una feature deseable.
- **Sí:** Inky usa a Blinky (`game.ghosts[0]`) como referencia. Es la definición clásica del vector.
- **Sí:** prohibir reentrada en la pen. Evita que los fantasmas se refugien donde Pac-Man no puede llegar.
- **Sí:** `game.frame` para reloj en vez de parametrizar `update`. Guardarlo en el estado del juego hace la cuenta por-partida y reseteable.
- **Sí:** perder el fantasma `random` actual y el juego ser más determinista. Clyde aporta la variabilidad tipo "vaivén".

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Objetivos de Pinky/Inky/Clyde fuera del tablero (ej. Pinky apunta fuera por el borde) | Los targets solo se usan para calcular distancias Manhattan, nunca como celdas a recorrer. |
| Túnel con wrap confunde la distancia Manhattan de los objetivos | Riesgo asumido para v1: el greedy hace clásicos, no pathfinding; en el peor caso el fantasma rodea por el túnel. |
| El juego se vuelve determinista al perder el fantasma `random` | Decisión a propósito: Clyde aporta la variabilidad y la partida sigue siendo jugable. |
| Fantasmas atascados en la pen si `canMove` bloquea la puerta | `isWall` para fantasma ya permite el tile puerta (3) — no cambia en este spec. |

## What is **not** in this spec

- Power-ups / modo asustado.
- Ciclos de épocas scatter/chase.
- Dificultad por nivel ni velocidades desiguales.
- Sonido y efectos visuales extra.

Cada uno de esos, si llega, va en su propio spec.
