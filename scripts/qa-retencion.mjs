// QA de retención sobre un MP4 renderizado.
// Uso: node scripts/qa-retencion.mjs <video.mp4> <dirSalida>
// Mide: duración ≤ 45 s (tope del kit) · movimiento antes de 0,5 s · cambio fuerte antes de 2 s · ningún encuadre fijo > 3 s ·
//       el último fotograma empalma con el primero · sin silencios > 0,4 s · sin franjas vacías entre y = 200 y 1540.
// Exporta los 4 stills del checklist (0,0 s · 1,0 s · 3,0 s · último) a <dirSalida>/stills/ para mirarlos a mano
// (lo que NO se puede medir: «se entiende sin audio» y «nada tapado por la interfaz»).
// Código de salida ≠ 0 si falla algo. Reporte: <dirSalida>/retencion.json
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import { decodePng } from "./lib/png.mjs";
import { ffmpeg as ffmpegKit } from "./lib/comun.mjs";

const [videoArg, outArg] = process.argv.slice(2);
if (!videoArg || !outArg) {
  console.error("Uso: node scripts/qa-retencion.mjs <video.mp4> <dirSalida>");
  process.exit(2);
}
const video = path.resolve(videoArg);
const out = path.resolve(outArg);
const R = { durMax: 45, movAntes: 0.5, cambioAntes: 2, encuadreMax: 3, silencioMax: 0.4, escena: [200, 1540], franjaMax: 400 };
const FPS = 30;
const ffmpeg = (args) => ffmpegKit(args);
const q = (p) => p;
fs.mkdirSync(out, { recursive: true });
const chicos = path.join(out, "frames-chicos");
fs.rmSync(chicos, { recursive: true, force: true });
fs.mkdirSync(chicos, { recursive: true });
ffmpeg(["-i", q(video), "-vf", "scale=108:192", q(path.join(chicos, "%05d.png"))]);
const files = fs.readdirSync(chicos).filter((f) => f.endsWith(".png")).sort();
const imgs = files.map((f) => decodePng(fs.readFileSync(path.join(chicos, f))));
const N = imgs.length;
const bpp = imgs[0].data.length / (imgs[0].width * imgs[0].height);
/** % de píxeles cuyo canal cambia más de 12 niveles */
const cambio = (a, b) => {
  let n = 0;
  const px = a.width * a.height;
  for (let i = 0; i < px; i++)
    for (let c = 0; c < 3; c++)
      if (Math.abs(a.data[i * bpp + c] - b.data[i * bpp + c]) > 12) {
        n++;
        break;
      }
  return (100 * n) / px;
};
const fallas = [];
const rep = { video, fotogramas: N, segundos: Number((N / FPS).toFixed(2)) };

// 1 · duración
if (N / FPS > R.durMax) fallas.push(`dura ${(N / FPS).toFixed(1)} s (tope ${R.durMax} s)`);

// 2 · gancho: movimiento antes de 0,5 s y cambio fuerte antes de 2 s
rep.gancho = { cambio_f0_f15: Number(cambio(imgs[0], imgs[Math.min(15, N - 1)]).toFixed(2)), maxAntesDe2s: 0, fMax: 0 };
for (let f = 1; f <= Math.min(R.cambioAntes * FPS, N - 1); f++) {
  const d = cambio(imgs[0], imgs[f]);
  if (d > rep.gancho.maxAntesDe2s) Object.assign(rep.gancho, { maxAntesDe2s: Number(d.toFixed(2)), fMax: f });
}
if (rep.gancho.cambio_f0_f15 < 0.5) fallas.push(`sin movimiento visible antes de 0,5 s (f0→f15 cambia ${rep.gancho.cambio_f0_f15} %)`);
if (rep.gancho.maxAntesDe2s < 6) fallas.push(`sin cambio visual fuerte antes de 2 s (máximo ${rep.gancho.maxAntesDe2s} % en f${rep.gancho.fMax})`);

// 3 · encuadre fijo: desde cada fotograma, en los 3 s siguientes tiene que cambiar ≥ 4 % del cuadro (y ≥ 0,5 % en 1 s)
const fijos = [];
const quietos = [];
for (let f = 0; f + R.encuadreMax * FPS < N; f++) {
  const m = Math.max(cambio(imgs[f], imgs[f + 30]), cambio(imgs[f], imgs[f + 60]), cambio(imgs[f], imgs[f + 90]));
  if (m < 4) fijos.push(f);
}
for (let f = 0; f + FPS < N; f++) if (cambio(imgs[f], imgs[f + FPS]) < 0.5) quietos.push(f);
const tramos = (fs_) => {
  const t = [];
  for (const f of fs_) {
    const u = t[t.length - 1];
    if (u && f === u.hasta + 1) u.hasta = f;
    else t.push({ desde: f, hasta: f });
  }
  return t;
};
rep.encuadresFijos = tramos(fijos);
rep.tramosQuietos = tramos(quietos);
if (rep.encuadresFijos.length) fallas.push(`encuadre fijo más de 3 s: ${rep.encuadresFijos.map((t) => `f${t.desde}–f${t.hasta + 90}`).join(", ")}`);
if (rep.tramosQuietos.length) fallas.push(`tramos quietos (1 s casi sin cambios): ${rep.tramosQuietos.map((t) => `f${t.desde}–f${t.hasta + 30}`).join(", ")}`);

