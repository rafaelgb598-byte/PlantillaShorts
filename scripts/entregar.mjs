// Entrega un short que pasó los dos QA: copia el MP4 a «Shorts listos/» y escribe el .txt para YouTube.
// Uso: node scripts/entregar.mjs <slug>
// Pide: trabajo/<slug>/render.mp4, qa/subtitulos/reporte.json con 0 fallas y qa/retencion/retencion.json sin fallas.
// El .txt trae: título, descripción (con la fuente del dato) y créditos.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { LISTOS, RAIZ, dirShort, leerJson } from "./lib/comun.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("Uso: node scripts/entregar.mjs <slug>");
  process.exit(2);
}
const dir = dirShort(slug);
const mp4 = path.join(dir, "render.mp4");
const qaS = leerJson(path.join(dir, "qa", "subtitulos", "reporte.json"), null);
const qaR = leerJson(path.join(dir, "qa", "retencion", "retencion.json"), null);
const problemas = [];
if (!fs.existsSync(mp4)) problemas.push("falta render.mp4 (corre scripts/render.mjs)");
if (!qaS) problemas.push("falta el QA de subtítulos (scripts/qa-subs.mjs)");
else if (qaS.fallas.length) problemas.push(`el QA de subtítulos tiene ${qaS.fallas.length} fallas`);
if (!qaR) problemas.push("falta el QA de retención (scripts/qa-retencion.mjs)");
else if (qaR.fallas.length) problemas.push(`el QA de retención falla: ${qaR.fallas.join("; ")}`);
if (qaS && fs.existsSync(mp4) && fs.statSync(mp4).mtimeMs > fs.statSync(path.join(dir, "qa", "subtitulos", "reporte.json")).mtimeMs + 60 * 60 * 1000)
  problemas.push("el render es más nuevo que el QA de subtítulos: vuelve a correrlo");
if (problemas.length) {
  console.error(`Todavía no se puede entregar:\n- ${problemas.join("\n- ")}`);
  process.exit(1);
}

const plan = leerJson(path.join(dir, "plan.json"));
const { temas } = leerJson(path.join(RAIZ, "temas", "temas.json"));
const tema = temas.find((t) => t.id === plan.temaId);
const vozInfo = leerJson(path.join(dir, "voz-info.json"), null);
const musica = plan.musica ? leerJson(path.join(RAIZ, "public", "musica", "creditos.json")).investigations : null;

const titulo = plan.titulo || tema?.gancho || slug;
const fuente = tema ? `${tema.fuente_nombre}: ${tema.fuente_url}` : plan.fuente || "";
const descripcion = [plan.descripcion || tema?.dato || "", "", fuente ? `Fuente del dato: ${fuente}` : ""].join("\n").trim();
const creditos = [];
if (musica?.credito) creditos.push(musica.credito);
if (plan.estilo === "mapa") creditos.push("Mapa: Natural Earth (dominio público).");

fs.mkdirSync(LISTOS, { recursive: true });
const destino = path.join(LISTOS, `${slug}.mp4`);
fs.copyFileSync(mp4, destino);
const txt = [
  "TÍTULO",
  titulo,
  "",
  "DESCRIPCIÓN",
  descripcion,
  "",
  "FUENTE DEL DATO",
  fuente || "(sin fuente)",
  "",
  "CRÉDITOS",
  creditos.length ? creditos.join("\n") : "Sin créditos de terceros.",
  ...(vozInfo ? ["", `Voz generada con ${vozInfo.proveedor}.`] : []),
  "",
].join("\n");
fs.writeFileSync(path.join(LISTOS, `${slug}.txt`), txt);
console.log(`Entregado:\n- ${path.relative(RAIZ, destino)}\n- ${path.relative(RAIZ, path.join(LISTOS, `${slug}.txt`))}`);
