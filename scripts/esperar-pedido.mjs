// Espera a que el panel guarde un pedido nuevo en trabajo/pedido.json (estilo, tema y voz).
// Uso: node scripts/esperar-pedido.mjs [--max 450]
// Sale con código 0 e imprime el pedido apenas llega; con código 3 si se cumplió el tiempo sin pedido
// (la skill lo vuelve a correr una vez: en total espera unos 15 minutos).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { TRABAJO, escribirJson } from "./lib/comun.mjs";

const i = process.argv.indexOf("--max");
const max = Number(i >= 0 ? process.argv[i + 1] : 450);
const archivo = path.join(TRABAJO, "pedido.json");
const inicio = Date.now();

const revisar = () => {
  if (!fs.existsSync(archivo)) return null;
  try {
    const p = JSON.parse(fs.readFileSync(archivo, "utf8"));
    return p.estado === "nuevo" ? p : null;
  } catch {
    return null;
  }
};

console.log(`Esperando tu elección en el panel (hasta ${Math.round(max / 60)} min)…`);
const ciclo = setInterval(() => {
  const p = revisar();
  if (p) {
    clearInterval(ciclo);
    escribirJson(archivo, { ...p, estado: "tomado", tomado: new Date().toISOString() });
    console.log("PEDIDO " + JSON.stringify({ estilo: p.estilo, temaId: p.temaId, voz: p.voz, slug: p.slug }));
    process.exit(0);
  }
  if ((Date.now() - inicio) / 1000 > max) {
    clearInterval(ciclo);
    console.log("TODAVIA_ESPERANDO: no llegó ningún pedido.");
    process.exit(3);
  }
}, 1000);
