# QuranKi

QuranKi is an installable, offline-friendly Quran revision app that uses spaced repetition to help you track what to recite today.

## Project structure

QuranKi now keeps the app shell, styling, and application logic in separate files so it is easier to maintain and package for mobile stores:

- `index.html` — minimal document shell and metadata.
- `assets/styles.css` — app layout, controls, and Mushaf-inspired Quran page styling.
- `src/quran-data.js` — static Quran page, surah, juz, and prompt data.
- `src/app.js` — spaced-repetition state, screens, Quran rendering, and actions.
- `sw.js` — installable/offline app shell cache.

## Run locally

Serve the folder with any static web server, then open the local site in your browser. For example:

```bash
npm run dev
```

Then visit <http://localhost:4173>. You can also run `python3 -m http.server 4173` directly if you do not want to use npm.

## Install as an app

QuranKi includes a web app manifest and service worker, so supported mobile and desktop browsers can install it to the home screen or app launcher. After opening the local or hosted site, use your browser's **Install app** or **Add to Home Screen** option.
