# Sprint 2 Retrospective — Questline (P2)

> **STATUS: DRAFT — Pending confirmation by both partners (`Yang-Zhang1994` and `Yifeicarrots`).**  
> Grounded in `git` commit history and PR merges from `2026-11-11` through `2026-11-15`.

**Sprint 2 Goal (from `docs/PRD.md`):** Stage advance, rewards (XP/streak/stamps), reschedule/week plan, multi-goal, diary, manual fallbacks, documentation, and production deployment (`#10`–`#16`, `#18`–`#21`, `#74`, `#80`, `#81`).  
**Participants:** Yang Zhang (`Yang-Zhang1994`) · Yanni Zhao (`Yifeicarrots`)

---

## What Went Well

- **All Sprint 2 features landed:**
  - Rewards & progression: XP & level-up toast (`#11`/PR `#42`), daily streak tracking with `active_day_completions` migration `004` (`#12`/PR `#43`), stamp card with `completed_local_date` migration `005` (`#13`/PR `#72`), and milestone stage advancement (`#10`/PR `#47`).
  - Recovery & flexibility: Plan next week (`#15`/PR `#73`), reschedule overdue quests (`#14`/PR `#76` + lazy AI client fix PR `#79`), manual quest add/delete (`#20`/PR `#77`), manual plan fallback (`#21`/PR `#51`), multi-goal selector (`#18`/PR `#48`), and daily diary autosave (`#19`/PR `#71`).
- **Production deployment & hardening:** Configured single-service Express + Vite SPA serving on Render (`#74`/PR `#75`, `render.yaml`) and added production env validation, `DATABASE_SSL`, `CORS_ORIGIN`, `SEED_DEMO_DATA`, and `ALLOW_ECHO_AI` (PR `#82`).
- **UI & UX polish:** Fixed bottom dock overlap (PR `#78`) and optimistic user message rendering in chat (`fix/chat-optimistic-message`).
- **Documentation & API contract:** Delivered `README.md` (`#16`/PR `#52`), `docs/openapi.yaml` and `docs/architecture.md` (PR `#56`), and synced schema/deployment docs for final submission.

## What Could Have Gone Better

- **Integration bugs surfaced late:** `proposeReschedule` wasn't initially forwarded in the lazy AI client wrapper in `server/src/app.ts`, requiring follow-up fix PR `#79`.
- **Security advisories deferred:** `npm audit --audit-level=high` flagged `zod@3.25.76` (`#80`) and `tinypool@1.1.1` via `vitest@3.2.7` (`#81`); both require breaking major-version bumps and remain `continue-on-error: true` in CI for now.
- **Known product gaps left out of scope for submission:** No diary history browser (only today's note), no rest-day streak forgiveness, and Playwright E2E tests remain unimplemented.

## Action Items / Next Steps (Post-Submission)

- Upgrade `zod` to 4.x (`#80`) and `vitest` to 5.x (`#81`), then make `npm audit --audit-level=high` blocking in CI.
- Add Playwright E2E coverage for Flows A/B/C and a diary history view.
- Confirm both partners' sign-off on [docs/contribution-log.md](../contribution-log.md) and both retrospectives.
