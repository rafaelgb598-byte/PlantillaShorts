import React, { useId } from "react";
import { loadFont } from "@remotion/google-fonts/Kalam";
import { Short } from "../comun/Short";
import { icono } from "../comun/iconos";
import { lim, onda, salida, tramo } from "../comun/movimiento";
import { escenaEn, normalizar } from "../comun/plan.mjs";
import { ajustar, medir, useFuentes } from "../comun/texto";
import { cruzMano, flechaMano, garabato, ovaloMano, rectMano, subrayado } from "../comun/trazos";
import type { Escena, PropsCuadro, PropsShort } from "../comun/tipos";
import { LIENZO } from "../comun/zonaSegura";

/**
 * Estilo Pizarra: cuaderno cuadriculado, trazos SVG que se dibujan solos (stroke-dashoffset), flechas y círculos
 * que marcan lo importante. Cada escena es un recuadro de la hoja y la cámara pasa de uno a otro.
 * Tipos de escena: titulo · dibujo · cifra · paso · comparar · fuente · pregunta (CLAUDE.md).
 */

const kalam = loadFont("normal", { weights: ["700"], subsets: ["latin", "latin-ext"] });
const FAM = kalam.fontFamily;

type Paleta = { papel: string; cuadricula: string; cuadricula5: string; margen: string; tinta: string; rojo: string; verde: string; resaltador: string; nota: string };
export const PALETAS_PIZARRA: Record<string, Paleta> = {
  cuaderno: { papel: "#F8F4E8", cuadricula: "#C2CCDD", cuadricula5: "#A9B6CE", margen: "#E59A9A", tinta: "#1F3A68", rojo: "#D7263D", verde: "#178F7F", resaltador: "#FFD23F", nota: "#FFE783" },
  pizarron: { papel: "#1F3B33", cuadricula: "#3C5E54", cuadricula5: "#4B7266", margen: "#6E8F5A", tinta: "#F4F1E6", rojo: "#FF8A7A", verde: "#9BE7C4", resaltador: "#F7D046", nota: "#2E5246" },
};

const PANEO = 12;
/** dónde queda cada recuadro en la hoja (zigzag) */
const recuadro = (i: number) => ({ x: (i % 2) * 640, y: i * 1080 });

type PE = { e: Escena; lf: number; dur: number; P: Paleta; primera: boolean; inicio: number; plan: PropsCuadro["plan"] };

const Trazo: React.FC<{ d: string; p: number; color: string; ancho?: number; opacity?: number }> = ({ d, p, color, ancho = 9, opacity = 1 }) =>
  p <= 0 ? null : (
    <>
      <path d={d} fill="none" stroke={color} strokeWidth={ancho} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${lim(p)} 1`} opacity={opacity} />
      <path d={d} fill="none" stroke={color} strokeWidth={ancho * 0.45} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${lim(p)} 1`} opacity={0.35 * opacity} transform="translate(2.5 -1.8)" />
    </>
  );

/** fibra que acompaña la escritura */
const Fibra: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g transform={`translate(${x} ${y}) rotate(-38)`}>
    <rect x={-8} y={-118} width={34} height={108} rx={8} fill={color} />
    <rect x={-8} y={-128} width={34} height={22} rx={6} fill="#2B2B2B" opacity={0.8} />
    <path d="M-4 -10 L22 -10 L12 8 Z" fill="#3A3A3A" />
  </g>
);

