// Revisa que esté todo lo necesario para crear shorts. No instala nada: solo informa.
// Uso: node scripts/revisar-entorno.mjs   (la última línea es un resumen en JSON para la skill)
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { RAIZ, leerEnv } from "./lib/comun.mjs";
import { WHISPER, whisperListo } from "./lib/whisper.mjs";

const [may, men] = process.versions.node.split(".").map(Number);
const nodeOk = may > 20 || (may === 20 && men >= 19);
const deps = ["remotion", "@remotion/renderer", "@remotion/bundler", "@remotion/install-whisper-cpp", "d3-geo", "world-atlas"].every((d) => fs.existsSync(path.join(RAIZ, "node_modules", ...d.split("/"), "package.json")));
const env = leerEnv();
const modelo = env.WHISPER_MODELO || WHISPER.modelo;
const estado = {
  node: { ok: nodeOk, version: process.versions.node, pide: ">= 20.19 (LTS)" },
  dependencias: { ok: deps, arreglo: "npm install" },
  whisper: { ok: whisperListo(modelo), modelo, arreglo: "node scripts/instalar-whisper.mjs", soloPara: "grabación propia (mp3)" },
  elevenlabs: { claveCargada: Boolean(env.ELEVENLABS_API_KEY), vozElegida: Boolean(env.ELEVENLABS_VOZ_ID), soloPara: "voz de ElevenLabs" },
  sonidos: { ok: fs.existsSync(path.join(RAIZ, "public", "sonidos", "whoosh.wav")), arreglo: "node scripts/generar-sonidos.mjs" },
};
const m = (ok) => (ok ? "✔" : "✖");
console.log(`${m(nodeOk)} Node ${process.versions.node}${nodeOk ? "" : " — hace falta Node 20.19 o más nuevo (LTS) de nodejs.org"}`);
console.log(`${m(deps)} Dependencias${deps ? "" : " — falta correr «npm install» (baja Remotion y los mapas, ~400 MB)"}`);
console.log(`${m(estado.sonidos.ok)} Efectos de sonido${estado.sonidos.ok ? "" : " — corre «node scripts/generar-sonidos.mjs»"}`);
console.log(`${m(estado.whisper.ok)} whisper.cpp (modelo ${modelo})${estado.whisper.ok ? "" : " — solo si usas tu grabación: «node scripts/instalar-whisper.mjs» (~150 MB)"}`);
console.log(`${estado.elevenlabs.claveCargada ? "✔" : "·"} Clave de ElevenLabs ${estado.elevenlabs.claveCargada ? "cargada" : "sin cargar (solo hace falta si eliges ElevenLabs)"}`);
console.log("ENTORNO " + JSON.stringify(estado));
