#!/usr/bin/env python3
with open('index.html', encoding='utf-8') as f:
    html = f.read()

idx = html.find('${ayah}')
if idx >= 0:
    # Find the end of this orphaned line (closing brace of the duplicate function end)
    end = html.index('\n', idx + 1) + 1  # include the newline
    # Also grab the extra closing brace on the next line if present
    junk = html[idx:end]
    # The junk is: ${ayah} … </div></div>`;\n}\n  (we want to remove up to and including the })
    # Actually find the } that closes this orphan
    close = html.index('}', idx)
    end2 = html.index('\n', close) + 1
    remove = html[idx:end2]
    html = html[:idx] + html[end2:]
    print('Removed:', len(remove), 'chars')
else:
    print('Not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Done.')
