# Atheos, as a local web app

A local copy of the content from **Atheos 1.0.32** (`Atheos_1.0.32_APKPure.apk`), which no longer installs on Android.
It was an Ionic/Cordova app, so the APK already held the whole app as HTML/JS. Nothing was retyped or converted:
both pages below read the app's own data file, `original/js/build/root_loader.js`.

## Run it

Online: **https://rmngorelov.github.io/atheos/** (GitHub Pages, works on a phone).

Locally: double-click `start.bat`. It starts a small local server and opens http://127.0.0.1:8765/. Close the window to stop the server.

Or from a terminal in this folder:

```
python -m http.server 8765 --bind 127.0.0.1
```

## What's here

| Path | What it is |
| --- | --- |
| `index.html` + `viewer/` | **Study Viewer.** Browse every level, quiz and dialogue with all answers and explanations, practice quizzes one question at a time (branching dialogues included), and read the essays, references and glossary. Includes full-text search. |
| `original/` | **The original app**, extracted unchanged from the APK except for the two edits below. Open it from the viewer's sidebar ("Play the original app"). |

### Content

- 10 cave levels, 77 quizzes (18 of them branching dialogues), 978 questions, about 3,700 answer choices with explanations
- 49 essays, 17 organizations, 132 references (books, videos, podcasts, articles), 98 glossary terms
- Intro and outro screens, team credits, terms

## Changes to the original app

- `original/index.html`: a Content-Security-Policy that blocks all network access. On launch the app checked
  `atheos-app.com` and, if that server reported a newer version, **replaced its content with whatever it sent**. The app is
  abandoned, so there's no telling who serves that domain now; the local copy stays offline. Firebase (comments and counts)
  is blocked the same way.
- `original/web-shim.js` (new): unlocks levels 2-10, which were sold through an in-app purchase that no longer exists,
  and keeps the Firebase SDK from retrying.

Features that needed the dead backend don't work in the original: comments, trending counts, Twitter search, sharing and the store.
Everything you can study is in the Study Viewer.

## Notes

- Practice scores, the theme and the "hide answers" setting are saved in your browser's local storage, per browser.
- Links in the content (YouTube, Amazon, author sites) open in a new tab and are from 2016, so some may be dead.
