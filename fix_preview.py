#!/usr/bin/env python3
with open('index.html', encoding='utf-8') as f:
    html = f.read()

# Find the function and replace everything from the ayah/starts lines onward
old_marker = "  const starts=PAGE_SURAH_STARTS[item.page]||[];"
idx = html.find(old_marker)
if idx == -1:
    print("ERROR: marker not found")
    exit(1)

# Find the closing line of the function (the return statement + closing brace)
func_end = html.index("}", idx) + 1
pass  # print removed to avoid console encoding issues

# Replace from the marker to end of function with just the new return line
new_part = "  return `<div class=\"revision-prompt\"><div class=\"verse-preview\">${escapeHtml(words)} …</div></div>`;\n}"
html = html[:idx] + new_part + html[func_end:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Done.")
