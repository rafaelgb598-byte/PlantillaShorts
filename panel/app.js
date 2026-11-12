// Panel de Plantilla Shorts (sin frameworks). Habla solo con el servidor local (panel/servidor.mjs).
const ESTILOS = [
  { id: "explicador", nombre: "Explicador", texto: "Tipografía en movimiento, un número grande y gráficos que salen del dato." },
  { id: "pizarra", nombre: "Pizarra", texto: "Un cuaderno que se dibuja solo: trazos, flechas y círculos que marcan lo importante." },
  { id: "mapa", nombre: "Mapa", texto: "Un globo que gira y hace zoom: rutas que se trazan y marcadores con el dato." },
];

const PRO = [
  { nombre: "Cronología", texto: "Una línea de tiempo que avanza año por año.", dibujo: '<rect width="180" height="320" fill="#14213D"/><line x1="90" y1="30" x2="90" y2="290" stroke="#FCA311" stroke-width="5"/><circle cx="90" cy="80" r="12" fill="#FCA311"/><circle cx="90" cy="160" r="12" fill="#FCA311"/><circle cx="90" cy="240" r="12" fill="#E5E5E5"/><rect x="110" y="66" width="52" height="26" rx="6" fill="#E5E5E5"/><rect x="18" y="146" width="52" height="26" rx="6" fill="#E5E5E5"/><rect x="110" y="226" width="52" height="26" rx="6" fill="#E5E5E5" opacity=".5"/>' },
  { nombre: "Ranking", texto: "Del puesto 10 al 1, con barras que compiten.", dibujo: '<rect width="180" height="320" fill="#2B193D"/><rect x="24" y="60" width="132" height="34" rx="8" fill="#FF6B6B"/><rect x="24" y="110" width="104" height="34" rx="8" fill="#FFD93D"/><rect x="24" y="160" width="80" height="34" rx="8" fill="#6BCB77"/><rect x="24" y="210" width="56" height="34" rx="8" fill="#4D96FF"/><text x="30" y="84" font-size="20" font-weight="800" fill="#2B193D" font-family="system-ui">1</text>' },
  { nombre: "Antes y después", texto: "Una cortina que muestra cómo cambió algo.", dibujo: '<rect width="180" height="320" fill="#F1E9DA"/><rect x="0" y="0" width="90" height="320" fill="#2E294E"/><circle cx="90" cy="160" r="22" fill="#FFD400"/><path d="M80 160 L72 152 M80 160 L72 168 M100 160 L108 152 M100 160 L108 168" stroke="#2E294E" stroke-width="4"/><rect x="24" y="110" width="44" height="90" rx="8" fill="#541388"/><rect x="112" y="80" width="44" height="120" rx="8" fill="#D90368"/>' },
  { nombre: "Quiz", texto: "Pregunta con opciones y cuenta regresiva para jugar.", dibujo: '<rect width="180" height="320" fill="#0B3C5D"/><rect x="20" y="40" width="140" height="70" rx="12" fill="#F2F2F2"/><rect x="20" y="130" width="140" height="36" rx="10" fill="#328CC1"/><rect x="20" y="176" width="140" height="36" rx="10" fill="#D9B310"/><rect x="20" y="222" width="140" height="36" rx="10" fill="#328CC1"/><circle cx="146" cy="40" r="20" fill="#D9B310"/><text x="139" y="47" font-size="20" font-weight="800" fill="#0B3C5D" font-family="system-ui">3</text>' },
];

const $ = (s) => document.querySelector(s);
const estado = { estilo: null, tema: null, categoria: "Todas", voz: "mp3", vozId: null, temas: [] };

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dominio = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\d?\./, "");
  } catch {
    return u;
  }
};
const sinTildes = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const pintarEstilos = () => {
  $("#estilos").innerHTML = ESTILOS.map(
    (e) => `<button class="estilo${estado.estilo === e.id ? " elegido" : ""}" data-estilo="${e.id}">
      <img class="gif" src="gifs/${e.id}.gif" alt="Vista previa del estilo ${e.nombre}" loading="lazy" onerror="this.style.visibility='hidden'" />
      <strong>${e.nombre}</strong><span>${e.texto}</span></button>`,
  ).join("");
  document.querySelectorAll(".estilo").forEach((b) =>
    b.addEventListener("click", () => {
      if (estado.estilo !== b.dataset.estilo) {
        estado.estilo = b.dataset.estilo;
        estado.tema = null;
        estado.categoria = "Todas";
      }
      pintarEstilos();
      pintarTemas();
      $("#paso-tema").classList.remove("bloqueado");
      $("#paso-tema").scrollIntoView({ behavior: "smooth", block: "start" });
      actualizar();
    }),
  );
};

