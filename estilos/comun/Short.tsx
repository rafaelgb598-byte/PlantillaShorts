import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { EMPALME, resolverEscenas } from "./plan.mjs";
import { Subtitulos } from "./subtitulos/Subtitulos";
import type { Escena, PropsCuadro, PropsShort } from "./tipos";
import { LIENZO } from "./zonaSegura";

/**
 * Contenedor común de los 3 estilos.
 * - Capas para el QA de subtítulos: «fondo» (solo escenario), «escena» (escenario + objetos), «subtitulos» (solo
 *   subtítulos, fondo transparente) y «todo» (el video normal, con voz y efectos).
 * - Loop: en los últimos EMPALME fotogramas aparece encima el cuadro 0, así el último fotograma empalma con el primero.
 */

export type Sonido = { archivo: string; volumen: number };

type Props = PropsShort & {
  Cuadro: React.FC<PropsCuadro>;
  colorFondo: string;
  /** efecto de sonido al entrar cada escena (según su tipo) */
  sonidoDe?: (e: Escena) => Sonido | null;
};

const suave = (x: number) => x * x * (3 - 2 * x);
/** tema de Kevin MacLeod (CC BY 4.0); el crédito exacto está en public/musica/creditos.json */
const MUSICA = "musica/investigations-kevin-macleod.mp3";

export const Short: React.FC<Props> = ({ plan, palabras, voz, capa = "todo", mudo = false, Cuadro, colorFondo, sonidoDe }) => {
  const f = useCurrentFrame();
  const { durationInFrames: D, fps } = useVideoConfig();
  const { escenas } = useMemo(() => resolverEscenas(plan, palabras, fps), [plan, palabras, fps]);
  const desde = D - EMPALME;
  const empalme = f < desde ? 0 : suave(Math.min(1, (f - desde) / (EMPALME - 1)));
  const conDibujo = capa !== "subtitulos";
  const soloFondo = capa === "fondo";
  return (
    <AbsoluteFill style={{ backgroundColor: conDibujo ? colorFondo : "transparent" }}>
      {conDibujo ? <Cuadro f={f} escenas={escenas as Escena[]} plan={plan} total={D} soloFondo={soloFondo} /> : null}
      {conDibujo && empalme > 0 ? (
        <AbsoluteFill style={{ opacity: empalme }}>
          <Cuadro f={0} escenas={escenas as Escena[]} plan={plan} total={D} soloFondo={soloFondo} />
        </AbsoluteFill>
      ) : null}
      {capa === "todo" || capa === "subtitulos" ? (
        <svg width={LIENZO.w} height={LIENZO.h} viewBox={`0 0 ${LIENZO.w} ${LIENZO.h}`} style={{ position: "absolute", inset: 0 }}>
          <g opacity={1 - empalme}>
            <Subtitulos f={f} palabras={palabras} enfasis={plan.enfasis ?? []} />
          </g>
        </svg>
      ) : null}
      {capa === "todo" && !mudo && voz ? <Audio src={staticFile(voz)} /> : null}
      {capa === "todo" && !mudo && plan.musica ? (
        // música de fondo (CC BY, crédito en el .txt): bajita debajo de la voz y con fundido al final
        <Audio src={staticFile(MUSICA)} volume={(fr) => 0.1 * Math.min(1, (D - 1 - fr) / EMPALME)} />
      ) : null}
      {capa === "todo" && !mudo && sonidoDe
        ? (escenas as Escena[]).map((e) => {
            const s = sonidoDe(e);
            if (!s || e.f0 >= D - EMPALME) return null;
            return (
              <Sequence key={e.indice} from={Math.max(0, e.f0)} durationInFrames={Math.min(45, D - e.f0)} layout="none">
                <Audio src={staticFile(s.archivo)} volume={s.volumen} />
              </Sequence>
            );
          })
        : null}
    </AbsoluteFill>
  );
};
