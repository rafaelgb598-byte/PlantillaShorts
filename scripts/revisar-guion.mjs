// Revisa el guion ANTES de grabar o gastar créditos: largo, gancho, voseo y cómo quedan los subtítulos.
// Uso: node scripts/revisar-guion.mjs <slug>      (lee trabajo/<slug>/guion.txt y plan.json si ya existe)
// Sale con 0 si está todo bien; con 1 y la lista de qué cambiar si no.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ESTILOS } from "../estilos/comun/plan.mjs";
import { PUBLIC, RAIZ, dirShort, leerJson } from "./lib/comun.mjs";
import { leerGuion, palabrasFalsas } from "./lib/props.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("Uso: node scripts/revisar-guion.mjs <slug>");
  process.exit(2);
}
const texto = leerGuion(slug);
const problemas = [];
const avisos = [];

// 1 · largo y gancho
const palabras = texto.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
if (palabras.length < 90 || palabras.length > 110) problemas.push(`tiene ${palabras.length} palabras: tienen que ser entre 90 y 110`);
const primera = texto.split(/(?<=[.?!])\s+/)[0];
const nPrimera = primera.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
if (nPrimera > 7) problemas.push(`la primera oración («${primera}») tiene ${nPrimera} palabras: el gancho va en 7 o menos`);

// 2 · voseo y españolismos (lista corta de formas típicas)
const VOSEO = /\b(vos|tenés|sabés|podés|querés|sos|mirá|fijate|pensá|imaginá|decime|contame|dejá|andá|vení|hacé|poné|comentá|escribí|elegí|probá|viste|vosotros|vosotras|os\s+\w+|tenéis|sabéis|coger|ordenador|móvil|zumo|vale\?)\b/giu;
const vos = [...new Set((texto.match(VOSEO) ?? []).map((v) => v.toLowerCase()))];
if (vos.length) problemas.push(`usa formas que no son de español neutro con «tú»: ${vos.join(", ")}`);

// 3 · subtítulos: paginación con la fuente real (tiempos aproximados)
const plan = leerJson(path.join(dirShort(slug), "plan.json"), { estilo: "explicador", escenas: [{ tipo: "titular", texto: "" }] });
const composicion = (ESTILOS[plan.estilo] ?? ESTILOS.explicador).composicion;
const inputProps = { plan: { ...plan, slug, escenas: [plan.escenas?.[0] ?? { tipo: "titular", texto: "" }] }, palabras: palabrasFalsas(texto), voz: null, capa: "subtitulos", qaSubs: true };
const serveUrl = await bundle({ entryPoint: path.join(RAIZ, "estilos", "index.ts"), rootDir: RAIZ, publicDir: PUBLIC });
const chromiumOptions = { gl: process.platform === "win32" ? "angle" : null };
const composition = await selectComposition({ serveUrl, id: composicion, inputProps, chromiumOptions });
let volcado = null;
let tolerancia = false;
const tmp = path.join(dirShort(slug), "revision.png");
await renderStill({
  serveUrl,
  composition,
  frame: 0,
  output: tmp,
  inputProps,
  chromiumOptions,
  onBrowserLog: (l) => {
    if (l.text.startsWith("QA_SUBS ")) volcado = JSON.parse(l.text.slice(8));
    if (l.text.includes("nivel")) tolerancia = true;
  },
});
fs.rmSync(tmp, { force: true });
const NO_CIERRA = "el la lo los las un una unos unas al del de a en con por para sin sobre entre que y e o u ni pero más muy tan su sus mi tu se me te le les no".split(" ");
const clave = (t) => t.toLowerCase().replace(/[^a-zñáéíóúü0-9]/g, "");
const finOracion = (t) => /[.?!…]["»”)]*$/.test(t);
const paginas = volcado?.paginas ?? [];
paginas.forEach((p, i) => {
  const ws = p.palabras;
  const ult = ws[ws.length - 1];
  const r1 = p.renglones.length === 2 ? ws[p.renglones[0] - 1] : null;
  const malCierre = [i < paginas.length - 1 ? ult : null, r1].filter((w) => w && !finOracion(w) && NO_CIERRA.includes(clave(w)));
  if (malCierre.length) problemas.push(`subtítulo «${ws.join(" ")}»: queda cortado en «${malCierre[0]}». Reescribe esa frase más corta o con una coma en otro lugar.`);
  if (ws.length === 1 && !(finOracion(ult) && (i === 0 || finOracion(paginas[i - 1].palabras.at(-1))))) problemas.push(`subtítulo «${ult}» queda solo: júntalo con la frase de al lado.`);
});
if (tolerancia && !problemas.some((p) => p.startsWith("subtítulo"))) avisos.push("los subtítulos necesitaron cortes forzados: revisa las frases más largas");

console.log(`${palabras.length} palabras · gancho de ${nPrimera} palabras · ${paginas.length} páginas de subtítulos`);
for (const a of avisos) console.log(`aviso: ${a}`);
if (problemas.length) {
  console.log(`\nHay que ajustar el guion:\n- ${problemas.join("\n- ")}`);
  process.exit(1);
}
console.log("GUION_OK");
