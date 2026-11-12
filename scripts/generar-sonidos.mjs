// Efectos de sonido sintetizados por código (sin grabaciones ni licencias de terceros).
// Salida: public/sonidos/{whoosh,pop,ping,trazo}.wav · Uso: node scripts/generar-sonidos.mjs
import path from "node:path";
import { PUBLIC, escribirWav } from "./lib/comun.mjs";

const SR = 44100;
const OUT = path.join(PUBLIC, "sonidos");
const azar = (s) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const buf = (s) => new Float32Array(Math.round(s * SR));
const normalizar = (x, pico = 0.7) => {
  const m = x.reduce((a, v) => Math.max(a, Math.abs(v)), 1e-9);
  return x.map((v) => (v / m) * pico);
};
/** filtro pasabanda de 2.º orden con frecuencia variable */
const pasabanda = (x, fq, q = 1.2) => {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const w = (2 * Math.PI * Math.min(fq(i), SR * 0.45)) / SR;
    const a = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const v = (a * x[i] - a * x2 - -2 * c * y1 - (1 - a) * y2) / (1 + a);
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
};

// whoosh: ruido con un barrido de 300 Hz a 2,4 kHz y vuelta
{
  const r = azar(7);
  const x = buf(0.42);
  for (let i = 0; i < x.length; i++) x[i] = r() * 2 - 1;
  const n = x.length;
  const y = pasabanda(x, (i) => 300 + 2100 * Math.sin((Math.PI * i) / n), 1.4);
  for (let i = 0; i < n; i++) y[i] *= Math.sin((Math.PI * i) / n) ** 1.6;
  escribirWav(path.join(OUT, "whoosh.wav"), normalizar(y, 0.6), SR);
}
// pop: seno que cae de 900 a 180 Hz con ataque corto
{
  const x = buf(0.16);
  let fase = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    fase += (2 * Math.PI * (180 + 720 * Math.exp(-t * 40))) / SR;
    x[i] = Math.sin(fase) * Math.exp(-t * 26) * Math.min(1, t * 900);
  }
  escribirWav(path.join(OUT, "pop.wav"), normalizar(x, 0.7), SR);
}
// ping: dos parciales tipo campanita
{
  const x = buf(0.6);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = (Math.sin(2 * Math.PI * 1320 * t) * 0.7 + Math.sin(2 * Math.PI * 1980 * t) * 0.3) * Math.exp(-t * 7) * Math.min(1, t * 2000);
  }
  escribirWav(path.join(OUT, "ping.wav"), normalizar(x, 0.55), SR);
}
// trazo: fibra sobre papel (ruido agudo con pulsos irregulares)
{
  const r = azar(11);
  const x = buf(0.5);
  for (let i = 0; i < x.length; i++) x[i] = r() * 2 - 1;
  const y = pasabanda(x, () => 3200, 0.8);
  const n = y.length;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const pulsos = 0.55 + 0.45 * Math.sin(2 * Math.PI * 9 * t + Math.sin(2 * Math.PI * 3 * t) * 2);
    y[i] *= pulsos * Math.sin((Math.PI * i) / n) ** 0.8;
  }
  escribirWav(path.join(OUT, "trazo.wav"), normalizar(y, 0.5), SR);
}
console.log(`Sonidos listos en ${path.relative(process.cwd(), OUT) || OUT}`);
