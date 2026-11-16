# Sprint 1 Retrospective — Questline (P2)

> **STATUS: Yang Zhang confirmed (`2026-11-15`). Pending confirmation by Yanni Zhao (`Yifeicarrots`).**  
> Grounded in `git` commit history and PR merges from `2026-10-27` through `2026-11-12`.

**Sprint 1 Goal (from `docs/PRD.md`):** Onboarding chat → confirm Goal + Milestones → roadmap → complete today's Quests (`#1`–`#9`, `#17`, plus `#31`, `#32`).  
**Participants:** Yang Zhang (`Yang-Zhang1994`) · Yanni Zhao (`Yifeicarrots`)

---

## What Went Well

- **Clean stack lock & PostgreSQL migration early:** Locking the stack to React + Vite + Express 5 + PostgreSQL + TailwindCSS + JWT (`#27`, `#17`/PR `#30`, `#32`/PR `#33`, `#31`/PR `#34`) eliminated drift between SQLite prototype code and the production architecture.
- **Full Flow A & Flow B MVP landed:**
  - Mochi chat shell (`#2`/PR `#36`), one-question goal interview (`#3`/PR `#37`), and `GoalConfirmCard` (`#4`/PR `#38`) established the confirm-before-save pattern.
  - Game-style roadmap (`#6`/PR `#62`), milestone planning (`#5`/PR `#64`), daily quest generation (`#7`/PR `#67`), Today greeting (`#8`/PR `#69`), and quest check-off/undo (`#9`/PR `#70`) completed the core loop.
- **Fast bug turnaround:** Caught and fixed the interview Time-topic loop (`#53`), free-text deadline handling in milestone planning (`#68`), and roadmap final-goal node labeling (`#66`).
- **Balanced ownership recovery:** Reverting `#8`/`#9` (PR `#61`) allowed Yanni to re-implement and own the Today greeting and quest check-off PRs (`#69`, `#70`) cleanly.

## What Could Have Gone Better

- **Schedule slip & initial imbalance:** Planning/scaffolding ran Oct 27–29, followed by a quiet gap until Nov 9, which compressed Sprint 1 implementation into Nov 9–12 (past the original Nov 3 target).
- **Stacked PRs & rework:** Early Today UI work (`#8`/`#9`) landed before ownership was split cleanly, requiring a surgical revert (PR `#61`) and restack of dependent branches.
- **Process tracking lag:** Standup/retro notes (`#54`, `#55`) and the partner contribution log needed catch-up updates after the main coding push.

## Action Items Carried Into Sprint 2

- Keep one Issue per branch and coordinate Today/Map/Talk ownership upfront to avoid reverts.
- Have both partners actively review and merge each other's PRs.
- Land Sprint 2 features (`#10`–`#15`, `#18`–`#21`), deployment (`#74`), and documentation (`#16`, OpenAPI, architecture) before submission.

## Partner Confirmation

- [x] **Yang Zhang (`Yang-Zhang1994`)** — reviewed and confirmed (`2026-11-15`)
- [ ] **Yanni Zhao (`Yifeicarrots`)** — reviewed and confirmed
