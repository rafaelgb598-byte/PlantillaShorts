import type { Palabra } from "./subtitulos/tipos";

export type Capa = "todo" | "subtitulos" | "escena" | "fondo";

/** una escena del plan, ya resuelta a fotogramas [f0, f1) */
export type Escena = {
  tipo: string;
  indice: number;
  f0: number;
  f1: number;
  en?: string;
  t?: number;
  // los campos de cada tipo están en CLAUDE.md § Plan de escenas
  [k: string]: unknown;
};

export type Plan = {
  slug: string;
  estilo: "explicador" | "pizarra" | "mapa";
  temaId?: string;
  titulo?: string;
  /** fuente del dato, tal como se muestra en pantalla («NASA», «Harvard, 2012») */
  fuente?: string;
  /** palabras clave en amarillo en los subtítulos (máx. 1 por página) */
  enfasis?: string[];
  /** variante de color del estilo */
  paleta?: string;
  /** música de fondo suave (Kevin MacLeod, CC BY 4.0: el crédito va solo en el .txt) */
  musica?: boolean;
  escenas: Omit<Escena, "f0" | "f1" | "indice">[];
};

export type PropsShort = {
  plan: Plan;
  palabras: Palabra[];
  /** ruta dentro de public/ (staticFile) del audio de la voz, o null para un borrador mudo */
  voz: string | null;
  capa?: Capa;
  qaSubs?: boolean;
  /** sin voz ni efectos (para los GIF) */
  mudo?: boolean;
};

/** lo que recibe el dibujo de cada estilo */
export type PropsCuadro = {
  f: number;
  escenas: Escena[];
  plan: Plan;
  total: number;
  /** true: solo el fondo (capa «fondo» del QA) */
  soloFondo: boolean;
};
