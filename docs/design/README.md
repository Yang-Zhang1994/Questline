# Design notes — Questline visual & interaction reference

**Prototype:** [Questline with Mochi](https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y) (Claude Web artifact).  
**Screenshots:** `today.png`, `map.png`, `talk.png` in this folder.

The prototype is the **visual and interaction reference**. Rebuild it as React components; do not copy its single-file HTML/JS, browser-side storage, or in-browser Claude calls.

## Overall look — "cozy sky-and-meadow diary"

- Light sky-blue page with soft clouds and sparkles (✦ ✧); title "Questline", tagline "your little quest diary with Mochi ♡".
- Content in rounded retro **window cards** (title bar with ✦ + title, e.g. "✉ A note from Mochi", "Mochi Messenger").
- Glossy **"gel" pills**: pink (primary), blue, white (secondary), green (stage cleared); `danger` for delete; mini ✕ for close/remove.
- **Fonts:** display = "Mochiy Pop One"; body = "M PLUS Rounded 1c"; small UI = Tahoma/Verdana/system-ui (Google Fonts + rounded fallbacks).
- **Color tokens** (`client/src/styles/tokens.css`):
  `--page #E8F4FF`, `--sky-top #38ACF0`, `--pink #FF6FB1`, `--pink-ink #D23A82`, `--pink-pale #FFF0F7`,
  `--blue-ink #1C7FC8`, `--blue-pale #F0F9FF`, `--purple-pale #F7F2FF`, `--ink #3D3570`,
  `--ink-soft #776CA8`, `--panel #FFFFFF`, `--meadow #CBF0B6`, `--road #FFF8E6`,
  `--walked #FFD0E6`, `--tree #8CD96A`.
- **Mochi:** round white mochi with two-leaf sprout, pink cheeks (inline SVG); moods `happy`, `wink`, `think`, `cheer`; gentle bob on the map.
- Toasts for actions; disable bob/sparkle/map-scroll under `prefers-reduced-motion`.

**Navigation:** bottom dock — **☀️ Today**, **🗺️ Map**, **💌 Talk**.

## View 1 — Today

- HUD: goal selector, **★ Lv N** + XP bar, **"Days in a row"** streak.
- **"A note from Mochi"**: time-based greeting, today's quest count, current stage, gentle leftover line.
- Today's quests (`x/y done`); check + undo; overdue tag; done items stay, faded.
- **"Too much?"** reshuffle (#14); **"♡ Plan my next days"** when stage has no quests (#15).
- Empty: head-start / rest-day / "♡ Plan a quest with Mochi".
- **Stamp card** (#13): fixed `STAMPS_PER_CARD` slots (not the prototype's 28-day grid); full card → Mochi reward + new card; past cards kept.
- **"Diary note for today"** (#19).

## View 2 — Map

- SVG meadow: winding road Start house → milestone nodes → goal; walked path pink.
- Node states: Cleared / You are here (Mochi) / Ahead; title, target date, `♡ done/total`.
- Header: goal sentence, deadline, `N/M` stages cleared; auto-scroll to current.
- Node bottom sheet: description, quests (+ delete), new quest form, "♡ Ask Mochi to plan", stage cleared / reopen (#10).

## View 3 — Talk ("Mochi Messenger")

- Chat: Mochi bubbles (name + avatar) vs user; streaming replies.
- First message greets and gives the Japanese-novel example.
- Composer: Enter send, Shift+Enter newline, IME-safe; **"Send ♡"**.
- After milestones: **"🗺️ Draw my map"** → plan preview → **"★ Start this goal"** (#4, #5); Start over.
- Existing goal: welcome back, **"🗺️ Update my map"**, Clear chat, **"＋ New goal"**.
- Manual fallback form (#21). Friendly AI error copy.

## Terminology (PRD terms — not prototype copy)

| Term                        | Meaning                                                |
| --------------------------- | ------------------------------------------------------ |
| **Goal**                    | Whole pursuit (e.g. read a Japanese novel in one year) |
| **Milestone** (UI: "stage") | One roadmap step                                       |
| **Quest**                   | Small daily task                                       |

Rename prototype labels: "＋ New quest" → "＋ New goal"; "★ Start this quest" → "★ Start this goal"; "New task" → "New quest"; etc.

## Sprint 2 prototype extras

Build only when their Issue is in progress: multi-goal selector (#18), diary note (#19), manual quest add/delete (#20), manual plan form (#21).

When a state is missing from the prototype (empty/loading/error), follow Mochi's warm tone and note the gap in the PR.
