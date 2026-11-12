import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";

/**
 * Estilo de los subtítulos: MAYÚSCULAS, 70 px, peso 900, contorno 14 px oscuro, letra blanca.
 * La fuente (Inter Tight, licencia OFL) se carga de Google Fonts, así se ve igual en todas las computadoras.
 */

export const TAM = 70;
export const INTERLINEA = 1.22;
export const CONTORNO = 14;
export const ESPACIO = 18 / 70; // separación entre palabras, en em
export const LETRA_ESPACIADO = -1; // px
export const ESCALA_ACTIVA = 1.04; // la palabra que suena (efecto karaoke, sin color)
export const OPACIDAD_RESTO = 0.78;
/** pico de la animación de entrada (0,86 → 1 con rebote) */
export const ESCALA_ENTRADA_MAX = 1.0123;
/** si un renglón no entra, la letra se achica hasta 64 px como mucho */
export const ESCALA_MIN = 64 / TAM;
export const COLOR = { texto: "#FFFFFF", contorno: "#1F1A22", enfasis: "#FFD84A" };
export const SERIF = "Georgia, 'Times New Roman', serif";

export type Fuente = { familia: string; listo: () => Promise<unknown> };

const interTight = loadInterTight("normal", { weights: ["900"], subsets: ["latin", "latin-ext"] });

export const FUENTE_SUBTITULOS: Fuente = { familia: interTight.fontFamily, listo: interTight.waitUntilDone };
/** nombre de la familia que espera el QA */
export const FAMILIA_SUBTITULOS = "Inter Tight";
