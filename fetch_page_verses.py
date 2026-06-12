#!/usr/bin/env python3
"""
Fetch the first verse on every Quran page (1-604) from quran.com API
and replace PAGE_CONTINUATION_VERSE in index.html.
"""
import json
import time
import urllib.request

AR_NUMS = '٠١٢٣٤٥٦٧٨٩'

def to_arabic_num(n):
    return ''.join(AR_NUMS[int(d)] for d in str(n))

def fetch_page(page, retries=3):
    url = f'https://api.alquran.cloud/v1/page/{page}/quran-uthmani'
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
            else:
                raise

page_verses = {}
failed = []

for page in range(1, 605):
    try:
        data = fetch_page(page)
        ayahs = data.get('data', {}).get('ayahs', [])
        if not ayahs:
            print(f'  page {page}: no ayahs returned')
            failed.append(page)
            continue
        v = ayahs[0]
        text = v['text']
        ayah_num = v['numberInSurah']
        marker = '۝' + to_arabic_num(ayah_num)
        page_verses[page] = text + ' ' + marker
        if page % 50 == 0:
            print(f'  {page}/604 done')
    except Exception as e:
        print(f'  page {page}: ERROR {e}')
        failed.append(page)
    time.sleep(0.15)

print(f'\nFetched {len(page_verses)} pages. Failed: {failed}')

# Retry failed pages once more
for page in list(failed):
    try:
        time.sleep(1)
        data = fetch_page(page)
        ayahs = data.get('data', {}).get('ayahs', [])
        if ayahs:
            v = ayahs[0]
            text = v['text']
            ayah_num = v['numberInSurah']
            marker = '۝' + to_arabic_num(ayah_num)
            page_verses[page] = text + ' ' + marker
            failed.remove(page)
            print(f'  Retried page {page}: OK')
    except Exception as e:
        print(f'  Retried page {page}: still failed {e}')

# Build the new const string
lines = []
for k in sorted(page_verses.keys()):
    v = page_verses[k]
    escaped = v.replace('\\', '\\\\').replace('"', '\\"')
    lines.append(f'  {k}: "{escaped}"')

new_const = ('// First verse on every Quran page sourced from quran.com API.\n'
             'const PAGE_CONTINUATION_VERSE = {\n'
             + ',\n'.join(lines)
             + '\n};')

with open('index.html', encoding='utf-8') as f:
    html = f.read()

# Find and replace the old const
start_marker = 'const PAGE_CONTINUATION_VERSE = {'
idx = html.find(start_marker)
# Also handle comment line before it
comment_marker = '// First verse of every continuation'
cidx = html.rfind('\n', 0, idx)  # start of that line
# Go back further to grab any comment line
line_start = html.rfind('\n', 0, cidx) + 1
if html[line_start:].startswith('//'):
    idx = line_start

end_idx = html.index('};', idx) + 2
html = html[:idx] + new_const + html[end_idx:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Done! Wrote {len(page_verses)} entries. Still failed: {failed}')
