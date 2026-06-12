#!/usr/bin/env python3
"""
Generate a QuranKi Anki deck from index.html.

Install dependency:  pip install genanki
Run:                 python generate_deck.py
Output:              quranki.apkg  (import this file into Anki)
"""

import re
import sys
import genanki

# ── Parse data from index.html ────────────────────────────────────────────────

with open('index.html', encoding='utf-8') as f:
    html = f.read()


def read_str_dict(html, name):
    """Extract {int: "string", ...} JS constant -> Python dict."""
    idx = html.find('const ' + name)
    if idx == -1:
        return {}
    start = html.index('{', idx)
    end = html.index('};', start)
    content = html[start + 1:end]
    result = {}
    for m in re.finditer(r'(\d+)\s*:\s*"((?:[^"\\]|\\.)*)"', content):
        result[int(m.group(1))] = m.group(2).replace('\\"', '"')
    return result


def read_int_dict(html, name):
    """Extract {int: int, ...} JS constant -> Python dict."""
    idx = html.find('const ' + name)
    if idx == -1:
        return {}
    start = html.index('{', idx)
    end = html.index('};', start)
    content = html[start + 1:end]
    result = {}
    for m in re.finditer(r'(\d+)\s*:\s*(\d+)', content):
        result[int(m.group(1))] = int(m.group(2))
    return result


FIRST_VERSE    = read_str_dict(html, 'FIRST_VERSE')
PAGE_CONT      = read_str_dict(html, 'PAGE_CONTINUATION_VERSE')
SURAH_NAMES    = read_str_dict(html, 'SURAH_NAMES')
SURAH_NAMES_AR = read_str_dict(html, 'SURAH_NAMES_AR')
SURAH_STARTS   = read_int_dict(html, 'SURAH_STARTS')  # {surah -> first_page}

# Invert SURAH_STARTS to {page -> [surahs that start there]}
PAGE_SURAH_STARTS = {}
for surah, page in SURAH_STARTS.items():
    PAGE_SURAH_STARTS.setdefault(page, []).append(surah)

print('Loaded: {} surah openers, {} continuation verses, {} surah-start pages'.format(
    len(FIRST_VERSE), len(PAGE_CONT), len(PAGE_SURAH_STARTS)))

# ── Build page metadata ───────────────────────────────────────────────────────

def get_verse(page):
    """Match app logic: surah opener if a surah starts here, else continuation."""
    starts = PAGE_SURAH_STARTS.get(page, [])
    if starts:
        return FIRST_VERSE.get(starts[0], '')
    return PAGE_CONT.get(page, '')


def primary_surah(page):
    """The surah at the top of this page (walk back to find last surah start)."""
    for p in range(page, 0, -1):
        if p in PAGE_SURAH_STARTS:
            return PAGE_SURAH_STARTS[p][0]
    return 1


def first_words(text, n=5):
    return ' '.join(text.split()[:n])

# ── Anki card template ────────────────────────────────────────────────────────

CSS = """
.card {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0a0907;
  color: #f2ece4;
  text-align: center;
  padding: 32px 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.verse {
  font-family: 'Scheherazade New', 'Amiri Quran', 'Traditional Arabic',
               'Arabic Typesetting', 'Geeza Pro', serif;
  font-size: 36px;
  line-height: 2;
  direction: rtl;
  color: #f2ece4;
  margin-bottom: 14px;
}
.surah-ar {
  font-family: 'Scheherazade New', 'Amiri Quran', serif;
  font-size: 18px;
  color: #817669;
  direction: rtl;
  margin-bottom: 4px;
}
.surah-en {
  font-size: 14px;
  color: #5a5248;
  margin-bottom: 24px;
}
hr {
  border: none;
  border-top: 1px solid #24210f;
  width: 60%;
  margin: 24px auto;
}
.back-surah-ar {
  font-family: 'Scheherazade New', 'Amiri Quran', serif;
  font-size: 22px;
  color: #f2ece4;
  direction: rtl;
  font-weight: 700;
  margin-bottom: 4px;
}
.back-surah-en {
  font-size: 16px;
  color: #c5b8a9;
  margin-bottom: 8px;
}
.page-num {
  font-size: 13px;
  color: #5a5248;
}
"""

FRONT = """
<div class="verse">{{Verse}}</div>
<div class="surah-ar">{{SurahAr}}</div>
<div class="surah-en">{{SurahEn}}</div>
"""

BACK = """
<div class="verse">{{Verse}}</div>
<hr>
<div class="back-surah-ar">{{SurahAr}}</div>
<div class="back-surah-en">{{SurahEn}}</div>
<div class="page-num">Page {{Page}}</div>
"""

model = genanki.Model(
    1876543210,
    'QuranKi Page',
    fields=[
        {'name': 'Verse'},
        {'name': 'SurahAr'},
        {'name': 'SurahEn'},
        {'name': 'Page'},
    ],
    templates=[{
        'name': 'Card',
        'qfmt': FRONT,
        'afmt': BACK,
    }],
    css=CSS,
)

# ── Build deck ────────────────────────────────────────────────────────────────

deck = genanki.Deck(1234567890, 'QuranKi')

for page in range(1, 605):
    verse = get_verse(page)
    if not verse:
        continue

    surah = primary_surah(page)
    note = genanki.Note(
        model=model,
        fields=[
            first_words(verse, 5),
            SURAH_NAMES_AR.get(surah, ''),
            SURAH_NAMES.get(surah, 'Surah ' + str(surah)),
            str(page),
        ],
        tags=['quranki'],
    )
    deck.add_note(note)

genanki.Package(deck).write_to_file('quranki.apkg')
print('Done! quranki.apkg -- {} cards'.format(len(deck.notes)))
print('Import into Anki: File > Import > select quranki.apkg')
