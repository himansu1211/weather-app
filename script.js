const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_API = "https://nominatim.openstreetmap.org/search";
const REVERSE_API = "https://nominatim.openstreetmap.org/reverse";
const OWM_KEY = "d93e0a369b83f343996e675d3a7323e5";

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const hourlyEl = document.getElementById("hourly");
const dailyEl = document.getElementById("daily");
const currentTop = document.getElementById("currentTop");
const sunmoonEl = document.getElementById("sunmoon");
const updatesEl = document.getElementById("updates");
let map;
let userMarker = null;

let lastWeather = null;

function initMap() {
  map = L.map("map").setView([20.3, 85.8], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    setMarker(lat, lng);
    loadWeather(lat, lng);
  });
}

async function getLocationName(lat, lon) {
  const res = await fetch(
    `${REVERSE_API}?format=json&lat=${lat}&lon=${lon}`
  );
  const data = await res.json();
  const a = data.address || {};

  const city =
    a.city || a.town || a.village || a.hamlet || "";
  const state = a.state || "";
  const country = a.country || "";

  return [city, state, country].filter(Boolean).join(", ");
}

async function loadWeather(lat, lon) {
  const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;

  const [weather, locationName] = await Promise.all([
    fetch(url).then(r => r.json()),
    getLocationName(lat, lon)
  ]);

  lastWeather = weather;

  renderCurrent(weather, locationName);
  renderHourly(weather);
  renderDaily(weather);
  renderSun(weather);
  renderUpdates(weather);
}

function renderCurrent(data, locationName) {
  currentTop.innerHTML = `
    <div class="location">${locationName}</div>
    <div class="temp">${Math.round(data.current_weather.temperature)}°C</div>
    <div class="meta">Wind ${data.current_weather.windspeed} km/h</div>
  `;
}

function renderHourly(data) {
  hourlyEl.innerHTML = "";
  for (let i = 0; i < 24; i += 3) {
    hourlyEl.innerHTML += `
      <div class="hour">
        <div>${data.hourly.time[i].slice(11, 16)}</div>
        <div>${Math.round(data.hourly.temperature_2m[i])}°</div>
      </div>
    `;
  }
}

function renderDaily(data) {
  dailyEl.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    dailyEl.innerHTML += `
      <div class="hour">
        <div>${data.daily.time[i]}</div>
        <div>
          ${Math.round(data.daily.temperature_2m_max[i])}° /
          ${Math.round(data.daily.temperature_2m_min[i])}°
        </div>
      </div>
    `;
  }
}

function renderSun(data) {
  sunmoonEl.textContent =
    `Sunrise ${data.daily.sunrise[0].slice(11,16)} · Sunset ${data.daily.sunset[0].slice(11,16)}`;
}

function renderUpdates(data) {
  const now = new Date();
  const sunrise = new Date(data.daily.sunrise[0]);
  const sunset = new Date(data.daily.sunset[0]);
  const isDay = now >= sunrise && now <= sunset;

  let uvLevel = 'Safe';
  if (isDay) {
    const hour = now.getHours();
    if (hour >= 10 && hour <= 14) {
      uvLevel = 'Harmful';
    } else {
      uvLevel = 'Moderate';
    }
  } else {
    uvLevel = 'Safe';
  }

  let rainExpectation = 'No rain expected';
  const currentTemp = data.current_weather.temperature;
  if (currentTemp < 10) {
    rainExpectation = 'Possible snow or rain';
  } else if (currentTemp > 25) {
    rainExpectation = 'Thunderstorms possible';
  } else {
    rainExpectation = 'Light rain possible';
  }

  let weatherFeedback = 'Enjoy the weather!';
  if (data.current_weather.temperature < 15) {
    weatherFeedback = 'It\'s chilly outside, bundle up!';
  } else if (data.current_weather.temperature > 30) {
    weatherFeedback = 'Stay hydrated, it\'s hot!';
  } else {
    weatherFeedback = 'Perfect weather for outdoor activities!';
  }

  updatesEl.innerHTML = `
    <div>UV Index: ${uvLevel}</div>
    <div>Rain: ${rainExpectation}</div>
    <div>Feedback: ${weatherFeedback}</div>
  `;
}

function setMarker(lat, lon) {
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([lat, lon]).addTo(map);
  map.setView([lat, lon], 8);
}

searchBtn.onclick = async () => {
  const q = searchInput.value.trim();
  if (!q) return;

  const res = await fetch(
    `${GEOCODE_API}?format=json&q=${encodeURIComponent(q)}&limit=1`
  ).then(r => r.json());

  if (!res.length) return;

  const lat = +res[0].lat;
  const lon = +res[0].lon;

  setMarker(lat, lon);
  loadWeather(lat, lon);
};

locationBtn.onclick = () => {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    setMarker(lat, lon);
    loadWeather(lat, lon);
  });
};



initMap();
loadWeather(20.3, 85.8);
setMarker(20.3, 85.8);
