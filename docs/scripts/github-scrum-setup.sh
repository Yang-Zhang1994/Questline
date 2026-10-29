#!/usr/bin/env bash
# Owner-run setup: milestones, even assignees (Yang / Yanni), and Questline Sprint Board.
# The cloud agent token cannot create projects or edit milestones/assignees (403).
# Run as Yang-Zhang1994 (or an admin) with: gh auth login  (scopes: project, repo)
set -euo pipefail

REPO="Yang-Zhang1994/Questline"
OWNER="Yang-Zhang1994"
YANG="Yang-Zhang1994"
YANNI="Yifeicarrots" # GitHub name: "yanni"

echo "==> Patch Sprint 1 milestone (due 2026-11-03)"
gh api "repos/${REPO}/milestones/1" -X PATCH \
  -f due_on='2026-11-03T23:59:59Z' \
  -f description='Sprint 1 MVP (~Oct 27 → Nov 3): foundation + onboarding + roadmap + daily quests.

- Repo scaffold, branching, CI lint (#1)
- Data model / SQLite persistence (#17)
- Chat with Mochi + one-question interview (#2, #3)
- Confirm measurable goal + milestone plan (#4, #5)
- Game-style roadmap (#6)
- Generate / show / check off today'\''s quests (#7, #8, #9)

Workable MVP: user can onboard with Mochi, see a roadmap, and complete daily quests.'

echo "==> Patch Sprint 2 milestone (due 2026-11-10)"
gh api "repos/${REPO}/milestones/2" -X PATCH \
  -f due_on='2026-11-10T23:59:59Z' \
  -f description='Sprint 2 MVP (Nov 3 → Nov 10): rewards, recovery, prototype extras, wrap-up.

- Advance stages when cleared (#10)
- XP / levels, streak, stamp card (#11, #12, #13)
- Reschedule overdue + week plan (#14, #15)
- Multi-goal selector, diary note, manual quest/plan (#18–#21)
- README with setup, usage, screenshots (#16)

Workable MVP: full cozy loop — rewards, catch-up with Mochi, extras, documented app.'

echo "==> Assign issues evenly (Yang vs Yanni)"
# Sprint 1 — Yang: foundation + interview/goal; Yanni: milestones + daily quests
for n in 1 2 3 4 17; do
  gh issue edit "$n" --repo "$REPO" --add-assignee "$YANG" --remove-assignee "$YANNI" || true
done
for n in 5 6 7 8 9; do
  gh issue edit "$n" --repo "$REPO" --add-assignee "$YANNI" --remove-assignee "$YANG" || true
done
# Sprint 2 — Yang: advance/XP/streak/readme/multi-goal/manual plan; Yanni: stamps/reschedule/week/diary/manual quests
for n in 10 11 12 16 18 21; do
  gh issue edit "$n" --repo "$REPO" --add-assignee "$YANG" --remove-assignee "$YANNI" || true
done
for n in 13 14 15 19 20; do
  gh issue edit "$n" --repo "$REPO" --add-assignee "$YANNI" --remove-assignee "$YANG" || true
done

echo "==> Create Project v2: Questline Sprint Board"
PROJECT_URL=$(gh project create --owner "$OWNER" --title "Questline Sprint Board" --format json | jq -r '.url')
PROJECT_NUMBER=$(gh project list --owner "$OWNER" --limit 20 --format json \
  | jq -r '.projects[] | select(.title=="Questline Sprint Board") | .number' | head -1)
echo "Project: $PROJECT_URL (number=$PROJECT_NUMBER)"

# Ensure Status field options exist (Backlog, Sprint Todo, In Progress, In Review, Done).
# Fresh projects usually ship with Todo/In Progress/Done — edit in UI if option names differ,
# or use: gh project field-list <number> --owner <owner>
echo "==> Add all open issues to the project"
for n in $(seq 1 21); do
  ISSUE_URL="https://github.com/${REPO}/issues/${n}"
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL" || true
done

echo "==> Move Sprint 1 issues (#1–#9, #17) to Status = Sprint Todo (set Status in the Board UI if CLI field ids differ)"
echo "Open the board, switch layout to Board, rename/add columns:"
echo "  Backlog | Sprint Todo | In Progress | In Review | Done"
echo "Then drag Sprint 1 issues into Sprint Todo."
echo "Done. Board URL: $PROJECT_URL"
