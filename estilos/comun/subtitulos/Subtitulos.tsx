import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, getInputProps, useVideoConfig } from "remotion";
import { ANCHO_TEXTO_MAX, CARRIL, CENTRO_X } from "../zonaSegura";
import { COLOR, CONTORNO, ESCALA_ACTIVA, ESCALA_MIN, FUENTE_SUBTITULOS, INTERLINEA, LETRA_ESPACIADO, OPACIDAD_RESTO, SERIF, TAM, type Fuente } from "./estilo";
import { colocar, esItalica, textoVisible } from "./medida";
import { crearMedidor } from "./medida";
import { normalizar, paginar } from "./paginar";
import type { Pagina, Palabra } from "./tipos";

/**
 * Subtítulos de los Shorts.
 * - Carril FIJO: el bloque se apoya en y = 1500, centrado en x = 540, crece hacia arriba hasta 2 renglones. Nunca sube.
 * - Páginas por frase (`paginar`), medidas con la fuente real cargada.
 * - Amarillo SOLO para la palabra clave de la página (`enfasis`, máx. 1 por página).
 * - La palabra que suena se marca sin color: escala 1,04 y opacidad 100 % (el resto 78 %).
 * El subtítulo no esquiva nada: el layout de cada escena deja el carril libre (lo verifica `npm run qa:subs`).
 */

const escalaEntrada = (t: number) => {
  // resorte amortiguado: 0,86 → 1 con un rebote corto (pico 1,012)
  const x = Math.min(1, Math.max(0, t));
  if (x <= 0) return 0.86;
  if (x >= 1) return 1;
  const ta = 0.01;
  if (x < ta) return 0.86;
  const u = (x - ta) / (1 - ta);
  const w = 1.6 * Math.PI;
  const r = Math.exp(-4.5) * Math.cos(w);
  return 0.86 + 0.14 * (1 - Math.exp(-4.5 * u) * Math.cos(w * u) + r * u);
};

export type SubtitulosProps = {
  f: number;
  /** palabras con tiempos reales de la voz (segundos). `|` en una palabra = corte manual después de ella */
  palabras: Palabra[];
  /** palabras o frases clave en amarillo (máx. 1 por página); comparación sin tildes ni signos */
  enfasis?: string[];
  /** palabras que pueden ir solas en una página */
  remates?: string[];
  /** palabras en serif itálica, como se escriben (p. ej. un nombre propio) */
  italicas?: string[];
  /** visibilidad por fotograma (rangos ocultos) */
  visible?: (f: number) => boolean;
  /** fuente de los subtítulos (por defecto Inter Tight) */
  fuente?: Fuente;
  /** color de la palabra clave (por defecto el amarillo, `COLOR.enfasis`) */
  colorEnfasis?: string;
  debug?: boolean;
};

/** espera a que cargue la fuente: ningún fotograma se mide ni se dibuja con la de reemplazo */
export const useFuenteLista = (fuente: Fuente) => {
  const [lista, setLista] = useState(false);
  const [handle] = useState(() => delayRender(`fuente ${fuente.familia}`));
  useEffect(() => {
    let vivo = true;
    fuente
      .listo()
      .then(() => document.fonts.load(`900 ${TAM}px "${fuente.familia}"`))
      .then(() => document.fonts.load(`italic 700 ${TAM}px Georgia`))
      .then(() => {
        if (vivo) setLista(true);
        continueRender(handle);
      });
    return () => {
      vivo = false;
    };
  }, [fuente, handle]);
  return lista;
};

const cachePaginas = new Map<string, Pagina[]>();
export const usePaginas = (palabras: Palabra[], o: { fuente: Fuente; italicas: string[]; remates: string[]; lista: boolean }) => {
  const { fps, durationInFrames } = useVideoConfig();
  return useMemo(() => {
    if (!o.lista) return null;
    const k = JSON.stringify([o.fuente.familia, o.italicas, o.remates, fps, durationInFrames, palabras.length, palabras[0]?.s, palabras[palabras.length - 1]?.e]);
    const hit = cachePaginas.get(k);
    if (hit) return hit;
    const p = paginar(palabras, {
      fps,
      frames: durationInFrames,
      medir: crearMedidor(o.fuente.familia, o.italicas),
      anchoMax: ANCHO_TEXTO_MAX - 4, // margen por el contorno, que no se achica con la letra
      escalaMin: ESCALA_MIN,
      remates: o.remates,
      minFrames: 15,
    });
    cachePaginas.set(k, p);
    return p;
  }, [o.lista, o.fuente, o.italicas, o.remates, fps, durationInFrames, palabras]);
};

