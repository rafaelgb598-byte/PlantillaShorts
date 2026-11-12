// Voz con ElevenLabs (tu propia cuenta). La clave se lee de .env (ELEVENLABS_API_KEY) y nunca se imprime.
// Uso:
//   node scripts/voz-elevenlabs.mjs <slug> --contar     → cuántos caracteres va a gastar (no gasta nada)
//   node scripts/voz-elevenlabs.mjs <slug> --generar    → genera la voz con tiempos (endpoint with-timestamps)
//   node scripts/voz-elevenlabs.mjs --voces             → lista las voces de tu cuenta (id y nombre)
// Lee trabajo/<slug>/guion.txt · voz: ELEVENLABS_VOZ_ID en .env (la eliges en el panel).
// Deja public/trabajo/<slug>/voz.mp3 y trabajo/<slug>/palabras.json listos para el render.
/* global fetch */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { RAIZ, dirShort, escribirJson, leerEnv } from "./lib/comun.mjs";
import { leerGuion } from "./lib/props.mjs";
import { normalizarVoz } from "./normalizar-voz.mjs";

const API = "https://api.elevenlabs.io/v1";
const MODELO = "eleven_multilingual_v2";
const AJUSTES = { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 1.0 };

const args = process.argv.slice(2);
const env = leerEnv();
const clave = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
const vozId = process.env.ELEVENLABS_VOZ_ID || env.ELEVENLABS_VOZ_ID;
const falta = (m) => {
  console.error(m);
  process.exit(1);
};

const pedir = async (ruta, opciones = {}) => {
  const r = await fetch(`${API}${ruta}`, { ...opciones, headers: { "xi-api-key": clave, "Content-Type": "application/json", ...(opciones.headers ?? {}) } });
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 300);
    if (r.status === 401) throw new Error("ElevenLabs rechazó la clave (401). Revísala en el panel o en .env.");
    throw new Error(`ElevenLabs respondió ${r.status}: ${txt}`);
  }
  return r.json();
};

if (args.includes("--voces")) {
  if (!clave) falta("Falta ELEVENLABS_API_KEY en .env (la pegas en el panel).");
  const { voices } = await pedir("/voices");
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}${v.labels?.accent ? ` · ${v.labels.accent}` : ""}${v.labels?.language ? ` · ${v.labels.language}` : ""}`);
  process.exit(0);
}

const slug = args.find((a) => !a.startsWith("--"));
if (!slug) falta("Uso: node scripts/voz-elevenlabs.mjs <slug> --contar | --generar");
const texto = leerGuion(slug);
const caracteres = texto.length;

if (args.includes("--contar")) {
  console.log(`CARACTERES=${caracteres}`);
  console.log(`Este guion gasta ${caracteres} caracteres de tu cuenta de ElevenLabs.`);
  if (clave) {
    try {
      const s = await pedir("/user/subscription");
      if (typeof s.character_limit === "number") console.log(`Te quedan ${Math.max(0, s.character_limit - s.character_count)} caracteres este mes.`);
    } catch {
      // la clave puede no tener permiso para leer la suscripción: no es un problema
    }
  }
  process.exit(0);
}

if (!args.includes("--generar")) falta("Indica --contar o --generar.");
if (!clave) falta("Falta ELEVENLABS_API_KEY en .env (la pegas en el panel).");
if (!vozId) falta("Falta ELEVENLABS_VOZ_ID en .env (elige una voz en el panel o corre --voces).");

const dir = dirShort(slug);
fs.mkdirSync(dir, { recursive: true });
console.log(`Generando la voz (${caracteres} caracteres)…`);
const r = await pedir(`/text-to-speech/${encodeURIComponent(vozId)}/with-timestamps?output_format=mp3_44100_128`, {
  method: "POST",
  body: JSON.stringify({ text: texto, model_id: MODELO, voice_settings: AJUSTES }),
});
const cruda = path.join(dir, "voz-cruda.mp3");
fs.writeFileSync(cruda, Buffer.from(r.audio_base64, "base64"));

// caracteres con tiempos → palabras con tiempos
const al = r.alignment ?? r.normalized_alignment;
const palabras = [];
let actual = null;
al.characters.forEach((c, i) => {
  if (/\s/.test(c)) {
    if (actual) palabras.push(actual);
    actual = null;
    return;
  }
  if (!actual) actual = { t: "", s: al.character_start_times_seconds[i], e: al.character_end_times_seconds[i] };
  actual.t += c;
  actual.e = al.character_end_times_seconds[i];
});
if (actual) palabras.push(actual);
escribirJson(path.join(dir, "palabras-crudas.json"), palabras);
escribirJson(path.join(dir, "voz-info.json"), { proveedor: "ElevenLabs", modelo: MODELO, vozId, caracteres, fecha: new Date().toISOString() });

const res = normalizarVoz(slug, cruda);
console.log(`Voz lista: ${res.duracion.toFixed(1)} s · ${palabras.length} palabras · ${path.relative(RAIZ, res.mp3)}`);