/** texto que se escribe renglón por renglón; devuelve el fotograma (local) en que termina */
const duracionEscritura = (lineas: string[]) => lineas.reduce((a, l) => a + Math.min(18, 4 + l.length * 0.5), 0);
const Escrito: React.FC<{ lineas: string[]; size: number; x: number; y: number; desde: number; lf: number; color: string; id: string; ancla?: "middle" | "start"; pluma?: boolean }> = ({
  lineas,
  size,
  x,
  y,
  desde,
  lf,
  color,
  id,
  ancla = "middle",
  pluma = true,
}) => {
  const uid = useId();
  const lh = size * 1.14;
  let t = desde;
  return (
    <>
      {lineas.map((l, i) => {
        const d = Math.min(18, 4 + l.length * 0.5);
        const p = tramo(lf, t, d);
        t += d;
        if (p <= 0) return null;
        const w = medir(l, FAM, 700, size);
        const x0 = ancla === "middle" ? x - w / 2 : x;
        const yy = y + i * lh;
        const cid = `clip-${uid}-${id}-${i}`.replace(/[^a-zA-Z0-9_-]/g, "");
        return (
          <g key={i}>
            <clipPath id={cid}>
              <rect x={x0 - 30} y={yy - size * 1.1} width={(w + 60) * p} height={size * 1.6} />
            </clipPath>
            <text x={x0} y={yy} fontFamily={`"${FAM}"`} fontWeight={700} fontSize={size} fill={color} clipPath={`url(#${cid})`}>
              {l}
            </text>
            {pluma && p < 1 ? <Fibra x={x0 + w * p} y={yy - size * 0.2} color={color} /> : null}
          </g>
        );
      })}
    </>
  );
};

const Titulo: React.FC<PE> = ({ e, lf, P, primera, inicio }) => {
  const tx = ajustar(String(e.texto ?? ""), { familia: FAM, peso: 700, maxW: 720, maxLineas: 3, tamMax: 128, tamMin: 70 });
  const lh = tx.size * 1.14;
  const y0 = -40 - ((tx.lineas.length - 1) * lh) / 2 + tx.size * 0.34;
  const desde = primera ? -999 : inicio;
  const fin = primera ? 0 : inicio + duracionEscritura(tx.lineas);
  const ult = tx.lineas[tx.lineas.length - 1] ?? "";
  const wUlt = medir(ult, FAM, 700, tx.size);
  const yUlt = y0 + (tx.lineas.length - 1) * lh;
  const destacar = String(e.destacar ?? "").split(/\s+/).map(normalizar).filter(Boolean);
  // resaltador detrás de la palabra destacada
  const resaltes: React.ReactNode[] = [];
  tx.lineas.forEach((l, i) => {
    const w = medir(l, FAM, 700, tx.size);
    let x = -w / 2;
    for (const pal of l.split(" ")) {
      const wp = medir(pal, FAM, 700, tx.size);
      if (destacar.includes(normalizar(pal))) {
        const p = primera ? 0.35 + salida(tramo(lf, 0, 20)) : salida(tramo(lf, fin + 4, 14));
        resaltes.push(<rect key={`${i}-${pal}`} x={x - 10} y={y0 + i * lh - tx.size * 0.72} width={(wp + 20) * lim(p)} height={tx.size * 0.9} fill={P.resaltador} opacity={0.65} transform={`rotate(-1.5 ${x} ${y0 + i * lh})`} />);
      }
      x += medir(`${pal} `, FAM, 700, tx.size);
    }
  });
  const pSub = primera ? 0.35 + 0.65 * salida(tramo(lf, 0, 24)) : salida(tramo(lf, fin + 2, 16));
  return (
    <>
      {resaltes}
      <Escrito lineas={tx.lineas} size={tx.size} x={0} y={y0} desde={desde} lf={lf} color={P.tinta} id={`t${e.indice}`} />
      <Trazo d={subrayado(-wUlt / 2 - 10, wUlt / 2 + 10, yUlt + 34, `sub${e.indice}`)} p={pSub} color={P.rojo} ancho={10} />
      <g transform={`rotate(${lf * 1.5} -360 -390)`}>
        <Trazo d={garabato(-360, -390, 40, 0)} p={primera ? 1 : salida(tramo(lf, inicio, 12))} color={P.rojo} ancho={6} />
      </g>
      <g transform={`rotate(${-lf * 1.2} 330 380)`}>
        <Trazo d={garabato(330, 380, 36, 1)} p={primera ? 1 : salida(tramo(lf, fin, 14))} color={P.verde} ancho={6} />
      </g>
    </>
  );
};

