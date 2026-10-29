# Questline — Product Requirements Document

| | |
|---|---|
| **Product** | Questline (Mochi’s Quest Diary) |
| **Course / project** | Project 2 |
| **Team** | [@teammate 1] · [@teammate 2] |
| **Status** | v1.0, Sprint 1 |
| **Related docs** | `AGENTS.md` (rules for AI agents) · `docs/design/prototype-link.md` · `docs/design/mockups/` · `docs/design/tokens.md` |

---

## 1. Problem

Many people start personal projects with big dreams but fall into the **Ambition-Action Gap**: a goal like “learn Japanese” feels exciting, but it is too vague to act on. Nobody tells them what to do today, so they either over-plan once and never follow the plan, or they don’t plan at all. Tracking progress alone is lonely and stressful, missing a few days creates guilt, and the project quietly dies within weeks.

Existing tools don’t close this gap. To-do apps and project boards assume you already know the steps. Habit trackers count streaks but don’t help you design the path. Generic AI chatbots can suggest a plan, but the plan lives in a chat log and nothing helps you follow it day by day.

## 2. Solution

Questline turns a self-driven project into a cozy life-sim game with a friendly AI guide, **Mochi** (an original mochi-spirit character):

1. **Shape the goal.** Mochi chats with the user, one question at a time, to turn a fuzzy wish into one concrete, measurable goal with a deadline (“learn Japanese” → “read a Japanese novel on my own within one year”).
2. **Draw the map.** Together they agree on 3–7 milestones, which the app draws as a game-style roadmap from **Start** to the **Goal**.
3. **Play today.** Every day, Mochi greets the user with a short note and a small list of tasks due today. Completing tasks earns XP, levels, streaks and stamps.
4. **Recover kindly.** When the user falls behind, Mochi reshuffles the schedule or plans the next week of tasks instead of letting guilt pile up.

## 3. Target users

**Primary:** self-motivated learners, hobbyists and side-project builders (students and young professionals, roughly 18–35) who want to pursue a personal goal, struggle to break it into small steps, lack outside accountability, and find traditional productivity tools stressful or boring.

| Persona | Situation | Need |
|---|---|---|
| **Lin, the dreamer** (21, student) | Wants to “learn Japanese” to read novels. Has bought three textbooks, finished none. | Someone to turn the dream into a clear path and tell her what to do today. |
| **Sam, the restarter** (27, developer) | Starts side projects in bursts, abandons them after missing a week. | A plan that adapts when life gets busy, without guilt. |
| **Ana, the overwhelmed planner** (24, designer) | Loves cute apps, hates spreadsheets and Gantt charts. | Planning that feels relaxing and rewarding, like a game. |

## 4. Goals and success metrics

This is a course project without real users, so every metric below can be measured by the team in a sprint, using scripts, automated tests or a short test session with classmates.

| Goal | How we measure it | Target |
|---|---|---|
| AI turns wishes into valid plans | Run 10 scripted sample wishes (different topics, vague and specific, at least 2 not in English) through the plan API | ≥ 9 of 10 produce a plan that passes validation with no manual fixes |
| Mochi follows its persona | Team reviews the replies from the same 10 scripted chats with a checklist (one question, 2–4 sentences, right language, no guilt) | ≥ 90% of replies pass |
| Core flows are easy to use | One-session test with 5 classmates: create a quest (Flow A) and check off a task (Flow B) without help | ≥ 4 of 5 finish both, each in under 5 minutes |
| It motivates people to come back | 3-day trial with the same 5 classmates in Sprint 2: count the days each person completes at least one task, read from the `done_at` dates already in our database (no survey, no extra tracking in the app) | ≥ 3 of 5 people complete tasks on at least 2 of the 3 days |
| AI feels responsive | Time 10 runs of each in the dev build | chat first reply < 3 s, plan < 20 s (median) |
| Accessible | axe scan in Playwright on Today, Map and Talk | 0 serious or critical issues |
| Built with quality | CI coverage report and acceptance-criteria tests | ≥ 80% overall, ≥ 95% in `lib/domain`, every Sprint 1 AC has a test |

During the test session, one teammate also takes notes on where people get stuck or react happily (for example, smiling when Mochi greets them or when a heart pops). These notes have no number target; they decide which fixes go into Sprint 2.

Metrics that need real users over a longer time, such as weekly retention, are left for a future public release. Questline never shows surveys or rating prompts in the app.

**Non-goals:** Questline is not a team project-management tool, a calendar, or a general-purpose chatbot.

