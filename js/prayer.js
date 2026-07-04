// ============ Furqan Prayer Times ============
// Uses the free, keyless Aladhan API: https://aladhan.com/prayer-times-api

const locateBtn = document.getElementById('locateBtn');
const locateStatus = document.getElementById('locateStatus');
const permissionCard = document.getElementById('permissionCard');
const resultsArea = document.getElementById('resultsArea');
const timesGrid = document.getElementById('timesGrid');
const cityLabel = document.getElementById('cityLabel');
const dateLabel = document.getElementById('dateLabel');
const methodSelect = document.getElementById('methodSelect');

const PRAYER_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PREFS_KEY = 'furqan-prayer-prefs';

let lastCoords = null;

function loadMethodPref() {
  return localStorage.getItem(PREFS_KEY) || '2';
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
    const data = await res.json();
    const a = data.address || {};
    return a.city || a.town || a.village || a.state || data.display_name || 'Your location';
  } catch {
    return 'Your location';
  }
}

async function fetchTimes(lat, lon, method) {
  const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=${method}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data;
}

function nextPrayerName(timings) {
  const now = new Date();
  const todayStr = now.toDateString();
  for (const name of PRAYER_ORDER) {
    const [h, m] = timings[name].split(':').map(Number);
    const t = new Date(todayStr + ' ' + h + ':' + m);
    if (t > now) return name;
  }
  return PRAYER_ORDER[0]; // after Isha, next is tomorrow's Fajr
}

function renderTimes(timings, dateInfo) {
  const next = nextPrayerName(timings);
  timesGrid.innerHTML = PRAYER_ORDER.map(name => `
    <div class="card time-card ${name === next ? 'next' : ''}">
      <div class="name">${name}${name === next ? ' • next' : ''}</div>
      <div class="time">${timings[name]}</div>
    </div>
  `).join('');
  dateLabel.textContent = dateInfo;
}

async function loadForCoords(lat, lon) {
  lastCoords = { lat, lon };
  const method = methodSelect.value;
  localStorage.setItem(PREFS_KEY, method);

  const [place, timingData] = await Promise.all([
    reverseGeocode(lat, lon),
    fetchTimes(lat, lon, method)
  ]);

  cityLabel.textContent = place;
  permissionCard.style.display = 'none';
  resultsArea.style.display = 'block';
  renderTimes(timingData.timings, timingData.date.readable);
}

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    locateStatus.textContent = 'Your browser does not support location. Try a different browser.';
    return;
  }
  locateBtn.disabled = true;
  locateStatus.textContent = 'Locating…';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        await loadForCoords(pos.coords.latitude, pos.coords.longitude);
        locateStatus.textContent = '';
      } catch (err) {
        locateStatus.textContent = 'Could not fetch prayer times. Please try again.';
        console.error(err);
      } finally {
        locateBtn.disabled = false;
      }
    },
    (err) => {
      locateBtn.disabled = false;
      locateStatus.textContent = 'Location access was denied. You can enable it in your browser settings and try again.';
      console.error(err);
    }
  );
});

methodSelect.value = loadMethodPref();
methodSelect.addEventListener('change', () => {
  if (lastCoords) loadForCoords(lastCoords.lat, lastCoords.lon);
});