// 4 · loop
rep.loop = Number(cambio(imgs[N - 1], imgs[0]).toFixed(2));
if (rep.loop > 1) fallas.push(`el último fotograma no empalma con el primero (${rep.loop} % distinto)`);
fs.rmSync(chicos, { recursive: true, force: true });

// 5 · audio: silencios > 0,4 s (ventanas de 50 ms por debajo de −45 dBFS)
const wav = path.join(out, "audio-qa.wav");
let silencios = [];
try {
  ffmpeg(["-i", q(video), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", q(wav)]);
  const b = fs.readFileSync(wav);
  let o = 12;
  while (o < b.length && b.toString("ascii", o, o + 4) !== "data") o += 8 + b.readUInt32LE(o + 4);
  const start = o + 8;
  const n = Math.floor((b.length - start) / 2);
  const win = 800;
  let desde = null;
  for (let i = 0; i + win <= n; i += win) {
    let s = 0;
    for (let k = 0; k < win; k++) {
      const v = b.readInt16LE(start + (i + k) * 2) / 32768;
      s += v * v;
    }
    const db = 10 * Math.log10(s / win + 1e-12);
    const t = i / 16000;
    if (db < -45) desde ??= t;
    else {
      if (desde !== null && t - desde > R.silencioMax) silencios.push([Number(desde.toFixed(2)), Number(t.toFixed(2))]);
      desde = null;
    }
  }
  if (desde !== null && n / 16000 - desde > R.silencioMax) silencios.push([Number(desde.toFixed(2)), Number((n / 16000).toFixed(2))]);
  fs.rmSync(wav, { force: true });
  rep.silencios = silencios;
  if (silencios.length) fallas.push(`silencios de más de 0,4 s: ${silencios.map(([a, z]) => `${a}–${z} s`).join(", ")}`);
} catch {
  rep.silencios = "sin pista de audio";
  fallas.push("el video no tiene audio");
}

// 6 · stills del checklist + franjas vacías (renglones casi lisos seguidos dentro de la escena)
const stills = path.join(out, "stills");
fs.mkdirSync(stills, { recursive: true });
const tomas = [
  ["0.0s", 0],
  ["1.0s", 30],
  ["3.0s", 90],
  ["ultimo", N - 1],
];
rep.franjas = {};
for (const [nombre, f] of tomas) {
  const png = path.join(stills, `${nombre}.png`);
  // (el ffmpeg de Remotion no trae el filtro select: se busca por tiempo, medio fotograma antes)
  ffmpeg(["-i", q(video), "-ss", (Math.max(0, f - 0.5) / FPS).toFixed(4), "-frames:v", "1", q(png)]);
  const im = decodePng(fs.readFileSync(png));
  const c = im.data.length / (im.width * im.height);
  // un renglón «tiene dibujo» si ≥ 4 % de sus píxeles se apartan > 40 niveles del color más común del renglón
  let racha = 0;
  let peor = { alto: 0, desde: 0 };
  for (let y = R.escena[0]; y < R.escena[1]; y++) {
    const cuenta = new Map();
    for (let x = 0; x < im.width; x += 4) {
      const i = (y * im.width + x) * c;
      const k = ((im.data[i] >> 4) << 8) | ((im.data[i + 1] >> 4) << 4) | (im.data[i + 2] >> 4);
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    }
    let moda = 0;
    let kModa = 0;
    for (const [k, v] of cuenta) if (v > moda) [moda, kModa] = [v, k];
    const mr = ((kModa >> 8) & 15) * 17;
    const mg = ((kModa >> 4) & 15) * 17;
    const mb = (kModa & 15) * 17;
    let distintos = 0;
    let total = 0;
    for (let x = 0; x < im.width; x += 4) {
      const i = (y * im.width + x) * c;
      total++;
      if (Math.abs(im.data[i] - mr) > 40 || Math.abs(im.data[i + 1] - mg) > 40 || Math.abs(im.data[i + 2] - mb) > 40) distintos++;
    }
    if (distintos / total < 0.04) {
      racha++;
      if (racha > peor.alto) peor = { alto: racha, desde: y - racha + 1 };
    } else racha = 0;
  }
  rep.franjas[nombre] = peor;
  if (peor.alto > R.franjaMax) fallas.push(`franja vacía de ${peor.alto} px desde y = ${peor.desde} en el still ${nombre}`);
}
rep.stills = stills;
rep.fallas = fallas;
fs.writeFileSync(path.join(out, "retencion.json"), JSON.stringify(rep, null, 2));
console.log(JSON.stringify(rep, null, 2));
console.log(fallas.length ? `\nFALLA (${fallas.length})` : "\nPASA");
process.exit(fallas.length ? 1 : 0);
