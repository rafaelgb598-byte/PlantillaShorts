// QA de subtítulos que mide los PÍXELES renderizados.
// Uso: node scripts/qa-subs.mjs <slug>        (con --borrador usa los tiempos inventados del guion)
// Salida: trabajo/<slug>/qa/subtitulos/{reporte.json, reporte.md, paginas.png}. Código de salida ≠ 0 si algo falla.
//
// Por cada página de subtítulos se renderizan el fotograma del medio y el de máxima escala de entrada con:
//   capa «subtitulos» (PNG con transparencia) → caja real de los píxeles del texto;
//   capa «escena» y capa «fondo» → la diferencia son los objetos y textos de la escena (no pueden quedar bajo el subtítulo).
// Las reglas de texto (cortes, palabras huérfanas, énfasis) se verifican sobre lo que quedó DIBUJADO.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { PUBLIC, RAIZ, dirShort } from "./lib/comun.mjs";
import { blit, canvas, decodePng, downscale, encodePng } from "./lib/png.mjs";
import { cargarProps, informarResolucion } from "./lib/props.mjs";

const slug = process.argv[2];
if (!slug || slug.startsWith("--")) {
  console.error("Uso: node scripts/qa-subs.mjs <slug> [--borrador]");
  process.exit(2);
}
const borrador = process.argv.includes("--borrador");
const datos = cargarProps(slug, { borrador });
if (!informarResolucion(datos.resolucion)) process.exit(1);
const { composicion, inputProps: props } = datos;
const OUT = path.join(dirShort(slug), "qa", "subtitulos");
const TMP = path.join(OUT, "fotogramas");
fs.mkdirSync(TMP, { recursive: true });

// zona segura (única fuente de verdad: estilos/comun/zonaSegura.ts)
const zonaSrc = fs.readFileSync(path.join(RAIZ, "estilos", "comun", "zonaSegura.ts"), "utf8");
const num = (re) => Number(zonaSrc.match(re)[1]);
const Z = {
  centro: num(/CENTRO_X = (\d+)/),
  anchoMax: num(/ANCHO_TEXTO_MAX = (\d+)/),
  carril: num(/CARRIL = \{ bottom: (\d+)/),
  zonaBottom: num(/ZONA = \{ top: \d+, bottom: (\d+)/),
  zonaRight: num(/ZONA = \{[^}]*right: (\d+)/),
};
const C = { tolCentro: 4, x0: Z.centro - Z.anchoMax / 2, x1: Z.centro + Z.anchoMax / 2, tolCarril: 4, top: 1300, margen: 12, minFrames: 15, umbralMascara: 24 };
const NO_CIERRA = "el la lo los las un una unos unas al del de a en con por para sin sobre entre que y e o u ni pero más muy tan su sus mi tu se me te le les no".split(" ");
const FAMILIA = "Inter Tight";

const clave = (t) => t.toLowerCase().replace(/[^a-zñáéíóúü0-9]/g, "");
const norm = (t) => clave(t).normalize("NFD").replace(/[̀-ͯ]/g, "");
const finOracion = (t) => /[.?!…]["»”)]*$/.test(t.replace(/\|/g, ""));
const cierraBien = (t) => finOracion(t) || !NO_CIERRA.includes(clave(t));

console.log(`Preparando el QA de ${slug}…`);
const serveUrl = await bundle({ entryPoint: path.join(RAIZ, "estilos", "index.ts"), rootDir: RAIZ, publicDir: PUBLIC });
const PUERTO = Number(process.env.QA_PUERTO ?? 3100 + Math.floor(Math.random() * 800));
const chromiumOptions = { gl: process.platform === "win32" ? "angle" : null };
const browser = await openBrowser("chrome", { chromiumOptions });
const CAPAS = ["todo", "subtitulos", "escena", "fondo"];
const comps = {};
for (const capa of CAPAS) comps[capa] = await selectComposition({ serveUrl, id: composicion, inputProps: { ...props, capa, qaSubs: true }, puppeteerInstance: browser, port: PUERTO, chromiumOptions });
const composition = comps.todo;
let n = 0;
const render = async (frame, capa) => {
  const output = path.join(TMP, `${capa}-${String(frame).padStart(4, "0")}.png`);
  const logs = [];
  await renderStill({
    serveUrl,
    composition: comps[capa],
    frame,
    output,
    imageFormat: "png",
    inputProps: { ...props, capa, qaSubs: true },
    puppeteerInstance: browser,
    port: PUERTO,
    chromiumOptions,
    onBrowserLog: (l) => {
      if (l.text.startsWith("QA_SUBS ")) logs.push(JSON.parse(l.text.slice(8)));
    },
  });
  n++;
  return { img: decodePng(fs.readFileSync(output)), log: logs[logs.length - 1] ?? null };
};

const caja = (img) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, amarillos = 0;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const [r, g, b, a] = [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
      if (a > 150 && r > 200 && g > 170 && b < 120) amarillos++;
    }
  return x0 === Infinity ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1, amarillos };
};
const difiere = (a, b, i) => Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) > C.umbralMascara;
/** píxeles de la escena (escena ≠ fondo) dentro de la caja del subtítulo ensanchada */
const choques = (esc, fon, b) => {
  let cuenta = 0;
  const X0 = Math.max(0, b.x0 - C.margen), X1 = Math.min(esc.width, b.x1 + C.margen);
  const Y0 = Math.max(0, b.y0 - C.margen), Y1 = Math.min(esc.height, b.y1 + C.margen);
  let cx0 = Infinity, cy0 = Infinity, cx1 = -1, cy1 = -1;
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      const i = (y * esc.width + x) * 4;
      if (difiere(esc, fon, i)) {
        cuenta++;
        cx0 = Math.min(cx0, x); cy0 = Math.min(cy0, y); cx1 = Math.max(cx1, x); cy1 = Math.max(cy1, y);
      }
    }
  return { n: cuenta, donde: cuenta ? { x0: cx0, y0: cy0, x1: cx1 + 1, y1: cy1 + 1 } : null };
};