const Dibujo: React.FC<PE> = ({ e, lf, P, primera, inicio }) => {
  const paths = icono(e.icono);
  const tx = ajustar(String(e.texto ?? ""), { familia: FAM, peso: 700, maxW: 720, maxLineas: 2, tamMax: 96, tamMin: 56 });
  const d0 = primera ? -999 : inicio;
  const fin = primera ? 0 : inicio + 10;
  return (
    <>
      <g transform={`translate(-250 -440) scale(5) rotate(${onda(lf, 90) * 1.5} 50 50)`}>
        {paths.map((d, i) => (
          <Trazo key={i} d={d} p={primera ? 1 : salida(tramo(lf, d0 + (i * 18) / paths.length, 18))} color={P.tinta} ancho={2.2} />
        ))}
      </g>
      <Trazo d={ovaloMano(0, -190, 330, 305, `ov${e.indice}`)} p={primera ? 0.3 + 0.7 * salida(tramo(lf, 0, 22)) : salida(tramo(lf, fin + 30, 20))} color={P.rojo} ancho={9} />
      <Escrito lineas={tx.lineas} size={tx.size} x={0} y={270} desde={primera ? -999 : fin} lf={lf} color={P.tinta} id={`d${e.indice}`} />
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2 + lf * 0.03;
        return <Trazo key={k} d={garabato(Math.cos(a) * 400, -190 + Math.sin(a) * 360, 24, k * 3)} p={salida(tramo(lf, (primera ? 0 : fin) + 50 + k * 6, 10))} color={P.verde} ancho={5} />;
      })}
    </>
  );
};

const Cifra: React.FC<PE> = ({ e, lf, P, primera, inicio }) => {
  const valor = String(e.valor ?? "");
  const v = ajustar(valor, { familia: FAM, peso: 700, maxW: 700, maxLineas: 1, tamMax: 260, tamMin: 100 });
  const et = ajustar(String(e.etiqueta ?? ""), { familia: FAM, peso: 700, maxW: 720, maxLineas: 2, tamMax: 86, tamMin: 52 });
  const w = medir(v.lineas[0] ?? "", FAM, 700, v.size);
  const fin = primera ? 0 : inicio + duracionEscritura(v.lineas) + 4;
  const finEt = fin + 18 + duracionEscritura(et.lineas);
  const yEt = 210;
  const wEt = Math.max(...et.lineas.map((l) => medir(l, FAM, 700, et.size)), 10);
  return (
    <>
      <rect x={-wEt / 2 - 12} y={yEt + (et.lineas.length - 1) * et.size * 1.14 - et.size * 0.45} width={(wEt + 24) * salida(tramo(lf, primera ? 0 : finEt + 8, 14))} height={et.size * 0.55} fill={P.resaltador} opacity={0.6} />
      <Escrito lineas={v.lineas} size={v.size} x={0} y={-140 + v.size * 0.34} desde={primera ? -999 : inicio} lf={lf} color={P.rojo} id={`c${e.indice}`} />
      <Trazo d={ovaloMano(0, -140, w / 2 + 70, v.size * 0.72, `oc${e.indice}`)} p={primera ? 0.3 + 0.7 * salida(tramo(lf, 0, 20)) : salida(tramo(lf, fin, 18))} color={P.tinta} ancho={9} />
      <Escrito lineas={et.lineas} size={et.size} x={0} y={yEt} desde={primera ? -999 : fin + 18} lf={lf} color={P.tinta} id={`ce${e.indice}`} />
    </>
  );
};

