import type { OpcionesPaginar, Pagina, Palabra } from "./tipos";

/**
 * Paginación de subtítulos POR FRASE (función pura, sin React ni Remotion: se prueba con `node --test`).
 *
 * Reglas:
 * - 1 o 2 renglones por página, cada renglón ≤ anchoMax (medido con la fuente real), ≥ minFrames por página.
 * - `|` en el texto de una palabra = corte manual obligatorio después de ella.
 * - Se corta, de mejor a peor: fin de oración · pausa ≥ 0,18 s · coma o dos puntos · límite de frase.
 * - Ninguna página ni primer renglón termina en NO_CIERRA (salvo con puntuación final).
 * - Sin huérfanas: 1 palabra sola solo si es una oración completa o un `remate`.
 * - Renglones parejos: el segundo nunca mide menos de la mitad del primero.
 */

/** palabras que nunca cierran una página ni un primer renglón */
export const NO_CIERRA = [
  "el", "la", "lo", "los", "las", "un", "una", "unos", "unas", "al", "del", "de", "a", "en", "con", "por", "para", "sin", "sobre",
  "entre", "que", "y", "e", "o", "u", "ni", "pero", "más", "muy", "tan", "su", "sus", "mi", "tu", "se", "me", "te", "le", "les", "no",
];
/** palabras que abren una frase nueva (cortar ANTES de ellas es un límite de frase) */
const ABRE_FRASE = [
  "que", "a", "de", "en", "con", "por", "para", "sin", "sobre", "entre", "contra", "hasta", "desde", "hacia", "y", "e", "o", "u", "ni",
  "pero", "si", "cuando", "porque", "como", "aunque", "mientras", "antes", "después", "también",
];
const PAUSA = 0.18;

/** minúsculas, sin tildes ni signos (la ñ se conserva) */
export const normalizar = (t: string) =>
  t
    .toLowerCase()
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ")
    .replace(/[^a-zñ0-9]/g, "");

/** minúsculas y sin signos, CON tildes («qué» ≠ «que», «más» ≠ «mas») */
export const palabraClave = (t: string) => t.toLowerCase().replace(/[^a-zñáéíóúü0-9]/g, "");

