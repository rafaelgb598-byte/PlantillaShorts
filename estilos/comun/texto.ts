import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

/** Medición y ajuste de textos con la fuente real (canvas fuera de pantalla). */

export type FuenteCargable = { fontFamily: string; waitUntilDone: () => Promise<unknown> };

let ctx: CanvasRenderingContext2D | null = null;
const lienzo = () => {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  return ctx as CanvasRenderingContext2D;
};
const cache = new Map<string, number>();

export const medir = (texto: string, familia: string, peso: number, size: number, espaciado = 0) => {
  const k = `${familia}|${peso}|${size}|${espaciado}|${texto}`;
  const hit = cache.get(k);
  if (hit !== undefined) return hit;
  const c = lienzo();
  c.font = `${peso} ${size}px "${familia}"`;
  (c as unknown as { letterSpacing: string }).letterSpacing = `${espaciado}px`;
  const w = c.measureText(texto).width;
  cache.set(k, w);
  return w;
};

/** parte el texto en renglones de ancho ≤ maxW (corte por palabras) */
export const partir = (texto: string, familia: string, peso: number, size: number, maxW: number, espaciado = 0) => {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (!actual || medir(prueba, familia, peso, size, espaciado) <= maxW) actual = prueba;
    else {
      out.push(actual);
      actual = p;
    }
  }
  if (actual) out.push(actual);
  return out;
};

export type Ajuste = { size: number; lineas: string[] };
/** el tamaño más grande (entre tamMin y tamMax) con el que el texto entra en maxLineas renglones de maxW */
export const ajustar = (
  texto: string,
  o: { familia: string; peso: number; maxW: number; maxLineas: number; tamMax: number; tamMin: number; espaciado?: number },
): Ajuste => {
  for (let size = o.tamMax; size >= o.tamMin; size -= 4) {
    const lineas = partir(texto, o.familia, o.peso, size, o.maxW, o.espaciado ?? 0);
    const ancho = Math.max(...lineas.map((l) => medir(l, o.familia, o.peso, size, o.espaciado ?? 0)));
    if (lineas.length <= o.maxLineas && ancho <= o.maxW) return { size, lineas };
  }
  return { size: o.tamMin, lineas: partir(texto, o.familia, o.peso, o.tamMin, o.maxW, o.espaciado ?? 0) };
};

/** espera a que carguen las fuentes: nada se mide ni se dibuja con la fuente de reemplazo */
export const useFuentes = (fuentes: { fuente: FuenteCargable; peso: number }[]) => {
  const [lista, setLista] = useState(false);
  const [handle] = useState(() => delayRender("fuentes del estilo"));
  useEffect(() => {
    let vivo = true;
    Promise.all(fuentes.map(({ fuente, peso }) => fuente.waitUntilDone().then(() => document.fonts.load(`${peso} 80px "${fuente.fontFamily}"`))))
      .then(() => {
        if (vivo) setLista(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
        if (vivo) setLista(true);
      });
    return () => {
      vivo = false;
    };
    // las fuentes son constantes de módulo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);
  return lista;
};

/** número que aparece al principio de un texto («63 %» → 63; «3,8 billones» → 3,8) para contarlo desde 0 */
export const numeroDe = (valor: string) => {
  const m = String(valor).match(/^[^\d-]*(-?[\d.]*\d(?:,\d+)?)/);
  if (!m) return null;
  const crudo = m[1];
  const decimales = crudo.includes(",") ? crudo.split(",")[1].length : 0;
  const n = Number(crudo.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return { n, decimales, antes: String(valor).slice(0, m.index! + m[0].length - crudo.length), despues: String(valor).slice(m.index! + m[0].length) };
};

/** escribe un número con formato latino (punto de miles, coma decimal) */
export const formatear = (n: number, decimales: number) => {
  const [ent, dec] = n.toFixed(decimales).split(".");
  const conMiles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec ? `${conMiles},${dec}` : conMiles;
};

/** cuenta del número de `valor` según el avance p (0 → 1); los números enteros de 4 dígitos sin separador (años) se cuentan sin puntos */
export const contar = (valor: string, p: number) => {
  const d = numeroDe(valor);
  if (!d) return valor;
  const esAnio = /^\d{4}$/.test(String(valor).trim());
  const v = d.n * Math.min(1, Math.max(0, p));
  const txt = esAnio ? String(Math.round(v)) : formatear(v, d.decimales);
  return `${d.antes}${txt}${d.despues}`;
};
