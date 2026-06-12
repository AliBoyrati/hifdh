#!/usr/bin/env python3
"""
Fetch correct verse text from alquran.cloud API and update FIRST_VERSE in index.html.
"""
import json
import re
import time
import urllib.request
import urllib.error

AR_NUMS = '٠١٢٣٤٥٦٧٨٩'

def to_arabic_num(n):
    return ''.join(AR_NUMS[int(d)] for d in str(n))

def fetch_surah(n, retries=3):
    url = f'https://api.alquran.cloud/v1/surah/{n}/quran-uthmani'
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=10) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                raise

first_verses = {}

for surah_num in range(1, 115):
    data = fetch_surah(surah_num)
    ayahs = data['data']['ayahs']

    if surah_num == 1:
        # Surah 1: verse 1 is Basmala (actually verse 1 here), use verse 2 (Al-Hamdu)
        ayah = ayahs[1]
        text = ayah['text']
    else:
        ayah = ayahs[0]
        text = ayah['text']
        # The API prepends the Basmala to verse 1 of every surah.
        # Strip it: Basmala always starts with بِسْمِ and ends with حِيمِ
        # Find the end of the Basmala (first occurrence of حِيمِ) and strip.
        import re as _re
        if text.startswith('بِسْمِ'):
            m = _re.search(r'حِيمِ\s*', text)
            if m:
                text = text[m.end():].strip()

    verse_num = ayah['numberInSurah']
    marker = '۝' + to_arabic_num(verse_num)
    first_verses[surah_num] = text + ' ' + marker

    print(f'  {surah_num}/114 done')
    time.sleep(0.05)

print('\nAll fetched. Updating index.html...')

with open('index.html', encoding='utf-8') as f:
    html = f.read()

# Build new FIRST_VERSE dict string
lines = []
for k, v in first_verses.items():
    escaped = v.replace('\\', '\\\\').replace('"', '\\"')
    lines.append(f'  {k}: "{escaped}"')

new_dict = 'const FIRST_VERSE = {\n' + ',\n'.join(lines) + '\n};'

# Replace existing FIRST_VERSE const (from 'const FIRST_VERSE = {' to '};')
pattern = r'const FIRST_VERSE = \{[^}]*(?:\{[^}]*\}[^}]*)?\};'
# Use a more robust approach: find start, find matching };
idx = html.find('const FIRST_VERSE = {')
if idx == -1:
    print('ERROR: could not find FIRST_VERSE in index.html')
    exit(1)

end_idx = html.index('};', idx) + 2
html = html[:idx] + new_dict + html[end_idx:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Done! Updated {len(first_verses)} entries in FIRST_VERSE.')