## 5. User stories and acceptance criteria

Each story becomes a GitHub Issue (label `story:US-n`). Acceptance criteria are written so they can be turned directly into tests.

### US-1 — Shape a concrete goal through chat
> As a user with a vague dream, I want to talk through my idea with an AI guide that asks me one question at a time (what “done” looks like, my starting point, my available time, my deadline), so that my fuzzy wish becomes a concrete, measurable goal without me having to plan it all alone.

- **AC1.1** Given I have no quest, when I open the app, then Today shows Mochi’s note inviting me to plan, with a “Plan a quest with Mochi” button that opens Talk in new-quest mode.
- **AC1.2** Given I am in new-quest mode, when Talk opens, then Mochi’s greeting is the first message and the composer placeholder reads “What would you like to start?”.
- **AC1.3** Given I send a message, when Mochi replies, then the reply streams in, is 2–4 sentences of plain text, asks at most one question, and is in the language I wrote in.
- **AC1.4** Given Mochi is replying, when I press “Stop”, then streaming stops and the partial reply is kept.
- **AC1.5** Given I leave and come back, when I reopen Talk, then my draft planning chat is still there; “Start over” clears it.
- **AC1.6** Given the AI is unavailable or I choose “Write the plan myself”, then I can create a quest manually with a name, goal, deadline and one milestone per line.

### US-2 — Agree on milestones and see a roadmap
> As a user who doesn’t know where to start, I want the AI to propose milestones and turn our agreed plan into a visual, game-style roadmap from Start to my final goal, so that I can see the whole journey and know exactly which stage I’m on.

- **AC2.1** Given I have sent fewer than 2 messages, then “Draw my map” is disabled with a hint to chat first; after 2 messages it is enabled.
- **AC2.2** Given I tap “Draw my map”, when the plan is ready, then a quest scroll shows title, goal, deadline, minutes per day, 3–7 dated milestones and the number of starter tasks.
- **AC2.3** Given the scroll is shown, when I tap “Keep talking”, then I return to the chat with nothing lost; when I tap “Start this quest”, then the quest is saved, set as active, I land on Map, and a toast says “New quest started! ⭐”.
- **AC2.4** Given a quest, when I open Map, then I see the goal card, then a road from Start (bottom) to the Goal flag (top), with milestones alternating left and right, and the map scrolls to my current stage.
- **AC2.5** Stage states: cleared = pink orb with a star; current = blue orb with a number, pulsing halo and Mochi standing on it; ahead = lilac dashed orb. The road walked so far is pink.
- **AC2.6** Given I tap (or focus and press Enter on) a stage, then a sheet shows its description, target date, progress, tasks, an add-task row, and “Stage cleared!” (or “Reopen stage”).
- **AC2.7** Given I have several quests, when I pick one in the header’s quest picker, then all screens switch to that quest.

### US-3 — Daily tasks from Mochi
> As a user who gets overwhelmed easily, I want a friendly character to greet me each day with a short list of small, actionable tasks due today, so that I only have to focus on the next step instead of the entire project.

- **AC3.1** Given I open Today, then Mochi’s note greets me by time of day (before 11:00 “Good morning!”, before 17:00 “Hi there!”, otherwise “Good evening!”) and summarizes today: how many tasks are due, any left over from earlier (“no stress”), or that everything is done.
- **AC3.2** “Today’s quests” lists open tasks with a due date on or before today, overdue first, then tasks I completed today. The title bar shows “x/y done”.
- **AC3.3** Overdue tasks show a chip “from <date>”. Every task shows its milestone name.
- **AC3.4** Given nothing is due today but future tasks exist, then I can pull the next one into today with one tap.
- **AC3.5** Given the current stage has no tasks yet, then I see “Plan my next days” and “Add tasks myself”.
- **AC3.6** “Coming up” shows the next 3 future tasks with their dates.
- **AC3.7** Mochi’s note types out once per day per quest and appears instantly when reduced motion is on.

### US-4 — Rewards for progress
> As a user who needs motivation, I want to earn XP, level up, keep a daily streak and collect stamps on a stamp card when I complete tasks, so that making progress feels rewarding and fun, like playing a game.

