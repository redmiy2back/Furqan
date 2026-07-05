// ============ Furqan Quran Reader ============
// Text/translation/audio: AlQuran Cloud API (https://alquran.cloud/api)
// Mushaf page images: real scanned Madani mushaf pages (604 pages)

const API = 'https://api.alquran.cloud/v1';
const MUSHAF_IMAGE_BASE = 'https://quran.islam-db.com/data/pages/quranpages_1024/images';
function mushafImageUrl(pageNum) {
  return `${MUSHAF_IMAGE_BASE}/page${String(pageNum).padStart(3, '0')}.png`;
}

// Reciters requested for Furqan. Each entry lists name fragments to match
// against the live edition list from the API — this avoids hardcoding
// identifiers that might be wrong or renamed.
const RECITER_WISHLIST = [
  { label: 'Mishary Rashid Alafasy', match: ['alafasy'] },
  { label: 'Saad Al-Ghamdi', match: ['ghamdi', 'ghamedi', 'ghamdy'] },
  { label: 'Ahmad Al-Ajmi', match: ['ajmy', 'ajmi'] },
  { label: 'Abu Bakr Al-Shatri', match: ['shatri', 'shaatri', 'shatry'] },
  { label: 'Raad Al-Kurdi', match: ['kurdi', 'kurdy'] },
  { label: 'Noreen Mohamed Siddig', match: ['siddig', 'siddiq', 'noreen'] },
  { label: 'Yasser Al-Dosari', match: ['dosari', 'dossari', 'dossary', 'dussary'] },
  { label: 'Mahmoud Al-Husary', match: ['husary', 'hussary'] },
  { label: 'Abdul Basit (Murattal)', match: ['abdulbasitmurattal', 'abdulbasit'] },
  { label: 'Mohamed Minshawi', match: ['minshawi', 'minshawy'] }
];

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
const playSurahBtn = document.getElementById('playSurahBtn');
const nowPlayingLabel = document.getElementById('nowPlayingLabel');

let TRANSLITERATION_EDITION = 'en.transliteration'; // fallback; refined in init()
const STORAGE_KEY = 'furqan-reader-prefs';
let transliterationAvailable = true;


function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function savePrefs(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error('Request failed: ' + url);
    const data = await res.json();
    return data.data;
  } finally {
    clearTimeout(timeout);
  }
}

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z]/g, '');
}

function resolveReciters(audioEditions) {
  // audioEditions: array of {identifier, englishName, name, language, format, ...}
  const arabicOnes = audioEditions.filter(e => e.language === 'ar' && e.format === 'audio');
  const resolved = [];
  const missing = [];

  RECITER_WISHLIST.forEach(wanted => {
    const found = arabicOnes.find(e => {
      const hay = normalize(e.englishName || e.identifier || '');
      return wanted.match.some(fragment => hay.includes(fragment));
    });
    if (found) {
      resolved.push({ label: wanted.label, identifier: found.identifier });
    } else {
      missing.push(wanted.label);
    }
  });

  if (missing.length) {
    console.warn('Furqan: could not find these reciters in the official ayah-level list (checking the larger catalog next):', missing.join(', '));
  }
  return resolved;
}

function resolveRecitersFromCatalog(identifiers) {
  // identifiers: plain array of strings like "ar.alafasy", from the larger
  // full-surah CDN catalog (~100 reciters), used to fill in names the
  // smaller official edition list doesn't have.
  const resolved = [];
  const missing = [];
  RECITER_WISHLIST.forEach(wanted => {
    const found = identifiers.find(id => {
      const hay = normalize(id);
      return wanted.match.some(fragment => hay.includes(fragment));
    });
    if (found) resolved.push({ label: wanted.label, identifier: found });
    else missing.push(wanted.label);
  });
  if (missing.length) {
    console.warn('Furqan: still could not find these reciters anywhere — leaving them out:', missing.join(', '));
  }
  return resolved;
}

