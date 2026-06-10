// Page → surahs that start on it
const PAGE_SURAH_STARTS = {};
for (const [n, sp] of Object.entries(SURAH_STARTS)) {
  if (!PAGE_SURAH_STARTS[sp]) PAGE_SURAH_STARTS[sp] = [];
  PAGE_SURAH_STARTS[sp].push(parseInt(n));
}

const SURAH_SORTED = Object.entries(SURAH_STARTS).map(([n,s])=>({num:parseInt(n),start:s})).sort((a,b)=>a.start!==b.start?a.start-b.start:a.num-b.num);

function getJuz(p)    { for(let i=JUZ_STARTS.length-1;i>=0;i--)if(p>=JUZ_STARTS[i])return i+1; return 1; }
function getSurah(p)  { let b=SURAH_SORTED[0]; for(const s of SURAH_SORTED){if(s.start<=p)b=s;else break;} return b.num; }
function getSurahPages(n){
  const s=SURAH_STARTS[n];
  // If the next surah starts on the same page, this short surah only occupies that one page.
  if(SURAH_STARTS[n+1]===s) return [s];
  const nx=Object.values(SURAH_STARTS).filter(p=>p>s).sort((a,b)=>a-b)[0];
  // Some surahs, including An-Naba', continue onto the same Madani page where the next
  // surah begins. PAGE_CONTINUATION_VERSE marks those mixed pages, so include that page
  // instead of cutting the surah off too early.
  const e=nx?(PAGE_CONTINUATION_VERSE[nx]?nx:nx-1):604;
  return Array.from({length:e-s+1},(_,i)=>s+i);
}
function surahsByJuz(){ const g={}; for(let s=1;s<=114;s++){const j=getJuz(SURAH_STARTS[s]);if(!g[j])g[j]=[];g[j].push(s);} return g; }
function getPageVerse(p, targetSurah=null){
  const starts=PAGE_SURAH_STARTS[p];
  if(targetSurah&&getSurahPages(targetSurah).includes(p)){
    if(starts&&starts.includes(targetSurah))return FIRST_VERSE[targetSurah]||null;
    return PAGE_CONTINUATION_VERSE[p]||FIRST_VERSE[targetSurah]||null;
  }
  if(starts&&starts.length)return FIRST_VERSE[starts[0]]||null;
  return PAGE_CONTINUATION_VERSE[p]||null;
}

function formatPageRuns(pages){
  const sorted=[...new Set(pages)].sort((a,b)=>a-b);
  if(!sorted.length)return 'Page —';
  const runs=[];let start=sorted[0],end=sorted[0];
  for(let i=1;i<sorted.length;i++){
    if(sorted[i]===end+1)end=sorted[i];
    else{runs.push(start===end?`${start}`:`${start}-${end}`);start=end=sorted[i];}
  }
  runs.push(start===end?`${start}`:`${start}-${end}`);
  return `Page ${runs.join(', ')}`;
}

function summarizeEntriesBySurah(entries){
  const bySurah={};
  for(const entry of entries){
    const surah=entry.surah||getSurah(entry.page);
    const pages=entry.cardType==='surah'?getSurahPages(surah):[entry.page];
    if(!bySurah[surah])bySurah[surah]=new Set();
    pages.forEach(p=>bySurah[surah].add(p));
  }
  return Object.keys(bySurah).map(Number).sort((a,b)=>a-b).map(s=>`${SURAH_NAMES[s]} · ${formatPageRuns([...bySurah[s]])}`);
}

function pagesForRatingSurah(surah){
  if(!surah)return [];
  const current=S.ratingQueue[S.ratingIdx];
  if(current&&current.cardType==='surah'&&current.surah===surah)return getSurahPages(surah);
  const pages=S.ratingQueue.filter(i=>i.surah===surah&&i.cardType!=='surah').map(i=>i.page);
  return pages.length?pages:[current?.page].filter(Boolean);
}

function pageSection(p){const starts=PAGE_SURAH_STARTS[p];return starts&&starts.length?Math.min(...starts):getSurah(p);}
function groupPages(pages){ const g={}; for(const p of pages){const j=getJuz(p),s=pageSection(p);if(!g[j])g[j]={};if(!g[j][s])g[j][s]=[];g[j][s].push(p);} return g; }
function sectionLabel(sectionKey,pages){const all=new Set();for(const p of pages){const st=PAGE_SURAH_STARTS[p];if(st&&st.length)st.forEach(s=>all.add(s));else all.add(sectionKey);}return[...all].sort((a,b)=>a-b).map(s=>SURAH_NAMES[s]).join(' · ');}

// Short surah = multiple surahs share its start page (e.g. Al-Ikhlas, Al-Falaq, An-Nas all on page 604)
function isShortSurah(s){ return (PAGE_SURAH_STARTS[SURAH_STARTS[s]]||[]).length>1; }
// Surahs shorter than 3 pages are reviewed as one surah-level card instead of page-by-page.
function isSurahCard(s){ return getSurahPages(s).length<3; }
function isWholeSurahMemorized(s,pages=S.pages){const sp=getSurahPages(s);return sp.length>0&&sp.every(p=>pages.includes(p));}
function getMemorizedShortSurahs(pages){ const r=new Set(); for(const p of pages) for(const s of (PAGE_SURAH_STARTS[p]||[])) if(isShortSurah(s))r.add(s); return[...r]; }