const primero = await render(0, "subtitulos");
if (!primero.log) {
  console.error("No llegó el volcado de los subtítulos: revisa que la composición use <Subtitulos>.");
  process.exit(1);
}
const PAGS = primero.log.paginas;
const ENFASIS = primero.log.enfasis.map((e) => e.split(/\s+/).map(norm).join(" "));
const REMATES = primero.log.remates.map(norm);
console.log(`${PAGS.length} páginas`);

const pico = (() => {
  let best = 0, bv = -1;
  for (let k = 0; k <= 6; k++) {
    const x = k / 6;
    const u = (x - 0.01) / 0.99;
    const v = x <= 0.01 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-4.5 * u) * Math.cos(1.6 * Math.PI * u) + Math.exp(-4.5) * Math.cos(1.6 * Math.PI) * u;
    if (v > bv) { bv = v; best = k; }
  }
  return best;
})();

const filas = [];
const hojas = [];
for (const [pi, p] of PAGS.entries()) {
  const medio = Math.floor((p.f0 + p.f1) / 2);
  const fPico = Math.min(p.f1 - 1, p.f0 + pico);
  const res = { pagina: pi + 1, texto: p.palabras.join(" "), f0: p.f0, f1: p.f1, frames: [], pruebas: {} };
  const ok = (k, v, det) => {
    const prev = res.pruebas[k];
    res.pruebas[k] = { ok: (prev ? prev.ok : true) && v, detalle: [prev?.detalle, v ? null : det].filter(Boolean).join(" · ") };
  };
  let dom = null;
  for (const fr of [...new Set([medio, fPico])]) {
    const sub = await render(fr, "subtitulos");
    const esc = await render(fr, "escena");
    const fon = await render(fr, "fondo");
    if (fr === medio) dom = sub.log;
    const b = caja(sub.img);
    if (!b) {
      ok("visible", false, `f${fr}: no se dibujó`);
      continue;
    }
    const cx = (b.x0 + b.x1) / 2;
    const ch = choques(esc.img, fon.img, b);
    res.frames.push({ f: fr, caja: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }, centro: cx, choques: ch.n, zonaChoque: ch.donde, amarillos: b.amarillos });
    ok("centrado", Math.abs(cx - Z.centro) <= C.tolCentro, `f${fr}: centro ${cx.toFixed(1)}`);
    ok("ancho", b.x0 >= C.x0 && b.x1 <= C.x1, `f${fr}: x ${b.x0}–${b.x1}`);
    ok("carril", Math.abs(b.y1 - Z.carril) <= C.tolCarril && b.y0 >= C.top, `f${fr}: y ${b.y0}–${b.y1}`);
    ok("zonaSegura", b.y1 <= Z.zonaBottom && b.x1 <= Z.zonaRight, `f${fr}: ${b.x1}, ${b.y1}`);
    ok("choques", ch.n === 0, `f${fr}: ${ch.n} px en [${ch.donde?.x0}–${ch.donde?.x1}, ${ch.donde?.y0}–${ch.donde?.y1}]`);
    if (fr === medio) {
      const todo = await render(fr, "todo");
      hojas.push({ img: todo.img, b, pagina: pi + 1, ch: ch.donde });
    }
  }
  const ult = p.palabras[p.palabras.length - 1];
  const r1 = p.renglones.length === 2 ? p.palabras[p.renglones[0] - 1] : null;
  const ultimaDeTodo = pi === PAGS.length - 1;
  ok("cortes", (ultimaDeTodo || cierraBien(ult)) && (!r1 || cierraBien(r1)), `termina en «${!(ultimaDeTodo || cierraBien(ult)) ? ult : r1}»`);
  const prev = pi > 0 ? PAGS[pi - 1].palabras.at(-1) : null;
  const sola = p.palabras.length === 1;
  ok("huerfanas", !sola || ((pi === 0 || finOracion(prev)) && finOracion(ult)) || REMATES.includes(norm(ult)), `«${ult}» sola`);
  ok("duracion", p.f1 - p.f0 >= C.minFrames, `${p.f1 - p.f0} fotogramas`);
  const am = (dom?.amarillas ?? []).map(norm);
  ok("enfasis", am.length === 0 || ENFASIS.includes(am.join(" ")), `amarillo: «${(dom?.amarillas ?? []).join(" ")}»`);
  const conAmarillo = res.frames.some((x) => x.amarillos > 30);
  ok("enfasis", conAmarillo === am.length > 0, `píxeles amarillos ${conAmarillo ? "sí" : "no"} vs DOM ${am.length}`);
  ok("fuente", Boolean(dom?.fuenteCargada) && (dom?.familia ?? "").includes(FAMILIA), `familia ${dom?.familia}, cargada ${dom?.fuenteCargada}`);
  res.dibujado = dom?.renglones ?? [];
  res.amarillo = dom?.amarillas ?? [];
  filas.push(res);
  const fallas = Object.entries(res.pruebas).filter(([, v]) => !v.ok).map(([k]) => k);
  console.log(`${String(pi + 1).padStart(2)} f${p.f0}–${p.f1} ${fallas.length ? "✖ " + fallas.join(",") : "✔"}  ${res.dibujado.join(" / ")}`);
}
await browser.close({ silent: true });