const Paso: React.FC<PE> = ({ e, lf, P, primera, inicio }) => {
  const num = String(e.n ?? "1");
  const tx = ajustar(String(e.texto ?? ""), { familia: FAM, peso: 700, maxW: 640, maxLineas: 3, tamMax: 84, tamMin: 52 });
  const lh = tx.size * 1.14;
  const tieneIcono = Boolean(e.icono);
  const yTexto = tieneIcono ? 190 : -60;
  const alto = tx.lineas.length * lh + 50;
  const d = primera ? -999 : inicio;
  const fin = primera ? 0 : inicio + 14;
  const [cuerpo, punta] = flechaMano(-250, -330, tieneIcono ? -150 : -120, tieneIcono ? -230 : yTexto - tx.size - 20, `fp${e.indice}`);
  return (
    <>
      <Trazo d={ovaloMano(-320, -380, 66, 66, `np${e.indice}`)} p={primera ? 1 : salida(tramo(lf, d, 14))} color={P.rojo} ancho={9} />
      <Escrito lineas={[num]} size={100} x={-320} y={-346} desde={primera ? -999 : inicio + 6} lf={lf} color={P.rojo} id={`pn${e.indice}`} pluma={false} />
      <Trazo d={cuerpo} p={primera ? 1 : salida(tramo(lf, inicio + 6, 8))} color={P.tinta} ancho={7} />
      <Trazo d={punta} p={primera ? 1 : salida(tramo(lf, inicio + 12, 5))} color={P.tinta} ancho={7} />
      {tieneIcono ? (
        <g transform="translate(-150 -430) scale(3.6)">
          {icono(e.icono).map((p, i, arr) => (
            <Trazo key={i} d={p} p={primera ? 1 : salida(tramo(lf, inicio + 8 + (i * 10) / arr.length, 12))} color={P.verde} ancho={2.6} />
          ))}
        </g>
      ) : null}
      <Trazo d={rectMano(-360, yTexto - tx.size - 10, 720, alto, `rp${e.indice}`)} p={primera ? 1 : salida(tramo(lf, fin, 18))} color={P.tinta} ancho={6} opacity={0.8} />
      <Escrito lineas={tx.lineas} size={tx.size} x={0} y={yTexto + 6} desde={primera ? -999 : fin + 2} lf={lf} color={P.tinta} id={`pt${e.indice}`} />
      {void d}
    </>
  );
};

const Comparar: React.FC<PE> = ({ e, lf, P, primera, inicio }) => {
  const izq = (e.izq ?? {}) as { titulo?: string; texto?: string };
  const der = (e.der ?? {}) as { titulo?: string; texto?: string };
  const marca = e.marca === "izq" ? "izq" : e.marca === "ninguna" ? "ninguna" : "der";
  const col = (c: { titulo?: string; texto?: string }, x: number, desde: number, lado: string) => {
    const ti = ajustar(String(c.titulo ?? ""), { familia: FAM, peso: 700, maxW: 340, maxLineas: 2, tamMax: 84, tamMin: 52 });
    const te = ajustar(String(c.texto ?? ""), { familia: FAM, peso: 700, maxW: 340, maxLineas: 5, tamMax: 66, tamMin: 46 });
    const wt = Math.max(...ti.lineas.map((l) => medir(l, FAM, 700, ti.size)), 20);
    const yT = -320;
    const ySub = yT + (ti.lineas.length - 1) * ti.size * 1.14 + 26;
    const finT = desde + duracionEscritura(ti.lineas);
    return (
      <g key={lado}>
        <Escrito lineas={ti.lineas} size={ti.size} x={x} y={yT} desde={primera ? -999 : desde} lf={lf} color={lado === "izq" ? P.rojo : P.verde} id={`cm${lado}${e.indice}`} />
        <Trazo d={subrayado(x - wt / 2, x + wt / 2, ySub, `cs${lado}${e.indice}`)} p={primera ? 1 : salida(tramo(lf, finT, 10))} color={P.tinta} ancho={6} />
        <Escrito lineas={te.lineas} size={te.size} x={x} y={ySub + te.size + 40} desde={primera ? -999 : finT + 6} lf={lf} color={P.tinta} id={`ct${lado}${e.indice}`} />
      </g>
    );
  };
  const finCols = inicio + 44;
  const mal = marca === "der" ? -200 : 200;
  const bien = -mal;
  return (
    <>
      <Trazo d="M0 -440 Q8 0 -4 460" p={primera ? 1 : salida(tramo(lf, inicio, 14))} color={P.tinta} ancho={6} opacity={0.7} />
      {col(izq, -200, inicio + 2, "izq")}
      {col(der, 200, inicio + 16, "der")}
      {marca !== "ninguna" ? (
        <>
          {cruzMano(mal, 330, 64, `x${e.indice}`).map((d, i) => (
            <Trazo key={i} d={d} p={primera ? 1 : salida(tramo(lf, finCols + i * 6, 8))} color={P.rojo} ancho={12} />
          ))}
          <Trazo d={`M${bien - 70} 330 L${bien - 20} 380 L${bien + 80} 260`} p={primera ? 1 : salida(tramo(lf, finCols + 16, 12))} color={P.verde} ancho={14} />
        </>
      ) : null}
    </>
  );
};

