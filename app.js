// ---------- 1. Study area: cities of Pakistan ----------
const CITIES = [
  { name: "Islamabad",   lat: 33.6844, lon: 73.0479 },
  { name: "Rawalpindi",  lat: 33.5651, lon: 73.0169 },
  { name: "Murree",      lat: 33.9070, lon: 73.3943 },
  { name: "Lahore",      lat: 31.5204, lon: 74.3587 },
  { name: "Faisalabad",  lat: 31.4504, lon: 73.1350 },
  { name: "Sialkot",     lat: 32.4945, lon: 74.5229 },
  { name: "Multan",      lat: 30.1575, lon: 71.5249 },
  { name: "Bahawalpur",  lat: 29.3956, lon: 71.6836 },
  { name: "Peshawar",    lat: 34.0151, lon: 71.5249 },
  { name: "Muzaffarabad",lat: 34.3700, lon: 73.4711 },
  { name: "Gilgit",      lat: 35.9208, lon: 74.3144 },
  { name: "Skardu",      lat: 35.2971, lon: 75.6333 },
  { name: "Quetta",      lat: 30.1798, lon: 66.9750 },
  { name: "Karachi",     lat: 24.8607, lon: 67.0011 },
  { name: "Hyderabad",   lat: 25.3960, lon: 68.3578 },
  { name: "Gwadar",      lat: 25.1216, lon: 62.3254 }
];

// ---------- 2. API settings (Open-Meteo, no key needed) ----------
const API_URL = "https://api.open-meteo.com/v1/forecast";
const CURRENT_FIELDS = [
  "temperature_2m", "apparent_temperature", "relative_humidity_2m",
  "precipitation", "weather_code", "wind_speed_10m",
  "wind_direction_10m", "surface_pressure"
].join(",");

// WMO weather code -> text
const WMO = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  77: "Snow grains", 80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
  85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail"
};

// ---------- 3. Map setup ----------
const map = L.map("map").setView([30.4, 69.3], 5);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Weather: <a href="https://open-meteo.com/">Open-Meteo</a>'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
let clickMarker = null;
let records = [];          // city + weather data after parsing

// ---------- 4. Helpers ----------
const $ = id => document.getElementById(id);

function setStatus(text, type) {
  const s = $("status");
  s.textContent = text;
  s.className = "status " + (type || "");
}

function tempClass(t) { return t < 15 ? "cold" : t > 28 ? "hot" : "mild"; }

function popupHtml(title, c, u) {
  return `<div class="pop"><h3>${title}</h3><table>
    <tr><td>Condition</td><td><b>${WMO[c.weather_code] ?? "Unknown"}</b></td></tr>
    <tr><td>Temperature</td><td>${c.temperature_2m} ${u.temperature_2m}</td></tr>
    <tr><td>Feels like</td><td>${c.apparent_temperature} ${u.apparent_temperature}</td></tr>
    <tr><td>Humidity</td><td>${c.relative_humidity_2m} ${u.relative_humidity_2m}</td></tr>
    <tr><td>Wind</td><td>${c.wind_speed_10m} ${u.wind_speed_10m} (${c.wind_direction_10m}&deg;)</td></tr>
    <tr><td>Pressure</td><td>${c.surface_pressure} ${u.surface_pressure}</td></tr>
    <tr><td>Precipitation</td><td>${c.precipitation} ${u.precipitation}</td></tr>
    <tr><td>Observed</td><td>${c.time.replace("T", " ")} (local)</td></tr>
  </table></div>`;
}

// ---------- 5. Fetch all cities in ONE request ----------
async function loadWeather() {
  setStatus("Loading weather data from Open-Meteo...");
  $("refresh").disabled = true;
  const url = `${API_URL}?latitude=${CITIES.map(c => c.lat).join(",")}` +
              `&longitude=${CITIES.map(c => c.lon).join(",")}` +
              `&current=${CURRENT_FIELDS}&timezone=auto`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Server replied with status " + res.status);
    const json = await res.json();                       // parse JSON
    const arr = Array.isArray(json) ? json : [json];     // one object per location
    if (arr.length !== CITIES.length || !arr[0].current) throw new Error("Unexpected API response");

    records = CITIES.map((city, i) => ({
      ...city,
      current: arr[i].current,
      units: arr[i].current_units,
      elevation: arr[i].elevation
    }));
    render();
    setStatus("Updated: " + new Date().toLocaleTimeString() + " | " + records.length + " cities", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Could not load data: " + err.message + ". Check internet and press Refresh.", "error");
  } finally {
    $("refresh").disabled = false;
  }
}

// ---------- 6. Draw markers + list (with search and filter) ----------
function render() {
  const q = $("search").value.trim().toLowerCase();
  const f = $("filter").value;
  const shown = records.filter(r =>
    r.name.toLowerCase().includes(q) && (f === "all" || tempClass(r.current.temperature_2m) === f)
  );

  markerLayer.clearLayers();
  $("list").innerHTML = "";

  shown.forEach(r => {
    const t = r.current.temperature_2m;
    const icon = L.divIcon({
      className: "",
      html: `<div class="tmarker ${tempClass(t)}">${Math.round(t)}&deg;</div>`,
      iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -20]
    });
    const marker = L.marker([r.lat, r.lon], { icon })
      .bindPopup(popupHtml(r.name + ` <small>(${Math.round(r.elevation)} m)</small>`, r.current, r.units))
      .addTo(markerLayer);

    const li = document.createElement("li");
    li.innerHTML = `<span>${r.name}</span><span class="t">${t} ${r.units.temperature_2m}</span>`;
    li.onclick = () => { map.setView([r.lat, r.lon], 9); marker.openPopup(); };
    $("list").appendChild(li);
  });

  if (!shown.length && records.length) setStatus("No city matches your search or filter.");
  else if (records.length) setStatus("Showing " + shown.length + " of " + records.length + " cities", "ok");
}

// ---------- 7. Click on map = weather for that point ----------
map.on("click", async e => {
  const { lat, lng } = e.latlng;
  if (clickMarker) map.removeLayer(clickMarker);
  clickMarker = L.marker([lat, lng]).addTo(map).bindPopup("Loading...").openPopup();
  try {
    const res = await fetch(`${API_URL}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=${CURRENT_FIELDS}&timezone=auto`);
    if (!res.ok) throw new Error("status " + res.status);
    const j = await res.json();
    clickMarker.setPopupContent(popupHtml(`Selected point<br><small>${lat.toFixed(3)}, ${lng.toFixed(3)}</small>`, j.current, j.current_units));
  } catch (err) {
    clickMarker.setPopupContent("Could not load weather for this point.");
  }
});

// ---------- 8. Events ----------
$("search").addEventListener("input", render);
$("filter").addEventListener("change", render);
$("refresh").addEventListener("click", loadWeather);

loadWeather();
