// Espera a que aparezca una grabación nueva en «Pon aquí tu voz/» (mp3, wav, m4a…).
// Uso: node scripts/esperar-voz.mjs [--desde <ISO>] [--max 450]
// Imprime «VOZ <ruta>» con la grabación más nueva posterior a --desde (o a cuando arrancó) y sale con 0;
// sale con 3 si se cumplió el tiempo. Ignora archivos que todavía se están copiando.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { RAIZ, VOZ_DIR } from "./lib/comun.mjs";

const opt = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const desde = opt("desde") ? Date.parse(opt("desde")) : Date.now();
const max = Number(opt("max", 450));
const AUDIO = /\.(mp3|wav|m4a|ogg|aac|flac)$/i;
fs.mkdirSync(VOZ_DIR, { recursive: true });
const inicio = Date.now();
const tamanos = new Map();

const buscar = () => {
  const nuevos = fs
    .readdirSync(VOZ_DIR)
    .filter((f) => AUDIO.test(f))
    .map((f) => ({ f: path.join(VOZ_DIR, f), st: fs.statSync(path.join(VOZ_DIR, f)) }))
    .filter((x) => x.st.mtimeMs >= desde - 2000 && x.st.size > 10_000)
    .sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
  const x = nuevos[0];
  if (!x) return null;
  // el archivo tiene que mantener su tamaño 2 s seguidos (terminó de copiarse)
  const antes = tamanos.get(x.f);
  tamanos.set(x.f, x.st.size);
  return antes === x.st.size ? x.f : null;
};

console.log(`Esperando tu grabación en «${path.relative(RAIZ, VOZ_DIR)}» (hasta ${Math.round(max / 60)} min)…`);
const ciclo = setInterval(() => {
  const f = buscar();
  if (f) {
    clearInterval(ciclo);
    console.log(`VOZ ${f}`);
    process.exit(0);
  }
  if ((Date.now() - inicio) / 1000 > max) {
    clearInterval(ciclo);
    console.log("TODAVIA_ESPERANDO: no apareció ninguna grabación nueva.");
    process.exit(3);
  }
}, 2000);
