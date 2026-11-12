// Utilidades compartidas por los scripts del kit.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TRABAJO = path.join(RAIZ, "trabajo");
export const VOZ_DIR = path.join(RAIZ, "Pon aquí tu voz");
export const LISTOS = path.join(RAIZ, "Shorts listos");
export const PUBLIC = path.join(RAIZ, "public");
export const ES_WIN = process.platform === "win32";

export const dirShort = (slug) => {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug ?? "")) throw new Error(`slug inválido «${slug}»: usa minúsculas, números y guiones (p. ej. e1-efecto-ikea)`);
  return path.join(TRABAJO, slug);
};
export const leerJson = (p, def) => {
  if (!fs.existsSync(p)) {
    if (def !== undefined) return def;
    throw new Error(`no existe ${path.relative(RAIZ, p)}`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
};
export const escribirJson = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};

/** ffmpeg que trae Remotion (no hace falta instalar nada aparte) */
export const ffmpeg = (args, opciones = {}) =>
  execFileSync(ES_WIN ? "npx.cmd" : "npx", ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", ...args.map((a) => (ES_WIN && /[\s&()]/.test(a) ? `"${a}"` : a))], {
    cwd: RAIZ,
    shell: ES_WIN,
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1 << 28,
    ...opciones,
  });
export const ffprobeDuracion = (archivo) => {
  const out = execFileSync(ES_WIN ? "npx.cmd" : "npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", ES_WIN ? `"${archivo}"` : archivo], {
    cwd: RAIZ,
    shell: ES_WIN,
    encoding: "utf8",
  });
  return Number(out.trim());
};

/** lee un .env simple (CLAVE=valor) sin imprimir nada */
export const leerEnv = () => {
  const p = path.join(RAIZ, ".env");
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
};
export const guardarEnv = (cambios) => {
  const p = path.join(RAIZ, ".env");
  const actual = fs.existsSync(p) ? fs.readFileSync(p, "utf8").split(/\r?\n/) : [];
  const vistos = new Set();
  const lineas = actual.map((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && m[1] in cambios) {
      vistos.add(m[1]);
      return `${m[1]}=${cambios[m[1]]}`;
    }
    return l;
  });
  for (const [k, v] of Object.entries(cambios)) if (!vistos.has(k)) lineas.push(`${k}=${v}`);
  fs.writeFileSync(p, lineas.filter((l, i, a) => l !== "" || i < a.length - 1).join("\n") + "\n");
};

// ── WAV mono 16 bits ──
export const leerWav = (buf) => {
  let pos = 12;
  let sr = 44100;
  let canales = 1;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      canales = buf.readUInt16LE(pos + 10);
      sr = buf.readUInt32LE(pos + 12);
    }
    if (id === "data") {
      const data = buf.subarray(pos + 8, pos + 8 + size);
      const n = Math.floor(data.length / 2 / canales);
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = data.readInt16LE(i * 2 * canales) / 32768;
      return { sr, x };
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error("WAV sin datos");
};
export const escribirWav = (p, x, sr) => {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, b);
};

export const slugDe = (texto) =>
  String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
