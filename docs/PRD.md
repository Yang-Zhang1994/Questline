# Questline (Mochi's Quest Diary) — PRD

## Description

Many people start personal projects with big dreams but fall victim to the "Ambition-Action Gap": a goal like "learn Japanese" feels exciting, but it's too vague to act on. Breaking it into concrete steps and tracking progress alone quickly becomes a lonely, stressful chore, so the project quietly dies within weeks.

Questline (Mochi's Quest Diary) fixes this by turning self-driven projects into a cozy life-sim game. Users chat with Mochi, a cute AI guide, who asks one question at a time to turn a fuzzy wish into a concrete, measurable goal with a deadline (for example, from "learn Japanese" to "read a Japanese novel on my own within one year"). Together they agree on milestones, which the app draws as a game-style roadmap from Start to the final goal. Every day, Mochi greets the user with a short note listing that day's small, actionable quests. Checking off quests earns XP, levels and streak stamps. When users fall behind, Mochi reshuffles the schedule instead of letting guilt pile up.

## Target Users

Self-motivated learners, hobbyists and side-project builders who want to pursue a personal goal but struggle to break it into small steps, stay consistent without outside accountability, or feel overwhelmed by traditional productivity tools.

## Scope

**In scope**

- Chat onboarding with Mochi (one question at a time) → confirmed measurable goal + milestones
- Game-style roadmap and daily quests (generate, list, check off / undo)
- Rewards: XP/levels, daily streak, stamp card
- Reschedule overdue quests and plan the next week of quests
- Prototype extras: multi-goal selector, daily diary note, manual quest/plan fallbacks
- Local SQLite persistence; Claude API called only from the server

**Out of scope (for this prototype)**

- Multi-user accounts, auth, social features, or cloud sync across devices
- Native mobile apps; push notifications; calendar integrations
- Payment / premium tiers; third-party habit trackers
- Fine-tuning or hosting our own LLM

## User Stories

Acceptance criteria for each story live on the linked GitHub Issues (checklist in each Issue body). Summary:

### US1 — Vague dream → concrete goal

As a user with a vague dream, I want to talk through my idea with an AI guide that asks me one question at a time (done definition, starting point, available time, deadline), so that my fuzzy wish becomes a concrete, measurable goal without me planning alone.  
**Issues / AC:** #2 (chat UI), #3 (interview), #4 (goal confirm).

### US2 — Milestones and roadmap

As a user who doesn't know where to start, I want the AI to propose milestones and turn our plan into a visual roadmap from Start to my final goal, so I can see the journey and know which stage I'm on.  
**Issues / AC:** #5 (milestone plan), #6 (roadmap), #10 (advance stage).

### US3 — Daily quests

As a user who gets overwhelmed easily, I want a friendly character to greet me each day with a short list of small tasks due today, so I only focus on the next step.  
**Issues / AC:** #7 (generate quests), #8 (daily note), #9 (check off).

### US4 — XP, levels, streak, stamps

As a user who needs motivation, I want to earn XP, level up, keep a daily streak and collect stamps when I complete tasks, so progress feels rewarding.  
**Issues / AC:** #11 (XP/levels), #12 (streak), #13 (stamp card).

### US5 — Reschedule and week planning

As a user whose plans don't always go smoothly, I want to ask the AI to reschedule overdue tasks or plan the next week for my current stage, so falling behind doesn't make me quit.  
**Issues / AC:** #14 (reschedule), #15 (week plan).

### Prototype extras / foundation

Multi-goal selector (#18), diary note (#19), manual quest CRUD (#20), manual plan form (#21); repo/CI (#1), data model (#17), README (#16).

## Sprint MVPs

| Sprint       | Window                       | Workable MVP                                                                                                                            |
| ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint 1** | ~2026-10-27 → **2026-11-03** | User can chat with Mochi, confirm a goal + milestones, see the roadmap, and complete today's quests. Issues: #1–#9, #17.                |
| **Sprint 2** | ~2026-11-03 → **2026-11-10** | Full cozy loop: stage advance, XP/streak/stamps, reschedule + week plan, prototype extras, documented README. Issues: #10–#16, #18–#21. |

After each sprint the app should be demoable for that sprint's MVP (not a broken half-feature).

## Success criteria

- A new user can go from a vague idea to a confirmed goal + roadmap in one sitting (Flow A).
- Returning user sees today's quests, can check them off, and sees XP/streak/stamp update (Flow B).
- Overdue quests can be rescheduled without guilt-inducing copy (Flow C).
- No browser-side Claude key; AI proposals confirm-before-save; lint/tests pass in CI.
- UI matches the prototype tone and meets WCAG 2.1 AA basics (see `AGENTS.md` §4.5).

## Non-functional requirements (brief)

- **Performance:** Daily Today view loads without noticeable lag for a single active goal's quest set.
- **Reliability:** AI parse failures retry once, then show a friendly error; DB writes for quest toggle + rewards are transactional.
- **Security:** Secrets server-side only; validated/size-limited bodies; rate-limited AI routes; no raw HTML rendering of chat.
- **Accessibility:** Keyboard use, live regions for chat, real checkboxes, contrast, reduced-motion (see `AGENTS.md`).
- **Maintainability:** Layered server, shared zod schemas, Issue-linked commits/PRs, ESLint 9 + Prettier.

## Mockup

Prototype: https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y  
Screenshots and design tokens: `docs/design/`.  
Agent implementation notes: `AGENTS.md`. Data model: `docs/data-model.md`.