/** índices de las palabras de la página que van en amarillo (la primera frase clave que aparezca) */
export const enfasisDePagina = (p: Pagina, enfasis: string[]): Set<number> => {
  const ks = p.palabras.map((w) => normalizar(w.t));
  for (const frase of enfasis) {
    const fs = frase.split(/\s+/).map(normalizar);
    for (let i = 0; i + fs.length <= ks.length; i++) {
      if (fs.every((x, j) => ks[i + j] === x)) return new Set(fs.map((_, j) => i + j));
    }
  }
  return new Set();
};

/**
 * Volcado para el QA (`scripts/qa-subtitulos.mjs`, input prop `qaSubs: true`): lo que quedó DIBUJADO en el DOM
 * (texto de cada renglón, palabras en amarillo según su `fill`, fuente según el estilo computado) y todos los
 * textos visibles del fotograma (para la lista de palabras prohibidas). No lo usa el render normal.
 */
const qaActivo = () => {
  try {
    return Boolean((getInputProps() as { qaSubs?: boolean }).qaSubs);
  } catch {
    return false;
  }
};
/** texto visible FUERA de los subtítulos (para el QA de textos en pantalla) */
const textoPantalla = () => {
  const out: string[] = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('[data-capa="subtitulos"]')) continue;
    const t = (n.textContent ?? "").trim();
    if (t) out.push(t);
  }
  return out.join(" ¦ ");
};
const useVolcadoQA = (ref: React.RefObject<SVGGElement | null>, f: number, paginas: Pagina[] | null, fuente: Fuente, remates: string[], enfasis: string[], colorEnfasis: string) => {
  useLayoutEffect(() => {
    if (!paginas || !qaActivo()) return;
    const g = ref.current;
    const textos = Array.from(g?.querySelectorAll("text") ?? []);
    const renglones: string[] = [];
    let y: number | null = null;
    for (const t of textos) {
      const ty = Number(t.getAttribute("y"));
      if (y === null || Math.abs(ty - y) > 1) renglones.push("");
      y = ty;
      renglones[renglones.length - 1] = `${renglones[renglones.length - 1]} ${t.textContent ?? ""}`.trim();
    }
    const amarillas = textos.filter((t) => (t.getAttribute("fill") ?? "").toUpperCase() === colorEnfasis.toUpperCase()).map((t) => t.textContent);
    const recta = textos.find((t) => getComputedStyle(t).fontStyle !== "italic");
    const familia = recta ? getComputedStyle(recta).fontFamily : null;
    const visibles = Array.from(document.querySelectorAll("svg text")).map((t) => t.textContent ?? "").concat(document.body.innerText ?? "");
    const pag = paginas.findIndex((p) => f >= p.f0 && f < p.f1);
    console.log(
      "QA_SUBS " +
        JSON.stringify({
          f,
          pagina: textos.length ? pag : null,
          renglones,
          amarillas,
          familia,
          fuenteCargada: document.fonts.check(`900 ${TAM}px "${fuente.familia}"`),
          esperada: fuente.familia,
          paginas: paginas.map((p) => ({ f0: p.f0, f1: p.f1, palabras: p.palabras.map((w) => w.t), renglones: p.renglones.map((r) => r.length) })),
          remates,
          enfasis,
          textosVisibles: visibles.join(" ¦ "),
          textosPantalla: textoPantalla(),
        }),
    );
  });
};

