import React from "react";
import { loadFont } from "@remotion/google-fonts/BricolageGrotesque";
import { Short } from "../comun/Short";
import { icono } from "../comun/iconos";
import { lim, onda, resorte, salida, suave, tramo } from "../comun/movimiento";
import { azar, escenaEn, normalizar } from "../comun/plan.mjs";
import { ajustar, contar, formatear, medir, numeroDe, useFuentes } from "../comun/texto";
import type { Escena, PropsCuadro, PropsShort } from "../comun/tipos";
import { LIENZO } from "../comun/zonaSegura";

/**
 * Estilo Explicador: tipografía cinética + un número grande + formas y gráficos generados a partir del dato.
 * Tipos de escena: titular · numero · barras · porcentaje · icono · frase · lista · fuente · pregunta (CLAUDE.md).
 */

const bricolage = loadFont("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });
const FAM = bricolage.fontFamily;

type Paleta = { fondo: string; puntos: string; a1: string; a2: string; a3: string; texto: string; tenue: string; tarjeta: string; tinta: string };
export const PALETAS_EXPLICADOR: Record<string, Paleta> = {
  noche: { fondo: "#111433", puntos: "#2E347A", a1: "#FF6B3D", a2: "#3DDCAA", a3: "#8C7BFF", texto: "#FFFFFF", tenue: "#C3C7F2", tarjeta: "#1D2156", tinta: "#111433" },
  coral: { fondo: "#2B0F1E", puntos: "#5C2849", a1: "#FFB13D", a2: "#FF5E7E", a3: "#5ED6FF", texto: "#FFF6EE", tenue: "#F4C6D4", tarjeta: "#41182F", tinta: "#2B0F1E" },
  bosque: { fondo: "#0C2420", puntos: "#24584D", a1: "#FFD166", a2: "#5EF2B8", a3: "#FF7A59", texto: "#F4FFF9", tenue: "#B5E2D3", tarjeta: "#163B34", tinta: "#0C2420" },
};

type PE = { e: Escena; lf: number; dur: number; P: Paleta; primera: boolean };

const Texto: React.FC<{ x: number; y: number; size: number; fill: string; peso?: number; ancla?: "start" | "middle" | "end"; children: React.ReactNode; espaciado?: number; opacity?: number }> = ({
  x,
  y,
  size,
  fill,
  peso = 800,
  ancla = "middle",
  children,
  espaciado = 0,
  opacity = 1,
}) => (
  <text x={x} y={y} fontFamily={`"${FAM}"`} fontWeight={peso} fontSize={size} fill={fill} textAnchor={ancla} letterSpacing={espaciado} opacity={opacity}>
    {children}
  </text>
);

/** renglones centrados en x = 540 que entran desde abajo, uno tras otro */
const Renglones: React.FC<{ lineas: string[]; size: number; yCentro: number; lf: number; fill: string; peso?: number; desfase?: number; desde?: number }> = ({
  lineas,
  size,
  yCentro,
  lf,
  fill,
  peso = 800,
  desfase = 4,
  desde = 0,
}) => {
  const lh = size * 1.1;
  const y0 = yCentro - ((lineas.length - 1) * lh) / 2 + size * 0.34;
  return (
    <>
      {lineas.map((l, i) => {
        const r = resorte(lf, desde + i * desfase);
        return (
          <g key={i} transform={`translate(0 ${(1 - r) * 50})`} opacity={lim(r * 1.6)}>
            <Texto x={540} y={y0 + i * lh} size={size} fill={fill} peso={peso}>
              {l}
            </Texto>
          </g>
        );
      })}
    </>
  );
};

const Titular: React.FC<PE> = ({ e, lf, P, primera }) => {
  const texto = String(e.texto ?? "");
  const destacar = String(e.destacar ?? "")
    .split(/\s+/)
    .map(normalizar)
    .filter(Boolean);
  const { size, lineas } = ajustar(texto, { familia: FAM, peso: 800, maxW: 820, maxLineas: 4, tamMax: 132, tamMin: 68 });
  const lh = size * 1.12;
  const y0 = 720 - ((lineas.length - 1) * lh) / 2 + size * 0.34;
  let idx = 0;
  return (
    <>
      {lineas.map((l, li) => {
        const ws = l.split(" ");
        const total = medir(l, FAM, 800, size);
        const x0 = 540 - total / 2;
        let x = x0;
        return ws.map((w, wi) => {
          const ancho = medir(w, FAM, 800, size);
          const xw = x;
          x += medir(`${w} `, FAM, 800, size);
          const i = idx++;
          const desde = primera ? i * 0.6 - 22 : i * 2.6;
          const r = resorte(lf, desde, 200, 13);
          const marca = destacar.includes(normalizar(w));
          const rm = resorte(lf, desde + 5, 160, 16);
          const y = y0 + li * lh;
          return (
            <g key={`${li}-${wi}`} transform={`translate(${xw + ancho / 2} ${y - size * 0.35}) scale(${0.6 + 0.4 * r}) rotate(${(1 - r) * (wi % 2 ? 6 : -6)}) translate(${-(xw + ancho / 2)} ${-(y - size * 0.35)})`} opacity={lim(r * 1.8)}>
              {marca ? <rect x={xw - 14} y={y - size * 0.86} width={(ancho + 28) * rm} height={size * 1.08} rx={size * 0.2} fill={P.a1} transform={`rotate(-2 ${xw} ${y})`} /> : null}
              <Texto x={xw} y={y} size={size} fill={marca ? P.tinta : P.texto} ancla="start">
                {w}
              </Texto>
            </g>
          );
        });
      })}
    </>
  );
};

const Numero: React.FC<PE> = ({ e, lf, P, primera }) => {
  const valor = String(e.valor ?? "");
  const p = primera ? 1 : salida(tramo(lf, 3, 32));
  const { size } = ajustar(valor, { familia: FAM, peso: 800, maxW: 560, maxLineas: 1, tamMax: 250, tamMin: 96 });
  const anillo = salida(tramo(lf, 0, 40));
  const et = ajustar(String(e.etiqueta ?? ""), { familia: FAM, peso: 600, maxW: 800, maxLineas: 2, tamMax: 66, tamMin: 46 });
  const pulso = 1 + 0.03 * Math.exp(-((lf % 48) / 8)) * (lf >= 48 ? 1 : 0);
  return (
    <g transform={`translate(540 640) scale(${pulso}) translate(-540 -640)`}>
      <circle cx={540} cy={640} r={330} fill="none" stroke={P.tarjeta} strokeWidth={34} />
      <circle cx={540} cy={640} r={330} fill="none" stroke={P.a2} strokeWidth={34} pathLength={1} strokeDasharray={`${anillo} 1`} strokeLinecap="round" transform="rotate(-90 540 640)" />
      {Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * 360 + lf * 0.5;
        return <rect key={i} x={538} y={250} width={4} height={i % 4 ? 16 : 30} fill={P.tenue} opacity={0.55} transform={`rotate(${a} 540 640)`} />;
      })}
      <g transform={`translate(0 ${(1 - resorte(lf, -6)) * 40})`}>
        <Texto x={540} y={640 + size * 0.34} size={size} fill={P.texto}>
          {contar(valor, p)}
        </Texto>
      </g>
      <Renglones lineas={et.lineas} size={et.size} yCentro={1090} lf={lf} fill={P.tenue} peso={600} desde={primera ? -10 : 12} />
    </g>
  );
};

