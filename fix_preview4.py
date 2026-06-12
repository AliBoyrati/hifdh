#!/usr/bin/env python3
with open('index.html', encoding='utf-8') as f:
    html = f.read()

# The function ends with }}\n — one } closes the function, the extra } is junk
# Find the specific location
marker = "return `<div class=\"revision-prompt\"><div class=\"verse-preview\">${escapeHtml(words)} …</div></div>`;\n}}"
replacement = "return `<div class=\"revision-prompt\"><div class=\"verse-preview\">${escapeHtml(words)} …</div></div>`;\n}"

if marker in html:
    html = html.replace(marker, replacement)
    print('Fixed double }}')
else:
    idx = html.find('escapeHtml(words)} ')
    print('Not found. Context:', repr(html[idx:idx+80]) if idx >= 0 else 'not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Done.')