// Fetches the larger (~100 reciter) full-surah catalog. This file is bigger
// than the other API calls, so it's always loaded in the BACKGROUND, after
// the page is already usable — never blocks initial load.
async function fetchReciterCatalog() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('https://cdn.islamic.network/quran/info/by-surah/info.json', { signal: controller.signal });
    if (!res.ok) return [];
    const tree = await res.json();
    const bitrateDirs = (tree[0] && tree[0].contents) || [];
    const bitrate128 = bitrateDirs.find(d => d.name === '128');
    if (!bitrate128) return [];
    return (bitrate128.contents || []).map(r => r.name);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function populateReciterSelect(reciters) {
  const previousValue = reciterSelect.value;
  reciterSelect.innerHTML = reciters.length
    ? reciters.map(r => `<option value="${r.identifier}">${r.label}</option>`).join('')
    : `<option value="ar.alafasy">Mishary Rashid Alafasy</option>`;
  if (reciters.some(r => r.identifier === previousValue)) {
    reciterSelect.value = previousValue;
  }
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
    const [surahs, translations, transliterations, audioEditions] = await Promise.all([
      fetchJSON(`${API}/surah`),
      fetchJSON(`${API}/edition/type/translation`),
      fetchJSON(`${API}/edition/type/transliteration`).catch(() => []),
      fetchJSON(`${API}/edition/type/versebyverse`).catch(() => [])
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

    // Reciters — start with whatever the small official list gives us right away
    // (usually just Alafasy + Husary), so the dropdown is never stuck loading.
    let reciters = resolveReciters(audioEditions || []);
    populateReciterSelect(reciters);

    // Restore preferences, or sensible defaults
    layoutSelect.value = prefs.layout || 'verse-translation';
    surahSelect.value = prefs.surah || 1;
    pageInput.value = prefs.page || 1;
    if (prefs.translation) translationSelect.value = prefs.translation;
    else {
      const enSahih = translations.find(t => t.identifier === 'en.sahih');
      if (enSahih) translationSelect.value = 'en.sahih';
    }
    if (prefs.reciter && reciters.some(r => r.identifier === prefs.reciter)) {
      reciterSelect.value = prefs.reciter;
    }
    transliterationToggle.checked = !!prefs.transliteration;

    toggleLayoutControls();
    await render();

    // Now, in the background, fetch the much bigger full-surah reciter
    // catalog (~100 names) and upgrade the dropdown once it's ready.
    // This never blocks or delays anything the user already sees.
    fetchReciterCatalog().then(catalogIds => {
      if (!catalogIds.length) return;
      const catalogReciters = resolveRecitersFromCatalog(catalogIds);
      if (catalogReciters.length > reciters.length) {
        reciters = catalogReciters;
        populateReciterSelect(reciters);
      }
    });

  } catch (err) {
    readerContent.innerHTML = `<div class="error-msg">Could not load the Qur'an right now. Check your internet connection and reload the page.</div>`;
    console.error(err);
  }
}

function toggleLayoutControls() {
  const layout = layoutSelect.value;
  const isMushaf = layout === 'mushaf-page';
  const isFullTranslation = layout === 'full-translation';
  surahWrap.style.display = isMushaf ? 'none' : 'block';
  pageWrap.style.display = isMushaf ? 'block' : 'none';
  translationWrap.style.display = isMushaf ? 'none' : 'block';
  transliterationWrap.style.display = (!transliterationAvailable || isMushaf || isFullTranslation) ? 'none' : 'flex';
  playSurahBtn.style.display = isMushaf ? 'none' : 'inline-flex';
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

function playAyah(globalAyahNumber, label) {
  const reciter = reciterSelect.value;
  nowPlayingLabel.textContent = label ? `Loading: ${label}…` : 'Loading verse…';
  ayahAudio.onerror = () => {
    nowPlayingLabel.textContent = `Per-verse audio isn't available for this reciter — try "Play full surah" instead, or pick another reciter.`;
    ayahAudio.onerror = null;
  };
  ayahAudio.src = `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyahNumber}.mp3`;
  ayahAudio.play()
    .then(() => { nowPlayingLabel.textContent = label || 'Playing verse…'; })
    .catch(() => {});
}

function playFullSurah() {
  const reciter = reciterSelect.value;
  const surahNum = surahSelect.value;
  const surahLabel = surahSelect.options[surahSelect.selectedIndex]
    ? surahSelect.options[surahSelect.selectedIndex].text
    : `Surah ${surahNum}`;

  nowPlayingLabel.textContent = `Loading full surah: ${surahLabel}…`;
  ayahAudio.onerror = () => {
    nowPlayingLabel.textContent = `Sorry — a full-surah recording isn't available for this reciter. Try another reciter, or use "Play verse" below instead.`;
    ayahAudio.onerror = null;
  };
  ayahAudio.src = `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surahNum}.mp3`;
  ayahAudio.play()
    .then(() => { nowPlayingLabel.textContent = `Playing full surah: ${surahLabel}`; })
    .catch(() => {});
}

function ayahRow(arabicText, translationText, transliterationText, ayahNumInSurah, globalNumber, showArabic, showTranslation, showTransliteration) {
  return `
    <div class="ayah-block">
      ${showArabic ? `<div class="ayah-arabic">${arabicText}<span class="ayah-number-tag">${ayahNumInSurah}</span></div>` : ''}
      ${showTransliteration && transliterationText ? `<div class="transliteration-line">${transliterationText}</div>` : ''}
      ${showTranslation ? `<div class="ayah-translation">${translationText}</div>` : ''}
      <div class="ayah-tools">
        <button class="play-btn" data-ayah="${globalNumber}" data-label="Playing verse ${ayahNumInSurah}">▶ Play verse</button>
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

    let bismillahBlock = '';
    if (surahNum != 1 && surahNum != 9) {
      bismillahBlock = `<div class="bismillah-block">
        <div class="ayah-arabic">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
      </div>`;
    }

    // 1. Show the centered top block for all Surahs EXCEPT Al-Fatiha (1) and Al-Tawbah (9)
const topHeader = (surahNum === 1 || surahNum === 9) ? '' : bismillahBlock;

readerContent.innerHTML = `<h2 style="font-size:1.4rem;">${combined[0].englishName} – ${combined[0].name}</h2>` +
  topHeader + 
  arabicAyahs.map((a, i) => {
    let arabicText = a.text.normalize("NFC");

    // 2. Safely remove the Bismillah from the first verse without relying on character lengths
    if (i === 0 && surahNum !== 1 && surahNum !== 9) {
      // This broad regex matches "Bismillah..." regardless of its exact character count or specific vowel markers
      const flexibleBismillahRegex = /^بِسْمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ\s*|^بِسْمِ.*?الرَّحِيمِ\s*/;
      
      // If it finds it at the very start, it replaces it with an empty string safely
      arabicText = arabicText.replace(flexibleBismillahRegex, '').trim();
    }

    return ayahRow(
      arabicText,
      translationAyahs[i] ? translationAyahs[i].text : '',
      transliterationAyahs && transliterationAyahs[i] ? transliterationAyahs[i].text : '',
      a.numberInSurah, a.number, true, showTranslation, showTranslit
    );
  }).join('');

attachPlayButtons();

  } catch (err) {
    readerContent.className = 'error-msg';
    readerContent.textContent = 'Something went wrong loading this passage. Please try a different selection or reload.';
    console.error(err);
  }
}

function attachPlayButtons() {
  readerContent.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', () => playAyah(btn.dataset.ayah, btn.dataset.label));
  });
}

layoutSelect.addEventListener('change', () => { toggleLayoutControls(); render(); });
surahSelect.addEventListener('change', render);
pageInput.addEventListener('change', render);
translationSelect.addEventListener('change', render);
transliterationToggle.addEventListener('change', render);
reciterSelect.addEventListener('change', () => savePrefs(currentPrefs()));
playSurahBtn.addEventListener('click', playFullSurah);

init();
