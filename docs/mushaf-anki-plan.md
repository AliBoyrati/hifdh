# Mushaf-accurate spaced-repetition pages

This project already has the core SRS shell: memorised pages are stored locally, due cards are selected by page or compact surah cards, Quran text is fetched/cached, and the rating screen schedules the next review. To make the review page look like the standard Quran apps while still allowing verses/words to be hidden, separate the Quran page into two layers: a faithful mushaf presentation layer and an interactive masking layer.


## Feasibility decision

Yes, the goal is doable. The best path is not to choose between “Quran.com API” and “mushaf pages”; it is to combine them:

- **Use Quran.com / Quran Foundation metadata as the source of truth** for page boundaries, ayahs, words, line numbers, and QCF/QPC fields.
- **Use a deterministic mushaf renderer for the visual page** so the layout does not change from browser to browser.
- **Put the Anki behavior in an overlay layer** that hides/reveals ayahs, words, or lines while leaving SRS scheduling keyed by page/surah.

This is a better path than trying to make plain `text_uthmani` flow naturally inside a `<div>`, because normal browser Arabic layout will never be perfectly stable across every device. It is also a better path than using only static screenshots, because Quran.com word/line metadata gives the app enough structure for word-level and ayah-level recall prompts.

The practical MVP should be:

1. fetch or prebuild Quran.com page metadata with `mushaf=1`, `words=true`, and `line_number`,
2. render each page line-by-line with the matching QCF/QPC font fields,
3. add masks over full lines/ayahs/words,
4. keep the existing rating and due-date logic unchanged,
5. only move to full page SVG/WebP assets if the line-by-line font renderer is not visually close enough.

## Goal

Render pages that match a target printed/app mushaf as closely as possible, while still supporting Anki-style recall prompts such as hiding a whole ayah, hiding selected words, revealing on tap, and rating the page afterward.

## Recommended architecture

### 1. Pick one canonical mushaf target

Most Quran apps use a Madani 604-page layout, but exact typography varies by asset set and font. Choose one of these approaches and keep it consistent across the app:

- **Best visual match:** use page image/SVG assets for the exact 604 pages.
- **Best interactivity:** use line-by-line text with a matching Quran font and precomputed line breaks.
- **Best compromise:** render a page image/SVG underneath and place invisible/transparent ayah or word hitboxes on top for hiding/revealing.

For this app, the compromise is the safest path because it preserves the exact familiar page shape while giving the review engine clickable regions.

### 2. Store page geometry data

Add static metadata for each page:

```json
{
  "page": 2,
  "width": 1024,
  "height": 1600,
  "ayahs": [
    {
      "surah": 1,
      "ayah": 1,
      "bbox": [120, 180, 780, 70],
      "words": [
        { "index": 1, "bbox": [720, 180, 80, 70] }
      ]
    }
  ]
}
```

Use normalized coordinates or source-image pixels, then scale the overlay to the current screen size with CSS.

### 3. Replace free-flow text with fixed page rendering

The current app uses fetched Uthmani text and CSS justification. That is good for readable Quran text, but it cannot exactly match all Quran apps because browser text shaping, font availability, line width, and justification differ device-to-device. A fixed page renderer should instead render:

1. a page asset (`/mushaf/pages/002.svg` or `.webp`),
2. an absolutely positioned overlay layer,
3. mask elements over ayahs/words according to the current review mode.

### 4. Keep SRS cards separate from display assets

The spaced-repetition state should stay keyed by page/surah, not by image asset. The display layer should only answer: “for this review card, which page asset and which overlay regions do I render?” This keeps rating logic stable even if you later change fonts/assets.

### 5. Add reveal modes

Support multiple prompt types without changing scheduling:

- **Page cloze:** show the page with all text covered, then reveal by tap.
- **Ayah cloze:** hide one or more ayahs and show surrounding text.
- **Word cloze:** hide key words in the current ayah.
- **Start cue:** show only the first word/ayah marker and require recitation.

Each mode can produce a list of mask targets such as `{ page, surah, ayah, wordIndex }` and the renderer converts those targets into overlay rectangles.

### 6. Make it offline-first

Bundle the page assets and geometry files with the app shell, or precache them lazily after a page is selected for memorisation. If all 604 pages are too large for the initial install, cache only memorised pages and due pages first.

### 7. Use Quran.com / Quran Foundation data for text, words, and line grouping

Quran.com data is useful, but it solves a different part of the problem than pixel-perfect visual layout:

- Use `verses/by_page/{page}` for the page's ayahs, verse keys, page numbers, and Uthmani text.
- Add `words=true` and `word_fields=...` when you need word positions, line numbers, QCF glyph codes, or QPC Hafs text for word-level hiding.
- Use `mushaf=1` when you want the standard Madani/QCF layout family, and keep that mushaf id consistent everywhere.
- Use Pages Lookup when you need page boundaries for a chapter, juz, or verse range before loading individual pages.

That means Quran.com can provide the canonical data source for:

1. **which ayahs are on a page**,
2. **which line each word belongs to**,
3. **QCF/QPC glyph/text fields for Quran-specific font rendering**,
4. **word-level metadata for Anki-style masks**,
5. **translations/audio later, if the review flow needs them**.

However, the API does not remove the need for a deterministic renderer. If you render `text_uthmani` as normal browser text, it will still reflow differently across devices. To look like common Quran apps, use Quran.com word/line data with a fixed rendering strategy:

```js
const url = `${API_BASE}/verses/by_page/${page}?mushaf=1&words=true&word_fields=code_v2,text_qpc_hafs,page_number,line_number`;
```

Then group the returned words by `line_number`, render each line with the correct Quran font/glyph data, and place masks over whole lines, ayahs, or words. If exact app-like visuals are the top priority, still prefer bundled page SVG/WebP assets and use the API data to build/verify overlay targets.

For this static PWA, do not put Quran Foundation `client_secret` values in the browser. If using authenticated Quran Foundation endpoints, proxy them through a small backend or pre-build/cache the needed page metadata into static JSON. The existing unauthenticated `api.quran.com/api/v4` usage can remain a fallback while the app is migrated.

## Implementation steps

1. Add a `/mushaf/` asset folder with page SVG/WebP files and `/mushaf/meta/` JSON geometry.
2. Add a Quran.com/Quran Foundation metadata loader for `verses/by_page/{page}?mushaf=1&words=true&word_fields=code_v2,text_qpc_hafs,page_number,line_number`.
3. Pre-build or cache page metadata so the review flow works offline and does not expose API secrets in the browser.
4. Add a `MushafPage` renderer that receives `page`, `hiddenTargets`, and `revealedTargets`.
5. Change review rendering to call `MushafPage` instead of rendering fetched text directly.
6. Keep the existing fetch/cache text path as a fallback for pages without assets.
7. Add review-mode settings for page/ayah/word hiding.
8. Cache selected mushaf assets in the service worker.
9. Validate against screenshots from the target Quran app on the same page numbers.

## Practical note

If exact visual identity matters more than selectable text, do not rely on live browser text layout. Use fixed page assets plus overlays. If selectable/searchable text matters more, use a Quran font and precomputed line breaks, but expect small differences from popular Quran apps.