export const Subtitulos: React.FC<SubtitulosProps> = ({ f, palabras, enfasis = [], remates = [], italicas = [], visible, fuente = FUENTE_SUBTITULOS, colorEnfasis = COLOR.enfasis, debug = false }) => {
  const { fps } = useVideoConfig();
  const ref = useRef<SVGGElement>(null);
  const lista = useFuenteLista(fuente);
  const ital = useMemo(() => italicas.map(normalizar), [italicas]);
  const paginas = usePaginas(palabras, { fuente, italicas: ital, remates, lista });
  const oculto = !paginas || (visible && !visible(f));
  const pag = oculto ? null : (paginas as Pagina[]).find((p) => f >= p.f0 && f < p.f1);
  useVolcadoQA(ref, f, paginas, fuente, remates, enfasis, colorEnfasis);
  if (!paginas) return null;
  if (!pag) return <g ref={ref} />;

  const t = f / fps;
  let actual: Palabra | null = null;
  for (const w of pag.palabras) if (t >= w.s - 0.04 && t < w.e + 0.25) actual = w;
  const amarillas = enfasisDePagina(pag, enfasis);

  const size = TAM * pag.escala;
  const LH = size * INTERLINEA;
  const rs = pag.renglones.map((r) => colocar(r, fuente.familia, ital, size));
  // el último renglón apoya su tinta (más el contorno) en y = 1500
  const baseUlt = CARRIL.bottom - CONTORNO / 2 - rs[rs.length - 1].baja;
  const inT = Math.min(1, (f - pag.f0) / 6);
  const sc = escalaEntrada(inT);
  const op = Math.min(1, inT * 2);
  let idx = 0;
  return (
    <g opacity={op} transform={`translate(${CENTRO_X},${CARRIL.bottom}) scale(${sc}) translate(${-CENTRO_X},${-CARRIL.bottom})`} data-capa="subtitulos" ref={ref}>
      {debug ? <rect x={CENTRO_X - ANCHO_TEXTO_MAX / 2} y={1300} width={ANCHO_TEXTO_MAX} height={CARRIL.bottom - 1300} fill="none" stroke="#00E0FF" strokeWidth={3} strokeDasharray="10 8" /> : null}
      {pag.renglones.map((r, li) => {
        const m = rs[li];
        // si la palabra que suena está en un extremo del renglón, su escala 1,04 agranda la tinta de un solo lado:
        // se corre el renglón la mitad de ese crecimiento para que el bloque siga centrado en 540
        const ka = r.findIndex((w) => w === actual);
        let comp = 0;
        if (ka >= 0 && r.length > 1 && (ka === 0 || ka === r.length - 1)) {
          const t1 = colocar([r[ka]], fuente.familia, ital, size);
          const crece = ((t1.tintaDer - t1.tintaIzq) * (ESCALA_ACTIVA - 1)) / 2;
          comp = ka === 0 ? crece / 2 : -crece / 2;
        }
        const x0 = CENTRO_X - (m.tintaIzq + m.tintaDer) / 2 + comp;
        const y = baseUlt - (pag.renglones.length - 1 - li) * LH;
        return r.map((w, wi) => {
          const i = idx++;
          const it = esItalica(w.t, ital);
          const activa = w === actual;
          const x = x0 + m.xs[wi];
          const tw = colocar([w], fuente.familia, ital, size);
          const cx = x + (tw.tintaDer + tw.tintaIzq) / 2;
          return (
            <text
              key={`${li}-${wi}`}
              x={x}
              y={y}
              textAnchor="start"
              fontFamily={it ? SERIF : `"${fuente.familia}"`}
              fontWeight={it ? 700 : 900}
              fontStyle={it ? "italic" : "normal"}
              fontSize={it ? size * 1.08 : size}
              letterSpacing={it ? 0 : LETRA_ESPACIADO}
              fill={amarillas.has(i) ? colorEnfasis : COLOR.texto}
              stroke={COLOR.contorno}
              strokeWidth={CONTORNO}
              paintOrder="stroke"
              strokeLinejoin="round"
              opacity={activa ? 1 : OPACIDAD_RESTO}
              transform={activa ? `translate(${cx},${y - size * 0.35}) scale(${ESCALA_ACTIVA}) translate(${-cx},${-(y - size * 0.35)})` : undefined}
              data-enfasis={amarillas.has(i) ? 1 : undefined}
            >
              {textoVisible(w.t, it)}
            </text>
          );
        });
      })}
    </g>
  );
};
