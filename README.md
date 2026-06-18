# Curious Labs — Student LMS

**Hands-on, experiment-first STEM learning for grades 1–10** — coding, robotics, AI and 3D modelling — running entirely in the browser with **zero installs**. No textbooks; just interactive labs you *do*, that grade themselves instantly.

> A Curious Labs / PhysicsWallah product, designed to pair with physical STEM lab kits in schools.

---

## ✨ Highlights

- **16 interactive, auto-graded labs** across 4 subjects, each a self-contained mini-experiment (drag / tap / build / simulate).
- **Grade bands** tuned to cognitive level:
  - 🐣 **Juniors (Class 1–3)** — tap, match, sort; no reading needed
  - 🚀 **Explorers (Class 4–6)** — loops, logic, circuits, model training
  - 🧠 **Innovators (Class 7–10)** — *coming soon* (variables, control loops, model evaluation, coordinates)
- **Gamification** — XP + levels, daily streaks, 13 badges, completion rewards, and printable per-subject **certificates**.
- **Maker Base** — a coins economy with unlockable avatars, accent colours and titles.
- **Creative Studio** — a free-build Pixel Art canvas with save / PNG export / gallery.
- **In-lab learning support** — progressive Socratic hints + a "How it works" real-world explainer on every lab.
- **Crafted feel** — dark neon STEM aesthetic, soft animated backdrops, per-subject launch transitions; tuned for low-end school tablets and `prefers-reduced-motion`.
- **Local-first** — progress lives in the browser (no backend yet), so the whole site is static and scales to any number of concurrent learners from a CDN.

## 🧱 Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · TypeScript. No backend, no database — progress is stored in `localStorage`.

## 🚀 Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

## 🗺️ Project structure

```
src/
  app/                       # routes
    page.tsx                 #   home (pick class → tracks)
    subjects/[subject]/      #   a track's labs for the selected band
    activity/[id]/           #   a single lab, hosted by LabShell
    create/  base/  profile/ #   studio · cosmetics · progress dashboard
    certificate/[subject]/   #   printable certificate
  lib/
    activities/              # the lab system
      types.ts               #   the ActivityProps / onComplete contract + Band
      registry.ts            #   all lab metadata (server-safe)
      componentMap.tsx       #   client-only lazy loader (ssr:false)
      impl/                  #   the 16 self-contained lab engines
    progress.ts              # localStorage progress + streak (the DB swap-seam)
    gamification.ts          # XP / levels / badges
    cosmetics.ts  creations.ts  bands.ts  subjects.ts
  components/                # LabShell, cards, backgrounds, transitions, …
```

## 🧠 Architecture notes

- **One activity contract.** Every lab is a self-contained client component that owns its own interaction and auto-grading, reporting through a single `onComplete({ passed, stars })` callback — so labs are built, tested and reasoned about in isolation.
- **Grade bands** are a `band` dimension on each lab; navigation, progress and "next lab" all stay within the chosen band.
- **`progress.ts` is the single seam** to swap the local store for a DB-backed one when accounts land — the UI never changes.

## 📋 Roadmap

- **Innovators (Class 7–10)** labs — harder engines (block-code with variables, sensor control loops, train-and-evaluate AI, coordinate/boolean 3D)
- Accounts + cloud-synced, server-verified progress (Supabase) → teacher & school dashboards
- Lab-effectiveness upgrades (per-mistake feedback, predict-then-run, seeded replay)
- Hindi + regional localisation, voice/read-aloud, PWA/offline

---

*Built with [Claude Code](https://claude.com/claude-code).*
