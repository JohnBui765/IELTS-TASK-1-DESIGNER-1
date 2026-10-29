# Task 1 Studio

An iPhone-first web app for **IELTS Academic Writing Task 1**. It makes tasks
(line graphs, bar charts, pie charts, tables, maps, processes and two-chart
tasks), works out the language each one needs from its own figures, and helps
you memorise that language with spaced repetition. It also times and checks your
writing. It installs to the Home Screen and works fully offline.

## What it does

- **Generate tasks** offline, instantly, with the real IELTS wording. There are
  36 chart topics, eight processes and nine map settings. Time frames vary on
  purpose (a finished period, a projection, a typical day, a single year), so
  you practise choosing the tense.
- **Edit the data**: drag a point, a bar or a pie boundary, or type into a
  table. The language updates as you go.
- **Model language for every task**: introduction, overview and details,
  computed from the data. It covers trend verbs and adverbs, prepositions with
  figures, comparisons, fractions, the tense the time frame needs, and map
  changes and positions. Each sentence has one key chunk to learn; **Hide key
  words** turns it into a self-test, and tapping a sentence reads it aloud.
- **Knowledge bank**: about 110 starter entries made from `CLAUDE-task1.md`,
  each with a level, a note and at least three examples. You can add more from
  any coursebook with Claude (see below), by hand, or undo an import.
- **Drills**:
  - type the missing words
  - choose them
  - say it then reveal
  - spot the error, built from the ✗ forms in the bank

  Examples rotate, so you learn the pattern, not one sentence. Spaced repetition
  is saved after every answer.
- **Write**: a 20-minute timer that starts with your first keystroke, a word
  count and autosave. The **checker** applies the rules from `CLAUDE-task1.md`
  and every ✗ form in your bank:
  - under 150 words, or no overview
  - I/we/you, contractions, rhetorical questions
  - "surprisingly", "a lot", "went up"
  - "was risen", "has been increased", "comprises of"
  - speculating about causes, or copying the question

  It also credits the bank phrases you used. It does not give a band score:
  **Copy feedback prompt** asks Claude for one, with the exact data.
- **Make with Claude**, with no API key: a new task on any topic, a Band 9 model
  answer whose marked phrases become drills, or band feedback on your answer.
  Each is a copy, paste and paste-back flow.

The generated figures are invented: realistic in shape, not real statistics.

## Adding knowledge

Read [docs/knowledge-format.md](docs/knowledge-format.md). In short:
1. Paste the project instructions into a Claude Project once.
2. In that project, send one unit at a time (up to 100 pages) with its answer key.
3. Paste Claude's JSON reply into **Knowledge → + → Add knowledge from Claude**.

Duplicates are merged and each import can be undone. The format
(`task1-kb/1`) is frozen, so packs keep importing into later versions.

## Put it on your iPhone

The app is a static site with no server code. To host it on GitHub Pages:
1. In this repository, open **Settings → Pages → Build and deployment**.
2. Choose **Deploy from a branch**, `main` and `/ (root)`, then **Save**.
3. After a minute it is live at
   `https://johnbui765.github.io/IELTS-TASK-1-DESIGNER-1/`.
4. Open that address in **Safari**, then **Share → Add to Home Screen → Add**.

Everything is stored only on the phone (IndexedDB). Use **Settings → Export
backup** now and then.

### Sharing one origin with your other apps

All your apps live on `johnbui765.github.io`, so this one keeps to its own
names:

| What | Name |
| --- | --- |
| Manifest `id` | `/IELTS-TASK-1-DESIGNER-1/` |
| Cache names | prefix `ielts-task1-`; the service worker deletes only caches with that prefix |
| IndexedDB database | `ielts-task1` |
| localStorage keys | prefix `t1.` |

Vocab Studio uses `vocab-studio`, `vocab-studio-` and `vs.`.

## Development

There is no build step and there are no dependencies. Node 22+ is needed only
for the tests and tools.

```sh
node tools/serve.mjs 8080        # serve at http://localhost:8080
npm test                         # unit tests (node:test)
node tests/e2e/flows.mjs         # end-to-end flows (Playwright + Chromium, dev server on 8080)
node tools/update-sw.mjs         # refresh the offline file list + version (after every change)
node tools/build-docs.mjs        # regenerate docs/knowledge-format.md from js/core/kb-prompt.js
node tools/make-icons.mjs        # re-render the PNG icons from icons/icon.svg
```

**After changing any app file, run `node tools/update-sw.mjs`.** The service
worker version is a hash of the shipped files, and installed apps update only
when it changes; they then show an **Update** button.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app shell, install metadata, offline cache
css/app.css, css/screens/*.css            design system (from Vocab Studio) + per-screen styles
js/core/                                  pure logic, tested in Node:
  charts.js, topics.js, describe.js         chart generator and its language engine
  maps.js, process.js                       map and process generators and language
  tasks.js, task-import.js                  tasks, and tasks written by Claude
  knowledge.js, kb-schema.js, kb-prompt.js  knowledge packs: format, import, merge, undo
  drills.js, srs.js, lint.js                review queue, cards, spaced repetition, writing checker
  english.js, marked.js, rng.js …           verb forms, [[ ]] markup, seeded random numbers
js/render/                                chart, map and process drawing (SVG)
js/data/                                  IndexedDB storage, starter set, seeding
js/ui/                                    DOM helpers, components, router, speech (from Vocab Studio)
js/screens/                               screens; js/screens/practice/ = drills
tests/unit, tests/e2e                     tests
tools/                                    dev server, service-worker updater, docs and icon builders
```

The engine (router, components, storage, spaced repetition and grading) is
copied from Vocab Studio, not linked to it, so the two apps stay independent.
