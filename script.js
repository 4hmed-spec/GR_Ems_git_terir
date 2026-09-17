"use strict";

// -----------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------

const CARBURANT_API_URL =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records";

const CARBURANT_LABELS = {
  sp95_prix: "SP95",
  gazole_prix: "Gazole",
  e10_prix: "E10",
  sp98_prix: "SP98",
  e85_prix: "E85",
  gplc_prix: "GPLc",
};

const SEARCH_RADIUS_M = 15000; // 15 km autour de l'utilisateur
const MAX_RECORDS = 100;
const TOP_N = 3;

// -----------------------------------------------------------------------
// Navigation entre étapes
// -----------------------------------------------------------------------

const steps = {
  vehicleType: document.getElementById("step-vehicle-type"),
  thermique: document.getElementById("step-thermique"),
  electrique: document.getElementById("step-electrique"),
  loading: document.getElementById("step-loading"),
  error: document.getElementById("step-error"),
  results: document.getElementById("step-results"),
};

function showStep(name) {
  Object.values(steps).forEach((section) => section.classList.remove("active"));
  steps[name].classList.add("active");
}

document.getElementById("choice-thermique").addEventListener("click", () => {
  showStep("thermique");
});

document.getElementById("choice-electrique").addEventListener("click", () => {
  showStep("electrique");
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => showStep("vehicleType"));
});

// -----------------------------------------------------------------------
// Formulaire thermique
// -----------------------------------------------------------------------

document.getElementById("form-thermique").addEventListener("submit", (event) => {
  event.preventDefault();

  const carburantField = document.getElementById("carburant").value;
  const conso = parseFloat(document.getElementById("conso").value);

  if (!conso || conso <= 0) {
    showError("Merci d'indiquer une consommation valide.");
    return;
  }

  startThermiqueSearch(carburantField, conso);
});

let userPosition = null;

function startThermiqueSearch(carburantField, consoL100km) {
  setLoadingMessage("Localisation en cours…");
  showStep("loading");

  if (!("geolocation" in navigator)) {
    showError("Ton navigateur ne supporte pas la géolocalisation.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      userPosition = { lat: latitude, lon: longitude };
      setLoadingMessage("Recherche des stations à proximité…");
      findBestStationsThermique(latitude, longitude, carburantField, consoL100km)
        .then((topStations) => {
          if (topStations.length === 0) {
            showError(
              `Aucune station proposant du ${CARBURANT_LABELS[carburantField]} n'a été trouvée dans un rayon de ${SEARCH_RADIUS_M / 1000} km.`
            );
            return;
          }
          renderResults(topStations, carburantField);
          showStep("results");
        })
        .catch((err) => {
          console.error(err);
          showError("Impossible de récupérer les prix des carburants pour le moment. Réessaie dans un instant.");
        });
    },
    (geoError) => {
      showError(geolocationErrorMessage(geoError));
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function geolocationErrorMessage(geoError) {
  switch (geoError.code) {
    case geoError.PERMISSION_DENIED:
      return "La géolocalisation a été refusée. Autorise-la dans ton navigateur pour trouver des stations près de toi.";
    case geoError.POSITION_UNAVAILABLE:
      return "Ta position n'a pas pu être déterminée. Réessaie.";
    case geoError.TIMEOUT:
      return "La géolocalisation a pris trop de temps. Réessaie.";
    default:
      return "Une erreur de géolocalisation est survenue.";
  }
}

// -----------------------------------------------------------------------
// Appel API carburants + calcul du coût du détour
// -----------------------------------------------------------------------

async function findBestStationsThermique(lat, lon, carburantField, consoL100km) {
  const where = `distance(geom, geom'POINT(${lon} ${lat})', ${SEARCH_RADIUS_M}m)`;
  const params = new URLSearchParams({
    where,
    limit: String(MAX_RECORDS),
  });

  const response = await fetch(`${CARBURANT_API_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Erreur API carburants : ${response.status}`);
  }

  const data = await response.json();
  const records = data.results || data.records || [];

  const candidates = records
    .map((record) => stationFromRecord(record, carburantField))
    .filter((station) => station !== null);

  candidates.forEach((station) => {
    const distanceKmAllerRetour = 2 * haversineDistanceKm(lat, lon, station.lat, station.lon);
    station.distanceKm = distanceKmAllerRetour / 2; // distance affichée = aller simple
    station.coutDetour = (distanceKmAllerRetour * consoL100km) / 100 * station.prixLitre;
  });

  candidates.sort((a, b) => a.coutDetour - b.coutDetour);

  return candidates.slice(0, TOP_N);
}

function stationFromRecord(record, carburantField) {
  const prixLitre = record[carburantField];
  if (prixLitre === null || prixLitre === undefined) {
    return null; // carburant non disponible à cette station
  }

  const geom = record.geom;
  if (!geom || typeof geom.lat !== "number" || typeof geom.lon !== "number") {
    return null;
  }

  return {
    nom: record.adresse ? `${record.adresse}${record.ville ? ", " + record.ville : ""}` : "Station",
    adresse: record.ville || "",
    lat: geom.lat,
    lon: geom.lon,
    prixLitre,
  };
}

// -----------------------------------------------------------------------
// Distance (formule de haversine)
// -----------------------------------------------------------------------

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // rayon de la Terre en km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// -----------------------------------------------------------------------
// Affichage des résultats
// -----------------------------------------------------------------------

function renderResults(stations, carburantField) {
  const label = CARBURANT_LABELS[carburantField];
  document.getElementById("results-subtitle").textContent = `Carburant : ${label}`;

  const list = document.getElementById("results-list");
  list.innerHTML = "";

  stations.forEach((station, index) => {
    const item = document.createElement("li");
    item.className = "result-card";

    const mapsUrl = buildGoogleMapsUrl(station);

    item.innerHTML = `
      <span class="result-rank">#${index + 1}</span>
      <p class="result-name">${escapeHtml(station.nom)}</p>
      <p class="result-address">${escapeHtml(station.adresse)}</p>
      <div class="result-stats">
        <span>📍 <strong>${station.distanceKm.toFixed(1)} km</strong></span>
        <span>💶 <strong>${station.prixLitre.toFixed(3)} €/L</strong></span>
        <span>🧮 Coût du détour : <strong>${station.coutDetour.toFixed(2)} €</strong></span>
      </div>
      <a class="btn-itineraire" href="${mapsUrl}" target="_blank" rel="noopener">Itinéraire →</a>
    `;

    list.appendChild(item);
  });
}

function buildGoogleMapsUrl(station) {
  const params = new URLSearchParams({
    api: "1",
    origin: `${userPosition.lat},${userPosition.lon}`,
    destination: `${station.lat},${station.lon}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// -----------------------------------------------------------------------
// Erreurs / état de chargement
// -----------------------------------------------------------------------

function setLoadingMessage(message) {
  document.getElementById("loading-message").textContent = message;
}

function showError(message) {
  document.getElementById("error-message").textContent = message;
  showStep("error");
}