const Nota: React.FC<PE & { encabezado: string; texto: string; dibujo: string[] }> = ({ e, lf, P, primera, inicio, encabezado, texto, dibujo }) => {
  const tx = ajustar(texto, { familia: FAM, peso: 700, maxW: 600, maxLineas: 4, tamMax: 72, tamMin: 46 });
  const lh = tx.size * 1.14;
  const alto = 200 + tx.lineas.length * lh;
  const top = -60 - alto / 2;
  const entra = primera ? 1 : salida(tramo(lf, inicio, 12));
  return (
    <g transform={`rotate(${-3 + (1 - entra) * -8}) translate(0 ${(1 - entra) * 60})`} opacity={lim(entra * 1.5)}>
      <rect x={-360} y={top} width={720} height={alto} fill={P.nota} />
      <path d={`M-360 ${top + alto} L360 ${top + alto} L360 ${top + alto - 6} L-360 ${top + alto - 3} Z`} fill="#000" opacity={0.08} />
      <g transform={`translate(-55 ${top - 70}) scale(1.1)`}>
        {dibujo.map((d, i) => (
          <Trazo key={i} d={d} p={primera ? 1 : salida(tramo(lf, inicio + 8, 14))} color={P.rojo} ancho={5} />
        ))}
      </g>
      <Escrito lineas={[encabezado]} size={64} x={0} y={top + 120} desde={primera ? -999 : inicio + 2} lf={lf} color={P.rojo} id={`ne${e.indice}`} />
      <Escrito lineas={tx.lineas} size={tx.size} x={0} y={top + 120 + 30 + tx.size} desde={primera ? -999 : inicio + 10} lf={lf} color={"#1F3A68"} id={`nt${e.indice}`} />
    </g>
  );
};

const ESCENAS: Record<string, React.FC<PE>> = {
  titulo: Titulo,
  dibujo: Dibujo,
  cifra: Cifra,
  paso: Paso,
  comparar: Comparar,
  fuente: (p) => <Nota {...p} encabezado="Fuente:" texto={String(p.e.texto ?? p.plan.fuente ?? "")} dibujo={icono("libro")} />,
  pregunta: (p) => <Nota {...p} encabezado="¿Y tú?" texto={String(p.e.texto ?? "Cuéntamelo en los comentarios")} dibujo={icono("comentario")} />,
};

const camara = (escenas: Escena[], f: number) => {
  const k = escenaEn(escenas, f);
  const e = escenas[k];
  const lf = e ? f - e.f0 : f;
  const a = recuadro(Math.max(0, k - 1));
  const b = recuadro(k);
  const t = k === 0 ? 1 : salida(tramo(lf, 0, PANEO));
  const deriva = { x: onda(f, 150) * 10, y: onda(f, 110, 0.3) * 8 };
  const giroA = (Math.max(0, k - 1) % 2 ? 1 : -1) * 1.1;
  const giroB = (k % 2 ? 1 : -1) * 1.1;
  return {
    x: a.x + (b.x - a.x) * t + deriva.x,
    y: a.y + (b.y - a.y) * t + deriva.y,
    giro: giroA + (giroB - giroA) * t + onda(f, 200) * 0.4,
    zoom: 1 + 0.012 * onda(f, 130, 0.5) - 0.06 * Math.sin(Math.PI * t) * (k === 0 ? 0 : 1),
    k,
  };
};

