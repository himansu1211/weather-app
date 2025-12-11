/* ==========================
   CONFIG (No API Keys Needed)
   ========================== */
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_BASE = 'https://nominatim.openstreetmap.org/search';
const REVERSE_BASE = 'https://nominatim.openstreetmap.org/reverse';
const OPENAQ_BASE = 'https://api.openaq.org/v3/latest';

/* ==========================
   DOM REFERENCES
   ========================== */
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const autocompleteEl = document.getElementById('autocomplete');
const loader = document.getElementById('loader');
const currentTop = document.getElementById('currentTop');
const hourlyEl = document.getElementById('hourly');
const dailyEl = document.getElementById('daily');
const sunmoonEl = document.getElementById('sunmoon');
const overlay = document.getElementById('overlay');
const dashboardEl = document.getElementById('dashboard');
let map, miniMap;
let aqiChart, uvChart, humChart, windChart;

/* ==========================
   HELPERS
   ========================== */
function showLoader(s = true){ loader.classList.toggle('hidden', !s); }
function debounce(fn, wait){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); }; }

/* ==========================
   GEOCODING
   ========================== */
async function geocode(q, limit=5){
  const url = `${GEOCODE_BASE}?format=json&q=${encodeURIComponent(q)}&limit=${limit}&addressdetails=1`;
  const r = await fetch(url, {headers:{'User-Agent':'WeatherSphere/1.0'}});
  return r.json();
}

async function reverseGeocode(lat, lon){
  const url = `${REVERSE_BASE}?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const r = await fetch(url, {headers:{'User-Agent':'WeatherSphere/1.0'}});
  return r.json();
}

/* ==========================
   AUTOCOMPLETE
   ========================== */
searchInput.addEventListener('input', debounce(async (e)=>{
  const q = e.target.value.trim();
  if(!q){ autocompleteEl.classList.add('hidden'); return; }

  const res = await geocode(q, 5);
  if(!res.length){ autocompleteEl.classList.add('hidden'); return; }

  autocompleteEl.innerHTML = res.map(r=>`
    <div class="autocomplete-item" data-lat="${r.lat}" data-lon="${r.lon}" data-d="${encodeURIComponent(r.display_name)}">${r.display_name}</div>
  `).join('');
  autocompleteEl.classList.remove('hidden');
}, 250));

autocompleteEl.addEventListener('click', (e)=>{
  const item = e.target.closest('.autocomplete-item');
  if(!item) return;
  autocompleteEl.classList.add('hidden');

  const lat = parseFloat(item.dataset.lat);
  const lon = parseFloat(item.dataset.lon);
  const name = decodeURIComponent(item.dataset.d);

  flyToAndLoad(lat, lon, name);
});

/* ==========================
   WEATHER FETCH
   ========================== */
async function fetchWeather(lat, lon){
  const params = [
    'current_weather=true',
    'hourly=temperature_2m,relativehumidity_2m,weathercode,windspeed_10m,uv_index',
    'daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max',
    'timezone=auto'
  ].join('&');

  const url = `${WEATHER_BASE}?latitude=${lat}&longitude=${lon}&${params}`;
  const r = await fetch(url);
  return r.json();
}

async function fetchAqi(lat, lon){
  const url = `${OPENAQ_BASE}?coordinates=${lat},${lon}&radius=50000&limit=10`;
  return fetch(url).then(r=>r.json()).catch(()=>null);
}

/* ==========================
   RENDERING
   ========================== */
function iconFor(code){
  if(code===0) return 'icons/sun.svg';
  if(code===1||code===2) return 'icons/partly-day.svg';
  if(code>=3 && code<50) return 'icons/cloud.svg';
  if(code>=51 && code<80) return 'icons/rain.svg';
  if(code>=70) return 'icons/snow.svg';
  return 'icons/cloud.svg';
}

function translation(code){
  const t = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',61:'Slight rain',71:'Slight snow'};
  return t[code] || '—';
}

function renderCurrent(data, name){
  const cur = data.current_weather;
  currentTop.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center">
      <img src="${iconFor(cur.weathercode)}" width="110" />
      <div>
        <div style="font-size:18px;font-weight:700">${name}</div>
        <div class="temp">${Math.round(cur.temperature)}°C</div>
        <div class="meta">Wind: ${cur.windspeed} km/h • ${translation(cur.weathercode)}</div>
      </div>
    </div>
  `;
}

