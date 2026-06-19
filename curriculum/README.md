# STEM PBL Curriculum — Gurukulam Schools, 2026–27 (Grades 1–10)

Source of truth for the Curious Labs labs. Each of the 10 grades has **10 monthly
projects** (May → Feb); every project is turned into **one interactive, self-grading
browser lab**. So the full build is **100 labs** (10 grades × 10 projects).

Imported from the shared Google Sheet
(`docs.google.com/spreadsheets/d/15tUyvH42kIWXLGRpnu0zqRL0VEqg3KBp`).

## Files
- `stem-pbl-2026-27.xlsx` — original workbook (Curriculum Overview + G1–G10 Lesson Planners).
- `stem-pbl-2026-27.overview.json` — per-grade monthly project names + yearly theme.
- `stem-pbl-2026-27.full.json` — every project broken into its 45-min class sessions
  (title, description & learning objectives, materials). Use this as the source when
  authoring a grade's labs.

## Months
`May · July · Aug · Sep · Oct · Nov · Dec · Jan (I) · Jan (II) · Feb` (projectNo 1–10).

## Grade themes
| Grade | Yearly theme |
|---|---|
| 1 | Exploration & Logical Thinking |
| 2 | Cause & Effect Systems |
| 3 | Motion, Control & Digital Creativity |
| 4 | Real Robotics Begins |
| 5 | Automation & Design Thinking |
| 6 | Coding Meets Hardware |
| 7 | AI & Data Awareness |
| 8 | Intelligent Decision Systems |
| 9 | Engineering & Research |
| 10 | Industry & Entrepreneurship |

## How a project becomes a lab
Each project maps to one lab implemented as the standard 3-file pattern:
1. `src/lib/activities/impl/g<grade>-<slug>.tsx` — the interactive client component
   (implements `ActivityProps`, owns its own auto-grading via `onComplete`).
2. an `ActivityMeta` entry in `src/lib/activities/registry.ts` carrying
   `grade`, `month`, `projectNo`, `subject`, `band`, learning `objective`, `concepts`, etc.
3. a lazy loader line in `src/lib/activities/componentMap.tsx`.

Band follows the grade: **Class 1–3 → junior · 4–6 → explorer · 7–10 → innovator**.

## Build status
- ✅ **Grade 1** — "Think, Build, Play" — 10 labs (`g1-*`) live.
- ⬜ **Grades 2–10** — to build, one grade at a time, from `stem-pbl-2026-27.full.json`.
