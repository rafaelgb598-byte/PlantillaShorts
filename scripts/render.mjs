// Renderiza un short a partir de trabajo/<slug>/.
// Uso:
//   node scripts/render.mjs <slug>                    → trabajo/<slug>/render.mp4 (1080×1920, 30 fps, con voz)
//   node scripts/render.mjs <slug> --borrador         → sin voz, con tiempos inventados desde guion.txt
//   node scripts/render.mjs <slug> --stills 0,45,300  → fotogramas sueltos en trabajo/<slug>/stills/
//   node scripts/render.mjs <slug> --gif salida.gif --desde 0 --segundos 3
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { PUBLIC, RAIZ, dirShort } from "./lib/comun.mjs";
import { cargarProps, informarResolucion } from "./lib/props.mjs";

const args = process.argv.slice(2);
const slug = args[0];
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!slug || slug.startsWith("--")) {
  console.error("Uso: node scripts/render.mjs <slug> [--borrador] [--stills 0,45] [--gif archivo.gif --desde 0 --segundos 3]");
  process.exit(2);
}
const borrador = args.includes("--borrador");
const t0 = Date.now();
let datos;
try {
  datos = cargarProps(slug, { borrador });
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
if (!informarResolucion(datos.resolucion)) process.exit(1);
const { composicion, inputProps } = datos;
const dir = dirShort(slug);
const chromiumOptions = { gl: process.platform === "win32" ? "angle" : null };

console.log("Preparando el render…");
const serveUrl = await bundle({ entryPoint: path.join(RAIZ, "estilos", "index.ts"), rootDir: RAIZ, publicDir: PUBLIC });
const composition = await selectComposition({ serveUrl, id: composicion, inputProps, chromiumOptions });

const stills = opt("stills");
const gif = opt("gif");
if (stills) {
  const out = path.join(dir, "stills");
  fs.mkdirSync(out, { recursive: true });
  for (const fr of stills.split(",").map(Number)) {
    const output = path.join(out, `${String(fr).padStart(4, "0")}.png`);
    await renderStill({ serveUrl, composition, frame: Math.min(fr, composition.durationInFrames - 1), output, inputProps, chromiumOptions });
    console.log(path.relative(RAIZ, output));
  }
} else if (gif) {
  const desde = Math.round(Number(opt("desde") ?? 0) * 30);
  const hasta = Math.min(composition.durationInFrames - 1, desde + Math.round(Number(opt("segundos") ?? 3) * 30) - 1);
  // las props salen de la composición seleccionada: se vuelve a elegir con «mudo» (el GIF no lleva audio)
  const propsGif = { ...inputProps, mudo: true };
  const compGif = await selectComposition({ serveUrl, id: composicion, inputProps: propsGif, chromiumOptions });
  await renderMedia({
    serveUrl,
    composition: compGif,
    codec: "gif",
    outputLocation: path.resolve(gif),
    inputProps: propsGif,
    chromiumOptions,
    frameRange: [desde, hasta],
    everyNthFrame: 2,
    scale: Number(opt("escala") ?? 0.3),
    imageFormat: "png",
    onProgress: () => {},
  });
  console.log(path.resolve(gif));
} else {
  const outputLocation = path.join(dir, borrador ? "borrador.mp4" : "render.mp4");
  let ultimo = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation,
    inputProps,
    chromiumOptions,
    crf: 18,
    imageFormat: "jpeg",
    jpegQuality: 92,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== ultimo) {
        ultimo = p;
        console.log(`render ${p * 10} %`);
      }
    },
  });
  console.log(`Listo: ${path.relative(RAIZ, outputLocation)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