function buildRatingQueue(duePages) {
  const queue = [], seenSurahs = new Set(), seenPages = new Set();
  const addSurahPages=s=>{
    if(seenSurahs.has(s)||S.retiredSurahs.has(s)||!S.surahCards[s])return;
    seenSurahs.add(s);
    getSurahPages(s).forEach(p=>{
      seenPages.add(p);
      queue.push({page:p,surah:s,cardType:'surah'});
    });
  };
  for (const p of duePages) {
    if(seenPages.has(p))continue;
    const starts = PAGE_SURAH_STARTS[p] || [];
    const here = starts.filter(s=>isSurahCard(s)&&isWholeSurahMemorized(s));
    if (here.length>0) {
      here.forEach(addSurahPages);
      continue;
    }
    const s=getSurah(p);
    if(isSurahCard(s)&&isWholeSurahMemorized(s))addSurahPages(s);
    else {seenPages.add(p);queue.push({page:p,surah:s,cardType:'page'});}
  }
  return queue;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEY_CARDS='hifdh_v1', KEY_PAGES='hifdh_pages', KEY_SETTINGS='hifdh_settings', KEY_RETIRED='hifdh_retired';
const KEY_SURAH_CARDS='hifdh_surah_v1', KEY_SURAH_RETIRED='hifdh_surah_retired', KEY_SURAH_REMOVED='hifdh_surah_removed';
const KEY_PAGE_TEXT='hifdh_page_text_cache_quran_com_v1';
const KEY_PAGE_META='hifdh_page_meta_cache_quran_com_v1';
const DEFAULT_PAGES=[];
const DEFAULT_SETTINGS={
  forgotDays:1,struggledDays:3,easyDays:10,forgotLabel:'Forgot',struggledLabel:'Struggled',easyLabel:'Easy',darkMode:true,
  mushafFontSize:26,mushafLineHeight:1.85,mushafTextColor:'#21170f',mushafPageColor:'#fbf4df',mushafAyahColor:'#8a6a3a'
};

const loadSettings=()=>{
  const r=localStorage.getItem(KEY_SETTINGS);
  const raw=r?JSON.parse(r):{};
  if(raw.struggledDays===undefined&&raw.hardDays!==undefined)raw.struggledDays=raw.hardDays;
  return {...DEFAULT_SETTINGS,...raw};
};
const saveSettings=s=>localStorage.setItem(KEY_SETTINGS,JSON.stringify(s));
const loadPageTextCache=()=>{try{return JSON.parse(localStorage.getItem(KEY_PAGE_TEXT)||'{}')||{};}catch{return{};}};
const savePageTextCache=cache=>localStorage.setItem(KEY_PAGE_TEXT,JSON.stringify(cache));
const loadPageMetaCache=()=>{try{return JSON.parse(localStorage.getItem(KEY_PAGE_META)||'{}')||{};}catch{return{};}};
const savePageMetaCache=cache=>localStorage.setItem(KEY_PAGE_META,JSON.stringify(cache));
const loadPages=()=>{const r=localStorage.getItem(KEY_PAGES);if(r)return JSON.parse(r);const p=[...DEFAULT_PAGES];localStorage.setItem(KEY_PAGES,JSON.stringify(p));return p;};
const savePages=p=>localStorage.setItem(KEY_PAGES,JSON.stringify([...p].sort((a,b)=>a-b)));
const loadCards=()=>{const r=localStorage.getItem(KEY_CARDS);return r?JSON.parse(r):{};};
const saveCards=c=>localStorage.setItem(KEY_CARDS,JSON.stringify(c));
const loadRetired=()=>{const r=localStorage.getItem(KEY_RETIRED);return r?new Set(JSON.parse(r)):new Set();};
const saveRetired=()=>localStorage.setItem(KEY_RETIRED,JSON.stringify([...S.retired]));
const loadSurahCards=()=>{const r=localStorage.getItem(KEY_SURAH_CARDS);return r?JSON.parse(r):{};};
const saveSurahCards=c=>localStorage.setItem(KEY_SURAH_CARDS,JSON.stringify(c));
const loadSurahRetired=()=>{const r=localStorage.getItem(KEY_SURAH_RETIRED);return r?new Set(JSON.parse(r)):new Set();};
const saveSurahRetired=()=>localStorage.setItem(KEY_SURAH_RETIRED,JSON.stringify([...S.retiredSurahs]));
const loadRemovedSurahs=()=>{const r=localStorage.getItem(KEY_SURAH_REMOVED);return r?new Set(JSON.parse(r)):new Set();};
const saveRemovedSurahs=()=>localStorage.setItem(KEY_SURAH_REMOVED,JSON.stringify([...S.removedSurahs]));

function ensureCards(cards,pages){const t=today();let ch=false;for(const p of pages){if(!cards[p]){cards[p]={interval:0,ease:2.5,reps:0,due:t};ch=true;}}if(ch)saveCards(cards);return cards;}
// Only creates cards for explicitly listed surahs — never auto-discovers from shared pages
function ensureSurahCards(cards,pages,explicit=[]){const t=today();let ch=false;for(const s of explicit){if(!cards[s]&&!S.removedSurahs.has(s)){cards[s]={interval:0,ease:2.5,reps:0,due:t};ch=true;}}if(ch)saveSurahCards(cards);return cards;}
function ensureCompactSurahCards(cards,pages){
  let ch=false;
  for(let s=1;s<=114;s++){
    if(!isSurahCard(s)||!isWholeSurahMemorized(s,pages)||S.removedSurahs.has(s))continue;
    if(!cards[s]){
      const pageCards=getSurahPages(s).map(p=>S.cards[p]).filter(Boolean);
      const due=pageCards.map(c=>c.due).filter(Boolean).sort()[0]||today();
      cards[s]={interval:0,ease:2.5,reps:0,due};
      ch=true;
    }
  }
  if(ch)saveSurahCards(cards);
  return cards;
}

function getDue(cards,pages){
  const t=today(), due=[], seenSurahs=new Set();
  for(const p of pages){
    if(S.retired.has(p))continue;
    const starts=PAGE_SURAH_STARTS[p]||[];
    const surahStarts=starts.filter(s=>isSurahCard(s)&&isWholeSurahMemorized(s,pages));
    if(surahStarts.length){
      for(const s of surahStarts){
        if(!seenSurahs.has(s)&&!S.retiredSurahs.has(s)&&S.surahCards[s]&&S.surahCards[s].due<=t){
          seenSurahs.add(s);
          due.push(SURAH_STARTS[s]);
        }
      }
      continue;
    }
    const s=getSurah(p);
    if(isSurahCard(s)&&isWholeSurahMemorized(s,pages)){
      if(!seenSurahs.has(s)&&!S.retiredSurahs.has(s)&&S.surahCards[s]&&S.surahCards[s].due<=t){
        seenSurahs.add(s);
        due.push(SURAH_STARTS[s]);
      }
      continue;
    }
    if(cards[p]&&cards[p].due<=t)due.push(p);
  }
  return due;
}

function getUpcomingEntries(){
  const entries=[], seenSurahs=new Set();
  const add=(due, page, surah, cardType='page')=>{if(due)entries.push({due,page,surah,cardType});};
  for(const p of S.pages){
    if(S.retired.has(p))continue;
    const starts=PAGE_SURAH_STARTS[p]||[];
    const compactStarts=starts.filter(s=>isSurahCard(s)&&isWholeSurahMemorized(s));
    if(compactStarts.length){
      compactStarts.forEach(s=>{
        if(!seenSurahs.has(s)&&!S.retiredSurahs.has(s)){
          seenSurahs.add(s);
          add(S.surahCards[s]?.due,SURAH_STARTS[s],s,'surah');
        }
      });
      continue;
    }
    const s=getSurah(p);
    if(isSurahCard(s)&&isWholeSurahMemorized(s)){
      if(!seenSurahs.has(s)&&!S.retiredSurahs.has(s)){
        seenSurahs.add(s);
        add(S.surahCards[s]?.due,SURAH_STARTS[s],s,'surah');
      }
      continue;
    }
    add(S.cards[p]?.due,p,s,'page');
  }
  return entries;
}
function getUpcoming(){
  return getUpcomingEntries().reduce((acc,e)=>{if(!acc[e.due])acc[e.due]=0;acc[e.due]++;return acc;},{});
}
function getUpcomingByDate(){
  return getUpcomingEntries().reduce((acc,e)=>{if(!acc[e.due])acc[e.due]=[];acc[e.due].push(e);return acc;},{});
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function today(){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function addDays(ds,n){const d=new Date(ds+'T00:00:00');d.setDate(d.getDate()+n);const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function ordinal(n){const v=n%100;if(v>=11&&v<=13)return `${n}th`;return `${n}${['th','st','nd','rd'][Math.min(n%10,4)]||'th'}`;}
function formatDate(ds){
  if(!ds)return '—';
  const d=new Date(ds+'T00:00:00');
  return `${d.toLocaleDateString('en-GB',{weekday:'long'})}, ${ordinal(d.getDate())} of ${d.toLocaleDateString('en-GB',{month:'long'})}`;
}
function intervalLabel(days){if(days<=1)return'Tomorrow';if(days<7)return`${days} days`;if(days===7)return'1 week';if(days<14)return`${days} days`;if(days<30)return`${Math.round(days/7)} weeks`;if(days<60)return'1 month';return`${Math.round(days/30)} months`;}
function settingIntervalLabel(days){return `${days} day${days===1?'':'s'}`;}
function escapeHtml(value){return String(value).replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));}
function escapeAttr(value){return escapeHtml(value).replace(/'/g,'&#39;');}

function calcInterval(card,rating,settings){
  let{ease,reps}=card;
  if(rating===1)return{interval:settings.forgotDays,ease:Math.max(1.3,ease-0.2),reps:0};
  const interval=rating===2?settings.struggledDays:settings.easyDays;
  const ne=rating===2?Math.max(1.3,ease-0.15):Math.min(3.0,ease+0.1);
  return{interval,ease:ne,reps:reps+1};
}
function applyRating(card,rating,settings,reviewed=today()){const r=calcInterval(card,rating,settings);return{...r,due:addDays(reviewed,r.interval),lastReviewed:reviewed};}
function previewLabels(_card,settings){return{1:settingIntervalLabel(settings.forgotDays),2:settingIntervalLabel(settings.struggledDays),3:settingIntervalLabel(settings.easyDays)};}
function ratingNames(settings){return{1:(settings.forgotLabel||DEFAULT_SETTINGS.forgotLabel).trim()||DEFAULT_SETTINGS.forgotLabel,2:(settings.struggledLabel||DEFAULT_SETTINGS.struggledLabel).trim()||DEFAULT_SETTINGS.struggledLabel,3:(settings.easyLabel||DEFAULT_SETTINGS.easyLabel).trim()||DEFAULT_SETTINGS.easyLabel};}

// ─── State ────────────────────────────────────────────────────────────────────
const S={
  screen:'home', pages:loadPages(), cards:{}, settings:loadSettings(), retired:loadRetired(),
  surahCards:{}, retiredSurahs:loadSurahRetired(), removedSurahs:loadRemovedSurahs(),
  ratingQueue:[], ratingIdx:0, ratingDate:null, pageRatings:{}, surahRatings:{}, ratingHistory:[], pendingRating:null, moreScrollY:0, openJuzs:new Set(),
  pageTextCache:loadPageTextCache(), pageMetaCache:loadPageMetaCache(), loadingPageTexts:new Set(), pageTextErrors:new Set(),
  revealedReviewPages:new Set(),
  selectMode:false, selectedForRating:new Set(),
  selectedSurah:null, selection:new Set(),
};
S.cards=ensureCards(loadCards(),S.pages);
S.surahCards=loadSurahCards(); // Cards are created only when explicitly added, never auto-discovered
S.surahCards=ensureCompactSurahCards(S.surahCards,S.pages);

// ─── Actions ──────────────────────────────────────────────────────────────────
function goHome()        {S.screen='home';     S.selectMode=false; S.selectedForRating=new Set(); render();}
function goMore()        {S.screen='more';     render();}
function goSurahPicker() {S.screen='surahPicker'; render();}
function openSurah(n){
  const sp=getSurahPages(n);
  if(sp.length===1){
    const p=sp[0];
    if(isSurahCard(n)){
      // Compact surah card — add only (removal is via × button)
      if(!S.pages.includes(p)){S.pages=[...S.pages,p].sort((a,b)=>a-b);savePages(S.pages);}
      S.removedSurahs.delete(n);saveRemovedSurahs();
      S.cards=ensureCards(S.cards,S.pages);S.surahCards=ensureSurahCards(S.surahCards,S.pages,[n]);
      saveCards(S.cards);saveSurahCards(S.surahCards);render();
    } else if(S.pages.includes(p)){
      showModal(`Remove ${SURAH_NAMES[n]}?`,`Page ${p} will be removed from your revision list.`,'Remove',true,()=>{
        S.pages=S.pages.filter(x=>x!==p);savePages(S.pages);render();
      });
    } else {
      S.pages=[...S.pages,p].sort((a,b)=>a-b);S.cards=ensureCards(S.cards,S.pages);
      savePages(S.pages);saveCards(S.cards);render();
    }
  } else {
    S.moreScrollY=window.scrollY;
    S.selectedSurah=n;S.selection=new Set(sp.filter(p=>S.pages.includes(p)));S.screen='pagePicker';render();
  }
}
function applyTheme(){
  document.body.classList.toggle('dark',!!S.settings.darkMode);
  document.querySelector('meta[name="theme-color"]').setAttribute('content',S.settings.darkMode?'#17130f':'#f5f1eb');
}
function autoSaveSetting(key,val,el){const days=Math.max(1,parseInt(val)||1);S.settings[key]=days;saveSettings(S.settings);if(el){const unit=el.parentElement?.querySelector('.setting-unit');if(unit)unit.textContent=days===1?'day':'days';}}
function autoSaveTextSetting(key,val){S.settings[key]=String(val).trim().slice(0,24)||DEFAULT_SETTINGS[key];saveSettings(S.settings);render();}
function autoSaveNumberSetting(key,val,min,max,el){const num=Math.min(max,Math.max(min,parseFloat(val)||DEFAULT_SETTINGS[key]));S.settings[key]=num;saveSettings(S.settings);if(el){const out=el.parentElement?.querySelector('.setting-unit');if(out)out.textContent=key==='mushafLineHeight'?num.toFixed(2):`${Math.round(num)}px`;}}
function autoSaveColorSetting(key,val){if(/^#[0-9a-f]{6}$/i.test(val)){S.settings[key]=val;saveSettings(S.settings);}}
function resetMushafAppearance(){['mushafFontSize','mushafLineHeight','mushafTextColor','mushafPageColor','mushafAyahColor'].forEach(k=>S.settings[k]=DEFAULT_SETTINGS[k]);saveSettings(S.settings);render();}
function toggleDarkMode(){S.settings.darkMode=!S.settings.darkMode;saveSettings(S.settings);applyTheme();render();}
function normalizePageText(text){return String(text||'').replace(/\s+/g,' ').trim();}
function toArabicIndicNumber(value){return String(value).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);}
function ayahMark(number){return `<span class="ayah-mark" aria-label="Ayah ${number}">﴿${toArabicIndicNumber(number)}﴾</span>`;}
function stripHtml(value){const el=document.createElement('div');el.innerHTML=String(value||'');return normalizePageText(el.textContent||'');}
function pageTextHasAyahMarks(value){return /class=["']ayah-mark["']|﴿[٠-٩0-9]+﴾/.test(String(value||''));}
const BASMALA_RE=/^((?:بِسْمِ|بسم)\s+(?:[ٱا]?للَّهِ|الله)\s+(?:[ٱا]?لرَّحْمَـ?ٰنِ|الرحمن)\s+(?:[ٱا]?لرَّحِيمِ|الرحيم))(?:\s+|$)/u;
function formatQuranComAyahText(value){
  const text=normalizePageText(value);
  const match=text.match(BASMALA_RE);
  if(!match)return escapeHtml(text);
  const rest=normalizePageText(text.slice(match[0].length));
  return `<span class="basmala-line">${escapeHtml(match[1])}</span>${rest?escapeHtml(rest):''}`;
}
function formatPageAyahs(ayahs){
  return ayahs.map(a=>{
    const text=a.text_uthmani||a.text||'';
    const number=a.verse_number||a.numberInSurah;
    return normalizePageText(text)&&number?`${formatQuranComAyahText(text)} ${ayahMark(number)}`:'';
  }).filter(Boolean).join(' ');
}
function currentReviewPages(item){return [item.page];}
function getCachedPageText(page){
  const text=normalizePageText(S.pageTextCache[page]);
  return pageTextHasAyahMarks(text)?text:escapeHtml(text);
}
function getCachedPageMeta(page){
  const meta=S.pageMetaCache[page];
  return meta&&Array.isArray(meta.lines)&&meta.lines.length?meta:null;
}
function mushafStyle(){
  const s=S.settings;
  return `--mushaf-font-size:${s.mushafFontSize||DEFAULT_SETTINGS.mushafFontSize}px;--mushaf-line-height:${s.mushafLineHeight||DEFAULT_SETTINGS.mushafLineHeight};--mushaf-text-color:${s.mushafTextColor||DEFAULT_SETTINGS.mushafTextColor};--mushaf-page-color:${s.mushafPageColor||DEFAULT_SETTINGS.mushafPageColor};--mushaf-ayah-color:${s.mushafAyahColor||DEFAULT_SETTINGS.mushafAyahColor}`;
}
function wordText(word){return normalizePageText(word.text_qpc_hafs||word.text_uthmani||word.text||word.code_v2||word.char_type_name||'');}
function isEndWord(word){return /end/i.test(String(word.char_type_name||''));}
function wordLineNumber(word, fallback=1){return parseInt(word.line_number||word.line||fallback)||fallback;}
function verseKeyParts(key){const [s,a]=String(key||'').split(':').map(n=>parseInt(n));return{surah:s||0,ayah:a||0};}
function normalizeQuranComPage(data,page){
  const lines=[];
  const addWord=(line,word)=>{if(!lines[line-1])lines[line-1]=[];lines[line-1].push(word);};
  (data.verses||[]).forEach(verse=>{
    const parts=verseKeyParts(verse.verse_key);
    const words=Array.isArray(verse.words)?verse.words.filter(w=>w&&wTextOk(w)):[];
    if(words.length){
      let lastLine=1;
      words.forEach(w=>{
        const line=wordLineNumber(w,lastLine);
        lastLine=line;
        const text=wordText(w);
        if(!text)return;
        addWord(line,{text, surah:parts.surah, ayah:parts.ayah, word:w.position||w.id||0, end:isEndWord(w)});
      });
      if(!words.some(isEndWord))addWord(lastLine,{text:parts.ayah, surah:parts.surah, ayah:parts.ayah, end:true});
    } else {
      const text=normalizePageText(verse.text_uthmani||verse.text_qpc_hafs||verse.text||'');
      if(text)addWord(lines.length+1,{text, surah:parts.surah, ayah:parts.ayah, fallback:true});
      if(parts.ayah)addWord(lines.length||1,{text:parts.ayah, surah:parts.surah, ayah:parts.ayah, end:true});
    }
  });
  const cleanLines=lines.filter(Boolean).map(words=>({words}));
  return cleanLines.length?{page,source:'quran.com',lines:cleanLines}:null;
}
function wTextOk(w){return !!wordText(w)&&!['pause','rub-el-hizb'].includes(String(w.char_type_name||'').toLowerCase());}
function renderMushafMetaPage(page,meta){
  const hidden=!S.revealedReviewPages.has(page);
  const lineHtml=meta.lines.slice(0,15).map(line=>{
    const words=(line.words||[]).map(w=>w.end?`<span class="mushaf-ayah-end">${ayahMark(w.text)}</span>`:`<span class="mushaf-word" data-ayah="${w.surah||''}:${w.ayah||''}">${escapeHtml(w.text)}</span>`).join('');
    const short=(line.words||[]).length<5?' short':'';
    return `<div class="mushaf-line${short}">${words}</div>`;
  }).join('');
  return `<div class="mushaf-page structured${hidden?' hidden':''}" style="${mushafStyle()}" aria-label="Quran page ${page}"><div class="mushaf-page-number">${toArabicIndicNumber(page)}</div><div class="mushaf-frame">${lineHtml}</div></div>${hidden?`<div class="mushaf-reveal-row"><button class="show-words-btn" onclick="revealReviewPage(${page})">Reveal page</button></div>`:''}`;
}
function reviewPageTextHtml(item){
  const pages=currentReviewPages(item);
  const metas=pages.map(p=>({page:p,meta:getCachedPageMeta(p)}));
  if(metas.every(t=>t.meta))return `<div class="mushaf-pages${pages.length>1?' multi-page':''}" aria-label="Quran page text">${metas.map(t=>renderMushafMetaPage(t.page,t.meta)).join('')}</div>`;
  const texts=pages.map(p=>({page:p,text:getCachedPageText(p)}));
  if(!texts.every(t=>t.text))return '';
  return `<div class="mushaf-pages${pages.length>1?' multi-page':''}" aria-label="Quran page text">${texts.map(t=>`<div class="mushaf-page" style="${mushafStyle()}" aria-label="Quran page ${t.page}">${t.text}</div>`).join('')}</div>`;
}
function fetchPageText(p){
  if((getCachedPageMeta(p)||S.pageTextCache[p])||S.loadingPageTexts.has(p)||S.pageTextErrors.has(p))return;
  S.pageTextErrors.delete(p);
  S.loadingPageTexts.add(p);
  const alQuranCloud=`https://api.alquran.cloud/v1/page/${p}/quran-uthmani`;
  const quranCom=`https://api.quran.com/api/v4/verses/by_page/${p}?mushaf=1&words=true&word_fields=code_v2,text_qpc_hafs,text_uthmani,page_number,line_number&fields=text_uthmani&per_page=50`;
  const pageFromAlQuranCloud=()=>fetch(alQuranCloud)
    .then(r=>r.ok?r.json():Promise.reject())
    .then(data=>({text:formatPageAyahs(data.data?.ayahs||[])}));
  const pageFromQuranCom=()=>fetch(quranCom)
    .then(r=>r.ok?r.json():Promise.reject())
    .then(data=>({meta:normalizeQuranComPage(data,p),text:formatPageAyahs(data.verses||[])}));

  pageFromQuranCom()
    .catch(pageFromAlQuranCloud)
    .then(result=>{
      const meta=result.meta;
      const clean=normalizePageText(result.text);
      if(meta){S.pageMetaCache[p]=meta;savePageMetaCache(S.pageMetaCache);}
      if(clean){S.pageTextCache[p]=clean;savePageTextCache(S.pageTextCache);}
      if(!meta&&!clean)S.pageTextErrors.add(p);
    })
    .catch(()=>{S.pageTextErrors.add(p);})
    .finally(()=>{S.loadingPageTexts.delete(p);if(S.screen==='rating')render();});
}
function ensureReviewText(item){currentReviewPages(item).forEach(fetchPageText);}
function revealReviewPage(page){S.revealedReviewPages.add(page);render();}
function retryCurrentReviewText(){
  const item=S.ratingQueue[S.ratingIdx];
  if(!item)return;
  currentReviewPages(item).forEach(p=>S.pageTextErrors.delete(p));
  ensureReviewText(item);
  render();
}

function toggleSelectMode(){S.selectMode=!S.selectMode;S.selectedForRating=new Set();render();}
function toggleSelectPage(p){S.selectedForRating.has(p)?S.selectedForRating.delete(p):S.selectedForRating.add(p);render();}

function startRating(pagesToRate=null){
  const due=pagesToRate||getDue(S.cards,S.pages);
  S.ratingQueue=buildRatingQueue(due);
  S.ratingIdx=0;S.ratingDate=today();S.pageRatings={};S.surahRatings={};S.ratingHistory=[];S.pendingRating=null;S.revealedReviewPages=new Set();
  S.selectMode=false;S.selectedForRating=new Set();
  S.screen='rating';render();
}
function goBackFromRating(){
  if(S.ratingIdx>0){undoLastRating();render();return;}
  exitRating();
}
function previousRating(){
  if(S.ratingIdx>0){undoLastRating();render();}
}
function exitRating(){
  S.screen='home'; S.ratingQueue=[]; S.ratingIdx=0; S.ratingDate=null; S.pageRatings={}; S.surahRatings={}; S.ratingHistory=[]; S.pendingRating=null; S.revealedReviewPages=new Set(); render();
}
function startRatingSingle(p){
  S.ratingQueue=buildRatingQueue([p]);
  S.ratingIdx=0;S.ratingDate=today();S.pageRatings={};S.surahRatings={};S.ratingHistory=[];S.pendingRating=null;S.revealedReviewPages=new Set();
  S.selectMode=false;
  S.screen='rating';render();
}

function selectRating(r){rate(r);}
function nextRating(){if(!S.pendingRating)return;rate(S.pendingRating);}
function rate(r){
  const item=S.ratingQueue[S.ratingIdx];
  S.ratingHistory.push({
    item:{...item}, rating:r,
    previous:item.cardType==='surah'?{...S.surahCards[item.surah]}:{...S.cards[item.page]}
  });
  if(item.cardType==='surah'){
    if(!S.surahRatings[item.surah])S.surahRatings[item.surah]=[];
    S.surahRatings[item.surah].push(r);
    const hasMoreSurahPages=S.ratingQueue.slice(S.ratingIdx+1).some(next=>next.cardType==='surah'&&next.surah===item.surah);
    if(!hasMoreSurahPages){
      const finalRating=Math.min(...S.surahRatings[item.surah]);
      S.surahCards[item.surah]=applyRating(S.surahCards[item.surah],finalRating,S.settings,S.ratingDate||today());
      saveSurahCards(S.surahCards);
    }
  } else {
    if(!S.pageRatings[item.page])S.pageRatings[item.page]=[];
    S.pageRatings[item.page].push(r);
    S.cards[item.page]=applyRating(S.cards[item.page],r,S.settings,S.ratingDate||today());
    saveCards(S.cards);
  }
  S.ratingIdx++;
  S.pendingRating=null;S.revealedReviewPages=new Set();
  if(S.ratingIdx>=S.ratingQueue.length){
    S.screen='home';
    S.ratingQueue=[];
    S.ratingIdx=0;
    S.ratingDate=null;
    S.pageRatings={};
    S.surahRatings={};
    S.ratingHistory=[];
    render();
    return;
  }
  render();
}

function undoLastRating(){
  const h=S.ratingHistory.pop();
  if(!h)return;
  if(h.item.cardType==='surah'){
    S.surahCards[h.item.surah]=h.previous;
    if(S.surahRatings[h.item.surah]){S.surahRatings[h.item.surah].pop();if(!S.surahRatings[h.item.surah].length)delete S.surahRatings[h.item.surah];}
    saveSurahCards(S.surahCards);
  } else {
    S.cards[h.item.page]=h.previous;
    if(S.pageRatings[h.item.page]){S.pageRatings[h.item.page].pop();if(!S.pageRatings[h.item.page].length)delete S.pageRatings[h.item.page];}
    saveCards(S.cards);
  }
  S.ratingIdx=Math.max(0,S.ratingIdx-1);
  S.pendingRating=h.rating;
  S.screen='rating';
}

function togglePage(p){S.selection.has(p)?S.selection.delete(p):S.selection.add(p);render();}
function savePagePicker(){
  const sp=getSurahPages(S.selectedSurah);
  S.pages=[...S.pages.filter(p=>!sp.includes(p)),...Array.from(S.selection)].sort((a,b)=>a-b);
  S.cards=ensureCards(S.cards,S.pages);
  // Compact surahs get one surah-level card once the whole surah is selected
  if(isSurahCard(S.selectedSurah)&&isWholeSurahMemorized(S.selectedSurah,S.pages)){
    S.removedSurahs.delete(S.selectedSurah);saveRemovedSurahs();
    S.surahCards=ensureSurahCards(S.surahCards,S.pages,[S.selectedSurah]);
  }
  S.surahCards=ensureCompactSurahCards(S.surahCards,S.pages);
  savePages(S.pages);saveCards(S.cards);saveSurahCards(S.surahCards);S.screen='more';render();
}
function removePage(p){
  showModal(`Remove page ${p}?`,`This page will be deleted from your list entirely.`,'Remove',true,()=>{
    S.pages=S.pages.filter(x=>x!==p);savePages(S.pages);render();
  });
}
function retirePage(p){
  showModal(`Retire page ${p}?`,`It won't appear in future revisions. You can restore it from the manage screen anytime.`,'Retire',false,()=>{
    S.retired.add(p);saveRetired();render();
  });
}
function unretirePage(p){S.retired.delete(p);saveRetired();render();}
function retireSurah(s){
  showModal(`Retire ${SURAH_NAMES[s]}?`,`It won't appear in future revisions. Restore it from the manage screen anytime.`,'Retire',false,()=>{
    S.retiredSurahs.add(s);saveSurahRetired();render();
  });
}
function unretireSurah(s){S.retiredSurahs.delete(s);saveSurahRetired();render();}
function retireAllSurahPages(s){
  showModal(`Retire ${SURAH_NAMES[s]}?`,`All pages will be hidden from future revisions.`,'Retire',false,()=>{
    getSurahPages(s).filter(p=>S.pages.includes(p)).forEach(p=>S.retired.add(p));saveRetired();render();
  });
}
function removeAllSurahPages(s){
  showModal(`Remove ${SURAH_NAMES[s]}?`,`All pages will be removed from your list.`,'Remove',true,()=>{
    const mp=getSurahPages(s).filter(p=>S.pages.includes(p));
    S.pages=S.pages.filter(p=>!mp.includes(p));
    if(isSurahCard(s)){delete S.surahCards[s];S.removedSurahs.add(s);saveSurahCards(S.surahCards);saveRemovedSurahs();}
    savePages(S.pages);render();
  });
}
function removeShortSurah(s){
  showModal(`Remove ${SURAH_NAMES[s]}?`,`It will be deleted from your revision list.`,'Remove',true,()=>{
    const pg=SURAH_STARTS[s];
    delete S.surahCards[s];
    S.removedSurahs.add(s);
    saveSurahCards(S.surahCards);
    saveRemovedSurahs();
    // If no tracked short surahs remain on this page, remove the page too
    const remaining=(PAGE_SURAH_STARTS[pg]||[]).filter(x=>S.surahCards[x]&&!S.removedSurahs.has(x));
    if(remaining.length===0){S.pages=S.pages.filter(x=>x!==pg);savePages(S.pages);}
    render();
  });
}


function showModal(title, msg, confirmLabel, _danger, onConfirm){
  const el=document.createElement('div');
  el.className='modal-overlay';
  el.innerHTML=`<div class="modal">
    <p class="modal-title">${title}</p>
    ${msg?`<p class="modal-msg">${msg}</p>`:''}
    <div class="modal-actions">
      <button class="modal-confirm" id="mc-ok">${confirmLabel}</button>
      <button class="modal-cancel" id="mc-cancel">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  const close=()=>document.body.removeChild(el);
  el.querySelector('#mc-ok').onclick=()=>{close();onConfirm();};
  el.querySelector('#mc-cancel').onclick=close;
  el.addEventListener('click',e=>{if(e.target===el)close();});
}

function hardReset(){
  showModal('Reset all progress?','This cannot be undone.','Reset',true,()=>{
    [KEY_CARDS,KEY_PAGES,KEY_SETTINGS,KEY_RETIRED,KEY_SURAH_CARDS,KEY_SURAH_RETIRED,KEY_SURAH_REMOVED,KEY_PAGE_TEXT,KEY_PAGE_META].forEach(k=>localStorage.removeItem(k));
    S.pages=[...DEFAULT_PAGES];S.settings={...DEFAULT_SETTINGS};S.retired=new Set();S.retiredSurahs=new Set();S.removedSurahs=new Set();
    S.cards=ensureCards({},S.pages);S.surahCards={};S.pageTextCache={};S.pageMetaCache={};S.loadingPageTexts=new Set();S.pageTextErrors=new Set();S.revealedReviewPages=new Set();saveSurahCards(S.surahCards);S.screen='home';render();
  });
}

// ─── Renderers ────────────────────────────────────────────────────────────────

// Compact overview cards — one per Juz, shows surah names inline
function renderDueOverview(duePages){
  if(!duePages.length)return'';
  const byJuz={};
  for(const p of duePages){const j=getJuz(p);if(!byJuz[j])byJuz[j]=[];byJuz[j].push(p);}
  return Object.keys(byJuz).map(Number).sort((a,b)=>a-b).map(juz=>{
    const pages=byJuz[juz];
    const surahMap={};
    for(const p of pages){
      const starts=PAGE_SURAH_STARTS[p];
      if(starts&&starts.length){
        for(const s of starts){
          // For short surahs (shared page), only include if user has actually tracked this surah
          if(isShortSurah(s)&&(!S.surahCards[s]||S.removedSurahs.has(s)))continue;
          if(!surahMap[s])surahMap[s]=[];surahMap[s].push(p);
        }
      } else{const s=getSurah(p);if(!surahMap[s])surahMap[s]=[];surahMap[s].push(p);}
    }
    // Group consecutive surah numbers into runs, show as "First → Last"
    const surahNums=Object.keys(surahMap).map(Number).sort((a,b)=>a-b);
    const runs=[];let rs=surahNums[0],re=surahNums[0];
    for(let i=1;i<surahNums.length;i++){if(surahNums[i]===re+1){re=surahNums[i];}else{runs.push([rs,re]);rs=re=surahNums[i];}}
    runs.push([rs,re]);
    const lines=[];
    for(const[s,e]of runs){
      if(s===e){
        if(getSurahPages(s).length>4){
          // Long surah — format due pages as consecutive ranges, one line per run
          lines.push(`${SURAH_NAMES[s]} · ${formatPageRuns(surahMap[s])}`);
        } else {
          lines.push(SURAH_NAMES[s]);
        }
      } else {
        lines.push(`${SURAH_NAMES[s]} → ${SURAH_NAMES[e]}`);
      }
    }
    return`<div class="juz-overview-card" onclick="startRating([${pages.join(',')}])">
      <div class="juz-overview-top">
        <span class="juz-overview-label">Juz ${juz}</span>
        <span class="juz-overview-count">${pages.length} page${pages.length>1?'s':''} ›</span>
      </div>
      <div class="juz-overview-surahs">${lines.join('<br>')}</div>
    </div>`;
  }).join('');
}

function renderUpcomingList(dates, upcomingByDate, t=today()){
  return dates.map(d=>{
    const entries=(upcomingByDate[d]||[]).sort((a,b)=>a.page-b.page||a.surah-b.surah);
    const count=entries.length;
    const detail=summarizeEntriesBySurah(entries).join('<br>');
    const dateLabel=d===t?'Today (retry)':formatDate(d);
    return`<div class="upcoming-item">
      <div class="upcoming-main">
        <div class="upcoming-date">${dateLabel}</div>
        ${detail?`<div class="upcoming-detail">${detail}</div>`:''}
      </div>
      <span class="upcoming-count">${count} page${count>1?'s':''}</span>
    </div>`;
  }).join('');
}


// Expanded checkbox list for select mode
function renderSelectList(duePages){
  if(!duePages.length)return'';
  const groups=groupPages(duePages);
  const juzNums=Object.keys(groups).map(Number).sort((a,b)=>a-b);
  return juzNums.map(juz=>`<div class="juz-block"><p class="juz-label">Juz ${juz}</p>
    ${Object.keys(groups[juz]).map(Number).sort((a,b)=>a-b).map(s=>`<div class="surah-block">
      <p class="surah-label">${SURAH_NAMES[s]}</p>
      <ul class="page-list">${groups[juz][s].map(p=>{
        const sel=S.selectedForRating.has(p);
        return`<li class="due-item${sel?' sel':''}" onclick="toggleSelectPage(${p})">
          <span class="due-name">Page ${p}</span>
          <span class="due-check">${sel?'✓':''}</span></li>`;
      }).join('')}</ul></div>`).join('')}
    </div>`).join('');
}

// Manage page list — grouped, with retire + delete
function renderManageList(pages, retired=false){
  if(!pages.length)return'<p style="color:var(--ink-3);font-size:14px;padding:8px 0">None.</p>';
  const groups=groupPages(pages);
  const juzNums=Object.keys(groups).map(Number).sort((a,b)=>a-b);
  const t=today();
  return juzNums.map(juz=>{
    const surahNums=Object.keys(groups[juz]).map(Number).sort((a,b)=>a-b);
    return`<div class="juz-block"><p class="juz-label">Juz ${juz}</p>
      ${surahNums.map(sectionKey=>{
        const sectionPages=groups[juz][sectionKey];
        // Check if this section contains short surahs
        const allSurahs=[];
        for(const p of sectionPages) for(const s of (PAGE_SURAH_STARTS[p]||[])) if(!allSurahs.includes(s))allSurahs.push(s);
        const hasShort=allSurahs.some(s=>isShortSurah(s));
        if(isSurahCard(sectionKey)&&isWholeSurahMemorized(sectionKey)&&S.surahCards[sectionKey]){
          const pg=getSurahPages(sectionKey);
          const pgLabel=pg.length>1?`Pages ${pg[0]} → ${pg[pg.length-1]}`:`Page ${pg[0]}`;
          if(retired){
            if(!S.retiredSurahs.has(sectionKey))return'';
            return`<div class="surah-block"><p class="surah-label">${SURAH_NAMES[sectionKey]}</p><ul class="page-list"><li class="page-item retired-item"><span class="page-num-main">${pgLabel}</span><div class="page-meta"><span class="retired-tag">Retired</span><span class="restore-btn" onclick="unretireSurah(${sectionKey})">restore</span></div></li></ul></div>`;
          }
          if(S.retiredSurahs.has(sectionKey))return'';
          const d=S.surahCards[sectionKey]?.due;
          const dueTag=d?(d<=t?`<span class="page-due-now">Due</span>`:`<span class="page-due-tag">${d}</span>`):'';
          return`<div class="surah-block"><p class="surah-label">${SURAH_NAMES[sectionKey]}</p><ul class="page-list"><li class="page-item"><span class="page-num-main">${pgLabel}</span><span class="page-item-verse">${FIRST_VERSE[sectionKey]||''}</span><div class="page-meta">${dueTag}<span class="retire-btn" onclick="retireSurah(${sectionKey})">retire</span><span class="delete-btn" onclick="removeAllSurahPages(${sectionKey})">×</span></div></li></ul></div>`;
        }

        if(hasShort){
          // Group short surahs by their shared page, use page number as the section header
          const shortPage=sectionPages.find(p=>(PAGE_SURAH_STARTS[p]||[]).some(s=>isShortSurah(s)));
          const shortSurahs=allSurahs.filter(s=>isShortSurah(s)).sort((a,b)=>a-b);
          const shortRows=shortSurahs.map(s=>{
            const pg=SURAH_STARTS[s];
            if(retired){
              if(!S.retiredSurahs.has(s))return'';
              return`<li class="page-item retired-item"><span class="page-surah-name">${SURAH_NAMES[s]}</span><div class="page-meta"><span class="retired-tag">Retired</span><span class="restore-btn" onclick="unretireSurah(${s})">restore</span></div></li>`;
            }
            if(S.retiredSurahs.has(s))return'';
            const d=S.surahCards[s]?.due;
            const dueTag=d?(d<=t?`<span class="page-due-now">Due</span>`:`<span class="page-due-tag">${d}</span>`):'';
            const sv=FIRST_VERSE[s]||'';
            return`<li class="page-item"><span class="page-surah-name">${SURAH_NAMES[s]}</span><span class="page-item-verse">${sv}</span><div class="page-meta">${dueTag}<span class="retire-btn" onclick="retireSurah(${s})">retire</span><span class="delete-btn" onclick="removeShortSurah(${s})">×</span></div></li>`;
          }).join('');
          if(!shortRows)return'';
          return`<div class="surah-block"><p class="surah-label">Page ${shortPage}</p><ul class="page-list">${shortRows}</ul></div>`;
        }

        // Normal section: page-level rows with surah label header
        return`<div class="surah-block"><p class="surah-label">${sectionLabel(sectionKey,sectionPages)}</p>
          <ul class="page-list">${sectionPages.map(p=>{
            const v=getPageVerse(p,sectionKey)||'';
            if(retired){
              return`<li class="page-item retired-item"><span class="page-num-main">${p}</span><span class="page-item-verse">${v}</span><div class="page-meta"><span class="retired-tag">Retired</span><span class="restore-btn" onclick="unretirePage(${p})">restore</span></div></li>`;
            }
            const d=S.cards[p]?.due;
            const dueTag=d?(d<=t?`<span class="page-due-now">Due</span>`:`<span class="page-due-tag">${d}</span>`):'';
            return`<li class="page-item"><span class="page-num-main">${p}</span><span class="page-item-verse">${v}</span><div class="page-meta">${dueTag}<span class="retire-btn" onclick="retirePage(${p})">retire</span><span class="delete-btn" onclick="removePage(${p})">×</span></div></li>`;
          }).join('')}</ul></div>`;
      }).join('')}
      </div>`;
  }).join('');
}

// ─── Render ───────────────────────────────────────────────────────────────────
function hiddenWordsPattern(text,minCount=3){
  const words=stripHtml(text).split(/\s+/).filter(Boolean);
  const count=Math.max(words.length,minCount);
  return Array.from({length:count},(_,i)=>i%3===2?'••••••':'••••').join(' ');
}
function hiddenPagePattern(){return hiddenWordsPattern('',120);}

function render(){
  applyTheme();
  if(S.screen==='more'){
    S.moreScrollY=window.scrollY;
    S.openJuzs=new Set([...document.querySelectorAll('.juz-details[open]')].map(el=>parseInt(el.querySelector('.juz-summary-num').textContent.replace('Juz ',''))));
  }
  const app=document.getElementById('app');
  const due=getDue(S.cards,S.pages);
  const t=today();

  // HOME
  if(S.screen==='home'){
    const upcomingByDate=getUpcomingByDate();
    const futureDates=Object.keys(upcomingByDate).filter(d=>d>t).sort().slice(0,3);

    app.innerHTML=`<div class="top-bar"><h1>QuranKi</h1><button class="top-btn" onclick="goMore()"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="2" y1="5" x2="18" y2="5"/><line x1="2" y1="10" x2="18" y2="10"/><line x1="2" y1="15" x2="18" y2="15"/><circle cx="7" cy="5" r="2.2" fill="var(--bg)"/><circle cx="13" cy="10" r="2.2" fill="var(--bg)"/><circle cx="8" cy="15" r="2.2" fill="var(--bg)"/></svg></button></div>
      <div class="home-content">
        ${due.length?`<section class="section-block">
          <p class="label">Due today</p>
          ${renderDueOverview(due)}
          <button class="btn btn-primary" style="margin-top:24px" onclick="startRating()">Start revision</button>
        </section>`:''}
        ${futureDates.length?`<section class="section-block"><p class="label">Coming up</p>
          ${renderUpcomingList(futureDates,upcomingByDate,t)}</section>`:''}
      </div>`;
    return;
  }

  // MORE — unified surah list (add + manage) + settings
  if(S.screen==='more'){
    const{forgotDays,struggledDays,easyDays,forgotLabel,struggledLabel,easyLabel,darkMode,mushafFontSize,mushafLineHeight,mushafTextColor,mushafPageColor,mushafAyahColor}=S.settings;
    const groups=surahsByJuz(),juzNums=Object.keys(groups).map(Number).sort((a,b)=>a-b);
    function surahRowHtml(s){
      const sp=getSurahPages(s);
      const isCompact=isSurahCard(s);
      const allMem=sp.filter(p=>S.pages.includes(p));
      const isMemorized=allMem.length>0||(isCompact&&S.surahCards[s]&&!S.removedSurahs.has(s));
      const isFullyMemorized=isCompact?isWholeSurahMemorized(s)&&S.surahCards[s]&&!S.removedSurahs.has(s):allMem.length===sp.length;
      const left=`<div class="surah-row-left"><span class="surah-row-num">${s}</span><span class="surah-row-name">${SURAH_NAMES[s]}</span></div>`;

      // Not memorized at all → tap to add
      if(!isMemorized)
        return`<div class="surah-row tappable" onclick="openSurah(${s})">${left}<span class="surah-progress">${sp.length} pg</span></div>`;

      // Partially memorized multi-page → show progress, tap to manage
      if(!isFullyMemorized)
        return`<div class="surah-row tappable" onclick="openSurah(${s})">${left}<span class="surah-progress partial">${allMem.length} / ${sp.length} ›</span></div>`;

      // Compact surahs (under 3 pages) use one surah-level SRS card.
      if(isCompact){
        if(S.retiredSurahs.has(s))
          return`<div class="surah-row">${left}<div class="page-meta"><span class="retired-tag">Retired</span><span class="restore-btn" onclick="unretireSurah(${s})">restore</span></div></div>`;
        const d=S.surahCards[s]?.due;
        const st=d&&d<=t?`<span class="page-due-now">Due</span>`:`<span class="surah-progress done">✓</span>`;
        const removeAction=isShortSurah(s)?`removeShortSurah(${s})`:`removeAllSurahPages(${s})`;
        return`<div class="surah-row">${left}<div class="page-meta">${st}<span class="retire-btn" onclick="retireSurah(${s})">retire</span><span class="delete-btn" onclick="${removeAction}">×</span></div></div>`;
      }
      // Multi-page fully memorized
      const allRetired=allMem.every(p=>S.retired.has(p));
      if(allRetired)
        return`<div class="surah-row">${left}<div class="page-meta"><span class="retired-tag">Retired</span><span class="restore-btn" onclick="allMem.forEach(p=>unretirePage(p));render()">restore</span></div></div>`;
      const anyDue=allMem.some(p=>S.cards[p]?.due<=t);
      const st=anyDue?`<span class="page-due-now">Due</span>`:`<span class="surah-progress done">✓</span>`;
      return`<div class="surah-row">${left}<div class="page-meta">${st}<span class="retire-btn" onclick="retireAllSurahPages(${s})">retire</span><span class="delete-btn" onclick="removeAllSurahPages(${s})">×</span></div></div>`;
    }
    const surahRows=juzNums.map(juz=>{
      const juzSurahs=groups[juz];
      const juzStart=JUZ_STARTS[juz-1];
      const juzEnd=JUZ_STARTS[juz]?JUZ_STARTS[juz]-1:604;
      const totalJuzPages=juzEnd-juzStart+1;
      const memJuzPages=S.pages.filter(p=>p>=juzStart&&p<=juzEnd).length;
      const hint=memJuzPages>0?`${memJuzPages}/${totalJuzPages} Pages`:`${totalJuzPages} Pages`;
      const rowsHtml=juzSurahs.map(s=>surahRowHtml(s)).join('');
      return`<details class="juz-details"${S.openJuzs.has(juz)?' open':''}\><summary class="juz-summary"><div class="juz-summary-left"><span class="juz-summary-num">Juz ${juz}</span><span class="juz-summary-surahs">${hint}</span></div><span class="juz-summary-arrow">›</span></summary><div class="juz-details-body">${rowsHtml}</div></details>`;
    }).join('');
    app.innerHTML=`<div style="margin-bottom:32px"><button class="back-btn" onclick="goHome()"><svg width="9" height="16" viewBox="0 0 9 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1L1 8L8 15"/></svg></button></div>
      <p class="section-title">Revision intervals</p>

      <div class="settings-card">
        <div class="setting-row"><input class="interval-name-input" aria-label="Rename first interval" type="text" maxlength="24" value="${escapeAttr(forgotLabel)}" onblur="autoSaveTextSetting('forgotLabel',this.value)"/><div class="setting-right"><input class="days-input" type="number" inputmode="numeric" min="1" max="365" value="${forgotDays}" oninput="autoSaveSetting('forgotDays',this.value,this)"/><span class="setting-unit">${forgotDays===1?'day':'days'}</span></div></div>
        <div class="setting-row"><input class="interval-name-input" aria-label="Rename second interval" type="text" maxlength="24" value="${escapeAttr(struggledLabel)}" onblur="autoSaveTextSetting('struggledLabel',this.value)"/><div class="setting-right"><input class="days-input" type="number" inputmode="numeric" min="1" max="365" value="${struggledDays}" oninput="autoSaveSetting('struggledDays',this.value,this)"/><span class="setting-unit">${struggledDays===1?'day':'days'}</span></div></div>
        <div class="setting-row"><input class="interval-name-input" aria-label="Rename third interval" type="text" maxlength="24" value="${escapeAttr(easyLabel)}" onblur="autoSaveTextSetting('easyLabel',this.value)"/><div class="setting-right"><input class="days-input" type="number" inputmode="numeric" min="1" max="365" value="${easyDays}" oninput="autoSaveSetting('easyDays',this.value,this)"/><span class="setting-unit">${easyDays===1?'day':'days'}</span></div></div>
      </div>
      <p class="section-title" style="margin-top:32px">Appearance</p>
      <div class="settings-card">
        <div class="setting-row"><span class="setting-label">Dark mode</span><button class="theme-toggle${darkMode?' on':''}" onclick="toggleDarkMode()" aria-label="Toggle dark mode" aria-pressed="${darkMode?'true':'false'}"><span class="theme-toggle-knob"></span></button></div>
        <div class="setting-row"><span class="setting-label">Quran text size</span><div class="setting-right"><input class="range-input" aria-label="Quran text size" type="range" min="20" max="44" step="1" value="${mushafFontSize}" oninput="autoSaveNumberSetting('mushafFontSize',this.value,20,44,this)"/><span class="setting-unit">${Math.round(mushafFontSize)}px</span></div></div>
        <div class="setting-row"><span class="setting-label">Quran line height</span><div class="setting-right"><input class="range-input" aria-label="Quran line height" type="range" min="1.5" max="2.8" step="0.05" value="${mushafLineHeight}" oninput="autoSaveNumberSetting('mushafLineHeight',this.value,1.5,2.8,this)"/><span class="setting-unit">${Number(mushafLineHeight).toFixed(2)}</span></div></div>
        <div class="setting-row"><span class="setting-label">Text color</span><input class="color-input" aria-label="Quran text color" type="color" value="${escapeAttr(mushafTextColor)}" oninput="autoSaveColorSetting('mushafTextColor',this.value)"/></div>
        <div class="setting-row"><span class="setting-label">Page color</span><input class="color-input" aria-label="Quran page color" type="color" value="${escapeAttr(mushafPageColor)}" oninput="autoSaveColorSetting('mushafPageColor',this.value)"/></div>
        <div class="setting-row"><span class="setting-label">Ayah number color</span><input class="color-input" aria-label="Ayah number color" type="color" value="${escapeAttr(mushafAyahColor)}" oninput="autoSaveColorSetting('mushafAyahColor',this.value)"/></div>
        <div class="setting-row"><span class="setting-label">Reset Quran style</span><button class="top-btn" onclick="resetMushafAppearance()">Reset</button></div>
      </div>
      <p class="section-title" style="margin-top:48px">Surahs</p><div>${surahRows}</div>
      <span class="reset-link" onclick="hardReset()">reset all progress</span>`;
    requestAnimationFrame(()=>window.scrollTo(0,S.moreScrollY));
    return;
  }

  // PAGE PICKER
  if(S.screen==='pagePicker'){
    const sn=S.selectedSurah,pages=getSurahPages(sn);
    const added=Array.from(S.selection).filter(p=>!S.pages.includes(p)).length;
    const removed=S.pages.filter(p=>pages.includes(p)&&!S.selection.has(p)).length;
    let btnLabel='Save';
    if(added>0&&removed>0)btnLabel=`Add ${added}, remove ${removed}`;
    else if(added>0)btnLabel=`Add ${added} page${added>1?'s':''}`;
    else if(removed>0)btnLabel=`Remove ${removed} page${removed>1?'s':''}`;
    app.innerHTML=`<div class="top-bar"><button class="top-btn" onclick="goMore()"><svg width="9" height="16" viewBox="0 0 9 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1L1 8L8 15"/></svg></button><h1>${SURAH_NAMES[sn]}</h1></div>
      <p class="date" style="margin-bottom:24px">Tap pages you've memorised</p>
      <ul class="page-list" style="margin-bottom:24px">${pages.map(p=>{
        const c=S.selection.has(p);
        const v=getPageVerse(p, S.selectedSurah);
        return`<li class="pick-item${c?' checked':''}" onclick="togglePage(${p})">
          <span class="pick-check">${c?'✓':''}</span>
          <span class="pick-num">${p}</span>
          <span class="pick-verse">${v||''}</span>
        </li>`;
      }).join('')}</ul>
      <button class="btn btn-primary" onclick="savePagePicker()">${btnLabel}</button>
      <button class="btn btn-ghost" onclick="goMore()">Cancel</button>`;
    return;
  }

  // RATING
  if(S.screen==='rating'){
    const item=S.ratingQueue[S.ratingIdx];
    const{page,surah}=item;
    const prog=S.ratingIdx+1,total=S.ratingQueue.length;
    const card=item.cardType==='surah'?(S.surahCards[surah]||{interval:0,ease:2.5,reps:0,due:today()}):S.cards[page];
    const preview=previewLabels(card,S.settings);
    const names=ratingNames(S.settings);
    ensureReviewText(item);
    const reviewPages=currentReviewPages(item);
    const reviewFailed=reviewPages.some(p=>S.pageTextErrors.has(p));
    const loadingHtml='<p class="page-text-loading">Loading Quran page…</p>';
    const errorHtml='<div class="revision-prompt"><p class="page-text-loading">Could not load the Quran page. Check your connection and try again.</p><button class="show-words-btn" onclick="retryCurrentReviewText()">Retry</button></div>';
    const promptHtml=reviewPageTextHtml(item)||(reviewFailed?errorHtml:loadingHtml);
    const pagesLeft=Math.max(0,total-prog);
    const pageStatus=`Page ${page} · ${pagesLeft} page${pagesLeft===1?'':'s'} left in this revision`;
    app.innerHTML=`<div class="rating-screen"><div class="top-bar"><button class="back-btn" onclick="exitRating()" title="Exit revision" aria-label="Exit revision"><svg width="9" height="16" viewBox="0 0 9 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1L1 8L8 15"/></svg></button><p class="progress-text" style="margin:0">${prog} / ${total}</p><span aria-hidden="true"></span></div>
      <div class="rating-main">
        <div class="rating-surah-name">${SURAH_NAMES[surah]}</div>
        ${promptHtml}
        <div class="revision-page-status">${pageStatus}</div>
      </div>
      <div class="rating-nav">
        <button class="rating-arrow" onclick="previousRating()" title="Previous surah" aria-label="Previous surah"${S.ratingIdx>0?'':' disabled'}><svg width="9" height="16" viewBox="0 0 9 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1L1 8L8 15"/></svg></button>
        <div class="rating-options">
          <button class="r-btn${S.pendingRating===1?' selected':''}" onclick="selectRating(1)"><span class="r-label">${escapeHtml(names[1])}</span><span class="r-when">${preview[1]}</span></button>
          <button class="r-btn${S.pendingRating===2?' selected':''}" onclick="selectRating(2)"><span class="r-label">${escapeHtml(names[2])}</span><span class="r-when">${preview[2]}</span></button>
          <button class="r-btn${S.pendingRating===3?' selected':''}" onclick="selectRating(3)"><span class="r-label">${escapeHtml(names[3])}</span><span class="r-when">${preview[3]}</span></button>
        </div>
        <button class="rating-arrow" onclick="nextRating()" title="Next surah" aria-label="Next surah"${S.pendingRating?'':' disabled'}><svg width="9" height="16" viewBox="0 0 9 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L8 8L1 15"/></svg></button>
      </div></div>`;
    return;
  }

  // DONE screen is intentionally skipped; finishing revision returns home automatically.
  if(S.screen==='done'){
    goHome();
    return;
  }
}

applyTheme();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
