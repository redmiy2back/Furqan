// ============ Furqan Quran Reader ============
// Text/translation/audio: AlQuran Cloud API (https://alquran.cloud/api)
// Mushaf page images: real scanned Madani mushaf pages (604 pages)

const API = 'https://api.alquran.cloud/v1';
const MUSHAF_IMAGE_BASE = 'https://quran.islam-db.com/data/pages/quranpages_1024/images';
function mushafImageUrl(pageNum) {
  return `${MUSHAF_IMAGE_BASE}/page${String(pageNum).padStart(3, '0')}.png`;
}

const layoutSelect = document.getElementById('layoutSelect');
const surahSelect = document.getElementById('surahSelect');
const surahWrap = document.getElementById('surahWrap');
const pageWrap = document.getElementById('pageWrap');
const pageInput = document.getElementById('pageInput');
const translationSelect = document.getElementById('translationSelect');
const translationWrap = document.getElementById('translationWrap');
const transliterationWrap = document.getElementById('transliterationWrap');
const transliterationToggle = document.getElementById('transliterationToggle');
const reciterSelect = document.getElementById('reciterSelect');
const readerContent = document.getElementById('readerContent');
const ayahAudio = document.getElementById('ayahAudio');

let TRANSLITERATION_EDITION = 'en.transliteration';
const STORAGE_KEY = 'furqan-reader-prefs';


// ✅ ADDED: Reciters list + populate function
const RECITERS = [
  { name: "Mishary Rashid Alafasy", id: "ar.alafasy" },
  { name: "Abdul Basit (Murattal)", id: "ar.abdulbasitmurattal" },
  { name: "Maher Al-Muaiqly", id: "ar.mahermuaiqly" },
  { name: "Saad Al-Ghamdi", id: "ar.saadghamdi" },
  { name: "Ahmed Al-Ajmi", id: "ar.ahmedajamy" }
];

function populateReciters() {
  if (!reciterSelect) return;

  reciterSelect.innerHTML = RECITERS.map(r =>
    `<option value="${r.id}">${r.name}</option>`
  ).join('');
}


function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function savePrefs(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Request failed: ' + url);
  const data = await res.json();
  return data.data;
}

async function init() {
  const prefs = loadPrefs();

  // ✅ ADDED: populate reciters BEFORE using prefs
  populateReciters();

  // Populate mushaf page dropdown (1-604)
  for (let i = 1; i <= 604; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = 'Page ' + i;
    pageInput.appendChild(opt);
  }

  try {
    const [surahs, translations, transliterations] = await Promise.all([
      fetchJSON(`${API}/surah`),
      fetchJSON(`${API}/edition/type/translation`),
      fetchJSON(`${API}/edition/type/transliteration`).catch(() => [])
    ]);

    if (transliterations && transliterations.length) {
      const enTranslit = transliterations.find(t => t.language === 'en') || transliterations[0];
      TRANSLITERATION_EDITION = enTranslit.identifier;
    } else {
      transliterationAvailable = false;
    }

    surahSelect.innerHTML = surahs.map(s =>
      `<option value="${s.number}">${s.number}. ${s.englishName} — ${s.name}</option>`
    ).join('');

    // Group translations by language
    const byLang = {};
    translations.forEach(t => {
      if (!byLang[t.language]) byLang[t.language] = [];
      byLang[t.language].push(t);
    });

    const langNames = new Intl.DisplayNames(['en'], { type: 'language' });

    const sortedLangs = Object.keys(byLang).sort((a, b) => {
      try { return langNames.of(a).localeCompare(langNames.of(b)); }
      catch { return a.localeCompare(b); }
    });

    translationSelect.innerHTML = sortedLangs.map(lang => {
      const options = byLang[lang].map(t =>
        `<option value="${t.identifier}">${t.englishName || t.name}</option>`
      ).join('');
      let label = lang;
      try { label = langNames.of(lang); } catch {}
      return `<optgroup label="${label}">${options}</optgroup>`;
    }).join('');

    // Restore preferences
    layoutSelect.value = prefs.layout || 'verse-translation';
    surahSelect.value = prefs.surah || 1;
    pageInput.value = prefs.page || 1;

    if (prefs.translation) translationSelect.value = prefs.translation;
    else {
      const enSahih = translations.find(t => t.identifier === 'en.sahih');
      if (enSahih) translationSelect.value = 'en.sahih';
    }

    if (prefs.reciter) reciterSelect.value = prefs.reciter;
    else reciterSelect.value = "ar.alafasy"; // optional default

    transliterationToggle.checked = !!prefs.transliteration;

    toggleLayoutControls();
    await render();

  } catch (err) {
    readerContent.innerHTML = `<div class="error-msg">Could not load the Qur'an right now.</div>`;
    console.error(err);
  }
}

