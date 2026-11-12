// Panel local para elegir estilo, tema y voz. Solo escucha en tu computadora (127.0.0.1); no usa internet,
// salvo para validar tu clave de ElevenLabs con ElevenLabs si eliges esa opción.
// Uso: node panel/servidor.mjs [--sin-abrir]      (lo levanta la skill /shorts-gratis)
/* global fetch */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { RAIZ, TRABAJO, VOZ_DIR, escribirJson, guardarEnv, leerEnv, leerJson, slugDe } from "../scripts/lib/comun.mjs";

const PANEL = path.join(RAIZ, "panel");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".gif": "image/gif", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".ico": "image/x-icon" };
const AUDIO = /\.(mp3|wav|m4a|ogg|aac|flac)$/i;
const ESTILOS = ["explicador", "pizarra", "mapa"];

const json = (res, code, v) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(v));
};
const cuerpo = (req) =>
  new Promise((ok, mal) => {
    let s = "";
    req.on("data", (c) => {
      s += c;
      if (s.length > 1e5) mal(new Error("demasiado grande"));
    });
    req.on("end", () => {
      try {
        ok(s ? JSON.parse(s) : {});
      } catch (e) {
        mal(e);
      }
    });
  });

const vocesDe = async (clave) => {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": clave } });
  if (r.status === 401) return { ok: false, error: "ElevenLabs no aceptó esa clave. Revisa que la copiaste completa." };
  if (!r.ok) return { ok: false, error: `ElevenLabs respondió ${r.status}. Prueba de nuevo en un rato.` };
  const { voices } = await r.json();
  return {
    ok: true,
    voces: voices.map((v) => ({
      id: v.voice_id,
      nombre: v.name,
      detalle: [v.labels?.accent, v.labels?.gender, v.labels?.language].filter(Boolean).join(" · "),
      espanol: /spanish|español|latin|mexic|argentin|colombi|es-/i.test(JSON.stringify(v.labels ?? {}) + JSON.stringify(v.verified_languages ?? [])),
    })),
  };
};

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "POST") {
      const origen = req.headers.origin ?? "";
      if (origen && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origen)) return json(res, 403, { error: "origen no permitido" });
    }
    if (url.pathname === "/api/temas") return json(res, 200, leerJson(path.join(RAIZ, "temas", "temas.json")));
    if (url.pathname === "/api/estado") {
      const env = leerEnv();
      fs.mkdirSync(VOZ_DIR, { recursive: true });
      const audios = fs.readdirSync(VOZ_DIR).filter((f) => AUDIO.test(f));
      return json(res, 200, { elevenlabs: { clave: Boolean(env.ELEVENLABS_API_KEY), voz: env.ELEVENLABS_VOZ_ID ?? null }, audios });
    }
    if (url.pathname === "/api/voces") {
      const clave = leerEnv().ELEVENLABS_API_KEY;
      if (!clave) return json(res, 200, { ok: false, error: "Todavía no pegaste tu clave." });
      return json(res, 200, await vocesDe(clave));
    }
    if (url.pathname === "/api/clave" && req.method === "POST") {
      const { clave } = await cuerpo(req);
      const limpia = String(clave ?? "").trim();
      if (!/^[A-Za-z0-9_-]{20,120}$/.test(limpia)) return json(res, 200, { ok: false, error: "Esa clave no tiene el formato de ElevenLabs." });
      const r = await vocesDe(limpia);
      if (r.ok) guardarEnv({ ELEVENLABS_API_KEY: limpia });
      return json(res, 200, r);
    }
    if (url.pathname === "/api/pedido" && req.method === "POST") {
      const p = await cuerpo(req);
      const { temas } = leerJson(path.join(RAIZ, "temas", "temas.json"));
      const tema = temas.find((t) => t.id === p.temaId);
      if (!ESTILOS.includes(p.estilo) || !tema || tema.estilo !== p.estilo) return json(res, 400, { error: "Elige un estilo y un tema." });
      if (!["mp3", "elevenlabs"].includes(p.voz)) return json(res, 400, { error: "Elige cómo vas a poner la voz." });
      if (p.voz === "elevenlabs") {
        if (!leerEnv().ELEVENLABS_API_KEY) return json(res, 400, { error: "Pega tu clave de ElevenLabs primero." });
        if (!p.vozId) return json(res, 400, { error: "Elige una voz de ElevenLabs." });
        guardarEnv({ ELEVENLABS_VOZ_ID: String(p.vozId).replace(/[^A-Za-z0-9_-]/g, "") });
      }
      const slug = `${tema.id.toLowerCase()}-${slugDe(tema.gancho)}`.slice(0, 56).replace(/-+$/, "");
      escribirJson(path.join(TRABAJO, "pedido.json"), { estado: "nuevo", estilo: p.estilo, temaId: tema.id, voz: p.voz, slug, creado: new Date().toISOString() });
      return json(res, 200, { ok: true, slug });
    }
    // archivos del panel
    const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const archivo = path.resolve(PANEL, rel);
    if (!archivo.startsWith(PANEL + path.sep) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404);
      return res.end("No existe");
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(archivo).pipe(res);
  } catch (e) {
    json(res, 500, { error: String(e.message ?? e) });
  }
});

const abrir = (url) => {
  const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // si no se puede abrir, la persona abre el enlace a mano
  }
};

const escuchar = (puerto, intentos = 10) => {
  servidor.once("error", (e) => {
    if (e.code === "EADDRINUSE" && intentos > 0) escuchar(puerto + 1, intentos - 1);
    else {
      console.error(`No pude abrir el panel: ${e.message}`);
      process.exit(1);
    }
  });
  servidor.listen(puerto, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${puerto}/`;
    fs.mkdirSync(TRABAJO, { recursive: true });
    fs.writeFileSync(path.join(TRABAJO, "panel.url"), url);
    console.log(`PANEL ${url}`);
    if (!process.argv.includes("--sin-abrir")) abrir(url);
  });
};
escuchar(Number(process.env.PANEL_PUERTO ?? 4747));
