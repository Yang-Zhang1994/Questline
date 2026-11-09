# Testing, TDD & CI

Companion to `AGENTS.md` §1.6 / §4–5. Stack: Vitest, RTL, Supertest + test Postgres, Playwright, GitHub Actions.

## Levels

| Level     | Tool                      | What to test                                    |
| --------- | ------------------------- | ----------------------------------------------- |
| Unit      | Vitest                    | XP/level, streaks, stamps, scheduling, AI parse |
| Component | Vitest + RTL              | Send message, check quest, roadmap, rest-day    |
| API       | Supertest + test Postgres | Success, validation, auth, not found            |
| E2E       | Playwright                | Onboarding, daily quests, reschedule (flows A–C)|

## TDD & patterns

- **Red → green → refactor.** Prefer committing a failing test before implementation on feature Issues.
- Test **behavior** (role/label/text/`data-*` state), not Tailwind class names.
- **Never call the real Claude API** — mock `server/src/ai/client.ts` with fixtures (include malformed JSON).
- Date logic uses an injectable clock (`server/src/clock.ts`); use the user's local `YYYY-MM-DD`.
- Map each Issue AC to ≥1 test. **Interactive UI AC → ≥1 RTL test** (API tests alone are not enough).
- Auth: cover unauthenticated 401 and wrong-user ownership cases on protected routes.

## Coverage & CI

- Coverage targets: ≥80% `server/src/services` + `server/src/ai/parse.ts`; ≥70% overall.
- CI must fail on lint, type errors, or failing tests.
- Prefer multi-stage GitHub Actions: install → lint/typecheck → unit/API → e2e (when ready) → security scan (`npm audit` / configured scanner).
- Deploy previews and env management land via dedicated Issues; do not invent deploy tooling in unrelated PRs.

## Definition of Done (testing slice)

AC met (or leftovers listed); tests green in CI including RTL when UI AC exist; Claude mocked; no secrets in logs or fixtures.
