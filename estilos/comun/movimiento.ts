import { interpolate, spring } from "remotion";
import { FPS } from "./zonaSegura";

/** Curvas de animación compartidas (todas son funciones puras del fotograma: sirven para el loop). */

export const lim = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** avance lineal 0 → 1 entre los fotogramas desde y desde + dur */
export const tramo = (f: number, desde: number, dur: number) => lim((f - desde) / Math.max(1, dur));
export const suave = (x: number) => {
  const t = lim(x);
  return t * t * (3 - 2 * t);
};
export const salida = (x: number) => 1 - Math.pow(1 - lim(x), 3);
/** resorte con rebote corto: entra de 0 a 1 */
export const resorte = (f: number, desde = 0, rigidez = 170, amortiguacion = 14) =>
  f < desde ? 0 : spring({ frame: f - desde, fps: FPS, config: { stiffness: rigidez, damping: amortiguacion, mass: 0.8 } });
export const mezcla = (a: number, b: number, t: number) => a + (b - a) * t;
export const entre = (f: number, entrada: [number, number], salidaV: [number, number]) =>
  interpolate(f, entrada, salidaV, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
/** onda suave para movimientos continuos (período en fotogramas) */
export const onda = (f: number, periodo: number, fase = 0) => Math.sin(((f / periodo) * 2 + fase) * Math.PI);
