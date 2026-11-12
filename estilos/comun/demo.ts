import type { Palabra } from "./subtitulos/tipos";
import type { Plan, PropsShort } from "./tipos";

/** tiempos inventados (2,7 palabras por segundo) para ver un estilo en Studio sin voz */
export const palabrasFalsas = (texto: string): Palabra[] => {
  let t = 0;
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const d = 0.22 + Math.min(0.3, w.length * 0.035);
      const p: Palabra = { t: w, s: Number(t.toFixed(3)), e: Number((t + d).toFixed(3)) };
      t += d + (/[.?!]$/.test(w) ? 0.22 : /[,:;]$/.test(w) ? 0.12 : 0.05);
      return p;
    });
};

const demo = (plan: Plan, texto: string): PropsShort => ({ plan, palabras: palabrasFalsas(texto), voz: null });

export const DEMO_EXPLICADOR = demo(
  {
    slug: "demo-explicador",
    estilo: "explicador",
    fuente: "Harvard Business School, 2012",
    enfasis: ["63"],
    escenas: [
      { tipo: "titular", texto: "Pagas más por lo que armas tú", destacar: "armas" },
      { tipo: "numero", en: "casi un 63", valor: "63 %", etiqueta: "más ofrecían por su caja" },
      { tipo: "barras", en: "Los que", a: { etiqueta: "La armaron", valor: 0.78 }, b: { etiqueta: "Ya armada", valor: 0.48 }, unidad: "US$" },
      { tipo: "icono", en: "Se llama", icono: "caja", texto: "Efecto IKEA" },
      { tipo: "porcentaje", en: "Esfuerzo", valor: 63, etiqueta: "de valor extra" },
      { tipo: "fuente", en: "Lo midió" },
      { tipo: "pregunta", en: "¿Y tú?", texto: "¿Qué armaste tú?" },
    ],
  },
  "Pagas más por lo que armas tú. En un experimento, la gente ofrecía casi un 63 por ciento más por una caja que había armado. Los que la armaron ofrecían 78 centavos; por una ya armada, solo 48. Se llama efecto IKEA. Esfuerzo propio, valor extra. Lo midió Harvard en 2012. ¿Y tú? ¿Qué armaste?",
);

export const DEMO_PIZARRA = demo(
  {
    slug: "demo-pizarra",
    estilo: "pizarra",
    fuente: "NASA Space Place",
    escenas: [
      { tipo: "titulo", texto: "¿Por qué el cielo es azul?", destacar: "azul" },
      { tipo: "dibujo", en: "La luz del Sol", icono: "sol", texto: "La luz blanca trae todos los colores" },
      { tipo: "paso", en: "Al chocar", n: 1, icono: "ondas", texto: "Choca con el aire y se dispersa" },
      { tipo: "cifra", en: "El azul", valor: "Azul", etiqueta: "viaja en ondas más cortas" },
      { tipo: "comparar", en: "Por eso", izq: { titulo: "Rojo", texto: "Ondas largas, sigue de largo" }, der: { titulo: "Azul", texto: "Ondas cortas, rebota por todo el cielo" } },
      { tipo: "fuente", en: "Lo explica" },
    ],
  },
  "¿Por qué el cielo es azul? La luz del Sol parece blanca, pero trae todos los colores. Al chocar con el aire, la luz se dispersa. El azul viaja en ondas más cortas y se dispersa mucho más. Por eso lo ves en todo el cielo, mientras el rojo sigue de largo. Lo explica la NASA.",
);

export const DEMO_MAPA = demo(
  {
    slug: "demo-mapa",
    estilo: "mapa",
    fuente: "Britannica",
    escenas: [
      { tipo: "vista", centro: [-65, -20], anchoKm: 12000, texto: "La cascada más alta del mundo" },
      { tipo: "vista", en: "Está en Venezuela", centro: [-62.5, 5.9], anchoKm: 1800 },
      { tipo: "paises", en: "Venezuela", paises: ["862"] },
      { tipo: "marcador", en: "Salto Ángel", lon: -62.53, lat: 5.97, nombre: "Salto Ángel", etiqueta: "979 m" },
      { tipo: "cifra", en: "979", valor: "979 m", etiqueta: "de caída casi sin cortes" },
      { tipo: "ruta", en: "El agua", puntos: [[-62.53, 5.97], [-62.4, 6.6], [-63.5, 8.1], [-62.0, 8.6]] },
      { tipo: "fuente", en: "Dato de" },
    ],
  },
  "La cascada más alta del mundo no está donde piensas. Está en Venezuela, en plena selva. Venezuela la llama Salto Ángel. Cae 979 metros, casi sin cortes. El agua termina viajando hasta el río Orinoco. Dato de la enciclopedia Britannica.",
);
