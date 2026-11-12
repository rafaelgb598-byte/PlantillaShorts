// Dónde vive whisper.cpp dentro del kit (carpeta .whisper/, no se sube a ningún lado).
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "./comun.mjs";

export const WHISPER = { dir: path.join(RAIZ, ".whisper"), version: "1.5.5", modelo: "base" };
export const archivoModelo = (modelo) => path.join(WHISPER.dir, `ggml-${modelo}.bin`);
export const whisperListo = (modelo = WHISPER.modelo) => {
  if (!fs.existsSync(WHISPER.dir)) return false;
  const exe = ["main.exe", "main", "build/bin/main", "whisper-cli.exe", "build/bin/whisper-cli"].some((f) => fs.existsSync(path.join(WHISPER.dir, f)));
  return exe && fs.existsSync(archivoModelo(modelo));
};
