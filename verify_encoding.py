#!/usr/bin/env python3
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', encoding='utf-8') as f:
    html = f.read()

idx = html.find('const PAGE_CONTINUATION_VERSE = {')
if idx == -1:
    print("NOT FOUND")
else:
    sample = html[idx:idx+200]
    print("FOUND. First 200 chars:")
    print(sample)
    # Check for question marks vs Arabic
    arabic_count = sum(1 for c in sample if '؀' <= c <= 'ۿ')
    q_count = sample.count('?')
    print(f"\nArabic chars: {arabic_count}, Question marks: {q_count}")
