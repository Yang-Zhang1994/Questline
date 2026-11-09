# Scrum & Git workflow

Companion to `AGENTS.md` §3. Pair workflow for Questline P2.

## Board & sprints

GitHub Project **[Questline Sprint Board](https://github.com/users/Yang-Zhang1994/projects/1)** columns: `Backlog → Sprint Todo → In Progress → In Review → Done`.

- Move to **In Progress** on branch create, **In Review** on PR open, **Done** on merge.
- Work current-sprint Issues only unless told otherwise.
- Use GitHub milestones for sprints (≥5 Issues each). Joint planning, standups, and retros are pair process — capture outcomes in Issues/PR notes as needed.

## Branch naming

```
<type>/<issue-number>-<short-kebab-description>
```

Types: `feature`, `fix`, `chore`, `docs`, `test`, `refactor`. Branch from latest `main`. One Issue per branch.

## Commit message format

```
<type>(<scope>): <imperative summary, max 72 chars> (#<issue>)
```

Scopes: `client`, `server`, `ai`, `db`, `shared`, `ci`, `docs`, `auth`. Never commit secrets, `.env`, DB dumps, or `*.sqlite`.

## PR workflow

1. PR against `main`; title in commit format.
2. Body: `Closes #<issue>`, summary, AC checklist, UI screenshots/GIF when UI changes, how tested.
3. CI (lint, type-check, tests, security scan when configured) must pass.
4. ≥1 teammate approving review; squash-merge; delete branch. No direct pushes to `main`.
5. Aim for balanced partner reviews across the pair (rubric: substantial history from both).

## Referencing Issues

- Commits end with `(#N)`.
- PRs: `Closes #N` / `Refs #N`.
- Code: `// TODO(#N): ...` only.
- Tests may cite the Issue in a comment when encoding an AC.
- Note `Depends on #N` when needed.