const pintarTemas = () => {
  const delEstilo = estado.temas.filter((t) => t.estilo === estado.estilo);
  const cats = ["Todas", ...new Set(delEstilo.map((t) => t.categoria))];
  $("#categorias").innerHTML = cats.map((c) => `<button class="categoria${c === estado.categoria ? " activa" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  document.querySelectorAll(".categoria").forEach((b) =>
    b.addEventListener("click", () => {
      estado.categoria = b.dataset.cat;
      pintarTemas();
    }),
  );
  const q = sinTildes($("#buscar").value.trim());
  const lista = delEstilo.filter((t) => (estado.categoria === "Todas" || t.categoria === estado.categoria) && (!q || sinTildes(`${t.gancho} ${t.dato} ${t.categoria}`).includes(q)));
  $("#cuenta-temas").textContent = `${lista.length} de ${delEstilo.length} temas`;
  $("#temas").innerHTML = lista.length
    ? lista
        .map(
          (t) => `<button class="tema${estado.tema === t.id ? " elegido" : ""}" data-tema="${t.id}">
        <span class="cat">${esc(t.categoria)}</span>
        <span class="gancho">${esc(t.gancho)}</span>
        <span class="dato">${esc(t.dato)}</span>
        <span class="fuente">Fuente: ${esc(t.fuente_nombre || dominio(t.fuente_url))}</span></button>`,
        )
        .join("")
    : `<p class="vacio">No hay temas con esa búsqueda. Prueba con otra palabra.</p>`;
  document.querySelectorAll(".tema").forEach((b) =>
    b.addEventListener("click", () => {
      estado.tema = b.dataset.tema;
      document.querySelectorAll(".tema").forEach((x) => x.classList.toggle("elegido", x === b));
      $("#paso-voz").classList.remove("bloqueado");
      actualizar();
    }),
  );
};

const actualizar = () => {
  const tema = estado.temas.find((t) => t.id === estado.tema);
  const estilo = ESTILOS.find((e) => e.id === estado.estilo);
  const vozOk = estado.voz === "mp3" || Boolean(estado.vozId);
  $("#crear-short").disabled = !(estilo && tema && vozOk);
  $("#resumen").innerHTML = !estilo
    ? "Elige un estilo para empezar."
    : !tema
      ? `<b>${estilo.nombre}</b> · ahora elige un tema.`
      : `<b>${estilo.nombre}</b> · ${esc(tema.gancho)} · ${estado.voz === "mp3" ? "con tu grabación" : vozOk ? "con ElevenLabs" : "falta elegir la voz de ElevenLabs"}`;
};

const mensajeClave = (t, tipo = "") => {
  const m = $("#mensaje-clave");
  m.textContent = t;
  m.className = `mensaje ${tipo}`;
};
const pintarVoces = (voces, elegida) => {
  const orden = [...voces].sort((a, b) => Number(b.espanol) - Number(a.espanol));
  $("#voz-el").innerHTML = orden.map((v) => `<option value="${esc(v.id)}">${esc(v.nombre)}${v.detalle ? ` — ${esc(v.detalle)}` : ""}</option>`).join("");
  const id = elegida && orden.some((v) => v.id === elegida) ? elegida : orden[0]?.id;
  if (id) $("#voz-el").value = id;
  estado.vozId = id ?? null;
  $("#fila-voces").classList.toggle("oculto", !orden.length);
  actualizar();
};

const iniciarVoz = async () => {
  document.querySelectorAll(".opcion-voz").forEach((o) =>
    o.addEventListener("click", () => {
      estado.voz = o.dataset.voz;
      document.querySelectorAll(".opcion-voz").forEach((x) => x.classList.toggle("elegida", x === o));
      $("#elevenlabs").classList.toggle("oculto", estado.voz !== "elevenlabs");
      actualizar();
    }),
  );
  $("#voz-el").addEventListener("change", (e) => {
    estado.vozId = e.target.value;
    actualizar();
  });
  $("#guardar-clave").addEventListener("click", async () => {
    const clave = $("#clave").value.trim();
    if (!clave) return mensajeClave("Pega tu clave primero.", "mal");
    mensajeClave("Revisando la clave con ElevenLabs…");
    const r = await fetch("/api/clave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave }) }).then((x) => x.json());
    if (!r.ok) return mensajeClave(r.error, "mal");
    $("#clave").value = "";
    mensajeClave("Clave guardada en tu computadora. Elige la voz:", "bien");
    pintarVoces(r.voces);
  });
  const est = await fetch("/api/estado").then((x) => x.json());
  if (est.elevenlabs.clave) {
    $("#clave").placeholder = "Clave guardada · pega otra para cambiarla";
    const r = await fetch("/api/voces").then((x) => x.json());
    if (r.ok) pintarVoces(r.voces, est.elevenlabs.voz);
    else mensajeClave(r.error, "mal");
  }
};

const iniciarPestanas = () => {
  document.querySelectorAll(".pestana").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".pestana").forEach((x) => {
        x.classList.toggle("activa", x === b);
        x.setAttribute("aria-selected", String(x === b));
      });
      const pro = b.dataset.pestana === "pro";
      $("#pro").classList.toggle("oculto", !pro);
      $("#crear").classList.toggle("oculto", pro);
      $("#listo").classList.add("oculto");
    }),
  );
  $("#pro-estilos").innerHTML = PRO.map(
    (p) => `<div class="pro-tarjeta"><svg viewBox="0 0 180 320" aria-hidden="true">${p.dibujo}</svg><div class="candado" title="Incluido en la versión Pro">🔒</div><strong>${p.nombre}</strong><span>${p.texto}</span></div>`,
  ).join("");
};

const crear = async () => {
  const b = $("#crear-short");
  b.disabled = true;
  b.textContent = "Enviando…";
  const r = await fetch("/api/pedido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estilo: estado.estilo, temaId: estado.tema, voz: estado.voz, vozId: estado.vozId }) }).then((x) => x.json());
  b.textContent = "Crear short";
  if (!r.ok) {
    alert(r.error || "No se pudo enviar el pedido.");
    actualizar();
    return;
  }
  const tema = estado.temas.find((t) => t.id === estado.tema);
  $("#detalle-pedido").textContent = `${ESTILOS.find((e) => e.id === estado.estilo).nombre} · ${tema.gancho}`;
  $("#crear").classList.add("oculto");
  $("#listo").classList.remove("oculto");
  window.scrollTo({ top: 0 });
};

(async () => {
  const { temas } = await fetch("/api/temas").then((x) => x.json());
  estado.temas = temas;
  pintarEstilos();
  iniciarPestanas();
  await iniciarVoz();
  $("#buscar").addEventListener("input", pintarTemas);
  $("#crear-short").addEventListener("click", crear);
  $("#otro").addEventListener("click", () => {
    $("#listo").classList.add("oculto");
    $("#crear").classList.remove("oculto");
    actualizar();
  });
  // enlaces directos (?estilo=mapa&tema=M16&ver=tema): sirven para volver a un tema y para las capturas de la guía
  const q = new URLSearchParams(location.search);
  if (ESTILOS.some((e) => e.id === q.get("estilo"))) {
    estado.estilo = q.get("estilo");
    if (estado.temas.some((t) => t.id === q.get("tema") && t.estilo === estado.estilo)) estado.tema = q.get("tema");
    pintarEstilos();
    pintarTemas();
    $("#paso-tema").classList.remove("bloqueado");
    if (estado.tema) $("#paso-voz").classList.remove("bloqueado");
  }
  const ver = q.get("ver");
  if (["estilo", "tema", "voz"].includes(ver)) document.querySelectorAll(".paso").forEach((p) => p.classList.toggle("oculto", p.id !== `paso-${ver}`));
  if (q.get("pestana") === "pro") document.querySelector('[data-pestana="pro"]').click();
  actualizar();
})();
