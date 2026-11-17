# jengels34.github.io

[![CI](https://github.com/jengels34/jengels34.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/jengels34/jengels34.github.io/actions/workflows/ci.yml)

Source for **[jengels34.github.io](https://jengels34.github.io/)**: my career profile, plus the home pages, support pages, and privacy policies for my iOS apps.

I'm Josh Engels, Director of Problem & Incident Management at DraftKings. On the side I build native iOS apps under the name Khakichimp.

## What's here

| Page | Folder | What it is |
| :--- | :--- | :--- |
| [Career profile](https://jengels34.github.io/) | `index.html` | Experience, selected work, skills, and resume download |
| [Khakichimp HQ](https://jengels34.github.io/khakichimp/) | `khakichimp/` | Overview of the three apps |
| [Tasks - Uniflow](https://jengels34.github.io/tasks-uniflow/) | `tasks-uniflow/` | App page, support, and [privacy policy](https://jengels34.github.io/tasks-uniflow/privacy.html) |
| [ReadMe](https://jengels34.github.io/readme/) | `readme/` | App page, support, and [privacy policy](https://jengels34.github.io/readme/privacy.html) |
| [Food in Five](https://jengels34.github.io/food-in-five/) | `food-in-five/` | App page, support, and [privacy policy](https://jengels34.github.io/food-in-five/privacy.html) |

Shared images, icons, page scripts, and the resume PDF live in `assets/`. The site's tooling lives in `scripts/`.

## How it's built

- Plain HTML, CSS, and JavaScript. No framework and no build step: GitHub Pages serves the files as they are.
- Each page keeps its styles inline, so a change to one page rarely touches another.
- No analytics or tracking scripts on any page.
- Every pull request runs automatic checks: the HTML is validated and every internal link is confirmed to point at a real file.
- The social share images are generated from code (`scripts/og-gen.mjs`), so they stay consistent across pages.

## Running the checks locally

```bash
npm install
npm test
```

To regenerate a share image after changing its text, for example the career card:

```bash
node scripts/og-gen.mjs og-josh
```

## Contact

App questions and feedback: the email link on [Khakichimp HQ](https://jengels34.github.io/khakichimp/), or the feedback form on the [ReadMe page](https://jengels34.github.io/readme/).

## Rights

All rights reserved. The writing, photos, illustrations, and app artwork in this repository are not licensed for reuse.
