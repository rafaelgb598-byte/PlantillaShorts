/**
 * Zona segura de YouTube Shorts: ÚNICA fuente de verdad (la usan los estilos, los subtítulos y scripts/qa-subs.mjs).
 * Lienzo 1080 × 1920.
 */
export const LIENZO = { w: 1080, h: 1920 };
/** nada importante fuera de esta caja: abajo y a la derecha está la interfaz de Shorts */
export const ZONA = { top: 240, bottom: 1536, left: 60, right: 900 };
/** todo texto centrado usa este centro */
export const CENTRO_X = 540;
/** 180–900: simétrico respecto de 540 y respeta right = 900 */
export const ANCHO_TEXTO_MAX = 720;
/** el bloque de subtítulos se apoya en y = 1500 y crece hacia arriba hasta 2 renglones; nunca sube */
export const CARRIL = { bottom: 1500, maxLineas: 2 };
/** la escena (todo lo que no es fondo) vive acá arriba, para dejar libre el carril de los subtítulos */
export const ESCENA = { top: 240, bottom: 1260, left: 80, right: 900 };
export const ESCENA_CENTRO = { x: (ESCENA.left + ESCENA.right) / 2, y: (ESCENA.top + ESCENA.bottom) / 2 };
export const FPS = 30;
