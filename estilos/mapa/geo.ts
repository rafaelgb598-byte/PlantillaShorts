import { geoBounds, geoCentroid, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
// Natural Earth (dominio público) empaquetado por world-atlas (ISC): países a 3 resoluciones
import w110 from "world-atlas/countries-110m.json";
import w50 from "world-atlas/countries-50m.json";
import w10 from "world-atlas/countries-10m.json";

export type Pais = { id: string; nombre: string; f: Feature<Geometry>; centro: [number, number]; radio: number };

const preparar = (topo: unknown): Pais[] => {
  const t = topo as Topology;
  const fc = feature(t, t.objects.countries) as unknown as FeatureCollection<Geometry, { name?: string }>;
  return fc.features.map((f) => {
    const centro = geoCentroid(f) as [number, number];
    const [[x0, y0], [x1, y1]] = geoBounds(f);
    const esquinas: [number, number][] = [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
      [(x0 + x1) / 2, y0],
      [(x0 + x1) / 2, y1],
    ];
    // si la caja cruza el antimeridiano (x0 > x1) se toma el peor caso: nunca se descarta
    const radio = x0 > x1 ? Math.PI : Math.max(...esquinas.map((p) => geoDistance(centro, p)));
    return { id: String(f.id ?? ""), nombre: f.properties?.name ?? "", f, centro, radio };
  });
};

let cache: Record<string, Pais[]> = {};
export const paises = (res: "110m" | "50m" | "10m") => {
  if (!cache[res]) cache = { ...cache, [res]: preparar(res === "110m" ? w110 : res === "50m" ? w50 : w10) };
  return cache[res];
};

/** resolución según el radio del globo en píxeles */
export const resolucionPara = (radioPx: number): "110m" | "50m" | "10m" => (radioPx < 1300 ? "110m" : radioPx < 7000 ? "50m" : "10m");

/** códigos ISO 3166-1 numéricos: "76" y "076" son el mismo país */
export const mismoId = (a: string, b: string) => String(a).replace(/^0+/, "") === String(b).replace(/^0+/, "");
