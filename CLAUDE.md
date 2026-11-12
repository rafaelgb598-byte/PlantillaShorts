# Plantilla Shorts (versión gratis)

Kit para crear YouTube Shorts animados con Claude y Remotion. La persona escribe `/shorts-gratis` y la skill
(`.claude/skills/shorts-gratis/SKILL.md`) hace todo el flujo. **No hace falta tocar código para un short nuevo:**
Claude escribe un guion y un plan de escenas (JSON) y los estilos lo animan.

## Reglas

- **Idioma:** español neutro latinoamericano con «tú». Nunca voseo («tenés», «mirá») ni español de España («vosotros», «coger»). Vocabulario neutro: palomitas, refrigerador, bombilla, celular, computadora.
- **Datos:** solo los de `temas/temas.json` (cada uno con su fuente verificada en `temas/VERIFICACION.md`). No agregues cifras que no estén en el `dato` del tema. Si la persona pide un tema que no está, explica que la versión gratis trabaja con estos 90 temas.
- **Sin promesas:** nunca digas que un video va a tener vistas, que es monetizable o que genera ingresos.
- **Claves:** la de ElevenLabs vive solo en `.env` (nunca se imprime, nunca se sube, nunca se copia a otro archivo).
- **Créditos de API:** no generes voz con ElevenLabs sin que la persona haya visto cuántos caracteres gasta y haya dicho que sí.
- **QA:** si `qa-subs` o `qa-retencion` fallan, se arregla el plan o el layout, nunca el QA.
- **Licencias:** Remotion se instala por npm (su licencia es aparte, ver `LICENCIA.md`). Tipografías de Google Fonts (OFL, `OFL.txt`). Mapas de Natural Earth (dominio público). Sin imágenes de IA: todo son formas SVG hechas en código.

## Dónde va cada cosa

| Carpeta / archivo | Qué es |
|---|---|
| `panel/` | Página local para elegir estilo, tema y voz (`node panel/servidor.mjs`) |
| `temas/temas.json` | Los 90 temas verificados (30 por estilo, 4 categorías por estilo) |
| `estilos/` | Las 3 composiciones Remotion: `explicador/`, `pizarra/`, `mapa/` y lo compartido en `comun/` |
| `scripts/` | Voz, transcripción, render, QA y entrega |
| `Pon aquí tu voz/` | Donde la persona deja su grabación |
| `trabajo/<slug>/` | Todo lo de un short: `guion.txt`, `plan.json`, `palabras.json`, QA (no se sube) |
| `public/trabajo/<slug>/voz.mp3` | La voz lista para el render |
| `Shorts listos/` | El resultado: `<slug>.mp4` + `<slug>.txt` |

Comandos útiles: `npm run estudio` (Remotion Studio para mirar los estilos), `node scripts/render.mjs <slug> --borrador`
(render sin voz, con tiempos inventados), `node scripts/render.mjs <slug> --stills 0,90,300` (fotogramas sueltos).

## Plan de escenas (`trabajo/<slug>/plan.json`)

```json
{
  "estilo": "explicador",
  "temaId": "E1",
  "titulo": "Por qué pagas más por lo que armas tú",
  "descripcion": "Un experimento de Harvard midió cuánto más valoramos lo que construimos.",
  "fuente": "Harvard Business School, 2011",
  "enfasis": ["63 %", "IKEA"],
  "paleta": "noche",
  "musica": true,
  "escenas": [
    { "tipo": "titular", "texto": "Pagas más por lo que armas tú", "destacar": "armas" },
    { "tipo": "numero", "en": "casi un 63", "valor": "63 %", "etiqueta": "más ofrecían por su caja" }
  ]
}
```

- **Cuándo arranca cada escena:** `en` = 1 a 4 palabras **tal como están en el guion**, donde empieza la escena (se buscan en orden en la voz). También vale `t` en segundos. La primera escena no lleva `en`: arranca en el cuadro 0 y tiene que mostrar el gancho.
- **Ritmo:** una escena nueva cada **1,5 a 3,5 s** (mínimo 1 s, conviene no pasar de 4 s). Para un short de 40 s son unas 12 a 16 escenas. Dentro de cada escena hay movimiento propio, pero los cambios grandes los dan las escenas.
- **Cierre:** el video empalma solo con el cuadro 0 (loop); no hace falta escena de despedida. La penúltima o última escena puede ser `pregunta` (la consigna para comentarios) o `fuente`.
- `enfasis`: palabras del guion que salen en amarillo en los subtítulos (una por página como máximo; elige 2 a 4 palabras clave).
- `musica`: `true` agrega de fondo, bajita, «Investigations» de Kevin MacLeod (CC BY 4.0). El crédito exacto se escribe solo en el `.txt`. Ponlo en `true` salvo que la persona pida el video sin música.
- `fuente`: cómo se nombra la fuente en pantalla (corto). Las escenas `fuente` lo usan si no traen `texto`.
- Textos en pantalla: cortos (los títulos ≤ 8 palabras). Los largos se achican solos, pero se leen peor.

