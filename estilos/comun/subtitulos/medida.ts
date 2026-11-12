import { CONTORNO, ESCALA_ACTIVA, ESCALA_ENTRADA_MAX, ESPACIO, LETRA_ESPACIADO, SERIF, TAM } from "./estilo";
import { limpiar, normalizar } from "./paginar";
import type { Medidor, Palabra } from "./tipos";

/**
 * Medida REAL de los renglones con la fuente cargada (canvas fuera de pantalla, en el navegador del render).
 * Devuelve posiciones por palabra para dibujar exactamente lo que se midió.
 */

let ctx: CanvasRenderingContext2D | null = null;
const lienzo = () => {
  if (!ctx) {
    const c = document.createElement("canvas");
    ctx = c.getContext("2d");
  }
  return ctx as CanvasRenderingContext2D;
};

export type EstiloPalabra = { italica: boolean };
export const esItalica = (t: string, italicas: string[]) => italicas.includes(normalizar(t));
/** texto que se dibuja (MAYÚSCULAS salvo las itálicas) */
export const textoVisible = (t: string, italica: boolean) => (italica ? limpiar(t) : limpiar(t).toUpperCase());

type Tinta = { avance: number; izq: number; der: number; sube: number; baja: number };
const cache = new Map<string, Tinta>();
const medirPalabra = (t: string, italica: boolean, familia: string, size: number): Tinta => {
  const k = `${familia}|${size}|${italica}|${t}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const c = lienzo();
  c.font = italica ? `italic 700 ${size * 1.08}px ${SERIF}` : `900 ${size}px "${familia}"`;
  (c as unknown as { letterSpacing: string }).letterSpacing = italica ? "0px" : `${LETRA_ESPACIADO}px`;
  const m = c.measureText(textoVisible(t, italica));
  const r = { avance: m.width, izq: m.actualBoundingBoxLeft, der: m.actualBoundingBoxRight, sube: m.actualBoundingBoxAscent, baja: m.actualBoundingBoxDescent };
  cache.set(k, r);
  return r;
};

export type Renglon = { xs: number[]; tintaIzq: number; tintaDer: number; sube: number; baja: number; maxAvance: number };
/** coloca las palabras de un renglón a partir de x = 0 (borde izquierdo del avance de la primera) */
export const colocar = (ws: Palabra[], familia: string, italicas: string[], size: number): Renglon => {
  const gap = ESPACIO * size;
  const xs: number[] = [];
  let x = 0;
  let sube = 0;
  let baja = 0;
  let maxAvance = 0;
  let tintaIzq = 0;
  let tintaDer = 0;
  ws.forEach((w, i) => {
    const m = medirPalabra(w.t, esItalica(w.t, italicas), familia, size);
    xs.push(x);
    if (i === 0) tintaIzq = x - m.izq;
    tintaDer = x + m.der;
    sube = Math.max(sube, m.sube);
    baja = Math.max(baja, m.baja);
    maxAvance = Math.max(maxAvance, m.avance);
    x += m.avance + gap;
  });
  return { xs, tintaIzq, tintaDer, sube, baja, maxAvance };
};

/**
 * Ancho total que puede ocupar un renglón en pantalla: tinta + contorno + crecimiento de la palabra activa
 * + pico de la animación de entrada. Es lo que se compara con ANCHO_TEXTO_MAX.
 */
export const anchoOcupado = (r: Renglon) => (r.tintaDer - r.tintaIzq + CONTORNO + r.maxAvance * (ESCALA_ACTIVA - 1)) * ESCALA_ENTRADA_MAX;

export const crearMedidor = (familia: string, italicas: string[]): Medidor => (ws) => anchoOcupado(colocar(ws, familia, italicas, TAM));
