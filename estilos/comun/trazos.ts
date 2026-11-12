import { azar } from "./plan.mjs";

/** Trazos «a mano alzada» generados por código (siempre iguales para la misma semilla). */

const n = (r: () => number, a: number) => (r() * 2 - 1) * a;

/** rectángulo con esquinas que se pasan un poco, como dibujado con marcador */
export const rectMano = (x: number, y: number, w: number, h: number, semilla: string) => {
  const r = azar(semilla);
  const j = 6;
  const p = [
    [x + n(r, j), y + n(r, j)],
    [x + w + n(r, j), y + n(r, j)],
    [x + w + n(r, j), y + h + n(r, j)],
    [x + n(r, j), y + h + n(r, j)],
  ];
  const lado = (a: number[], b: number[]) => {
    const mx = (a[0] + b[0]) / 2 + n(r, 5);
    const my = (a[1] + b[1]) / 2 + n(r, 5);
    return `Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  };
  return `M${(p[0][0] - 8).toFixed(1)} ${p[0][1].toFixed(1)} ${lado(p[0], p[1])} ${lado(p[1], p[2])} ${lado(p[2], p[3])} ${lado(p[3], [p[0][0] + 10, p[0][1] - 4])}`;
};

/** óvalo de una vuelta y algo (el trazo se pasa del inicio) */
export const ovaloMano = (cx: number, cy: number, rx: number, ry: number, semilla: string) => {
  const r = azar(semilla);
  const pasos = 28;
  const vuelta = 1.12;
  const a0 = -Math.PI * 0.6 + n(r, 0.3);
  const pts: string[] = [];
  for (let i = 0; i <= pasos; i++) {
    const a = a0 + (i / pasos) * Math.PI * 2 * vuelta;
    const k = 1 + n(r, 0.035) + (i / pasos) * 0.06;
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `M${pts[0]} ` + pts.slice(1).map((p) => `L${p}`).join(" ");
};

/** subrayado ondulado entre x1 y x2 */
export const subrayado = (x1: number, x2: number, y: number, semilla: string) => {
  const r = azar(semilla);
  const pasos = Math.max(4, Math.round((x2 - x1) / 60));
  let d = `M${x1} ${y + n(r, 3)}`;
  for (let i = 1; i <= pasos; i++) {
    const x = x1 + ((x2 - x1) * i) / pasos;
    d += ` Q${(x - (x2 - x1) / pasos / 2).toFixed(1)} ${(y + (i % 2 ? 9 : -9) + n(r, 3)).toFixed(1)} ${x.toFixed(1)} ${(y + n(r, 3)).toFixed(1)}`;
  }
  return d;
};

/** flecha curva de (x1, y1) a (x2, y2): devuelve [cuerpo, punta] */
export const flechaMano = (x1: number, y1: number, x2: number, y2: number, semilla: string, curva = 0.25): [string, string] => {
  const r = azar(semilla);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * curva + n(r, 10);
  const cy = my + dx * curva + n(r, 10);
  const cuerpo = `M${x1} ${y1} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`;
  const ang = Math.atan2(y2 - cy, x2 - cx);
  const L = 34;
  const a1 = ang + Math.PI * 0.82;
  const a2 = ang - Math.PI * 0.82;
  const punta = `M${(x2 + Math.cos(a1) * L).toFixed(1)} ${(y2 + Math.sin(a1) * L).toFixed(1)} L${x2} ${y2} L${(x2 + Math.cos(a2) * L).toFixed(1)} ${(y2 + Math.sin(a2) * L).toFixed(1)}`;
  return [cuerpo, punta];
};

/** cruz de dos trazos */
export const cruzMano = (cx: number, cy: number, s: number, semilla: string) => {
  const r = azar(semilla);
  return [`M${cx - s + n(r, 6)} ${cy - s + n(r, 6)} L${cx + s + n(r, 6)} ${cy + s + n(r, 6)}`, `M${cx + s + n(r, 6)} ${cy - s + n(r, 6)} L${cx - s + n(r, 6)} ${cy + s + n(r, 6)}`];
};

/** garabato decorativo (estrellita o espiral) */
export const garabato = (cx: number, cy: number, s: number, tipo: number) => {
  if (tipo % 3 === 0) {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? s * 0.45 : s;
      return `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
    });
    return `M${pts.join(" L")} Z`;
  }
  if (tipo % 3 === 1) {
    let d = `M${cx} ${cy}`;
    for (let i = 1; i <= 24; i++) {
      const a = i * 0.55;
      const rr = (i / 24) * s;
      d += ` L${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
    }
    return d;
  }
  return `M${cx - s} ${cy} L${cx + s} ${cy} M${cx} ${cy - s} L${cx} ${cy + s}`;
};