function renderHourly(data){
  hourlyEl.innerHTML = '';
  const h = data.hourly;
  for(let i=0;i<24;i+=4){
    const el = document.createElement('div');
    el.className = 'hour';
    el.innerHTML = `
      <div>${h.time[i].slice(11,16)}</div>
      <img src="${iconFor(h.weathercode[i])}" width="48" />
      <div>${Math.round(h.temperature_2m[i])}°C</div>
    `;
    hourlyEl.appendChild(el);
  }
}

function renderDaily(data){
  dailyEl.innerHTML = '';
  const d = data.daily;
  for(let i=0;i<5;i++){
    const el = document.createElement('div');
    el.className = 'card forecast';
    el.innerHTML = `
      <div style="text-align:center">
        <div>${d.time[i]}</div>
        <img src="${iconFor(d.weathercode[i])}" width="56" />
        <div>${Math.round(d.temperature_2m_max[i])}°/${Math.round(d.temperature_2m_min[i])}°</div>
      </div>
    `;
    dailyEl.appendChild(el);
  }
}

function renderSunMoon(data){
  const d = data.daily;
  sunmoonEl.innerHTML = `Sunrise: ${d.sunrise[0].slice(11,16)} • Sunset: ${d.sunset[0].slice(11,16)} • UV: ${d.uv_index_max[0]}`;
}

function setOverlayForWeather(code){
  overlay.className = 'overlay';
  if(code>=51 && code<80){ overlay.classList.add('rain'); }
  else if(code>=70){ overlay.classList.add('snow'); }
  else if(code>=80){ overlay.classList.add('storm'); }
}

/* ==========================
   DASHBOARD (CHARTS)
   ========================== */
function ensureCharts(){
  aqiChart = new Chart(document.getElementById('aqiChart'), {type:'bar',data:{labels:[],datasets:[{label:'PM2.5',data:[]}]}});
  uvChart = new Chart(document.getElementById('uvChart'), {type:'line',data:{labels:[],datasets:[{label:'UV',data:[],fill:true}]}});
  humChart = new Chart(document.getElementById('humChart'), {type:'line',data:{labels:[],datasets:[{label:'Humidity %',data:[]}]}});
  windChart = new Chart(document.getElementById('windChart'), {type:'polarArea',data:{labels:['N','NE','E','SE','S','SW','W','NW'],datasets:[{label:'Wind',data:[]}]}});
}

async function renderDashboard(lat, lon, weather){
  const aq = await fetchAqi(lat,lon);
  if(aq && aq.results){
    const r = aq.results.slice(0,6);
    aqiChart.data.labels = r.map(x=>x.location);
    aqiChart.data.datasets[0].data = r.map(x=>{
      const m = x.measurements.find(m=>m.parameter==='pm25');
      return m?m.value:0;
    });
    aqiChart.update();
  }

  const h = weather.hourly;
  uvChart.data.labels = h.time.slice(0,24).map(t=>t.slice(11,16));
  uvChart.data.datasets[0].data = h.uv_index.slice(0,24);
  uvChart.update();

  humChart.data.labels = uvChart.data.labels;
  humChart.data.datasets[0].data = h.relativehumidity_2m.slice(0,24);
  humChart.update();

  windChart.data.datasets[0].data = h.windspeed_10m.slice(0,8);
  windChart.update();
}

/* ==========================
   MAP + MINI MAP
   ========================== */
function initMap(){
  map = L.map('map').setView([20.29,85.82],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);

  map.on('click', async (ev)=>{
    const {lat, lng} = ev.latlng;
    const rev = await reverseGeocode(lat,lng);
    flytoAndLoad(lat, lng, rev.display_name || `Lat: ${lat.toFixed(2)}, Lon: ${lng.toFixed(2)}`);
  });
}

function initMiniMap(){
  miniMap = L.map('miniMap',{zoomControl:false,attributionControl:false}).setView([0,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(miniMap);
}

function flyToAndLoad(lat, lon, name){
  showLoader(true);
  map.flyTo([lat, lon], 10, {duration:2});
  loadWeatherForLocation(lat, lon, name);
}

/* ==========================
   LOAD WEATHER FOR LOCATION
   ========================== */
async function loadWeatherForLocation(lat, lon, name){
  try {
    const weather = await fetchWeather(lat, lon);
    renderCurrent(weather, name);
    renderHourly(weather);
    renderDaily(weather);
    renderSunMoon(weather);
    setOverlayForWeather(weather.current_weather.weathercode);
    await renderDashboard(lat, lon, weather);
  } catch(err) {
    console.error('Error loading weather:', err);
  } finally {
    showLoader(false);
  }
}

/* ==========================
   INITIALIZATION
   ========================== */
window.onload = ()=>{
  initMap();
  initMiniMap();
  ensureCharts();
  showLoader(false);
};  

