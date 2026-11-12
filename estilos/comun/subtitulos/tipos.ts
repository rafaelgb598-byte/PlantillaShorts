/** Tipos del sistema de subtítulos. */

/** palabra con tiempos en segundos (`t` = texto tal como se dice, con puntuación) */
export type Palabra = { t: string; s: number; e: number };

/** una página = lo que se ve junto (1 o 2 renglones) */
export type Pagina = {
  palabras: Palabra[];
  renglones: Palabra[][];
  /** escala de la letra de esta página (1 = tamaño normal; < 1 solo si un renglón no entra) */
  escala: number;
  /** fotogramas [f0, f1) */
  f0: number;
  f1: number;
};

/** mide el ancho en píxeles de un renglón ya en MAYÚSCULAS (incluye espaciado, escala activa y contorno) */
export type Medidor = (renglon: Palabra[]) => number;

export type OpcionesPaginar = {
  fps: number;
  medir: Medidor;
  anchoMax: number;
  /** palabras que pueden ir solas en una página (comparación normalizada, sin signos) */
  remates?: string[];
  /** cuánto se puede achicar la letra para que un renglón entre (por defecto 1 = nunca) */
  escalaMin?: number;
  /** duración mínima de una página en fotogramas */
  minFrames?: number;
  /** último fotograma del video (exclusivo) */
  frames?: number;
};
