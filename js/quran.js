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

let TRANSLITERATION_EDITION = 'en.transliteration'; // fallback; refined in init()
const STORAGE_KEY = 'furqan-reader-prefs';


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

    // Group translations by language for a friendlier dropdown
    const byLang = {};
    translations.forEach(t => {
      if (!byLang[t.language]) byLang[t.language] = [];
      byLang[t.language].push(t);
    });
    const langNames = new Intl.DisplayNames(['en'], { type: 'language' });
    const sortedLangs = Object.keys(byLang).sort((a, b) => {
      try { return langNames.of(a).localeCompare(langNames.of(b)); } catch { return a.localeCompare(b); }
    });

    translationSelect.innerHTML = sortedLangs.map(lang => {
      const options = byLang[lang].map(t => `<option value="${t.identifier}">${t.englishName || t.name}</option>`).join('');
      let label = lang;
      try { label = langNames.of(lang); } catch {}
      return `<optgroup label="${label}">${options}</optgroup>`;
    }).join('');

    // Restore preferences, or sensible defaults
    layoutSelect.value = prefs.layout || 'verse-translation';
    surahSelect.value = prefs.surah || 1;
    pageInput.value = prefs.page || 1;
    if (prefs.translation) translationSelect.value = prefs.translation;
    else {
      const enSahih = translations.find(t => t.identifier === 'en.sahih');
      if (enSahih) translationSelect.value = 'en.sahih';
    }
    if (prefs.reciter) reciterSelect.value = prefs.reciter;
    transliterationToggle.checked = !!prefs.transliteration;

    toggleLayoutControls();
    await render();
  } catch (err) {
    readerContent.innerHTML = `<div class="error-msg">Could not load the Qur'an right now. Check your internet connection and reload the page.</div>`;
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
        <img src="${mushafImageUrl(page)}" alt="Mushaf page ${page}"
             onerror="this.onerror=null; this.replaceWith(Object.assign(document.createElement('p'), {className:'error-msg', textContent:'This page image could not load. Try a nearby page or reload.'}));">
        <div class="mushaf-nav">
          <button id="prevPageBtn" ${page <= 1 ? 'disabled' : ''}>← Previous</button>
          <span class="muted">Page ${page} of 604</span>
          <button id="nextPageBtn" ${page >= 604 ? 'disabled' : ''}>Next →</button>
        </div>`;
      const prevBtn = document.getElementById('prevPageBtn');
      const nextBtn = document.getElementById('nextPageBtn');
      if (prevBtn) prevBtn.addEventListener('click', () => { pageInput.value = page - 1; render(); });
      if (nextBtn) nextBtn.addEventListener('click', () => { pageInput.value = page + 1; render(); });
      return;
    }

    const surahNum = surahSelect.value;
    const translationId = translationSelect.value;

    if (layout === 'full-translation') {
      const translationData = await fetchJSON(`${API}/surah/${surahNum}/${translationId}`);
      readerContent.className = 'full-translation-block';
      readerContent.style.padding = '20px 0';
      readerContent.innerHTML = `<h2 style="font-size:1.4rem;">${translationData.englishName} — ${translationData.name}</h2>` +
        translationData.ayahs.map(a => `<p><span class="verse-num">${a.numberInSurah}.</span>${a.text}</p>`).join('');
      return;
    }

    // verse-translation or arabic-only, optionally with transliteration
    const showTranslit = transliterationToggle.checked;
    const editionList = ['quran-uthmani', translationId];
    if (showTranslit) editionList.push(TRANSLITERATION_EDITION);

    const combined = await fetchJSON(`${API}/surah/${surahNum}/editions/${editionList.join(',')}`);
    const arabicAyahs = combined[0].ayahs;
    const translationAyahs = combined[1].ayahs;
    const transliterationAyahs = showTranslit && combined[2] ? combined[2].ayahs : null;
    const showTranslation = layout === 'verse-translation';

    readerContent.className = '';
    readerContent.style.padding = '20px 0';
    readerContent.innerHTML = `<h2 style="font-size:1.4rem;">${combined[0].englishName} — ${combined[0].name}</h2>` +
      arabicAyahs.map((a, i) =>
        ayahRow(
          a.text,
          translationAyahs[i] ? translationAyahs[i].text : '',
          transliterationAyahs && transliterationAyahs[i] ? transliterationAyahs[i].text : '',
          a.numberInSurah, a.number, true, showTranslation, showTranslit
        )
      ).join('');
    attachPlayButtons();

  } catch (err) {
    readerContent.className = 'error-msg';
    readerContent.textContent = 'Something went wrong loading this passage. Please try a different selection or reload.';
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

init();