const valorNum = (v: unknown) => {
  if (typeof v === "number") return v;
  return numeroDe(String(v ?? ""))?.n ?? 0;
};

const Barras: React.FC<PE> = ({ e, lf, P, primera }) => {
  const a = (e.a ?? {}) as { etiqueta?: string; valor?: number | string };
  const b = (e.b ?? {}) as { etiqueta?: string; valor?: number | string };
  const unidad = String(e.unidad ?? "");
  const va = valorNum(a.valor);
  const vb = valorNum(b.valor);
  const max = Math.max(va, vb, 1e-9);
  const base = 1150;
  const H = 600;
  const col = (v: number, x: number, color: string, etq: string, retraso: number, raw: unknown) => {
    const p = primera ? 1 : salida(tramo(lf, retraso, 30));
    const h = (H * v * p) / max;
    const crudo = String(raw ?? "");
    const dec = crudo.includes(",") ? crudo.split(",")[1].replace(/\D/g, "").length : crudo.includes(".") ? crudo.split(".")[1].replace(/\D/g, "").length : 0;
    const et = ajustar(etq, { familia: FAM, peso: 600, maxW: 300, maxLineas: 2, tamMax: 50, tamMin: 44 });
    return (
      <g>
        <rect x={x - 115} y={base - h} width={230} height={Math.max(0, h)} rx={22} fill={color} />
        <Texto x={x} y={base - h - 26} size={72} fill={P.texto}>
          {`${formatear(v * p, dec)}${unidad ? ` ${unidad}` : ""}`.trim()}
        </Texto>
        {et.lineas.map((l, i) => (
          <Texto key={i} x={x} y={base + 56 + i * et.size * 1.1} size={et.size} fill={P.tenue} peso={600}>
            {l}
          </Texto>
        ))}
      </g>
    );
  };
  const titulo = e.titulo ? ajustar(String(e.titulo), { familia: FAM, peso: 800, maxW: 820, maxLineas: 2, tamMax: 76, tamMin: 50 }) : null;
  return (
    <>
      {titulo ? <Renglones lineas={titulo.lineas} size={titulo.size} yCentro={330} lf={lf} fill={P.texto} /> : null}
      <rect x={180} y={base} width={720} height={8} rx={4} fill={P.tenue} opacity={0.6} />
      {col(va, 370, P.a1, String(a.etiqueta ?? ""), 2, a.valor)}
      {col(vb, 710, P.a3, String(b.etiqueta ?? ""), 14, b.valor)}
    </>
  );
};

