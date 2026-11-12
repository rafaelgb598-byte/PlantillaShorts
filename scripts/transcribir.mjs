// Tiempos palabra por palabra de una grabación propia, con whisper.cpp (corre en tu computadora, sin internet).
// Uso: node scripts/transcribir.mjs <slug>
// Lee trabajo/<slug>/voz-16k.wav (lo deja normalizar-voz.mjs) y, si existe, trabajo/<slug>/guion.txt.
// Escribe trabajo/<slug>/palabras.json: el texto del guion (bien escrito) con los tiempos de tu voz.
// Si leíste algo distinto del guion, se usa lo que entendió whisper (y te avisa).
import { toCaptions, transcribe } from "@remotion/install-whisper-cpp";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { RAIZ, dirShort, escribirJson, leerEnv } from "./lib/comun.mjs";
import { WHISPER, whisperListo } from "./lib/whisper.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("Uso: node scripts/transcribir.mjs <slug>");
  process.exit(2);
}
const dir = dirShort(slug);
const wav = path.join(dir, "voz-16k.wav");
if (!fs.existsSync(wav)) {
  console.error(`Falta ${path.relative(RAIZ, wav)}: primero corre normalizar-voz.mjs`);
  process.exit(1);
}
const modelo = leerEnv().WHISPER_MODELO || WHISPER.modelo;
if (!whisperListo(modelo)) {
  console.error("whisper.cpp no está instalado: corre  node scripts/instalar-whisper.mjs");
  process.exit(1);
}

const norm = (t) =>
  String(t)
    .toLowerCase()
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ")
    .replace(/[^a-zñ0-9]/g, "");
const parecido = (a, b) => {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - m[a.length][b.length] / Math.max(a.length, b.length);
};

console.log(`Transcribiendo con whisper.cpp (modelo ${modelo})…`);
const salida = await transcribe({
  inputPath: wav,
  whisperPath: WHISPER.dir,
  whisperCppVersion: WHISPER.version,
  model: modelo,
  modelFolder: WHISPER.dir,
  tokenLevelTimestamps: true,
  language: "es",
  printOutput: false,
});
const { captions } = toCaptions({ whisperCppOutput: salida });
// whisper devuelve trozos de palabra: una palabra nueva empieza con espacio; los trozos y signos se pegan a la anterior
const oidas = [];
for (const c of captions) {
  const txt = c.text;
  if (!txt.trim() || /^\[.*\]$/.test(txt.trim())) continue;
  const nueva = /^\s/.test(txt) && !/^\s*[.,;:!?…»”)]/.test(txt);
  const ult = oidas[oidas.length - 1];
  if (!nueva && ult) {
    ult.t += txt.trim();
    ult.e = Math.max(ult.e, c.endMs / 1000);
  } else oidas.push({ t: txt.trim(), s: c.startMs / 1000, e: c.endMs / 1000 });
}
fs.writeFileSync(path.join(dir, "transcripcion.json"), JSON.stringify(oidas, null, 1));
if (!oidas.length) {
  console.error("whisper no entendió ninguna palabra: revisa que la grabación tenga voz.");
  process.exit(1);
}

const guionP = path.join(dir, "guion.txt");
let palabras;
if (fs.existsSync(guionP)) {
  const guion = fs.readFileSync(guionP, "utf8").replace(/^﻿/, "").split(/\s+/).filter(Boolean);
  // alineación global (Needleman–Wunsch) entre el guion y lo que se oyó
  const A = guion.map(norm);
  const B = oidas.map((w) => norm(w.t));
  const n = A.length;
  const m = B.length;
  const S = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  const T = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) (S[i][0] = -i), (T[i][0] = 1);
  for (let j = 1; j <= m; j++) (S[0][j] = -j), (T[0][j] = 2);
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const p = parecido(A[i - 1], B[j - 1]);
      const diag = S[i - 1][j - 1] + (p >= 0.99 ? 2 : p >= 0.6 ? 1 : -1);
      const arriba = S[i - 1][j] - 0.8;
      const izq = S[i][j - 1] - 0.8;
      if (diag >= arriba && diag >= izq) (S[i][j] = diag), (T[i][j] = 0);
      else if (arriba >= izq) (S[i][j] = arriba), (T[i][j] = 1);
      else (S[i][j] = izq), (T[i][j] = 2);
    }
  const par = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 || j > 0; ) {
    if (i > 0 && j > 0 && T[i][j] === 0) {
      if (parecido(A[i - 1], B[j - 1]) >= 0.6) par[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && (j === 0 || T[i][j] === 1)) i--;
    else j--;
  }
  const coinciden = par.filter((x) => x >= 0).length;
  if (coinciden / n < 0.55) {
    console.log(`Aviso: tu grabación se parece poco al guion (${Math.round((100 * coinciden) / n)} % de palabras iguales). Uso lo que entendió whisper.`);
    palabras = oidas;
  } else {
    // palabras del guion sin pareja: se reparten en el hueco entre sus vecinas
    palabras = guion.map((t, i) => ({ t, s: NaN, e: NaN, j: par[i] }));
    for (const w of palabras) if (w.j >= 0) Object.assign(w, { s: oidas[w.j].s, e: oidas[w.j].e });
    for (let i = 0; i < palabras.length; i++) {
      if (!Number.isNaN(palabras[i].s)) continue;
      let k = i;
      while (k < palabras.length && Number.isNaN(palabras[k].s)) k++;
      const desde = i > 0 ? palabras[i - 1].e : Math.max(0, (palabras[k]?.s ?? 0) - 0.3 * (k - i));
      const hasta = k < palabras.length ? palabras[k].s : desde + 0.3 * (k - i);
      const paso = Math.max(0.05, (hasta - desde) / (k - i));
      for (let q = i; q < k; q++) Object.assign(palabras[q], { s: desde + paso * (q - i), e: desde + paso * (q - i + 1) - 0.01 });
      i = k - 1;
    }
    palabras = palabras.map(({ t, s, e }) => ({ t, s, e }));
    console.log(`Guion alineado con tu voz: ${coinciden} de ${n} palabras coinciden exacto o casi.`);
  }
} else palabras = oidas;

// tiempos crecientes y redondeados
let ult = 0;
palabras = palabras.map((w) => {
  const s = Math.max(ult, w.s);
  const e = Math.max(s + 0.05, w.e);
  ult = s;
  return { t: w.t, s: Number(s.toFixed(3)), e: Number(e.toFixed(3)) };
});
escribirJson(path.join(dir, "palabras.json"), palabras);
console.log(`Listo: ${path.relative(RAIZ, path.join(dir, "palabras.json"))} (${palabras.length} palabras, termina en ${palabras.at(-1).e.toFixed(1)} s)`);
