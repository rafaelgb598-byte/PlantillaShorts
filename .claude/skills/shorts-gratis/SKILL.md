---
name: shorts-gratis
description: Crea un YouTube Short animado (estilos Explicador, Pizarra o Mapa) a partir de uno de los 90 temas verificados del kit. Abre un panel en el navegador para elegir estilo, tema y voz; escribe el guion, prepara la voz, anima con Remotion, pasa el QA y deja el MP4 y su .txt en «Shorts listos/». Úsala cuando la persona escriba /shorts-gratis o pida hacer un short con esta plantilla.
---

# /shorts-gratis

Sigue estos pasos en orden. Habla siempre en **español neutro con «tú»** (nunca voseo ni «vosotros»), con frases cortas y sin jerga técnica: la persona puede no saber programar. Antes de empezar, lee `CLAUDE.md` (reglas y formato del plan de escenas).

Al empezar, anota la hora (`date`). Al entregar, di cuánto tardó todo.

## 1. Revisar el entorno

Corre `node scripts/revisar-entorno.mjs`.
- Si falla **Node**: explica en una línea que hace falta instalar Node LTS desde https://nodejs.org (el botón «LTS») y reiniciar la app de Claude. Frena hasta que esté.
- Si faltan **dependencias**: di en una línea «Voy a instalar Remotion y los mapas (unos 400 MB, una sola vez)» y corre `npm install` (la app te pide permiso).
- Si faltan los **efectos de sonido**: corre `node scripts/generar-sonidos.mjs`.
- whisper.cpp se instala más adelante y solo si la persona elige su grabación.

## 2. Abrir el panel

1. Levanta el panel **en segundo plano**: `node panel/servidor.mjs` (con `run_in_background`). Abre el navegador solo. Lee la línea `PANEL http://127.0.0.1:…` y dile a la persona: «Te abrí el panel en el navegador. Si no se abrió, entra a <url>».
2. Corre `node scripts/esperar-pedido.mjs --max 450` (timeout de la herramienta: 600000 ms). Si sale con `TODAVIA_ESPERANDO`, avisa «Sigo esperando tu elección en el panel» y córrelo una vez más (en total, unos 15 minutos). Si vuelve a vencer, pasa al plan B.
3. La línea `PEDIDO {…}` trae `estilo`, `temaId`, `voz` y `slug`.

### Plan B (si el navegador no abre o la persona lo prefiere)

Con AskUserQuestion, de a una pregunta:
1. **Estilo** (3 opciones: Explicador, Pizarra, Mapa, cada una con su descripción corta).
2. **Categoría** (las 4 categorías de ese estilo en `temas/temas.json`).
3. **Tema**: 3 temas de esa categoría (label = gancho, descripción = dato) + una 4.ª opción «Ver más» que muestra los 3 siguientes.
4. **Voz**: «Mi grabación (Recomendada)» o «ElevenLabs». Si elige ElevenLabs y no hay clave en `.env`, pídele que la pegue en el chat **solo si quiere**; guárdala con `guardarEnv` (o editando `.env`), nunca la repitas en pantalla, y lista las voces con `node scripts/voz-elevenlabs.mjs --voces` para que elija.

Escribe tú `trabajo/pedido.json` con `{"estado":"tomado","estilo":…,"temaId":…,"voz":…,"slug":…}` (slug = id del tema en minúsculas + gancho en minúsculas sin tildes, con guiones).

## 3. Guion

Busca el tema en `temas/temas.json`. Escribe el guion en `trabajo/<slug>/guion.txt` (solo el texto que se dice):
- **90 a 110 palabras** (30 a 45 segundos).
- **El gancho en el primer segundo**: la primera oración tiene **7 palabras o menos** y es el gancho del tema (puedes ajustarlo para que suene natural).
- Usa **solo el dato del tema** y lo que diga su fuente: no agregues cifras que no estén en `dato`. Nombra la fuente en voz («según la NASA», «lo midió Harvard»).
- Una sola idea, contada como una historia: gancho → contexto → el dato fuerte → por qué pasa → remate. Cierra con una pregunta corta para los comentarios que **empalme con el inicio** (que al volver a empezar el video se escuche natural).
- Números con cifras («63 %», «3,8 cm», «1494»), como en el tema. Nada de prometer vistas, dinero ni resultados.
- Español neutro con «tú»: «palomitas», «refrigerador», «bombilla», «celular», «computadora».