const Porcentaje: React.FC<PE> = ({ e, lf, P, primera }) => {
  const v = lim(valorNum(e.valor), 0, 100);
  const llenos = Math.round(v);
  const p = primera ? 1 : tramo(lf, 4, 40);
  const et = ajustar(String(e.etiqueta ?? ""), { familia: FAM, peso: 600, maxW: 820, maxLineas: 1, tamMax: 56, tamMin: 44 });
  return (
    <>
      <Texto x={540} y={430} size={160} fill={P.texto}>
        {contar(`${formatear(v, Number.isInteger(v) ? 0 : 1)} %`, primera ? 1 : salida(p))}
      </Texto>
      <Texto x={540} y={510} size={et.size} fill={P.tenue} peso={600}>
        {et.lineas[0] ?? ""}
      </Texto>
      {Array.from({ length: 100 }, (_, i) => {
        const fila = Math.floor(i / 10);
        const colm = i % 10;
        const lleno = i < llenos && i / 100 <= p;
        const r = lleno ? resorte(lf, primera ? -10 : 4 + i * 0.4, 260, 12) : 0;
        return <circle key={i} cx={270 + colm * 60} cy={600 + fila * 60} r={14 + 8 * r} fill={lleno ? P.a2 : P.tarjeta} />;
      })}
    </>
  );
};

const Icono: React.FC<PE> = ({ e, lf, P, primera }) => {
  const paths = icono(e.icono);
  const dibuja = primera ? 1 : salida(tramo(lf, 2, 26));
  const r = resorte(lf, primera ? -8 : 0, 150, 12);
  const tx = ajustar(String(e.texto ?? ""), { familia: FAM, peso: 800, maxW: 820, maxLineas: 2, tamMax: 92, tamMin: 56 });
  return (
    <>
      <g transform={`translate(540 600) scale(${0.4 + 0.6 * r}) rotate(${onda(lf, 120) * 4}) translate(-540 -600)`}>
        <circle cx={540} cy={600} r={260} fill="none" stroke={P.a2} strokeWidth={10} strokeDasharray="28 22" transform={`rotate(${lf * 0.8} 540 600)`} />
        <circle cx={540} cy={600} r={220} fill={P.a1} />
        <g transform="translate(390 450) scale(3)">
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={P.tinta} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${dibuja} 1`} />
          ))}
        </g>
      </g>
      <Renglones lineas={tx.lineas} size={tx.size} yCentro={1030} lf={lf} fill={P.texto} desde={primera ? -10 : 8} />
    </>
  );
};

const Frase: React.FC<PE> = ({ e, lf, P, primera }) => {
  const tx = ajustar(String(e.texto ?? ""), { familia: FAM, peso: 800, maxW: 820, maxLineas: 4, tamMax: 112, tamMin: 64 });
  const lh = tx.size * 1.12;
  const y0 = 740 - ((tx.lineas.length - 1) * lh) / 2 + tx.size * 0.34;
  const yFin = y0 + (tx.lineas.length - 1) * lh + 36;
  const raya = salida(tramo(lf, primera ? 0 : 10, 24));
  return (
    <>
      <text x={150} y={y0 - tx.size * 0.6} fontFamily={`"${FAM}"`} fontWeight={800} fontSize={240} fill={P.a3} opacity={0.9}>
        “
      </text>
      {tx.lineas.map((l, i) => {
        const r = resorte(lf, primera ? -8 : i * 4);
        const lado = i % 2 ? 1 : -1;
        return (
          <g key={i} transform={`translate(${(1 - r) * 180 * lado} 0)`} opacity={lim(r * 1.5)}>
            <Texto x={540} y={y0 + i * lh} size={tx.size} fill={P.texto}>
              {l}
            </Texto>
          </g>
        );
      })}
      <rect x={540 - 200 * raya} y={yFin} width={400 * raya} height={14} rx={7} fill={P.a1} />
    </>
  );
};

const Lista: React.FC<PE> = ({ e, lf, dur, P, primera }) => {
  const items = (Array.isArray(e.items) ? e.items : []).slice(0, 4).map(String);
  const n = Math.max(1, items.length);
  const paso = Math.max(10, Math.floor(dur / (n + 0.5)));
  const alto = 230;
  const y0 = 740 - ((n - 1) * alto) / 2;
  return (
    <>
      {items.map((it, i) => {
        const desde = primera ? -10 : i * paso;
        const r = resorte(lf, desde);
        const tx = ajustar(it, { familia: FAM, peso: 800, maxW: 600, maxLineas: 2, tamMax: 70, tamMin: 46 });
        const y = y0 + i * alto;
        const lh = tx.size * 1.1;
        return (
          <g key={i} opacity={lim(r * 1.6)} transform={`translate(${(1 - r) * -120} 0)`}>
            <circle cx={200} cy={y} r={56} fill={[P.a1, P.a2, P.a3, P.a1][i]} />
            <path d={`M176 ${y + 2} L194 ${y + 20} L226 ${y - 18}`} fill="none" stroke={P.tinta} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${salida(tramo(lf, desde + 6, 12))} 1`} />
            {tx.lineas.map((l, k) => (
              <Texto key={k} x={290} y={y + tx.size * 0.34 - ((tx.lineas.length - 1) * lh) / 2 + k * lh} size={tx.size} fill={P.texto} ancla="start">
                {l}
              </Texto>
            ))}
          </g>
        );
      })}
    </>
  );
};