// hoja de contactos con guías
const ESC = 4, COLS = 6;
const tw = 1080 / ESC, th = 1920 / ESC;
if (hojas.length) {
  const hoja = canvas(COLS * tw, Math.ceil(hojas.length / COLS) * th, [20, 20, 20]);
  const linea = (img, x0, y0, x1, y1, rgb, grosor = 3) => {
    for (let y = Math.max(0, y0); y < Math.min(img.height, y1 + grosor); y++)
      for (let x = Math.max(0, x0); x < Math.min(img.width, x1 + grosor); x++) {
        const i = (y * img.width + x) * 4;
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2];
      }
  };
  for (const [k, h] of hojas.entries()) {
    const im = { width: h.img.width, height: h.img.height, data: new Uint8Array(h.img.data) };
    linea(im, 0, C.top, 1080, C.top, [0, 224, 255]);
    linea(im, 0, Z.carril, 1080, Z.carril, [0, 255, 156]);
    linea(im, 0, Z.zonaBottom, 1080, Z.zonaBottom, [255, 0, 64]);
    linea(im, Z.zonaRight, 0, Z.zonaRight, 1920, [255, 0, 64]);
    if (h.ch) {
      linea(im, h.ch.x0, h.ch.y0, h.ch.x1, h.ch.y0, [255, 45, 85], 5);
      linea(im, h.ch.x0, h.ch.y1, h.ch.x1, h.ch.y1, [255, 45, 85], 5);
      linea(im, h.ch.x0, h.ch.y0, h.ch.x0, h.ch.y1, [255, 45, 85], 5);
      linea(im, h.ch.x1, h.ch.y0, h.ch.x1, h.ch.y1, [255, 45, 85], 5);
    }
    blit(hoja, downscale(im, ESC), (k % COLS) * tw, Math.floor(k / COLS) * th);
  }
  fs.writeFileSync(path.join(OUT, "paginas.png"), encodePng(hoja));
}

const PRUEBAS = ["centrado", "ancho", "carril", "zonaSegura", "choques", "cortes", "huerfanas", "duracion", "enfasis", "fuente"];
const resumen = Object.fromEntries(PRUEBAS.map((k) => [k, filas.filter((f) => f.pruebas[k]?.ok).length]));
const fallas = filas.flatMap((f) => Object.entries(f.pruebas).filter(([, v]) => !v.ok).map(([k, v]) => ({ pagina: f.pagina, prueba: k, detalle: v.detalle, texto: f.texto })));
fs.writeFileSync(path.join(OUT, "reporte.json"), JSON.stringify({ slug, composicion, fecha: new Date().toISOString(), fuente: FAMILIA, criterios: { ...C, ...Z }, paginas: filas.length, resumen, fallas, detalle: filas }, null, 1));
const md = [
  `# QA de subtítulos · ${slug}`,
  "",
  `${filas.length} páginas · fuente esperada **${FAMILIA}** · ${n} fotogramas renderizados · **${fallas.length} fallas**`,
  "",
  "| Prueba | Páginas que pasan |",
  "|---|---|",
  ...PRUEBAS.map((k) => `| ${k} | ${resumen[k]} / ${filas.length} |`),
  "",
  "| # | Fotogramas | Texto dibujado | Amarillo | Resultado |",
  "|---|---|---|---|---|",
  ...filas.map((f) => {
    const mal = Object.entries(f.pruebas).filter(([, v]) => !v.ok);
    return `| ${f.pagina} | ${f.f0}–${f.f1} | ${f.dibujado.join(" / ")} | ${f.amarillo.join(" ") || "—"} | ${mal.length ? "✖ " + mal.map(([k, v]) => `${k}: ${v.detalle}`).join("; ") : "✔"} |`;
  }),
  "",
].join("\n");
fs.writeFileSync(path.join(OUT, "reporte.md"), md);
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${fallas.length} fallas · ${path.relative(RAIZ, OUT)}${path.sep}reporte.md`);
process.exit(fallas.length ? 1 : 0);
