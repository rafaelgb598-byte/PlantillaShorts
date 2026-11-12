import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { DEMO_EXPLICADOR, DEMO_MAPA, DEMO_PIZARRA } from "./comun/demo";
import { duracionEnFrames, FPS } from "./comun/plan.mjs";
import type { PropsShort } from "./comun/tipos";
import { Explicador } from "./explicador/Explicador";
import { Mapa } from "./mapa/Mapa";
import { Pizarra } from "./pizarra/Pizarra";

/** la duración sale de la voz: última palabra + una cola corta */
const metadatos: CalculateMetadataFunction<PropsShort> = ({ props }) => ({ durationInFrames: duracionEnFrames(props.palabras, FPS) });

export const Root: React.FC = () => (
  <>
    <Composition id="Explicador" component={Explicador} width={1080} height={1920} fps={FPS} durationInFrames={900} defaultProps={DEMO_EXPLICADOR} calculateMetadata={metadatos} />
    <Composition id="Pizarra" component={Pizarra} width={1080} height={1920} fps={FPS} durationInFrames={900} defaultProps={DEMO_PIZARRA} calculateMetadata={metadatos} />
    <Composition id="Mapa" component={Mapa} width={1080} height={1920} fps={FPS} durationInFrames={900} defaultProps={DEMO_MAPA} calculateMetadata={metadatos} />
  </>
);