export const limpiar = (t: string) => t.replace(/\|/g, "");
const finOracion = (t: string) => /[.?!…]["»”)]*$/.test(limpiar(t));
const comaODos = (t: string) => /[,:;]["»”)]*$/.test(limpiar(t));
const manual = (t: string) => t.includes("|");
/** ¿la palabra puede cerrar una página o un primer renglón? */
export const puedeCerrar = (t: string) => finOracion(t) || !NO_CIERRA.includes(palabraClave(t));
/**
 * Las reglas son penalizaciones grandes, no prohibiciones: si una frase no tiene ningún corte bueno, el problema
 * queda SOLO en esa frase (el resto del guion se pagina bien) y el QA lo marca para reescribirla.
 */
const PENAL = { cierre: 60, huerfana: 40 };

type Corte = "manual" | "oracion" | "pausa" | "coma" | "frase" | "nada";
/** tipo de corte entre ws[i] y ws[i+1] */
const corte = (ws: Palabra[], i: number): Corte => {
  const a = ws[i];
  const b = ws[i + 1];
  if (manual(a.t)) return "manual";
  if (finOracion(a.t)) return "oracion";
  if (b && b.s - a.e >= PAUSA) return "pausa";
  if (comaODos(a.t)) return "coma";
  if (b && ABRE_FRASE.includes(palabraClave(b.t))) return "frase";
  return "nada";
};
const COSTO_FIN: Record<Corte, number> = { manual: 0, oracion: 0, pausa: 1, coma: 2, frase: 4, nada: 12 };
/** costo de dejar un corte de este tipo ADENTRO de una página (preferimos cortar ahí) */
const COSTO_DENTRO: Record<Corte, number> = { manual: Infinity, oracion: 9, pausa: 3, coma: 1.5, frase: 0, nada: 0 };
const COSTO_PAGINA = 2.5;

type Reparto = { lineas: Palabra[][]; costo: number; escala: number };
/** costo de achicar la letra (preferimos cortar distinto antes que achicar) */
const costoEscala = (e: number) => (1 - e) * 30;

/** mejor partición en renglones de ws (1 o 2), con la escala de letra que haga falta (≥ escalaMin); null si no entra */
export const renglones = (ws: Palabra[], medir: OpcionesPaginar["medir"], anchoMax: number, escalaMin = 1): Reparto | null => {
  const tope = anchoMax / escalaMin;
  const w1 = medir(ws);
  let mejor: Reparto | null = w1 <= tope ? { lineas: [ws], escala: Math.min(1, anchoMax / w1), costo: costoEscala(Math.min(1, anchoMax / w1)) } : null;
  if (mejor && mejor.escala === 1) return mejor;
  for (let k = 1; k < ws.length; k++) {
    const a = ws.slice(0, k);
    const b = ws.slice(k);
    const penal = puedeCerrar(a[a.length - 1].t) ? 0 : PENAL.cierre;
    const wa = medir(a);
    const wb = medir(b);
    if (wa > tope || wb > tope) continue;
    if (wb < wa / 2) continue;
    const c = corte(ws, k - 1);
    const escala = Math.min(1, anchoMax / Math.max(wa, wb));
    const costo = (Math.abs(wa - wb) / anchoMax) * 4 + (c === "nada" ? 1.5 : c === "frase" ? 0.6 : 0) + costoEscala(escala) + penal;
    if (!mejor || costo < mejor.costo) mejor = { lineas: [a, b], costo, escala };
  }
  return mejor;
};

const paginarNivel = (palabras: Palabra[], o: OpcionesPaginar): Pagina[] => {
  const ws = palabras.filter((w) => limpiar(w.t).trim().length > 0);
  const n = ws.length;
  if (!n) return [];
  const minF = o.minFrames ?? 15;
  const remates = (o.remates ?? []).map(normalizar);
  const inicio = (i: number) => ws[i].s - 0.08;
  /** fin de la página que va de i a j (exclusivo) */
  const fin = (j: number) => (j < n ? Math.min(inicio(j), ws[j - 1].e + 0.6) : ws[n - 1].e + 0.8);

  const dp: number[] = new Array(n + 1).fill(Infinity);
  const desde: number[] = new Array(n + 1).fill(-1);
  const lay: (Reparto | null)[] = new Array(n + 1).fill(null);
  dp[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = j - 1; i >= 0; i--) {
      if (dp[i] === Infinity) continue;
      const pw = ws.slice(i, j);
      // un corte manual adentro invalida la página (y las más largas también)
      let dentro = 0;
      let invalida = false;
      for (let k = i; k < j - 1; k++) {
        const c = corte(ws, k);
        if (c === "manual") invalida = true;
        dentro += COSTO_DENTRO[c];
      }
      if (invalida) break;
      const r = renglones(pw, o.medir, o.anchoMax, o.escalaMin ?? 1);
      if (!r) break; // más palabras no van a entrar
      const ultima = pw[pw.length - 1].t;
      let penal = j < n && !puedeCerrar(ultima) ? PENAL.cierre : 0;
      if (pw.length === 1) {
        const oracionCompleta = (i === 0 || finOracion(ws[i - 1].t)) && finOracion(ultima);
        if (!oracionCompleta && !remates.includes(normalizar(ultima))) penal += PENAL.huerfana;
      }
      const dur = (fin(j) - inicio(i)) * o.fps;
      const corto = dur < minF ? 1000 : 0;
      const costo = dp[i] + COSTO_PAGINA + (j < n ? COSTO_FIN[corte(ws, j - 1)] : 0) + dentro + r.costo + corto + penal;
      if (costo < dp[j]) {
        dp[j] = costo;
        desde[j] = i;
        lay[j] = r;
      }
    }
  }
  if (dp[n] === Infinity) {
    let ok = 0;
    for (let k = 0; k <= n; k++) if (dp[k] < Infinity) ok = k;
    throw new Error(`paginar: sin paginación válida después de «${ws.slice(Math.max(0, ok - 3), ok).map((w) => w.t).join(" ")}»`);
  }
  const out: Pagina[] = [];
  for (let j = n; j > 0; j = desde[j]) {
    const i = desde[j];
    const r = lay[j] as Reparto;
    out.unshift({ palabras: ws.slice(i, j), renglones: r.lineas, escala: r.escala, f0: 0, f1: 0 });
  }
  let pos = 0;
  for (const p of out) {
    const i = pos;
    const j = pos + p.palabras.length;
    pos = j;
    p.f0 = Math.max(0, Math.floor(inicio(i) * o.fps));
    p.f1 = Math.ceil(fin(j) * o.fps);
    if (o.frames !== undefined) p.f1 = Math.min(o.frames, p.f1);
  }
  for (let k = 1; k < out.length; k++) out[k - 1].f1 = Math.min(out[k - 1].f1, out[k].f0);
  return out;
};

export const paginar = paginarNivel;

/** texto de una página tal como se ve (sin marcas `|`) */
export const textoPagina = (p: Pagina) => p.renglones.map((r) => r.map((w) => limpiar(w.t)).join(" ")).join(" / ");
