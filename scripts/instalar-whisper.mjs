// Instala whisper.cpp y su modelo en la carpeta .whisper/ del kit (una sola vez).
// Uso: node scripts/instalar-whisper.mjs [base|small]
// En Windows baja el programa ya compilado; en Mac/Linux lo compila (hace falta tener las herramientas de desarrollo).
import { downloadWhisperModel, installWhisperCpp } from "@remotion/install-whisper-cpp";
import process from "node:process";
import { leerEnv } from "./lib/comun.mjs";
import { WHISPER, whisperListo } from "./lib/whisper.mjs";

const modelo = process.argv[2] || leerEnv().WHISPER_MODELO || WHISPER.modelo;
if (whisperListo(modelo)) {
  console.log(`whisper.cpp ya está instalado (modelo ${modelo}).`);
  process.exit(0);
}
console.log(`Instalando whisper.cpp ${WHISPER.version} en .whisper/ …`);
await installWhisperCpp({ to: WHISPER.dir, version: WHISPER.version, printOutput: false });
console.log(`Bajando el modelo «${modelo}» (base ≈ 150 MB, small ≈ 470 MB)…`);
await downloadWhisperModel({ model: modelo, folder: WHISPER.dir, printOutput: false });
console.log(whisperListo(modelo) ? "whisper.cpp listo." : "Algo no quedó bien: revisa la carpeta .whisper/");
process.exit(whisperListo(modelo) ? 0 : 1);
