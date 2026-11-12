import React, { useId, useMemo } from "react";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { geoDistance, geoGraticule, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import { Short } from "../comun/Short";
import { icono } from "../comun/iconos";
import { lim, onda, resorte, salida, suave, tramo } from "../comun/movimiento";
import { azar, escenaEn } from "../comun/plan.mjs";
import { ajustar, medir, useFuentes } from "../comun/texto";
import type { PropsCuadro, PropsShort } from "../comun/tipos";
import { LIENZO } from "../comun/zonaSegura";
import { mismoId, paises, resolucionPara } from "./geo";

/**
 * Estilo Mapa: globo vectorial con Natural Earth (dominio público), zoom a la región, rutas que se trazan
 * y marcadores con el dato. Tipos de escena: vista · paises · marcador · ruta · linea · cifra · fuente · pregunta.
 * El mapa es el escenario (capa «fondo»); marcadores, etiquetas y tarjetas son la escena.
 */

const outfit = loadFont("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });
const FAM = outfit.fontFamily;

type Paleta = { espacio: string; estrella: string; mar1: string; mar2: string; marPunto: string; tierra: string; borde: string; reticula: string; resalte: string; resaltes: string[]; ruta: string; pin: string; texto: string; tarjeta: string; tenue: string };
export const PALETAS_MAPA: Record<string, Paleta> = {
  atlas: { espacio: "#070B1A", estrella: "#8FA6E8", mar1: "#1C5390", mar2: "#0D2C55", marPunto: "#3D80C6", tierra: "#EDE6D2", borde: "#A79D84", reticula: "#3A6CA8", resalte: "#FFB703", resaltes: ["#FFB703", "#FF7A45", "#9B7BFF", "#4FD1A5"], ruta: "#FF4D6D", pin: "#FF4D6D", texto: "#FFFFFF", tarjeta: "#0B1430", tenue: "#B8C6EE" },
  noche: { espacio: "#05070D", estrella: "#6B7BA8", mar1: "#122640", mar2: "#08131F", marPunto: "#2A4C78", tierra: "#2F3D4F", borde: "#62758C", reticula: "#24405F", resalte: "#3DF2C0", resaltes: ["#3DF2C0", "#FFD166", "#FF7AA2", "#7FB2FF"], ruta: "#FFD166", pin: "#FFD166", texto: "#FFFFFF", tarjeta: "#0A1322", tenue: "#A9BBD6" },
};

const CENTRO_Y = 690;
const VIAJE = 40;
const MUNDO_KM = 12500;

type Vista = { f0: number; centro: [number, number]; km: number };
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const lonlat = (v: unknown, d: [number, number]): [number, number] => (Array.isArray(v) && v.length === 2 ? [num(v[0], d[0]), num(v[1], d[1])] : d);

/** cámara: dónde mira el globo (centro lon/lat) y cuántos km de ancho muestra */
const camara = (vistas: Vista[], f: number) => {
  let k = 0;
  for (let i = 0; i < vistas.length; i++) if (f >= vistas[i].f0) k = i;
  const b = vistas[k];
  const a = vistas[Math.max(0, k - 1)];
  // deriva lenta hacia el este desde que empieza cada vista (≈ 1,2 % del ancho por segundo): nunca hay un cuadro quieto
  const deriva = (v: Vista, hasta: number): [number, number] => [v.centro[0] + ((Math.max(0, hasta - v.f0) / 30) * (v.km / 111) * 0.012), v.centro[1]];
  const desdeA = k === 0 ? deriva(a, f) : deriva(a, b.f0);
  const t = k === 0 ? 1 : suave(tramo(f, b.f0, VIAJE));
  const destino = deriva(b, f);
  const lejos = geoDistance(desdeA, destino);
  const centro = (k === 0 ? desdeA : t >= 1 ? destino : geoInterpolate(desdeA, destino)(t)) as [number, number];
  const salto = 1 + Math.min(1.4, lejos * 1.2) * Math.sin(Math.PI * t);
  let km = Math.exp(Math.log(a.km) + (Math.log(b.km) - Math.log(a.km)) * t) * salto;
  km = Math.min(km, MUNDO_KM * 1.15);
  // respiración de zoom suave
  km *= 1 + 0.02 * onda(f, 140);
  return { centro: [centro[0], centro[1] + onda(f, 230) * (km / 111) * 0.01] as [number, number], km };
};

const Pildora: React.FC<{ x: number; y: number; texto: string; size: number; P: Paleta; color?: string; op?: number }> = ({ x, y, texto, size, P, color, op = 1 }) => {
  const w = medir(texto, FAM, 800, size) + size * 1.1;
  const h = size * 1.5;
  const xx = Math.min(Math.max(x, 80 + w / 2), 900 - w / 2);
  return (
    <g opacity={op}>
      <rect x={xx - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={P.tarjeta} stroke={color ?? P.resalte} strokeWidth={4} />
      <text x={xx} y={y + size * 0.36} fontFamily={`"${FAM}"`} fontWeight={800} fontSize={size} fill={P.texto} textAnchor="middle">
        {texto}
      </text>
    </g>
  );
};

/** tarjeta de arriba (cifra, fuente, pregunta, título de la vista) */
const Tarjeta: React.FC<{ lf: number; P: Paleta; grande?: string; texto: string; etiqueta?: string; dibujo?: string[]; primera: boolean; abajo?: number }> = ({ lf, P, grande, texto, etiqueta, dibujo, primera }) => {
  const r = resorte(lf, primera ? -10 : 0, 160, 15);
  const g = grande ? ajustar(grande, { familia: FAM, peso: 800, maxW: 700, maxLineas: 1, tamMax: 150, tamMin: 80 }) : null;
  const tx = ajustar(texto, { familia: FAM, peso: 800, maxW: 700, maxLineas: 3, tamMax: grande ? 58 : 76, tamMin: 44 });
  const lh = tx.size * 1.15;
  const extra = dibujo ? 34 : 0;
  const off = (etiqueta ? 70 : 20) + extra;
  const alto = (g ? g.size * 1.15 : 0) + tx.lineas.length * lh + (etiqueta ? 70 : 0) + 70 + extra;
  const top = 270;
  return (
    <g transform={`translate(0 ${(1 - r) * -260})`} opacity={lim(r * 1.4)}>
      <rect x={150} y={top} width={780} height={alto} rx={36} fill={P.tarjeta} opacity={0.94} stroke={P.resalte} strokeWidth={5} />
      {dibujo ? (
        <g>
          <circle cx={540} cy={top} r={52} fill={P.resalte} />
          <g transform={`translate(${540 - 33} ${top - 33}) scale(0.66)`}>
            {dibujo.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={P.tarjeta} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </g>
        </g>
      ) : null}
      {etiqueta ? (
        <text x={540} y={top + 70 + extra} fontFamily={`"${FAM}"`} fontWeight={800} fontSize={44} letterSpacing={7} fill={P.resalte} textAnchor="middle">
          {etiqueta}
        </text>
      ) : null}
      {g ? (
        <text x={540} y={top + off + g.size * 0.95} fontFamily={`"${FAM}"`} fontWeight={800} fontSize={g.size} fill={P.texto} textAnchor="middle">
          {g.lineas[0]}
        </text>
      ) : null}
      {tx.lineas.map((l, i) => (
        <text key={i} x={540} y={top + off + (g ? g.size * 1.15 : 0) + tx.size * 1.1 + i * lh} fontFamily={`"${FAM}"`} fontWeight={grande ? 600 : 800} fontSize={tx.size} fill={grande ? P.tenue : P.texto} textAnchor="middle">
          {l}
        </text>
      ))}
    </g>
  );
};

const Cuadro: React.FC<PropsCuadro> = ({ f, escenas, plan, soloFondo }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const lista = useFuentes([
    { fuente: outfit, peso: 800 },
    { fuente: outfit, peso: 600 },
  ]);
  const P = PALETAS_MAPA[plan.paleta ?? "atlas"] ?? PALETAS_MAPA.atlas;
  const vistas: Vista[] = useMemo(() => {
    const vs = escenas.filter((e) => e.tipo === "vista").map((e) => ({ f0: e.f0, centro: lonlat(e.centro, [0, 0]), km: Math.min(MUNDO_KM, num(e.anchoKm, 3000)) }));
    if (!vs.length) return [{ f0: 0, centro: [-60, -15] as [number, number], km: MUNDO_KM }];
    if (vs[0].f0 > 0) vs.unshift({ f0: 0, centro: vs[0].centro, km: MUNDO_KM });
    return vs;
  }, [escenas]);
  const estrellas = useMemo(() => {
    const r = azar("estrellas");
    return Array.from({ length: 260 }, () => ({ x: r() * 1080, y: r() * 1920, s: 1.2 + r() * 2.4, b: r() }));
  }, []);
  const cam = camara(vistas, f);
  const R = (LIENZO.w * 6371) / cam.km;
  const proy = geoOrthographic()
    .rotate([-cam.centro[0], -cam.centro[1], 0])
    .scale(R)
    .translate([540, CENTRO_Y])
    .clipAngle(90)
    .clipExtent([
      [-40, -40],
      [LIENZO.w + 40, LIENZO.h + 40],
    ]);
  const camino = geoPath(proy);
  const res = resolucionPara(R);
  const visible = Math.min(Math.PI / 2, Math.asin(Math.min(1, 1150 / R)) + 0.05);
  const todos = paises(res);
  const cerca = todos.filter((p) => geoDistance(cam.centro, p.centro) - p.radio <= visible);
  const k = escenaEn(escenas, f);
  const pasadas = escenas.filter((e) => e.f0 <= f);
  // países resaltados
  const resaltes = new Map<string, number>();
  const colorPais = new Map<string, string>();
  for (const e of pasadas.filter((x) => x.tipo === "paises")) {
    const ids = (Array.isArray(e.paises) ? e.paises : []).map(String);
    ids.forEach((id, n) => {
      resaltes.set(id, Math.max(resaltes.get(id) ?? 0, salida(tramo(f, e.f0 + n * 5, 14))));
      if (!colorPais.has(id)) colorPais.set(id, P.resaltes[colorPais.size % P.resaltes.length]);
    });
  }
  const colorDe = (id: string) => {
    for (const [k2, c] of colorPais) if (mismoId(k2, id)) return c;
    return P.resalte;
  };
  const resaltar = (id: string) => {
    for (const [k2, v] of resaltes) if (mismoId(k2, id)) return v;
    return 0;
  };
  const paso = [30, 15, 10, 5, 2, 1, 0.5, 0.25].find((s) => s * 111 <= cam.km / 5) ?? 0.25;
  const reticula = camino(geoGraticule().step([paso, paso])()) ?? "";
  const esfera = camino({ type: "Sphere" }) ?? "";
  const ultVista = [...escenas].filter((e) => e.tipo === "vista" && e.f0 <= f).pop();
  const desdeVista = ultVista ? ultVista.f0 : 0;
  const punto = (lon: number, lat: number) => {
    if (geoDistance(cam.centro, [lon, lat]) > Math.PI / 2 - 0.02) return null;
    return proy([lon, lat]);
  };
  const latido = (onda(f, 40) + 1) / 2;

  const fondo = (
    <>
      <rect width={LIENZO.w} height={LIENZO.h} fill={P.espacio} />
      {estrellas.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill={P.estrella} opacity={0.5 + 0.5 * Math.abs(Math.sin(f / 25 + s.b * 6))} />
      ))}
      <defs>
        <radialGradient id={`mar${uid}`} cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor={P.mar1} />
          <stop offset="100%" stopColor={P.mar2} />
        </radialGradient>
        <pattern id={`puntos${uid}`} width={36} height={36} patternUnits="userSpaceOnUse" patternTransform={`translate(${(-cam.centro[0] * 9) % 36} ${(cam.centro[1] * 9) % 36})`}>
          <circle cx={18} cy={18} r={3.2} fill={P.marPunto} />
        </pattern>
      </defs>
      {R < 1400 ? <circle cx={540} cy={CENTRO_Y} r={R + 26} fill="none" stroke={P.mar1} strokeWidth={30} opacity={0.35} /> : null}
      <path d={esfera} fill={`url(#mar${uid})`} />
      <path d={esfera} fill={`url(#puntos${uid})`} opacity={0.85} />
      <path d={reticula} fill="none" stroke={P.reticula} strokeWidth={1.6} opacity={0.7} />
      {cerca.map((p) => {
        const d = camino(p.f);
        if (!d) return null;
        const v = resaltar(p.id);
        return <path key={p.id + p.nombre} d={d} fill={v > 0 ? colorDe(p.id) : P.tierra} fillOpacity={1} stroke={P.borde} strokeWidth={v > 0 ? 2.5 : 1.2} opacity={v > 0 ? 0.55 + 0.45 * v : 1} />;
      })}
      {/* rutas y líneas: forman parte del mapa */}
      {pasadas
        .filter((e) => e.tipo === "linea")
        .map((e) => {
          const lon = num(e.lon, 0);
          const coords: [number, number][] = Array.from({ length: 81 }, (_, i) => [lon, -80 + i * 2]);
          const d = camino({ type: "LineString", coordinates: coords }) ?? "";
          return <path key={`l${e.indice}`} d={d} fill="none" stroke={P.ruta} strokeWidth={7} strokeDasharray="22 14" pathLength={undefined} opacity={salida(tramo(f, e.f0, 20))} />;
        })}
      {pasadas
        .filter((e) => e.tipo === "ruta")
        .map((e) => {
          const pts = (Array.isArray(e.puntos) ? e.puntos : []).map((p) => lonlat(p, [0, 0]));
          if (pts.length < 2) return null;
          const p = salida(tramo(f, e.f0 + 4, Math.max(30, Math.min(75, e.f1 - e.f0 - 10))));
          const d = camino({ type: "LineString", coordinates: pts }) ?? "";
          // punta que avanza por el círculo máximo
          const largos = pts.slice(1).map((q, i) => geoDistance(pts[i], q));
          const total = largos.reduce((a, b) => a + b, 0);
          let resto = p * total;
          let cab: [number, number] = pts[pts.length - 1];
          for (let i = 0; i < largos.length; i++) {
            if (resto <= largos[i]) {
              cab = geoInterpolate(pts[i], pts[i + 1])(largos[i] ? resto / largos[i] : 0) as [number, number];
              break;
            }
            resto -= largos[i];
          }
          const xy = punto(cab[0], cab[1]);
          return (
            <g key={`r${e.indice}`}>
              <path d={d} fill="none" stroke={P.tarjeta} strokeWidth={14} pathLength={1} strokeDasharray={`${p} 1`} strokeLinecap="round" opacity={0.5} />
              <path d={d} fill="none" stroke={P.ruta} strokeWidth={8} pathLength={1} strokeDasharray={`${p} 1`} strokeLinecap="round" />
              {xy && p < 1 ? <circle cx={xy[0]} cy={xy[1]} r={14} fill={P.texto} stroke={P.ruta} strokeWidth={6} /> : null}
            </g>
          );
        })}
    </>
  );

  // ── escena: marcadores, etiquetas y tarjetas ──
  const marcadores = pasadas.filter((e) => e.tipo === "marcador");
  const actual = escenas[k];
  const lfA = actual ? f - actual.f0 : 0;
  const primera = Boolean(actual && actual.indice === 0 && actual.f0 === 0);
  let tarjeta: React.ReactNode = null;
  if (actual) {
    if (actual.tipo === "cifra") tarjeta = <Tarjeta lf={lfA} P={P} grande={String(actual.valor ?? "")} texto={String(actual.etiqueta ?? "")} primera={primera} />;
    else if (actual.tipo === "fuente") tarjeta = <Tarjeta lf={lfA} P={P} etiqueta="FUENTE" texto={String(actual.texto ?? plan.fuente ?? "")} dibujo={icono("lupa")} primera={primera} />;
    else if (actual.tipo === "pregunta") tarjeta = <Tarjeta lf={lfA} P={P} etiqueta="TU TURNO" texto={String(actual.texto ?? "¿Lo sabías? Cuéntamelo en los comentarios")} dibujo={icono("comentario")} primera={primera} />;
    else if (actual.texto && ["vista", "paises", "ruta", "linea"].includes(actual.tipo)) tarjeta = <Tarjeta lf={lfA} P={P} texto={String(actual.texto)} primera={primera} />;
  }
  const hayTarjeta = Boolean(tarjeta);
  return (
    <svg width={LIENZO.w} height={LIENZO.h} viewBox={`0 0 ${LIENZO.w} ${LIENZO.h}`} style={{ position: "absolute", inset: 0 }}>
      {fondo}
      {!soloFondo && lista ? (
        <>
          {marcadores.map((e) => {
            const xy = punto(num(e.lon, 0), num(e.lat, 0));
            if (!xy || xy[1] > 1230 || xy[1] < 250 || xy[0] < 70 || xy[0] > 900) return null;
            const lf = f - e.f0;
            const r = resorte(lf, primera && e.indice === 0 ? -10 : 0, 220, 11);
            const etiqueta = String(e.nombre ?? "");
            const conEtiqueta = e.f0 >= desdeVista && etiqueta && !(hayTarjeta && xy[1] < 700);
            const sub = e.etiqueta ? String(e.etiqueta) : "";
            return (
              <g key={`m${e.indice}`}>
                <circle cx={xy[0]} cy={xy[1]} r={(26 + 34 * latido) * r} fill="none" stroke={P.pin} strokeWidth={5} opacity={(1 - latido) * 0.9} />
                <circle cx={xy[0]} cy={xy[1]} r={17 * r} fill={P.pin} stroke={P.texto} strokeWidth={6} />
                {conEtiqueta ? <Pildora x={xy[0]} y={xy[1] - 78 - (sub ? 64 : 0)} texto={etiqueta} size={50} P={P} color={P.pin} op={lim(r * 1.5)} /> : null}
                {conEtiqueta && sub ? <Pildora x={xy[0]} y={xy[1] - 76} texto={sub} size={44} P={P} op={lim(resorte(lf, 8) * 1.5)} /> : null}
              </g>
            );
          })}
          {tarjeta}
        </>
      ) : null}
    </svg>
  );
};

export const Mapa: React.FC<PropsShort> = (props) => (
  <Short
    {...props}
    Cuadro={Cuadro}
    colorFondo={(PALETAS_MAPA[props.plan.paleta ?? "atlas"] ?? PALETAS_MAPA.atlas).espacio}
    sonidoDe={(e) => (e.indice === 0 ? null : e.tipo === "vista" ? { archivo: "sonidos/whoosh.wav", volumen: 0.35 } : e.tipo === "marcador" ? { archivo: "sonidos/ping.wav", volumen: 0.3 } : { archivo: "sonidos/pop.wav", volumen: 0.25 })}
  />
);