- **AC4.1** Given I check a task, then it shows as done immediately (pink heart, strike-through), a small heart/star burst plays, and a toast shows “+10 XP ✨”, or “Level up! You’re Lv N 🎉” when I cross a level.
- **AC4.2** Unchecking a task removes its XP and its completion date.
- **AC4.3** XP = 10 per completed task + 50 per cleared milestone. Level = ⌊XP / 100⌋ + 1. The header shows “★ Lv N”, an XP bar with “x/100 XP”, and a 🔥 streak.
- **AC4.4** Streak = consecutive days with at least one completed task, counting back from today, or from yesterday if nothing is done yet today.
- **AC4.5** The stamp card shows the last 28 days; days with at least one completed task get a stamp; today is outlined.
- **AC4.6** Given I check the last open task of the current stage, then the stage clears automatically: `clearedAt` is set to today, I get +50 XP, a burst plays, the next stage becomes current and Mochi moves to it on the map.
- **AC4.7** When a stage clears, a toast shows “Stage cleared! On to “<next stage>” ⭐” (or “Quest complete! 🎉” for the last stage) with an **Undo** button for 5 seconds. Undo reopens the stage and removes the 50 XP.
- **AC4.8** Given a stage is cleared, when I uncheck one of its tasks or add a new task to it, then it reopens automatically. I can also clear a stage early with “Stage cleared!” in its sheet, or reopen it with “Reopen stage”.
- **AC4.9** I can write a one-line diary note for today; it saves automatically.

### US-5 — Adapt the plan when life happens
> As a user whose plans don’t always go smoothly, I want to ask the AI to reschedule my overdue tasks or plan the next week of tasks for my current stage, so that falling behind doesn’t make me give up and my plan keeps adapting to my real pace.

- **AC5.1** Given 2 or more tasks are due or overdue today, then “Too much today? Reshuffle” appears; using it spreads open tasks from today onward, keeps their order, and never schedules more than 2 per day. Toast: “Rescheduled. One step at a time! 🌱”.
- **AC5.2** “Plan my next days” / “Ask Mochi to plan more” adds 6–8 new tasks for that milestone covering about one week, building on tasks already done.
- **AC5.3** In a quest’s chat, Mochi knows the goal, milestones and their status, today’s tasks and my streak.
- **AC5.4** “Update my map” applies the changes agreed in the chat: cleared stages never change, kept stages keep their tasks, new stages start empty, and Mochi confirms in the chat.
- **AC5.5** While any AI action runs, its button shows a loading label (for example “Mochi is planning…”) and other AI actions are disabled. If it fails, a friendly toast explains what to do and nothing is changed.

## 6. Functional requirements

### 6.1 Screens and navigation
- Three main screens in a bottom dock: **Today** (pink tab), **Map** (blue tab), **Talk** (green tab). The header (logo, quest picker, level/XP/streak, Mochi) sits above all screens.
- Sign-in is required to save quests. Users sign up and sign in with their **phone number and a 6-digit SMS code** (Supabase phone auth with an SMS provider such as Twilio). Phone numbers use international format (for example +1 415 555 2671). Each user sees only their own data.
- Development, automated tests and demos use Supabase test phone numbers with fixed codes, so no real SMS is sent. Real SMS is only needed for the classmate trial.

### 6.2 AI behavior
| Action | Input | Output | Rules applied in code |
|---|---|---|---|
| Chat | persona + last 30 messages (+ quest context in project mode) | streamed text | message ≤ 3000 chars |
| Draw map | planning transcript | `QuestPlan` JSON: title, goal, deadline, daily minutes, milestones, starter tasks | 3–7 milestones, ascending dates ≤ deadline, deadline > today, 5–600 min/day, 6–10 starter tasks, ≤ 2 per day, dates ≥ today |
| Plan more | quest, milestone, done and open tasks | 6–8 tasks | same task rules, ≤ 14 per call |
| Reshuffle | open tasks with IDs and dates | new dates by ID | dates ≥ today, ≤ 2 per day, unknown IDs ignored |
| Update map | current plan + recent chat | updated milestones with kept IDs | cleared milestones unchanged, ≤ 8 milestones |

Mochi’s persona: cheerful, warm, never pushy or guilt-tripping; 2–4 plain sentences; one question at a time while planning; replies in the user’s language; never claims to be human; no medical, legal or financial advice.

### 6.3 Data
Quests → milestones (ordered) → tasks, plus planning/quest chat messages and diary entries per day. Calendar days are stored as local dates (`YYYY-MM-DD`). Details and limits are in `AGENTS.md` §1.2.

## 7. Design

