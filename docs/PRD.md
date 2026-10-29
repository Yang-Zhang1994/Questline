# Questline (Mochi's Quest Diary) — PRD

| | |
|---|---|
| **Product** | Questline (Mochi's Quest Diary) |
| **Status** | v1.1 — stack & vocabulary locked (2026-10-29) |
| **Related** | `AGENTS.md` · `docs/data-model.md` · `docs/design/` · [Sprint Board](https://github.com/users/Yang-Zhang1994/projects/1) |

### Decisions (locked)

| Date | Decision |
|---|---|
| 2026-10-29 | **Stack:** Vite + React client, Express server, SQLite (`better-sqlite3`), shared zod, npm workspaces. Claude only on the server. |
| 2026-10-29 | **Vocabulary:** **Goal** → **Milestone** (UI: “stage”) → **Quest** (daily item). Do not use teammate-draft “Quest = whole project / Task = daily item” in Issues or code. |
| 2026-10-29 | Auth, Supabase, and Next.js App Router are **out of scope** for this course prototype (may revisit after Nov 10). |

---

## 1. Problem

Many people start personal projects with big dreams but fall into the **Ambition-Action Gap**: a goal like “learn Japanese” feels exciting but is too vague to act on. Nobody tells them what to do today, so they over-plan once and never follow through, or they never plan at all. Tracking alone feels lonely; missing days creates guilt; the project dies within weeks.

To-do apps assume you already know the steps. Habit trackers count streaks but don’t design the path. Generic AI chat leaves a plan stuck in a transcript with no daily follow-through.

## 2. Solution

Questline turns a self-driven project into a cozy life-sim game with **Mochi**, an original AI guide:

1. **Shape the goal.** One question at a time → one concrete, measurable **Goal** with a deadline.
2. **Draw the map.** Agree on 3–7 **Milestones**; the app draws a roadmap from Start to the Goal.
3. **Play today.** Mochi greets the user with a short note and today’s **Quests**. Completing quests earns XP, levels, streaks, and stamps.
4. **Recover kindly.** When the user falls behind, Mochi reschedules or plans the next week — no guilt pile-up.

## 3. Target users

Self-motivated learners, hobbyists, and side-project builders (roughly 18–35) who want a personal goal, struggle to break it into steps, lack outside accountability, and find traditional productivity tools stressful.

| Persona | Situation | Need |
|---|---|---|
| **Lin, the dreamer** (21, student) | Wants to “learn Japanese”; bought textbooks, finished none. | A clear path and “what do I do today?” |
| **Sam, the restarter** (27, developer) | Bursts of side projects; quits after missing a week. | A plan that adapts without guilt. |
| **Ana, the overwhelmed planner** (24, designer) | Loves cute apps; hates spreadsheets. | Planning that feels like a cozy game. |

## 4. Goals and success metrics

Course project — measure in-sprint with scripts, tests, or a short classmate session.

| Goal | How we measure | Target |
|---|---|---|
| Vague wish → valid plan | Scripted sample wishes through plan/confirm flow | ≥ 9/10 plans pass validation |
| Mochi persona | Checklist on sample chats (one question, short, no guilt) | ≥ 90% replies pass |
| Core flows usable | 5 classmates: Flow A (goal) + Flow B (check off) unaided | ≥ 4/5 finish both, each &lt; 5 min |
| Come-back motivation (Sprint 2) | 3-day trial; days with ≥1 completed quest | ≥ 3/5 people active on ≥2 of 3 days |
| Quality | CI lint/typecheck/tests; AC mapped to tests | Every in-sprint Issue AC has ≥1 test |

**Non-goals:** team project management, calendar sync, general-purpose chatbot, social/sharing, native apps, payments.

## 5. User stories and Issues

Acceptance criteria live as checklists on each GitHub Issue. Vocabulary below is authoritative.

### US1 — Vague dream → concrete Goal

As a user with a vague dream, I want Mochi to ask one question at a time (done definition, starting point, time budget, deadline), so my wish becomes a measurable Goal.  
**Issues:** #2 (chat), #3 (interview), #4 (confirm Goal).

### US2 — Milestones and roadmap

As a user who doesn’t know where to start, I want Mochi to propose Milestones and a Start→Goal roadmap so I know which stage I’m on.  
**Issues:** #5 (Milestone plan), #6 (roadmap), #10 (advance stage).

### US3 — Daily Quests

As a user who gets overwhelmed, I want a short daily note with Quests due today so I only focus on the next step.  
**Issues:** #7 (generate Quests), #8 (daily note), #9 (check off / undo).

### US4 — XP, levels, streak, stamps

As a user who needs motivation, I want XP, levels, streak, and stamps when I complete Quests.  
**Issues:** #11 (XP/levels), #12 (streak), #13 (stamp card).

### US5 — Reschedule and week planning

As a user who falls behind, I want Mochi to reschedule overdue Quests or plan the next week for the current Milestone.  
**Issues:** #14 (reschedule), #15 (week plan).

### Foundation / prototype extras

#1 repo/CI · #17 data model · #16 README · #18 multi-Goal selector · #19 diary note · #20 manual Quest CRUD · #21 manual plan form.

## 6. Scope and sprint MVPs

**In scope:** onboarding chat; Goal + Milestones; roadmap; daily Quests (generate, list, check/undo); XP/streak/stamps; reschedule + week plan; listed extras; local SQLite; server-only Claude.

**Out of scope:** multi-user auth / SMS / Supabase; cloud sync; native apps; push/email; calendar integrations; premium; hosting our own LLM; Next.js App Router rewrite for this course window.

| Sprint | Window | Workable MVP |
|---|---|---|
| **Sprint 1** | ~2026-10-27 → **2026-11-03** | Chat → confirm Goal + Milestones → roadmap → complete today’s Quests. Issues #1–#9, #17. |
| **Sprint 2** | ~2026-11-03 → **2026-11-10** | Stage advance, rewards, reschedule/week plan, extras, README. Issues #10–#16, #18–#21. |

After each sprint the app must be demoable for that MVP.

## 7. Success criteria (product)

- Flow A: vague idea → confirmed Goal + roadmap in one sitting.
- Flow B: today’s Quests, check off, rewards update (Sprint 2 for full XP/streak/stamp).
- Flow C: overdue Quests rescheduled without guilt copy.
- No browser Claude key; AI proposals confirm-before-save; CI green.
- UI matches prototype tone; WCAG 2.1 AA basics (`AGENTS.md` §4.5).

## 8. Non-functional requirements

- **Performance:** Today view snappy for one active Goal’s Quests; check-off feels immediate.
- **Reliability:** AI parse retry once then friendly error; Quest toggle (+ later rewards) transactional.
- **Security:** Secrets server-side; zod + size limits; rate-limited AI routes; no `dangerouslySetInnerHTML` for chat.
- **Accessibility:** Keyboard, chat `aria-live`, real checkboxes, contrast, `prefers-reduced-motion`.
- **Maintainability:** `routes → services → repositories`, shared zod, Issue-linked commits/PRs, ESLint 9 + Prettier.

## 9. Design

**Cozy sky-and-meadow diary** (Y2K-cute influence, original art only). Details: `docs/design/README.md`, screenshots `today.png` / `map.png` / `talk.png`, tokens in `client/src/styles/tokens.css`.

- Bottom dock: **Today** · **Map** · **Talk**.
- Window cards (e.g. “✉ A note from Mochi”), gel pills, Mochi avatar moods.
- Prototype: https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y — rebuild in React; do not copy browser storage or in-browser Claude.

## 10. Risks

| Risk | Mitigation |
|---|---|
| AI returns bad plans | zod + clamp; confirm-before-save; manual fallbacks (#21). |
| Time-zone / streak bugs | Local `YYYY-MM-DD` + injectable clock; tests. |
| Guilt when behind | Mochi voice rules; reschedule UX (#14). |
| Docs/stack drift across teammates | This PRD Decisions table + `AGENTS.md` are source of truth. |

## 11. Open questions

1. Streak “rest day” forgiveness? Decide in Sprint 2 after a classmate trial; until then miss = break.
2. Inline edit of Quest titles/due dates in Sprint 2, or add/delete only (#20)?
