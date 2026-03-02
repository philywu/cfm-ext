# Claude Feature Manager

> A visual Kanban board for teams building with [Claude Code](https://claude.ai/code).

Claude Feature Manager (CFM) turns your `PLAN.md` feature file into a drag-and-drop Kanban board inside VS Code. It bridges the Claude Code `/feature` slash command workflow with a UI you can see, manage, and act on — without leaving your editor.

---

## Features

- **Kanban board** — seven status columns from backlog to archive, rendered as a webview panel inside VS Code
- **Live sync** — edits to `.feature/PLAN.md` are reflected in the board immediately; moving a card writes back to the file
- **Seven-stage lifecycle** — a clear, opinionated workflow designed around how Claude Code plans and implements features
- **Git branch tracking** — each card carries the branch it will be implemented on; the `/feature` command uses this to create and merge branches automatically
- **VS Code theme integration** — the board inherits your editor's color theme

---

## Requirements

- VS Code 1.109.0 or later
- A workspace folder open in VS Code
- [Claude Code](https://claude.ai/code) CLI (for the `/feature` slash command integration)

---

## Getting Started

### 1. Initialize your project

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
Claude Feature Manager: Init
```

This creates three files in your workspace:

| File | Purpose |
|------|---------|
| `.feature/PLAN.md` | The feature board — you edit this directly |
| `.feature/HOWTO.md` | Quick reference for the workflow |
| `.claude/commands/feature lifecycle manager.md` | The `/feature` slash command for Claude Code |

### 2. Open the board

Run from the Command Palette:

```
Claude Feature Manager: Open
```

The Kanban board opens in a side panel. Each column maps to one lifecycle stage.

### 3. Add your first feature

Open `.feature/PLAN.md` and add an entry under the `## #to-do` heading:

```markdown
## #to-do

### Receipt Export to CSV
Allow users to download their receipts as a CSV file.
```

Save the file. The card appears on the board instantly.

---

## The Seven-Stage Workflow

```
#to-do → #plan → #review → #goahead → #executing → #complete → #closed
```

| Stage | What happens here |
|-------|-------------------|
| **#to-do** | Your backlog. Add ideas here, no action required. |
| **#plan** | Move a card here when you want Claude Code to design a plan. Run `/feature plan`. |
| **#review** | Claude has created a plan doc. Read it, leave comments, approve or revise. |
| **#goahead** | You've approved the plan. Run `/feature goahead` — Claude creates a branch and implements the feature. |
| **#executing** | Implementation is in progress. Run `/feature executing` to fix issues or add missing items. |
| **#complete** | Feature is done. Run `/feature complete` — Claude merges the branch and archives the entry. |
| **#closed** | Archived. Logged in `.feature/FEATURE_LOG.md`. |

Move cards by dragging them between columns on the board, or by editing the status heading in `PLAN.md` directly.

---

## Using the `/feature` Slash Command

CFM sets up a `/feature` slash command in Claude Code that drives each lifecycle stage. Run it from the Claude Code chat panel inside VS Code.

```
/feature               # process all actionable stages
/feature plan          # only plan features in #plan
/feature goahead       # only implement features in #goahead
/feature executing     # only fix features in #executing
/feature complete      # only merge features in #complete
/feature review        # only revise plans in #review
```

Use a status argument to focus on one stage without touching others.

---

## PLAN.md Format

The board reads directly from `.feature/PLAN.md`. The format is standard Markdown:

- `## #<status>` — a column heading (one per stage)
- `### <Title>` — a feature card
- Body text — a short description of the feature
- `git-branch: <name>` — optional; sets which branch to merge into (defaults to `features`)
- `> Comment: ...` — feedback for Claude Code to act on during the next `/feature` run

**Example:**

```markdown
## #plan

### Dark Mode Support
Add a theme toggle to the settings panel.
git-branch: main

---

## #review

### Receipt Export to CSV
Export receipts as a downloadable CSV file.
git-branch: main
> Comment: Include line items in the export, not just receipt headers.
> Comment: Use semicolons as the delimiter, not commas.

---

## #goahead

### User Profile Page
Display avatar, username, and recent activity.
git-branch: develop

---

## #executing

### Budget Alerts
Send notifications when spending crosses a threshold.
git-branch: main
> Bug: Alert fires even when the budget period has not started yet.
```

---

## Git Integration

When `/feature goahead` runs, Claude Code creates a branch named `feature/<card-title>` from the branch specified in `git-branch:`. When `/feature complete` runs, that branch is merged back with `--no-ff` and a timestamped entry is appended to `.feature/FEATURE_LOG.md`.

| Stage | Git action |
|-------|------------|
| `#goahead` | `git checkout -b feature/<name>` from the parent branch |
| `#executing` | `git checkout feature/<name>` before applying fixes |
| `#complete` | `git merge feature/<name> --no-ff` into the parent branch |

If the parent branch does not exist yet, Claude Code creates it from the current HEAD.

---

## Commands

| Command | Description |
|---------|-------------|
| `Claude Feature Manager: Open` | Open the Kanban board panel |
| `Claude Feature Manager: Init` | Initialize `.feature/` folder and templates |

---

## Tips

- **Leave comments in `PLAN.md`, not in the execute docs.** Claude Code reads comments from `PLAN.md` and propagates them into the per-feature design document.
- **The execute doc is the source of truth.** Claude Code always re-reads `.feature/execute/<name>.md` before making any code changes.
- **Multiple features at once.** Running `/feature` with no argument processes all actionable stages in a single pass.
- **Merge conflicts.** Claude Code never force-resolves conflicts. Fix them manually, then re-run `/feature complete`.
- **Filter by stage.** Use `/feature <status>` to work on one stage without triggering unrelated work.

---

## Extension Settings

This extension does not add any VS Code settings at this time.

---

## License

MIT — see [LICENSE](LICENSE) for details.