let transliterationAvailable = true;

function toggleLayoutControls() {
  const layout = layoutSelect.value;
  const isMushaf = layout === 'mushaf-page';
  const isFullTranslation = layout === 'full-translation';

  surahWrap.style.display = isMushaf ? 'none' : 'block';
  pageWrap.style.display = isMushaf ? 'block' : 'none';
  translationWrap.style.display = isMushaf ? 'none' : 'block';
  transliterationWrap.style.display = (!transliterationAvailable || isMushaf || isFullTranslation) ? 'none' : 'flex';
}

function currentPrefs() {
  return {
    layout: layoutSelect.value,
    surah: surahSelect.value,
    page: pageInput.value,
    translation: translationSelect.value,
    reciter: reciterSelect.value,
    transliteration: transliterationToggle.checked
  };
}

function playAyah(globalAyahNumber) {
  const reciter = reciterSelect.value;
  ayahAudio.src = `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyahNumber}.mp3`;
  ayahAudio.play().catch(() => {});
}

function ayahRow(arabicText, translationText, transliterationText, ayahNumInSurah, globalNumber, showArabic, showTranslation, showTransliteration) {
  return `
    <div class="ayah-block">
      ${showArabic ? `<div class="ayah-arabic">${arabicText}<span class="ayah-number-tag">${ayahNumInSurah}</span></div>` : ''}
      ${showTransliteration && transliterationText ? `<div class="transliteration-line">${transliterationText}</div>` : ''}
      ${showTranslation ? `<div class="ayah-translation">${translationText}</div>` : ''}
      <div class="ayah-tools">
        <button class="play-btn" data-ayah="${globalNumber}">▶ Play verse</button>
      </div>
    </div>`;
}

async function render() {
  const layout = layoutSelect.value;
  readerContent.className = 'loading';
  readerContent.textContent = 'Loading…';
  savePrefs(currentPrefs());

  try {
    if (layout === 'mushaf-page') {
      const page = parseInt(pageInput.value, 10);

      readerContent.className = 'mushaf-page-view';
      readerContent.innerHTML = `
        <img src="${mushafImageUrl(page)}">
      `;
      return;
    }

    const surahNum = surahSelect.value;
    const translationId = translationSelect.value;

    const combined = await fetchJSON(`${API}/surah/${surahNum}/editions/quran-uthmani,${translationId}`);

    const arabicAyahs = combined[0].ayahs;
    const translationAyahs = combined[1].ayahs;

    readerContent.className = '';
    readerContent.innerHTML = arabicAyahs.map((a, i) =>
      ayahRow(
        a.text,
        translationAyahs[i]?.text || '',
        '',
        a.numberInSurah,
        a.number,
        true,
        true,
        false
      )
    ).join('');

    attachPlayButtons();

  } catch (err) {
    readerContent.className = 'error-msg';
    readerContent.textContent = 'Error loading.';
    console.error(err);
  }
}

function attachPlayButtons() {
  readerContent.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', () => playAyah(btn.dataset.ayah));
  });
}

layoutSelect.addEventListener('change', () => { toggleLayoutControls(); render(); });
surahSelect.addEventListener('change', render);
pageInput.addEventListener('change', render);
translationSelect.addEventListener('change', render);
transliterationToggle.addEventListener('change', render);
reciterSelect.addEventListener('change', () => savePrefs(currentPrefs()));

// ✅ FULL SURAH PLAY (FIXED)
document.addEventListener("DOMContentLoaded", () => {
  const playSurahBtn = document.getElementById('playSurahBtn');
  const nowPlayingLabel = document.getElementById('nowPlayingLabel');

  if (!playSurahBtn) return; // safety

  playSurahBtn.addEventListener('click', () => {
    const reciter = reciterSelect.value;
    const surah = surahSelect.value;

    if (!reciter || !surah) return;

    const surahPadded = String(surah).padStart(3, '0');

    ayahAudio.src = `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surahPadded}.mp3`;

    ayahAudio.play().catch(() => {});

    const selectedSurahName = surahSelect.options[surahSelect.selectedIndex].text;
    nowPlayingLabel.textContent = `Playing: ${selectedSurahName}`;
  });
});

init();