Antes de mostrarlo corre `node scripts/revisar-guion.mjs <slug>` y corrige lo que marque (largo, gancho, voseo, frases que no entran en los subtítulos) hasta que diga `GUION_OK`. Recién ahí muéstralo completo en un bloque de texto y pregunta con AskUserQuestion: **«Me sirve»** / **«Pedir cambios»**. Si pide cambios, ajústalo y vuelve a preguntar.

## 4. Voz

### Si eligió su grabación (`voz: "mp3"`)
1. Si `node scripts/revisar-entorno.mjs` dice que falta whisper.cpp: «Para sincronizar tu voz con los subtítulos voy a instalar whisper.cpp (unos 150 MB, una sola vez; corre en tu computadora)» y corre `node scripts/instalar-whisper.mjs` (timeout 600000).
2. Dile que grabe el guion (te lo dejo de nuevo abajo para copiar) con el celular o la computadora, a velocidad natural, y que ponga el archivo en la carpeta **«Pon aquí tu voz»** del kit. Formatos: mp3, m4a, wav.
3. Corre `node scripts/esperar-voz.mjs --desde <hora del pedido en ISO> --max 450` (repite una vez si vence). Si la persona ya tenía un archivo puesto y te lo dice, úsalo.
4. `node scripts/normalizar-voz.mjs <slug> "<archivo>"` y luego `node scripts/transcribir.mjs <slug>`.

### Si eligió ElevenLabs (`voz: "elevenlabs"`)
1. `node scripts/voz-elevenlabs.mjs <slug> --contar` y muestra cuántos caracteres va a gastar.
2. AskUserQuestion: «Sí, generar la voz» / «No, prefiero grabarla yo». Solo con el sí: `node scripts/voz-elevenlabs.mjs <slug> --generar`.
3. Nunca imprimas ni repitas la clave.

## 5. Plan de escenas y render

1. Escribe `trabajo/<slug>/plan.json` según **CLAUDE.md § Plan de escenas** (con `"musica": true`, salvo que la persona no quiera música) (usa `cifra`, `comparacion`, `pasos` o `mapa` del tema). Una escena nueva cada 1,5 a 3,5 s; la primera muestra el gancho desde el cuadro 0.
2. `node scripts/render.mjs <slug>` (timeout 600000). Si el plan tiene errores, el script los explica: corrige el plan y repite.
3. QA (los dos tienen que pasar):
   - `node scripts/qa-subs.mjs <slug>` → **0 fallas**.
   - `node scripts/qa-retencion.mjs trabajo/<slug>/render.mp4 trabajo/<slug>/qa/retencion` → **PASA**.
   Si algo falla, **se arregla el plan o el layout, nunca el QA** (CLAUDE.md § Si el QA falla), se vuelve a renderizar y se repite el QA.
4. Mira los stills de `trabajo/<slug>/qa/retencion/stills/` con Read antes de entregar: que se entienda sin audio y no haya nada cortado.

## 6. Entrega

1. Escribe `titulo` (≤ 70 caracteres, sin clickbait engañoso) y `descripcion` (2 o 3 frases) en `plan.json`.
2. `node scripts/entregar.mjs <slug>` → `Shorts listos/<slug>.mp4` y `Shorts listos/<slug>.txt` (título, descripción con la fuente del dato y créditos).
3. Cuéntale en 3 líneas: dónde quedó el video, cuánto tardó y que puede pedir otro con `/shorts-gratis`. No digas que el video es monetizable ni prometas vistas.
4. Deja el panel abierto por si quiere otro; si dice que terminó, detén el servidor.