const Hoja: React.FC<{ P: Paleta; cam: { x: number; y: number } }> = ({ P, cam }) => {
  const x0 = Math.floor((cam.x - 800) / 40) * 40;
  const y0 = Math.floor((cam.y - 1200) / 40) * 40;
  const lineas: React.ReactNode[] = [];
  for (let x = x0; x <= cam.x + 800; x += 40) lineas.push(<line key={`v${x}`} x1={x} y1={cam.y - 1200} x2={x} y2={cam.y + 1300} stroke={Math.round(x / 40) % 5 === 0 ? P.cuadricula5 : P.cuadricula} strokeWidth={Math.round(x / 40) % 5 === 0 ? 2.4 : 1.6} />);
  for (let y = y0; y <= cam.y + 1300; y += 40) lineas.push(<line key={`h${y}`} x1={cam.x - 800} y1={y} x2={cam.x + 800} y2={y} stroke={Math.round(y / 40) % 5 === 0 ? P.cuadricula5 : P.cuadricula} strokeWidth={Math.round(y / 40) % 5 === 0 ? 2.4 : 1.6} />);
  return (
    <>
      <rect x={cam.x - 900} y={cam.y - 1400} width={1800} height={2800} fill={P.papel} />
      {lineas}
      <line x1={-470} y1={cam.y - 1300} x2={-470} y2={cam.y + 1300} stroke={P.margen} strokeWidth={4} />
      <line x1={-460} y1={cam.y - 1300} x2={-460} y2={cam.y + 1300} stroke={P.margen} strokeWidth={2} />
    </>
  );
};

const Cuadro: React.FC<PropsCuadro> = ({ f, escenas, plan, soloFondo }) => {
  const lista = useFuentes([{ fuente: kalam, peso: 700 }]);
  const P = PALETAS_PIZARRA[plan.paleta ?? "cuaderno"] ?? PALETAS_PIZARRA.cuaderno;
  const cam = camara(escenas, f);
  const k = cam.k;
  const actual = escenas[k];
  const mundo = `translate(540 740) rotate(${cam.giro}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  const panel = (e: Escena, i: number) => {
    const C = ESCENAS[e.tipo];
    if (!C) return null;
    const pos = recuadro(i);
    const lf = f - e.f0;
    const primera = e.indice === 0 && e.f0 === 0;
    return (
      <g key={i} transform={`translate(${pos.x} ${pos.y})`}>
        <C e={e} lf={lf} dur={e.f1 - e.f0} P={P} primera={primera} inicio={primera ? 0 : PANEO} plan={plan} />
      </g>
    );
  };
  const previa = k > 0 && f - actual.f0 < PANEO + 4 ? escenas[k - 1] : null;
  return (
    <svg width={LIENZO.w} height={LIENZO.h} viewBox={`0 0 ${LIENZO.w} ${LIENZO.h}`} style={{ position: "absolute", inset: 0 }}>
      <rect width={LIENZO.w} height={LIENZO.h} fill={P.papel} />
      <g transform={mundo}>
        <Hoja P={P} cam={cam} />
        {!soloFondo && lista ? (
          <>
            {previa ? panel(previa, k - 1) : null}
            {actual ? panel(actual, k) : null}
          </>
        ) : null}
      </g>
    </svg>
  );
};

export const Pizarra: React.FC<PropsShort> = (props) => (
  <Short
    {...props}
    Cuadro={Cuadro}
    colorFondo={(PALETAS_PIZARRA[props.plan.paleta ?? "cuaderno"] ?? PALETAS_PIZARRA.cuaderno).papel}
    sonidoDe={(e) => (e.indice === 0 ? null : { archivo: "sonidos/trazo.wav", volumen: 0.3 })}
  />
);