### Explicador (`"estilo": "explicador"`, paletas `noche` · `coral` · `bosque`)

| tipo | campos | qué se ve |
|---|---|---|
| `titular` | `texto`, `destacar` (palabra con fondo de color) | Texto grande que entra palabra por palabra |
| `numero` | `valor` («63 %», «7,2 años»), `etiqueta` | Número gigante que cuenta desde 0 dentro de un anillo |
| `barras` | `a: {etiqueta, valor}`, `b: {etiqueta, valor}`, `unidad`, `titulo` | Dos barras que crecen y se comparan |
| `porcentaje` | `valor` (0–100), `etiqueta` | 100 puntos que se llenan hasta el porcentaje |
| `icono` | `icono` (ver § Íconos), `texto` | Ícono grande que se dibuja en un círculo + texto |
| `frase` | `texto` | Frase grande que entra por los costados |
| `lista` | `items` (2 a 4 textos cortos) | Ítems con tilde que aparecen de a uno |
| `fuente` | `texto` (opcional) | Tarjeta «FUENTE» |
| `pregunta` | `texto` | Tarjeta «TU TURNO» con la pregunta para comentarios |

### Pizarra (`"estilo": "pizarra"`, paletas `cuaderno` · `pizarron`)

| tipo | campos | qué se ve |
|---|---|---|
| `titulo` | `texto`, `destacar` | Título escrito a mano, subrayado en rojo |
| `dibujo` | `icono`, `texto` | Ícono que se dibuja solo, encerrado en un círculo + texto |
| `cifra` | `valor`, `etiqueta` | Número escrito grande y encerrado + etiqueta resaltada |
| `paso` | `n`, `texto`, `icono` (opcional) | Paso numerado con flecha y recuadro (usa los `pasos` del tema) |
| `comparar` | `izq: {titulo, texto}`, `der: {titulo, texto}`, `marca` (`izq`, `der` o `ninguna`: cuál es la correcta) | Dos columnas: cruz en la falsa, tilde en la correcta |
| `fuente` | `texto` (opcional) | Nota adhesiva con la fuente |
| `pregunta` | `texto` | Nota adhesiva con la pregunta |

Cada escena es un recuadro nuevo de la hoja: la cámara se desliza al siguiente.

### Mapa (`"estilo": "mapa"`, paletas `atlas` · `noche`)

| tipo | campos | qué se ve |
|---|---|---|
| `vista` | `centro: [lon, lat]`, `anchoKm`, `texto` (opcional, título arriba) | La cámara viaja a ese lugar (12.500 km = el globo entero) |
| `paises` | `paises` (códigos ISO numéricos: "076"), `texto` | Países pintados |
| `marcador` | `lon`, `lat`, `nombre`, `etiqueta` | Punto que late con su nombre y un dato corto |
| `ruta` | `puntos: [[lon, lat], …]`, `texto` | Ruta que se traza con una punta que avanza |
| `linea` | `lon`, `texto` | Meridiano punteado (Tordesillas, cambio de fecha) |
| `cifra` | `valor`, `etiqueta` | Tarjeta arriba con el número grande; el mapa sigue moviéndose |
| `fuente` / `pregunta` | `texto` | Tarjeta arriba |

Usa el objeto `mapa` del tema (centro, anchoKm, países, marcadores, ruta, línea). Empieza con una `vista` del globo
(`anchoKm` 12.500) con el gancho como `texto`, y viaja a la región. Los marcadores tienen que quedar en la mitad de arriba
del cuadro: si uno queda muy abajo, mueve un poco el `centro` hacia el sur.

### Íconos

`sol luna tierra estrella planeta cohete satelite rayo gota ola nube lluvia huracan copo hielo termometro fuego arcoiris aurora montana arbol bombilla celular wifi reloj engranaje chip microondas refrigerador termo panel qr codigo pararrayos iman barco avion ancla flecha moneda billete grafico caja hamburguesa palomitas cebolla dado cartas ruleta persona personas corazon hueso celula ojo cerebro pulpo oro papel libro lupa check cruz pregunta comentario sismo prisma fuegos ondas mapa pin brujula`

## Si el QA falla

- **qa-subs · choques:** algo de la escena quedó bajo los subtítulos (franja de y = 1300 a 1500). Acorta el texto de esa escena o cámbiala de tipo; en Mapa, mueve el `centro` para que el marcador quede más arriba.
- **qa-subs · cortes / huérfanas:** revisa la puntuación del guion (las páginas se cortan por frase).
- **qa-retencion · encuadre fijo o tramo quieto:** hay una escena demasiado larga: pártela en dos.
- **qa-retencion · silencios:** la grabación tiene una pausa larga que no se pudo recortar (ruido de fondo): pide otra toma en un lugar más silencioso.
- **qa-retencion · dura más de 45 s:** acorta el guion.
- **qa-retencion · loop:** no toques nada del final; avisa (es un error del estilo).
