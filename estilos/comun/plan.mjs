// Plan de un short: lo escribe Claude en trabajo/<slug>/plan.json (formato en CLAUDE.md § Plan de escenas).
// Este archivo es JavaScript puro: lo usan los estilos de Remotion y los scripts de Node (render, QA).

export const FPS = 30;
/** segundos que siguen después de la última palabra */
export const COLA = 0.45;
/** fotogramas del empalme final con el cuadro 0 (loop) */
export const EMPALME = 15;
/** duración mínima de una escena (segundos) */
export const ESCENA_MIN = 1.0;
/** límites del kit: guion de 30 a 45 segundos */
export const DURACION = { min: 20, max: 45 };

export const ESTILOS = {
  explicador: {
    composicion: "Explicador",
    tipos: ["titular", "numero", "barras", "porcentaje", "icono", "frase", "lista", "fuente", "pregunta"],
  },
  pizarra: {
    composicion: "Pizarra",
    tipos: ["titulo", "dibujo", "cifra", "paso", "comparar", "fuente", "pregunta"],
  },
  mapa: {
    composicion: "Mapa",
    tipos: ["vista", "paises", "marcador", "ruta", "linea", "cifra", "fuente", "pregunta"],
  },
};

/** minúsculas, sin tildes ni signos (la ñ se conserva) */
export const normalizar = (t) =>
  String(t)
    .toLowerCase()
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ")
    .replace(/[^a-zñ0-9]/g, "");

const tokens = (frase) => String(frase).split(/\s+/).map(normalizar).filter(Boolean);

/** fotogramas totales del short según la voz */
export const duracionEnFrames = (palabras, fps = FPS) => {
  if (!palabras?.length) return 10 * fps;
  return Math.ceil((palabras[palabras.length - 1].e + COLA) * fps);
};

/**
 * Busca la frase `en` dentro de las palabras de la voz, a partir de la palabra `desde`.
 * Devuelve el índice de la primera palabra o -1. Tolera palabras que la transcripción escribió distinto
 * (alcanza con que coincidan casi todas).
 */
export const buscarFrase = (palabras, en, desde = 0) => {
  const ts = tokens(en);
  if (!ts.length) return -1;
  const ws = palabras.map((w) => normalizar(w.t));
  let mejor = -1;
  let mejorPuntos = 0;
  for (let i = desde; i < ws.length; i++) {
    let puntos = 0;
    for (let k = 0; k < ts.length && i + k < ws.length; k++) if (ws[i + k] === ts[k]) puntos++;
    if (puntos === ts.length) return i;
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejor = i;
    }
  }
  return mejorPuntos >= Math.max(1, Math.ceil(ts.length * 0.6)) ? mejor : -1;
};

/**
 * Convierte las escenas del plan (con `en: "frase"` o `t: segundos`) en tramos de fotogramas [f0, f1).
 * Devuelve { escenas, errores, avisos }. Con errores, el render no arranca.
 */
export const resolverEscenas = (plan, palabras, fps = FPS) => {
  const errores = [];
  const avisos = [];
  const total = duracionEnFrames(palabras, fps);
  const estilo = ESTILOS[plan?.estilo];
  if (!estilo) errores.push(`estilo desconocido «${plan?.estilo}» (usa explicador, pizarra o mapa)`);
  const lista = Array.isArray(plan?.escenas) ? plan.escenas : [];
  if (!lista.length) errores.push("el plan no tiene escenas");
  let cursor = 0;
  const out = [];
  lista.forEach((e, i) => {
    if (estilo && !estilo.tipos.includes(e.tipo)) errores.push(`escena ${i + 1}: tipo «${e.tipo}» no existe en ${plan.estilo} (tipos: ${estilo.tipos.join(", ")})`);
    let f0;
    if (i === 0) f0 = 0;
    else if (typeof e.t === "number") f0 = Math.round(e.t * fps);
    else if (typeof e.en === "string") {
      const k = buscarFrase(palabras, e.en, cursor);
      if (k < 0) {
        errores.push(`escena ${i + 1}: no encontré «${e.en}» en la voz (después de la palabra ${cursor + 1})`);
        f0 = out.length ? out[out.length - 1].f0 + fps * 2 : 0;
      } else {
        cursor = k;
        f0 = Math.max(0, Math.round(palabras[k].s * fps) - 3);
      }
    } else {
      errores.push(`escena ${i + 1}: falta «en» (frase donde arranca) o «t» (segundos)`);
      f0 = out.length ? out[out.length - 1].f0 + fps * 2 : 0;
    }
    out.push({ ...e, indice: i, f0 });
  });
  out.sort((a, b) => a.f0 - b.f0);
  for (let i = 0; i < out.length; i++) {
    out[i].f1 = i + 1 < out.length ? out[i + 1].f0 : total;
    const dur = (out[i].f1 - out[i].f0) / fps;
    if (out[i].f1 > total) errores.push(`escena ${out[i].indice + 1}: arranca después del final de la voz`);
    else if (dur < ESCENA_MIN - 1e-6) errores.push(`escena ${out[i].indice + 1} («${out[i].tipo}») dura ${dur.toFixed(2)} s: el mínimo es ${ESCENA_MIN} s`);
    else if (dur > 6) avisos.push(`escena ${out[i].indice + 1} («${out[i].tipo}») dura ${dur.toFixed(1)} s: conviene partirla (cambio visual cada 1,5–2 s)`);
  }
  const seg = total / fps;
  if (seg > DURACION.max) errores.push(`el short dura ${seg.toFixed(1)} s y el tope es ${DURACION.max} s: acorta el guion`);
  if (seg < DURACION.min) avisos.push(`el short dura ${seg.toFixed(1)} s (lo ideal es 30–45 s)`);
  return { escenas: out, errores, avisos, total };
};

/** la escena activa en el fotograma f */
export const escenaEn = (escenas, f) => {
  let k = 0;
  for (let i = 0; i < escenas.length; i++) if (f >= escenas[i].f0) k = i;
  return k;
};

/** generador pseudoaleatorio con semilla (siempre el mismo dibujo para el mismo texto) */
export const azar = (semilla) => {
  let h = 2166136261;
  for (const c of String(semilla)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
