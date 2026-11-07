// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.0625; // 1/16 celda/frame -> alinea cada 16 frames
const GHOST_SPEED = 0.05;    // 1/20 celda/frame

// Region de la pen (interior + puerta) y celda objetivo para salir de ella.
const PEN = { xMin: 11, xMax: 16, yMin: 12, yMax: 15 };
const PEN_EXIT = { x: 13, y: 11 };    // celda objetivo para salir
const PINKY_AHEAD = 4;                // casillas de anticipacion
const INKY_AHEAD = 2;
const CLYDE_SHY_DIST = 8;             // huye si dist < 8
const CLYDE_CORNER = { x: 1, y: 29 }; // rincon inferior izquierdo

// Power pellets y su animacion.
const PELLET_POINTS = 50;
const FLOAT_LIFETIME = 60; // frames (~1 s) que dura el "+50" flotante

// Modo asustado (power pellets).
const FRIGHT_FRAMES = 360;       // ~6 s de modo asustado
const FRIGHT_SPEED = 0.04;       // 1/25 celda/frame (mas lento que GHOST_SPEED)
const FRIGHT_FLASH_FRAMES = 120; // ultimos ~2 s: parpadeo
const GHOST_POINTS_BASE = 200;   // cadena 200 -> 400 -> 800 -> 1600

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    frame: 0,
    dotsRemaining: dots,
    floaters: [],
    frightUntil: 0, // frame en el que expira el modo asustado; 0 = inactivo
    frightChain: 0, // fantasmas comidos en el periodo de asustado actual
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      kind: g.kind,
      releaseAt: g.releaseAt,
      frightened: false, // azul, comible y huye
      immune: false,     // devorado: ni comible ni letal hasta el fin del asustado
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += PELLET_POINTS;
      game.dotsRemaining--;
      game.floaters.push( { x: p.x, y: p.y, born: game.frame, text: '+50' } );
      // Pellet nuevo reinicia el timer y la cadena de puntos.
      game.frightUntil = game.frame + FRIGHT_FRAMES;
      game.frightChain = 0;
      game.ghosts.forEach( ( g ) => {
        g.frightened = true;
        g.immune = false;
      } );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Opciones de giro legales: sin volver atras; en callejon se permite el 180.
// Desde fuera de la pen, la puerta (tile 3) no es destino valido: nadie reentra.
function legalChoices( game, g ) {
  const outside = !inPen( g );
  const options = Object.keys( DIRS ).filter( ( dir ) => {
    if ( dir === OPPOSITE[ g.dir ] ) return false;
    if ( !canMove( game.grid, g.x, g.y, dir, 'ghost' ) ) return false;
    if ( outside ) {
      const d = DIRS[ dir ];
      const tx = Math.round( g.x ) + d.x;
      const ty = Math.round( g.y ) + d.y;
      if ( game.grid[ ty ][ tx ] === 3 ) return false;
    }
    return true;
  } );
  return options.length ? options : [ OPPOSITE[ g.dir ] ];
}

// Greedy Manhattan hacia (tx,ty): elige la direccion que minimiza la
// distancia al objetivo. Empates: gana la primera de legalChoices.
function chooseToTarget( game, g, tx, ty ) {
  let best;
  let bestDist = Infinity;
  for ( const dir of legalChoices( game, g ) ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( g.x + d.x - tx ) + Math.abs( g.y + d.y - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Esta el fantasma dentro de la region de la pen (incluida la puerta)?
function inPen( g ) {
  const x = Math.round( g.x );
  const y = Math.round( g.y );
  return x >= PEN.xMin && x <= PEN.xMax && y >= PEN.yMin && y <= PEN.yMax;
}

// --- Objetivos por personalidad (funciones puras sobre el estado) -----------

// Pinky: embosca, 4 casillas por delante de Pac-Man segun su direccion.
function pinkyTarget( game ) {
  const p = game.pacman;
  const d = DIRS[ p.dir ];
  return {
    x: Math.round( p.x ) + PINKY_AHEAD * d.x,
    y: Math.round( p.y ) + PINKY_AHEAD * d.y,
  };
}

// Inky: flanquea. Punto 2 casillas delante de Pac-Man, reflejado respecto a Blinky.
function inkyTarget( game ) {
  const p = game.pacman;
  const d = DIRS[ p.dir ];
  const aheadX = Math.round( p.x ) + INKY_AHEAD * d.x;
  const aheadY = Math.round( p.y ) + INKY_AHEAD * d.y;
  const b = game.ghosts[ 0 ]; // Blinky
  return { x: 2 * aheadX - Math.round( b.x ), y: 2 * aheadY - Math.round( b.y ) };
}

// Clyde: temeroso. Persigue de lejos; a menos de 8 casillas huye a su rincon.
function clydeTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const dist = Math.abs( px - Math.round( g.x ) ) + Math.abs( py - Math.round( g.y ) );
  if ( dist >= CLYDE_SHY_DIST ) return { x: px, y: py };
  return { x: CLYDE_CORNER.x, y: CLYDE_CORNER.y };
}

function decideGhost( game, g ) {
  if ( inPen( g ) ) {
    // Dentro de la pen el unico objetivo es la celda de salida.
    chooseToTarget( game, g, PEN_EXIT.x, PEN_EXIT.y );
    return;
  }
  let target;
  switch ( g.kind ) {
    case 'blinky': {
      const p = game.pacman;
      target = { x: Math.round( p.x ), y: Math.round( p.y ) };
      break;
    }
    case 'pinky':
      target = pinkyTarget( game );
      break;
    case 'inky':
      target = inkyTarget( game );
      break;
    default:
      target = clydeTarget( game, g );
  }
  chooseToTarget( game, g, target.x, target.y );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  const speed = g.frightened ? FRIGHT_SPEED : GHOST_SPEED;
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Reiniciar el reloj hace que la salida de la pen vuelva a ser escalonada.
  game.frame = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frame++;
  game.floaters = game.floaters.filter( ( f ) => game.frame - f.born < FLOAT_LIFETIME );
  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    if ( game.frame >= g.releaseAt ) moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.PELLET_POINTS = PELLET_POINTS;
window.FLOAT_LIFETIME = FLOAT_LIFETIME;
