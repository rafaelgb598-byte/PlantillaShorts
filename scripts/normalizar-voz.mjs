// Prepara la voz para el render: recorta silencios largos, normaliza el volumen y deja un MP3 limpio.
// Uso: node scripts/normalizar-voz.mjs <slug> "<archivo de voz>"
//   → public/trabajo/<slug>/voz.mp3   (lo que suena en el video)
//   → trabajo/<slug>/voz-16k.wav      (para la transcripción)
//   → trabajo/<slug>/voz-mapa.json    (cómo se movieron los tiempos)
// Si existe trabajo/<slug>/palabras-crudas.json (ElevenLabs), también escribe palabras.json con los tiempos corregidos.
//
// Silencios: el del principio queda en 0,05 s, los del medio de más de 0,30 s quedan en 0,22 s y el del final en 0,15 s
// (una voz que arranca en el cuadro 0 y no deja huecos retiene mejor). Volumen: pico a −3 dBFS y un limitador suave
// (≈ −14 LUFS, el nivel de YouTube). Todo con el ffmpeg de Remotion y cálculos en Node: no hay que instalar nada.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { PUBLIC, RAIZ, dirShort, escribirJson, escribirWav, ffmpeg, leerJson, leerWav } from "./lib/comun.mjs";

const SR = 44100;
const VENTANA = 0.02;
const UMBRAL_DB = -42;
const SIL = { inicio: 0.05, medioMax: 0.3, medio: 0.22, fin: 0.15, fundido: 0.008 };

const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
const pico = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/** tramos de sonido [desde, hasta) en segundos */
const tramosConSonido = (x) => {
  const w = Math.round(VENTANA * SR);
  const n = Math.floor(x.length / w);
  const voz = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < w; k++) s += x[i * w + k] ** 2;
    voz.push(db(Math.sqrt(s / w)) > UMBRAL_DB);
  }
  const t = [];
  for (let i = 0; i < n; i++) {
    if (!voz[i]) continue;
    const u = t[t.length - 1];
    if (u && i * VENTANA - u[1] < 1e-6) u[1] = (i + 1) * VENTANA;
    else t.push([i * VENTANA, (i + 1) * VENTANA]);
  }
  return t;
};

/** decide qué partes del audio se conservan: lista de [srcDesde, srcHasta] */
const segmentos = (tramos, durTotal) => {
  if (!tramos.length) return [[0, durTotal]];
  const seg = [];
  const a0 = Math.max(0, tramos[0][0] - SIL.inicio);
  let desde = a0;
  for (let i = 0; i < tramos.length - 1; i++) {
    const fin = tramos[i][1];
    const sig = tramos[i + 1][0];
    const hueco = sig - fin;
    if (hueco > SIL.medioMax) {
      seg.push([desde, fin + SIL.medio / 2]);
      desde = sig - SIL.medio / 2;
    }
  }
  seg.push([desde, Math.min(durTotal, tramos[tramos.length - 1][1] + SIL.fin)]);
  return seg;
};

/** convierte un tiempo del audio original al audio recortado */
export const mapear = (seg, t) => {
  let acum = 0;
  for (const [a, b] of seg) {
    if (t < a) return acum;
    if (t <= b) return acum + (t - a);
    acum += b - a;
  }
  return acum;
};

const limitar = (x) => {
  const L = Math.round(0.002 * SR);
  const r = Math.exp(-1 / (0.06 * SR));
  const techo = 10 ** (-3 / 20);
  const empuje = 10 ** (4.5 / 20);
  const n = x.length;
  const nec = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.abs(x[i] * empuje);
    nec[i] = v > techo ? techo / v : 1;
  }
  const m = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 1;
    for (let j = Math.max(0, i - L); j <= Math.min(n - 1, i + L); j++) if (nec[j] < v) v = nec[j];
    m[i] = v;
  }
  const out = new Float32Array(n);
  let suma = 0;
  let g = 1;
  for (let i = 0; i < n; i++) {
    suma += m[i];
    if (i > L) suma -= m[i - L - 1];
    const s = suma / Math.min(i + 1, L + 1);
    g = s < g ? s : g + (s - g) * (1 - r);
    out[i] = x[i] * empuje * g;
  }
  return out;
};

export const normalizarVoz = (slug, entrada) => {
  const dir = dirShort(slug);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(entrada)) throw new Error(`no encuentro el audio ${entrada}`);
  const tmp = path.join(dir, "voz-decodificada.wav");
  ffmpeg(["-i", path.resolve(entrada), "-ac", "1", "-ar", String(SR), "-c:a", "pcm_s16le", tmp]);
  const { x } = leerWav(fs.readFileSync(tmp));
  const p = pico(x);
  if (p < 1e-4) throw new Error("el audio está en silencio");
  const pre = 10 ** (-3 / 20) / p;
  for (let i = 0; i < x.length; i++) x[i] *= pre;
  const dur = x.length / SR;
  const seg = segmentos(tramosConSonido(x), dur);
  // une los segmentos con fundidos cortos (sin clics)
  const F = Math.round(SIL.fundido * SR);
  const partes = seg.map(([a, b]) => x.subarray(Math.round(a * SR), Math.round(b * SR)));
  const largo = partes.reduce((s, q) => s + q.length, 0);
  const y = new Float32Array(largo);
  let o = 0;
  for (const q of partes) {
    for (let i = 0; i < q.length; i++) {
      const env = Math.min(1, i / F, (q.length - 1 - i) / F);
      y[o + i] = q[i] * Math.max(0, env);
    }
    o += q.length;
  }
  const master = limitar(y);
  const wavMaster = path.join(dir, "voz-master.wav");
  escribirWav(wavMaster, master, SR);
  const mp3 = path.join(PUBLIC, "trabajo", slug, "voz.mp3");
  fs.mkdirSync(path.dirname(mp3), { recursive: true });
  ffmpeg(["-i", wavMaster, "-c:a", "libmp3lame", "-b:a", "192k", mp3]);
  ffmpeg(["-i", wavMaster, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", path.join(dir, "voz-16k.wav")]);
  fs.rmSync(tmp, { force: true });
  fs.rmSync(wavMaster, { force: true });
  const recortado = dur - largo / SR;
  escribirJson(path.join(dir, "voz-mapa.json"), { original: Number(dur.toFixed(3)), final: Number((largo / SR).toFixed(3)), segmentos: seg.map(([a, b]) => [Number(a.toFixed(3)), Number(b.toFixed(3))]) });
  // tiempos de ElevenLabs → tiempos del audio recortado
  const crudas = path.join(dir, "palabras-crudas.json");
  if (fs.existsSync(crudas)) {
    const ws = leerJson(crudas).map((w) => ({ t: w.t, s: Number(mapear(seg, w.s).toFixed(3)), e: Number(mapear(seg, w.e).toFixed(3)) }));
    escribirJson(path.join(dir, "palabras.json"), ws);
  }
  return { duracion: largo / SR, recortado, mp3 };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [slug, entrada] = process.argv.slice(2);
  if (!slug || !entrada) {
    console.error('Uso: node scripts/normalizar-voz.mjs <slug> "<archivo de voz>"');
    process.exit(2);
  }
  try {
    const r = normalizarVoz(slug, entrada);
    console.log(`Voz lista: ${path.relative(RAIZ, r.mp3)} · ${r.duracion.toFixed(1)} s (se quitaron ${r.recortado.toFixed(1)} s de silencios)`);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