const Tarjeta: React.FC<PE & { etiqueta: string; texto: string; dibujo: string[] }> = ({ lf, P, primera, etiqueta, texto, dibujo }) => {
  const r = resorte(lf, primera ? -8 : 0, 150, 14);
  const tx = ajustar(texto, { familia: FAM, peso: 800, maxW: 700, maxLineas: 3, tamMax: 80, tamMin: 48 });
  const lh = tx.size * 1.12;
  const alto = 230 + tx.lineas.length * lh;
  const top = 760 - alto / 2;
  return (
    <g transform={`translate(540 760) scale(${0.7 + 0.3 * r}) translate(-540 -760)`} opacity={lim(r * 1.5)}>
      <rect x={130} y={top} width={820} height={alto} rx={40} fill={P.tarjeta} stroke={P.a2} strokeWidth={5} />
      <circle cx={540} cy={top} r={86} fill={P.a2} />
      <g transform={`translate(${540 - 45} ${top - 45}) scale(0.9)`}>
        {dibujo.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={P.tinta} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${primera ? 1 : salida(tramo(lf, 6, 16))} 1`} />
        ))}
      </g>
      <Texto x={540} y={top + 150} size={46} fill={P.a2} espaciado={8}>
        {etiqueta}
      </Texto>
      {tx.lineas.map((l, i) => (
        <Texto key={i} x={540} y={top + 150 + 40 + tx.size + i * lh} size={tx.size} fill={P.texto}>
          {l}
        </Texto>
      ))}
    </g>
  );
};

const ESCENAS: Record<string, React.FC<PE & { plan: PropsCuadro["plan"] }>> = {
  titular: Titular,
  numero: Numero,
  barras: Barras,
  porcentaje: Porcentaje,
  icono: Icono,
  frase: Frase,
  lista: Lista,
  fuente: (p) => <Tarjeta {...p} etiqueta="FUENTE" texto={String(p.e.texto ?? p.plan.fuente ?? "")} dibujo={icono("lupa")} />,
  pregunta: (p) => <Tarjeta {...p} etiqueta="TU TURNO" texto={String(p.e.texto ?? "¿Lo sabías? Cuéntamelo en los comentarios")} dibujo={icono("comentario")} />,
};

/** fondo: color, puntos y formas grandes que cambian de lugar cada 1,6 s */
const Fondo: React.FC<{ f: number; P: Paleta; semilla: string }> = ({ f, P, semilla }) => {
  const BLOQUE = 48;
  const b = Math.floor(f / BLOQUE);
  const t = suave(tramo(f - b * BLOQUE, 0, 18));
  const lugar = (i: number, k: number) => {
    const r = azar(`${semilla}-${i}-${k}`);
    return { x: 80 + r() * 920, y: 160 + r() * 1600, s: 0.7 + r() * 0.6, g: r() * 360 };
  };
  const formas = [0, 1, 2, 3, 4].map((i) => {
    const a = lugar(i, Math.max(0, b - 1));
    const z = lugar(i, b);
    const k = b === 0 ? 1 : t;
    return { x: a.x + (z.x - a.x) * k, y: a.y + (z.y - a.y) * k, s: a.s + (z.s - a.s) * k, g: a.g + (z.g - a.g) * k + f * (i % 2 ? 0.35 : -0.35), i };
  });
  const colores = [P.a1, P.a2, P.a3, P.a2, P.a1];
  return (
    <>
      <rect width={LIENZO.w} height={LIENZO.h} fill={P.fondo} />
      {Array.from({ length: 36 }, (_, fila) =>
        Array.from({ length: 20 }, (_, c) => <circle key={`${fila}-${c}`} cx={27 + c * 54} cy={27 + fila * 54} r={4} fill={P.puntos} />),
      )}
      {formas.map(({ x, y, s, g, i }) => {
        const c = colores[i];
        const tr = `translate(${x} ${y}) rotate(${g}) scale(${s})`;
        const op = 0.22;
        if (i === 0) return <circle key={i} transform={tr} r={170} fill="none" stroke={c} strokeWidth={30} opacity={op} />;
        if (i === 1) return <rect key={i} transform={tr} x={-120} y={-120} width={240} height={240} rx={30} fill="none" stroke={c} strokeWidth={26} opacity={op} />;
        if (i === 2) return <path key={i} transform={tr} d="M0 -150 L130 75 L-130 75 Z" fill="none" stroke={c} strokeWidth={26} strokeLinejoin="round" opacity={op} />;
        if (i === 3) return <path key={i} transform={tr} d="M-30 -110 H30 V-30 H110 V30 H30 V110 H-30 V30 H-110 V-30 H-30 Z" fill={c} opacity={op * 0.8} />;
        return <circle key={i} transform={tr} r={90} fill={c} opacity={op * 0.8} />;
      })}
    </>
  );
};

const Cuadro: React.FC<PropsCuadro> = ({ f, escenas, plan, soloFondo }) => {
  const lista = useFuentes([
    { fuente: bricolage, peso: 800 },
    { fuente: bricolage, peso: 600 },
  ]);
  const P = PALETAS_EXPLICADOR[plan.paleta ?? "noche"] ?? PALETAS_EXPLICADOR.noche;
  const k = escenaEn(escenas, f);
  const actual = escenas[k];
  const SALIDA = 6;
  const RETRASO = 3;
  const dibujar = (e: Escena, modo: "entra" | "sale") => {
    const C = ESCENAS[e.tipo];
    if (!C) return null;
    const primera = e.indice === 0 && e.f0 === 0;
    // la escena nueva espera a que la anterior casi termine de salir
    const lf = f - e.f0 - (primera ? 0 : RETRASO);
    const dur = e.f1 - e.f0;
    let tr = "";
    let op = 1;
    if (modo === "sale") {
      const p = tramo(f - (e.f1 as number), 0, SALIDA - 1);
      // achica (no agranda): así nada invade el carril de los subtítulos mientras sale
      tr = `translate(540 740) scale(${1 - 0.12 * p}) translate(-540 -740)`;
      op = 1 - suave(p);
    } else {
      const pulso = lf >= 48 ? 1 + 0.025 * Math.exp(-((lf % 48) / 7)) : 1;
      tr = `translate(540 740) scale(${pulso}) translate(-540 -740)`;
    }
    return (
      <g key={`${e.indice}-${modo}`} transform={tr} opacity={op}>
        <C e={e} lf={lf} dur={dur} P={P} primera={primera} plan={plan} />
      </g>
    );
  };
  const previa = k > 0 && f - actual.f0 < SALIDA ? escenas[k - 1] : null;
  return (
    <svg width={LIENZO.w} height={LIENZO.h} viewBox={`0 0 ${LIENZO.w} ${LIENZO.h}`} style={{ position: "absolute", inset: 0 }}>
      <Fondo f={f} P={P} semilla={plan.slug ?? "explicador"} />
      {!soloFondo && lista ? (
        <>
          {previa ? dibujar(previa, "sale") : null}
          {actual ? dibujar(actual, "entra") : null}
        </>
      ) : null}
    </svg>
  );
};

export const Explicador: React.FC<PropsShort> = (props) => (
  <Short
    {...props}
    Cuadro={Cuadro}
    colorFondo={(PALETAS_EXPLICADOR[props.plan.paleta ?? "noche"] ?? PALETAS_EXPLICADOR.noche).fondo}
    sonidoDe={(e) => (e.indice === 0 ? null : { archivo: ["numero", "porcentaje", "barras"].includes(e.tipo) ? "sonidos/pop.wav" : "sonidos/whoosh.wav", volumen: 0.35 })}
  />
);