The visual direction is **Y2K / Web 2.0 cute**, inspired by early-2000s glossy web portals; all characters and artwork are original. Full details: `AGENTS.md` §2.1, `docs/design/tokens.md`, mockups in `docs/design/mockups/`, interactive prototype linked in `docs/design/prototype-link.md`.

- Sky-blue gradient header with clouds and sparkles, rainbow bubble-letter logo, Mochi standing on a wooden flower shelf.
- Content panels are “windows” with glossy title bars and white sticker rims: pink for Mochi’s note, stamp card, goal and chat; blue for task lists, map and sheets; purple for the diary.
- Glossy gel buttons, heart-orb checkboxes, candy-striped progress bars, perforated postage stamps, a pastel town at the bottom of every page.
- Light mode and a starry purple-night dark mode. Gentle motion only, all disabled with reduced motion.

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Today and Map interactive in < 2 s on a mid-range phone over 4G. Task check feels instant (optimistic update). |
| Responsiveness | Works from 360 px phones to desktop; layout max width 640 px. |
| Accessibility | WCAG 2.2 AA: contrast, full keyboard use, screen-reader labels, ≥ 44 px touch targets, reduced motion. |
| Security and privacy | API keys server-only; Row Level Security on all tables; input validation on every API route; AI rate limit per user; AI and user text rendered as plain text; no phone numbers, chat or diary content in logs. |
| Reliability | AI failures never corrupt data; every AI result is validated before saving. Manual quest creation always works without AI. |
| Browser support | Latest two versions of Chrome, Safari (iOS and macOS), Firefox, Edge. |

## 9. Scope and release plan

### Sprint 1 — “Plan and play” (US-1, US-2, US-3, US-4 core)
| Suggested issue | Story | Title |
|---|---|---|
| #1 | — | Project setup: Next.js, TypeScript, lint, Prettier, CI |
| #2 | — | Supabase schema, RLS policies, repositories and phone sign-in |
| #3 | — | Design tokens and base UI: Window, GelButton, Chip, Field, Toast, Sheet |
| #4 | — | App shell: header, quest picker, HUD, dock |
| #5 | — | Test setup: Vitest, RTL, MSW, Playwright, coverage gate |
| #8 | US-1 | Mochi chat with streaming (new-quest mode) |
| #9 | US-1 | Manual quest form fallback |
| #10 | US-2 | Plan generation API + quest scroll + start quest |
| #12 | US-3 | Today screen: Mochi’s note and today’s quests |
| #14 | US-4 | Task check-off with XP, level and streak |
| #18 | US-2 | Quest map SVG and stage sheet |

### Sprint 2 — “Adapt and delight” (US-4 complete, US-5)
Stamp card and diary; reshuffle; plan more; quest chat with context and update map; goal sheet and quest deletion; empty/error state polish; accessibility audit; user testing with 5+ people and metric collection.

### Out of scope (this project)
Push or email reminders; calendar sync; sharing or social features; collaborating on one quest; native mobile apps; voice input; offline mode; payments; importing tasks from other tools.

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| AI returns malformed or unrealistic plans | Zod validation, clamping rules in code, retry button, manual form fallback. |
| AI cost or rate limits during demos | Fast model for chat, stronger model only for plans; per-user rate limit; cap history at 30 messages. |
| Time-zone bugs break streaks and due dates | All calendar logic uses local `YYYY-MM-DD` dates in pure functions with tests. |
| Glossy Y2K style hurts readability | Contrast rules, gloss limited to 42% of button height, text shadows, dark-mode tokens tested. |
| Users feel guilty when they fall behind | Mochi’s no-guilt tone, “no stress” copy for overdue tasks, one-tap reshuffle. |
| A stage auto-clears too early (only the planned week’s tasks were done) | Undo in the toast, automatic reopen when a task is unchecked or added, “Plan more” stays available. |
| SMS costs money and may not reach every phone | Test phone numbers for development and demos; set a low SMS rate limit; budget a few dollars for the classmate trial. |

## 11. Open questions
1. Should streaks forgive one missed day per week (“rest day”)? Decide in Sprint 2, after the classmate trial. Until then, AC4.4 applies (no rest days).
2. Do we let users edit task titles and due dates directly in Sprint 2, or only add and delete?

## 12. Decisions
| Date | Decision |
|---|---|
| 2026-10-28 | Stages clear automatically when their last open task is checked, with Undo and automatic reopen (AC4.6–AC4.8). Clearing early by hand is still allowed. |
| 2026-10-28 | Sign-in uses phone number + SMS code through Supabase phone auth. Test phone numbers are used for development, tests and demos. |
