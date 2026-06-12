#!/usr/bin/env python3
with open('index.html', encoding='utf-8') as f:
    html = f.read()

# Remove the orphaned leftover text after the closing brace of reviewPageTextHtml
junk = '${ayah} …</div></div>`;\n'
if junk in html:
    html = html.replace(junk, '')
    print('Removed junk')
else:
    # Try without newline
    junk2 = '${ayah} …</div></div>`;'
    if junk2 in html:
        html = html.replace(junk2, '')
        print('Removed junk (no newline)')
    else:
        print('Junk not found, searching...')
        idx = html.find('${ayah}')
        print('Position:', idx)
        if idx >= 0:
            print('Context:', repr(html[idx-20:idx+60]))

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Done.')
