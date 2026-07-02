const map = L.map("map").setView([19.35, -99.10], 11);

const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "OpenStreetMap" }).addTo(map);
const claro = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 20, attribution: "OpenStreetMap | CARTO" });
const satelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, attribution: "Esri" });

L.control.layers({ "OpenStreetMap": osm, "Mapa claro": claro, "Satélite": satelite }, {}, { collapsed: true }).addTo(map);

let escuelasData = null;
let escuelasLayer = null;
let alcaldiasLayer = null;
let agebLayer = null;
let alcaldiaColorMap = {};

function cleanText(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function isYes(value) { return cleanText(value) === "si"; }
function getTotal(p) { return Number(p.Total_Nec ?? 0); }
function getSchoolName(p) { return p.Nombre || p.NOMBRE || p.nombre || p.NOM_ESC || p.NOM_CCT || "Escuela sin nombre"; }
function getCCT(p) { return p.CCT || p.CCT_1 || p.CCT1 || p.Clave || p.CLAVECCT || ""; }
function getAlcaldia(p) { return p.Alcaldia || p.ALCALDIA || p.NOMGEO || p.NOM_ALC || p.NOM_MUN || "Sin dato"; }
function getAlcaldiaNameFromPolygon(p) { return p.Alcaldia || p.ALCALDIA || p.NOMGEO || p.NOM_ALC || p.NOM_MUN || p.NOMBRE || p.Nombre || "Sin nombre"; }

function getPriority(total) {
  total = Number(total);
  if (total >= 22) return "muy_alta";
  if (total >= 16) return "alta";
  if (total >= 10) return "media";
  if (total >= 5) return "baja";
  return "muy_baja";
}
function priorityText(total) {
  const p = getPriority(total);
  if (p === "muy_alta") return "Muy alta";
  if (p === "alta") return "Alta";
  if (p === "media") return "Media";
  if (p === "baja") return "Baja";
  return "Muy baja";
}
function priorityColor(total) {
  total = Number(total);
  if (total >= 22) return "#d73027";
  if (total >= 16) return "#fc8d59";
  if (total >= 10) return "#ffffbf";
  if (total >= 5) return "#91cf60";
  return "#1a9850";
}
function priorityRadius(total) {
  total = Number(total);
  if (total >= 22) return 12;
  if (total >= 16) return 10;
  if (total >= 10) return 8;
  if (total >= 5) return 6;
  return 4;
}

function selectedPriorities() {
  return Array.from(document.querySelectorAll(".priorityChk:checked")).map(chk => chk.value);
}
function selectedNeeds() {
  return Array.from(document.querySelectorAll(".needChk:checked")).map(chk => chk.value);
}
function featurePassesFilters(feature) {
  const p = feature.properties || {};
  const query = cleanText(document.getElementById("searchBox").value);
  const alcaldia = document.getElementById("alcaldiaFilter").value;
  const priorities = selectedPriorities();
  const needs = selectedNeeds();

  if (!priorities.includes(getPriority(getTotal(p)))) return false;
  if (alcaldia !== "todas" && cleanText(getAlcaldia(p)) !== cleanText(alcaldia)) return false;

  if (query) {
    const text = cleanText(`${getSchoolName(p)} ${getCCT(p)} ${getAlcaldia(p)}`);
    if (!text.includes(query)) return false;
  }

  for (const field of needs) {
    if (!isYes(p[field])) return false;
  }
  return true;
}

function createPopup(p) {
  let needsHTML = "";
  Object.keys(NEED_FIELDS).forEach(field => {
    const val = p[field] || "Sin dato";
    const icon = isYes(val) ? "✅" : "—";
    needsHTML += `${icon} <b>${NEED_FIELDS[field]}:</b> ${val}<br>`;
  });

  return `<div class="popup-title">${getSchoolName(p)}</div>
    <b>CCT:</b> ${getCCT(p)}<br>
    <b>Alcaldía:</b> ${getAlcaldia(p)}<br>
    <b>Nivel:</b> ${p.Nivel_prin || "Sin dato"}<br>
    <b>Total necesidades:</b> ${getTotal(p)}<br>
    <b>Prioridad:</b> ${priorityText(getTotal(p))}<br>
    <hr>${needsHTML}`;
}

function updateStats(counts) {
  document.getElementById("visibleCount").textContent = counts.total;
  document.getElementById("countMuyAlta").textContent = counts.muy_alta;
  document.getElementById("countAlta").textContent = counts.alta;
  document.getElementById("countMedia").textContent = counts.media;
  document.getElementById("countBaja").textContent = counts.baja;
  document.getElementById("countMuyBaja").textContent = counts.muy_baja;
}

function drawSchools() {
  if (escuelasLayer) map.removeLayer(escuelasLayer);

  const counts = { total: 0, muy_alta: 0, alta: 0, media: 0, baja: 0, muy_baja: 0 };

  escuelasLayer = L.geoJSON(escuelasData, {
    filter: function(feature) {
      const ok = featurePassesFilters(feature);
      if (ok) {
        const pr = getPriority(getTotal(feature.properties || {}));
        counts.total += 1;
        counts[pr] += 1;
      }
      return ok;
    },
    pointToLayer: function(feature, latlng) {
      const total = getTotal(feature.properties || {});
      return L.circleMarker(latlng, {
        radius: priorityRadius(total),
        fillColor: priorityColor(total),
        color: "#111",
        weight: 1,
        fillOpacity: 0.9
      });
    },
    onEachFeature: function(feature, layer) {
      layer.bindPopup(createPopup(feature.properties || {}));
    }
  });

  updateStats(counts);
  if (document.getElementById("chkEscuelas").checked) escuelasLayer.addTo(map);
}

function drawAlcaldias(data) {
  const names = data.features.map(f => getAlcaldiaNameFromPolygon(f.properties || {})).sort();
  names.forEach((name, i) => alcaldiaColorMap[name] = ALCALDIA_COLORS[i % ALCALDIA_COLORS.length]);

  alcaldiasLayer = L.geoJSON(data, {
    style: function(feature) {
      const name = getAlcaldiaNameFromPolygon(feature.properties || {});
      return { color: "#333", weight: 1, fillColor: alcaldiaColorMap[name] || "#ccc", fillOpacity: 0.35 };
    },
    onEachFeature: function(feature, layer) {
      const name = getAlcaldiaNameFromPolygon(feature.properties || {});
      layer.bindPopup(`<b>${name}</b>`);
    }
  }).addTo(map);
}

function populateAlcaldiaFilter() {
  const select = document.getElementById("alcaldiaFilter");
  const names = new Set();
  escuelasData.features.forEach(f => names.add(getAlcaldia(f.properties || {})));

  Array.from(names).sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

Promise.all([
  fetch(DATA_FILES.escuelas).then(r => r.json()),
  fetch(DATA_FILES.alcaldias).then(r => r.json()),
  fetch(DATA_FILES.ageb).then(r => r.json()).catch(() => null)
]).then(([escuelas, alcaldias, ageb]) => {
  escuelasData = escuelas;
  drawAlcaldias(alcaldias);

  if (ageb) {
    agebLayer = L.geoJSON(ageb, { style: { color: "#444", weight: 0.4, fillOpacity: 0 } });
  }

  populateAlcaldiaFilter();
  drawSchools();

  if (escuelasLayer.getBounds().isValid()) {
    map.fitBounds(escuelasLayer.getBounds(), { padding: [25, 25] });
  }
}).catch(err => {
  alert("No se pudieron cargar los datos. Revisa que los archivos estén dentro de la carpeta data.");
  console.error(err);
});

function refresh() { drawSchools(); }

document.getElementById("searchBox").addEventListener("input", refresh);
document.getElementById("alcaldiaFilter").addEventListener("change", refresh);
document.querySelectorAll(".priorityChk").forEach(chk => chk.addEventListener("change", refresh));
document.querySelectorAll(".needChk").forEach(chk => chk.addEventListener("change", refresh));

document.getElementById("chkEscuelas").addEventListener("change", function() {
  if (!escuelasLayer) return;
  if (this.checked) escuelasLayer.addTo(map);
  else map.removeLayer(escuelasLayer);
});
document.getElementById("chkAlcaldias").addEventListener("change", function() {
  if (!alcaldiasLayer) return;
  if (this.checked) alcaldiasLayer.addTo(map);
  else map.removeLayer(alcaldiasLayer);
});
document.getElementById("chkAgeb").addEventListener("change", function() {
  if (!agebLayer) return;
  if (this.checked) agebLayer.addTo(map);
  else map.removeLayer(agebLayer);
});

document.getElementById("resetBtn").addEventListener("click", function() {
  document.getElementById("searchBox").value = "";
  document.getElementById("alcaldiaFilter").value = "todas";
  document.querySelectorAll(".priorityChk").forEach(chk => chk.checked = true);
  document.querySelectorAll(".needChk").forEach(chk => chk.checked = false);
  refresh();
});

const sidebar = document.getElementById("sidebar");
document.getElementById("menuBtn").addEventListener("click", () => sidebar.classList.remove("hidden"));
document.getElementById("closeBtn").addEventListener("click", () => sidebar.classList.add("hidden"));
