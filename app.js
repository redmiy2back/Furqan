let currentChapter = 1;

// Auto-recovery configuration via local browser memory ($0 cost)
const savedChapter = localStorage.getItem("furqan_last_chapter");
if (savedChapter) {
    currentChapter = parseInt(savedChapter);
    document.getElementById("chapterInput").value = currentChapter;
}

const chapterInput = document.getElementById("chapterInput");
chapterInput.addEventListener("change", (e) => {
    let val = parseInt(e.target.value);
    if (val >= 1 && val <= 114) {
        currentChapter = val;
        localStorage.setItem("furqan_last_chapter", currentChapter);
        loadSurahData();
    }
});

// High-speed key interception hooks
window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && currentChapter < 114) {
        currentChapter++;
        updateWorkspaceUI();
    }
    if (e.key === "ArrowLeft" && currentChapter > 1) {
        currentChapter--;
        updateWorkspaceUI();
    }
});

function updateWorkspaceUI() {
    chapterInput.value = currentChapter;
    localStorage.setItem("furqan_last_chapter", currentChapter);
    loadSurahData();
}

async function loadSurahData() {
    const arabicContainer = document.getElementById("arabicContainer");
    const translationContainer = document.getElementById("content-translation");
    
    arabicContainer.innerHTML = `<p class="text-slate-500 text-sm animate-pulse">Streaming Arabic source script...</p>`;
    translationContainer.innerHTML = `<p class="text-slate-500 text-sm animate-pulse">Loading target translations...</p>`;

    try {
        const arRes = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranara/${currentChapter}.json`);
        const arData = await arRes.json();
        
        const enRes = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/eng-sahih/${currentChapter}.json`);
        const enData = await enRes.json();

        // Print Arabic script column
        arabicContainer.innerHTML = arData.chapter.map(ayah => `
            <div class="pb-6 border-b border-slate-900 last:border-none">
                <p class="text-right text-3xl leading-loose text-slate-200 font-serif" dir="rtl">
                    ${ayah.text}
                    <span class="text-xs bg-slate-800 text-emerald-400 font-mono px-2.5 py-1 rounded-full mr-3 select-none">${ayah.verse}</span>
                </p>
            </div>
        `).join('');

        // Print English translation column side-by-side
        translationContainer.innerHTML = enData.chapter.map(trans => `
            <div class="min-h-[76px] flex flex-col justify-center border-b border-slate-800/40 pb-6 last:border-none">
                <span class="text-xs font-mono text-emerald-500 mb-1">VERSE ${trans.verse}</span>
                <p class="text-slate-300 text-base leading-relaxed italic font-light">"${trans.text}"</p>
            </div>
        `).join('');

    } catch (err) {
        console.error("Data pipeline broken:", err);
        arabicContainer.innerHTML = `<p class="text-red-400 text-sm">Error connecting to network stream.</p>`;
    }
}

function switchTab(tabName) {
    const tabs = ['translation', 'hifz', 'roots'];
    tabs.forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).className = "flex-1 py-4 text-center border-b-2 font-medium tracking-wide uppercase text-xs border-transparent text-slate-400 hover:text-slate-200";
    });
    
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).className = "flex-1 py-4 text-center border-b-2 font-medium tracking-wide uppercase text-xs border-emerald-500 text-emerald-400 bg-slate-900/40";
}

// Kick off initialization
loadSurahData();
