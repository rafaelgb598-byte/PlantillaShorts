// Arma las props de la composición a partir de trabajo/<slug>/ (plan.json, palabras.json, voz).
import fs from "node:fs";
import path from "node:path";
import { ESTILOS, FPS, resolverEscenas } from "../../estilos/comun/plan.mjs";
import { PUBLIC, RAIZ, dirShort, leerJson } from "./comun.mjs";

/** tiempos inventados para un borrador sin voz (2,7 palabras por segundo) */
export const palabrasFalsas = (texto) => {
  let t = 0;
  return String(texto)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const d = 0.22 + Math.min(0.3, w.length * 0.035);
      const p = { t: w, s: Number(t.toFixed(3)), e: Number((t + d).toFixed(3)) };
      t += d + (/[.?!]$/.test(w) ? 0.22 : /[,:;]$/.test(w) ? 0.12 : 0.05);
      return p;
    });
};

/** texto hablado del guion (trabajo/<slug>/guion.txt) */
export const leerGuion = (slug) => {
  const p = path.join(dirShort(slug), "guion.txt");
  if (!fs.existsSync(p)) throw new Error(`falta ${path.relative(RAIZ, p)}`);
  return fs.readFileSync(p, "utf8").replace(/^﻿/, "").trim();
};

export const cargarProps = (slug, { borrador = false } = {}) => {
  const dir = dirShort(slug);
  const plan = leerJson(path.join(dir, "plan.json"));
  plan.slug = slug;
  const estilo = ESTILOS[plan.estilo];
  if (!estilo) throw new Error(`plan.json: estilo «${plan.estilo}» no existe (explicador, pizarra o mapa)`);
  let palabras;
  let voz = null;
  if (borrador) palabras = palabrasFalsas(leerGuion(slug));
  else {
    palabras = leerJson(path.join(dir, "palabras.json"), null);
    if (!palabras) throw new Error(`falta ${path.relative(RAIZ, path.join(dir, "palabras.json"))}: primero prepara la voz (o usa --borrador)`);
    const rel = `trabajo/${slug}/voz.mp3`;
    if (!fs.existsSync(path.join(PUBLIC, rel))) throw new Error(`falta public/${rel}: primero prepara la voz (o usa --borrador)`);
    voz = rel;
  }
  const r = resolverEscenas(plan, palabras, FPS);
  return { composicion: estilo.composicion, inputProps: { plan, palabras, voz }, resolucion: r };
};

export const informarResolucion = (r) => {
  for (const a of r.avisos) console.log(`aviso: ${a}`);
  if (r.errores.length) {
    console.error(`El plan tiene ${r.errores.length} error(es):\n- ${r.errores.join("\n- ")}`);
    return false;
  }
  console.log(`${r.escenas.length} escenas · ${(r.total / FPS).toFixed(1)} s`);
  return true;
};
