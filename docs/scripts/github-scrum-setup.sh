#!/usr/bin/env bash
# One-shot owner setup for Questline Scrum:
#   milestones + MVP copy, even Yang/Yanni assignees, Projects v2 board with
#   Board columns, all issues linked, Sprint 1 issues → "Sprint Todo".
#
# WHY THE CLOUD AGENT CANNOT RUN THIS
#   Cursor Cloud Agents authenticate to GitHub as the GitHub App identity
#   `cursor[bot]` with an installation token (`ghs_…`). That is NOT Yang's
#   personal login. Installation tokens have no classic OAuth scopes
#   (`X-OAuth-Scopes` is empty). Retried after a claimed Issues+Projects
#   permission bump: milestone PATCH + assignee edit still 403
#   ("Resource not accessible by integration") — the live install still
#   lacks issues:write (or the run's token was minted before the grant).
#   Separately, GitHub Apps CANNOT create/manage user-owned Projects v2 at
#   all (no account-level Projects permission exists for Apps); createProjectV2
#   on Yang's user id stays FORBIDDEN even with org-style Projects write.
#   Interactive `gh auth login` is not available on the agent VM — do not
#   paste a PAT into chat. Run this script locally as Yang instead.
#
# RUN LOCALLY (as Yang-Zhang1994 or a repo admin) — never paste a PAT here:
#   gh auth login          # HTTPS, login as Yang-Zhang1994
#   gh auth refresh -s repo,project,read:project
#   bash docs/scripts/github-scrum-setup.sh
#
set -euo pipefail

REPO="Yang-Zhang1994/Questline"
OWNER="Yang-Zhang1994"
YANG="Yang-Zhang1994"
YANNI="Yifeicarrots" # GitHub profile name: "yanni"
TITLE="Questline Sprint Board"
S1_ISSUES=(1 2 3 4 5 6 7 8 9 17)
ALL_ISSUES=(1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21)

die() { echo "ERROR: $*" >&2; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"; }

need_cmd gh
need_cmd jq

echo "==> Auth check (must be a human user, not cursor[bot])"
gh auth status || die "gh is not authenticated — run: gh auth login"
VIEWER="$(gh api graphql -f query='query { viewer { login } }' --jq '.data.viewer.login')"
echo "    viewer=${VIEWER}"
case "${VIEWER}" in
  *'[bot]'*|cursor|github-actions*)
    die "logged in as '${VIEWER}' (GitHub App / bot). Re-auth as ${YANG}:
  gh auth logout
  gh auth login
  gh auth refresh -s repo,project,read:project
  bash docs/scripts/github-scrum-setup.sh"
    ;;
esac

# Soft scope hint (user tokens expose X-OAuth-Scopes; App tokens do not).
SCOPES="$(
  gh api -i user 2>/dev/null \
    | awk -F': ' 'BEGIN{IGNORECASE=1} $1 ~ /^x-oauth-scopes$/ { gsub(/\r/,"",$2); print $2; exit }' \
    || true
)"
if [[ -n "${SCOPES}" ]]; then
  echo "    X-OAuth-Scopes: ${SCOPES}"
  echo "${SCOPES}" | grep -q 'repo' \
    || echo "WARN: 'repo' scope missing — milestone/assignee edits may fail. Run: gh auth refresh -s repo,project,read:project"
  echo "${SCOPES}" | grep -Eq '(^|,)[[:space:]]*(read:)?project' \
    || echo "WARN: 'project' scope missing — board create may fail. Run: gh auth refresh -s repo,project,read:project"
fi

echo "==> Patch Sprint 1 milestone (due 2026-11-03)"
gh api "repos/${REPO}/milestones/1" -X PATCH \
  -f title='Sprint 1' \
  -f due_on='2026-11-03T23:59:59Z' \
  -f description="$(cat <<'EOF'
Sprint 1 MVP (~Oct 27 → Nov 3): foundation + onboarding + roadmap + daily quests.

