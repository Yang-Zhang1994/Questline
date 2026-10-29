# Questline — Mochi's Quest Diary

Cozy life-sim goal tracker: chat with **Mochi**, confirm a measurable goal, walk a game-style roadmap, and complete small daily quests.

## Docs

- Product: [`docs/PRD.md`](docs/PRD.md)
- Agent instructions: [`AGENTS.md`](AGENTS.md)
- Design / prototype: [`docs/design/`](docs/design/)
- Data model: [`docs/data-model.md`](docs/data-model.md)

## Setup (scaffold)

Requires **Node.js 22+**.

```bash
npm install
npm run lint
npm run format:check
```

Full app (Vite client + Express server) lands with Issue #1 and follow-on feature Issues.

### One-shot GitHub scrum (owner only)

Cloud Agents authenticate as `cursor[bot]` (GitHub App) and **cannot** create the Project board, patch milestones, or reassign issues. As **Yang-Zhang1994** on your laptop:

```bash
gh auth login
gh auth refresh -s repo,project,read:project
bash docs/scripts/github-scrum-setup.sh
```

Never paste a personal access token into chat or the repo.

## Mockup

https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y