- Repo scaffold, branching, CI lint (#1)
- Data model / SQLite persistence (#17)
- Chat with Mochi + one-question interview (#2, #3)
- Confirm measurable goal + milestone plan (#4, #5)
- Game-style roadmap (#6)
- Generate / show / check off today's quests (#7, #8, #9)

Workable MVP: user can onboard with Mochi, see a roadmap, and complete daily quests.
EOF
)" >/dev/null
echo "    Sprint 1 due_on=2026-11-03"

echo "==> Patch Sprint 2 milestone (due 2026-11-10)"
gh api "repos/${REPO}/milestones/2" -X PATCH \
  -f title='Sprint 2' \
  -f due_on='2026-11-10T23:59:59Z' \
  -f description="$(cat <<'EOF'
Sprint 2 MVP (Nov 3 → Nov 10): rewards, recovery, prototype extras, wrap-up.

- Advance stages when cleared (#10)
- XP / levels, streak, stamp card (#11, #12, #13)
- Reschedule overdue + week plan (#14, #15)
- Multi-goal selector, diary note, manual quest/plan (#18–#21)
- README with setup, usage, screenshots (#16)

Workable MVP: full cozy loop — rewards, catch-up with Mochi, extras, documented app.
EOF
)" >/dev/null
echo "    Sprint 2 due_on=2026-11-10"

assign_only() {
  local issue="$1" keep="$2" drop="$3"
  # Ensure keep is present; drop the other teammate if present.
  gh issue edit "$issue" --repo "$REPO" --add-assignee "$keep" >/dev/null
  gh issue edit "$issue" --repo "$REPO" --remove-assignee "$drop" >/dev/null 2>/dev/null || true
}

echo "==> Assign issues evenly (Yang vs Yanni=${YANNI})"
for n in 1 2 3 4 17; do assign_only "$n" "$YANG" "$YANNI"; done
for n in 5 6 7 8 9; do assign_only "$n" "$YANNI" "$YANG"; done
for n in 10 11 12 16 18 21; do assign_only "$n" "$YANG" "$YANNI"; done
for n in 13 14 15 19 20; do assign_only "$n" "$YANNI" "$YANG"; done
echo "    Yang:  #1 #2 #3 #4 #17 | #10 #11 #12 #16 #18 #21"
echo "    Yanni: #5 #6 #7 #8 #9  | #13 #14 #15 #19 #20"

echo "==> Create or reuse Project v2: ${TITLE}"
EXISTING_NUM="$(
  gh project list --owner "$OWNER" --limit 50 --format json \
    | jq -r --arg t "$TITLE" '.projects[] | select(.title==$t) | .number' \
    | head -1
)"
if [[ -n "${EXISTING_NUM}" ]]; then
  PROJECT_NUMBER="${EXISTING_NUM}"
  echo "    reusing existing project #${PROJECT_NUMBER}"
else
  CREATE_JSON="$(gh project create --owner "$OWNER" --title "$TITLE" --format json)"
  PROJECT_NUMBER="$(echo "$CREATE_JSON" | jq -r '.number')"
  echo "    created project #${PROJECT_NUMBER}"
fi
[[ -n "${PROJECT_NUMBER}" && "${PROJECT_NUMBER}" != "null" ]] || die "could not resolve project number"

PROJECT_ID="$(
  gh project view "$PROJECT_NUMBER" --owner "$OWNER" --format json | jq -r '.id'
)"
PROJECT_URL="$(
  gh project view "$PROJECT_NUMBER" --owner "$OWNER" --format json | jq -r '.url'
)"
echo "    id=${PROJECT_ID}"
echo "    url=${PROJECT_URL}"

echo "==> Link project to repo ${REPO}"
gh project link "$PROJECT_NUMBER" --owner "$OWNER" --repo "$REPO" >/dev/null 2>&1 \
  || echo "WARN: project link failed (may already be linked) — continue"

echo "==> Configure Status field columns (Board layout)"
# Fresh projects ship a Status single-select. Replace its options with the
# assignment columns. Do this BEFORE setting item Status values.
STATUS_FIELD_JSON="$(
  gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json \
    | jq -c '.fields[] | select(.name=="Status")'
)"
[[ -n "${STATUS_FIELD_JSON}" && "${STATUS_FIELD_JSON}" != "null" ]] \
  || die "Status field not found on project #${PROJECT_NUMBER}"
STATUS_FIELD_ID="$(echo "$STATUS_FIELD_JSON" | jq -r '.id')"
echo "    Status field id=${STATUS_FIELD_ID}"

STATUS_OPTS_JSON='[
  {"name":"Backlog","color":"GRAY","description":"Not yet scheduled"},
  {"name":"Sprint Todo","color":"BLUE","description":"Committed to current sprint"},
  {"name":"In Progress","color":"YELLOW","description":"Branch started"},
  {"name":"In Review","color":"PURPLE","description":"PR open"},
  {"name":"Done","color":"GREEN","description":"Merged / closed"}
]'
STATUS_UPDATE_PAYLOAD="$(jq -n \
  --arg fieldId "$STATUS_FIELD_ID" \
  --argjson opts "$STATUS_OPTS_JSON" \
  '{
    query: "mutation($fieldId:ID!, $opts:[ProjectV2SingleSelectFieldOptionInput!]!) { updateProjectV2Field(input: {fieldId: $fieldId, singleSelectOptions: $opts}) { projectV2Field { ... on ProjectV2SingleSelectField { id name options { id name } } } } }",
    variables: { fieldId: $fieldId, opts: $opts }
  }')"
STATUS_UPDATE_RESULT="$(echo "$STATUS_UPDATE_PAYLOAD" | gh api graphql --input -)"
echo "$STATUS_UPDATE_RESULT" | jq -e '.data.updateProjectV2Field.projectV2Field.options | length == 5' >/dev/null \
  || die "failed to set Status columns: ${STATUS_UPDATE_RESULT}"
echo "    columns: Backlog | Sprint Todo | In Progress | In Review | Done"

echo "==> Add all open issues (#1–#21) to the project"
for n in "${ALL_ISSUES[@]}"; do
  ISSUE_URL="https://github.com/${REPO}/issues/${n}"
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL" >/dev/null 2>&1 \
    || echo "WARN: item-add #${n} failed (may already be on the board)"
done

echo "==> Set Sprint 1 issues Status = Sprint Todo"
for n in "${S1_ISSUES[@]}"; do
  ISSUE_URL="https://github.com/${REPO}/issues/${n}"
  gh project item-edit "$PROJECT_NUMBER" \
    --owner "$OWNER" \
    --url "$ISSUE_URL" \
    --field "Status" \
    --value "Sprint Todo" >/dev/null \
    || die "failed to set Status=Sprint Todo on #${n}"
  echo "    #${n} → Sprint Todo"
done

echo "==> Leave Sprint 2 issues in Backlog (default / explicit)"
for n in 10 11 12 13 14 15 16 18 19 20 21; do
  ISSUE_URL="https://github.com/${REPO}/issues/${n}"
  gh project item-edit "$PROJECT_NUMBER" \
    --owner "$OWNER" \
    --url "$ISSUE_URL" \
    --field "Status" \
    --value "Backlog" >/dev/null 2>&1 \
    || echo "WARN: could not set Backlog on #${n}"
done

cat <<EOF

✓ Scrum setup complete
  Board:      ${PROJECT_URL}
  Layout:     open the project → View → Board (if not already)
  Columns:    Backlog | Sprint Todo | In Progress | In Review | Done
  Sprint Todo: #1–#9, #17
  Milestones: Sprint 1 → 2026-11-03; Sprint 2 → 2026-11-10
  Assignees:  Yang (${YANG}) / Yanni (${YANNI}) as printed above
EOF
