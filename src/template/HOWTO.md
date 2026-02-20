# Feature Workflow — How To Use

The `/feature` slash command manages your features from idea to archive using a simple status-driven board in `PLAN.md`.

---

## Lifecycle at a Glance

```text
You add idea        Agent plans it       You review
   #to-do    →         #plan       →      #review
                           ↓
              You approve → #goahead
                           ↓ (branch created)
              Agent implements → #executing
                           ↓
              You test & confirm → #complete
                           ↓ (branch merged)
              Agent logs it → #closed
```

---

## The Files

| File | Your role |
| ---- | --------- |
| `feature/PLAN.md` | The board — add features, change statuses, leave comments |
| `feature/execute/<name>.md` | Per-feature design doc — created by the agent, read by you |
| `feature/FEATURE_LOG.md` | Auto-generated changelog — do not edit manually |

---

## Running the Command

```text
/feature                  # process all actionable statuses
/feature plan             # only process #plan features
/feature goahead          # only process #goahead features
/feature executing        # only process #executing features
/feature complete         # only process #complete features
/feature review           # only process #review features
```

Use the status-filter argument to focus on one stage at a time — handy when you are iterating on a specific feature without triggering unrelated work.

---

## Step-by-Step Guide

### 1. Add a feature idea

Open `feature/PLAN.md` and add an entry under `## #to-do`:

```markdown
## #to-do

### Receipt Export to CSV
Allow users to download their receipts as a CSV file via a new GET endpoint.
```

This is just a backlog slot. The agent ignores `#to-do` entries.

---

### 2. Move it to `#plan` when you're ready

Cut the entry from `## #to-do` and paste it under `## #plan`.

Optionally add a `git-branch:` line to set which branch the feature will be merged into when complete. If omitted the agent defaults to `features`.

```markdown
## #plan

### Receipt Export to CSV
Allow users to download their receipts as a CSV file via a new GET endpoint.
git-branch: main
```

Then run `/feature plan`.

The agent will:

- Enter plan mode and explore the codebase
- Create `feature/execute/receipt-export-to-csv.md` with a full implementation plan
- Move the entry to `## #review` in `PLAN.md`

---

### 3. Review the plan

Open `feature/execute/receipt-export-to-csv.md` and read the plan.

**If you want changes**, add comments directly under the feature entry in `PLAN.md`:

```markdown
## #review

### Receipt Export to CSV
git-branch: main

> Comment: Also include line items in the export, not just receipt headers.
> Comment: Use semicolons as the delimiter, not commas.
```

Run `/feature review` — the agent will update the plan doc to reflect your feedback.

**If the plan looks good**, move the entry to `## #goahead`:

```markdown
## #goahead

### Receipt Export to CSV
git-branch: main
```

---

### 4. Let the agent implement it

Run `/feature goahead`.

The agent will:

- Read the `git-branch:` value (or default to `features`)
- Create branch `feature/receipt-export-to-csv` from that parent branch
- Implement all steps from the execute doc on that branch
- Commit the changes
- Record `**Git Branch:**` and `**Git Parent:**` in the execute doc
- Move the entry to `## #executing` in `PLAN.md`

---

### 5. Test and give feedback

Check out the feature branch and test manually, or run the scripts in `tests/`.

**If something needs fixing**, add feedback under the entry in `PLAN.md`:

```markdown
## #executing

### Receipt Export to CSV
git-branch: main

> Bug: The date column is formatted as a Unix timestamp, should be YYYY-MM-DD.
> Missing: No Content-Disposition header, browser does not prompt a download.
```

Run `/feature executing` — the agent will switch to the feature branch, fix the issues, and commit.

**When everything works**, move the entry to `## #complete`:

```markdown
## #complete

### Receipt Export to CSV
```

---

### 6. Archive and merge

Run `/feature complete`.

The agent will:

- Read `**Git Branch:**` and `**Git Parent:**` from the execute doc
- Merge `feature/receipt-export-to-csv` into the parent branch (no fast-forward)
- Append a timestamped entry to `feature/FEATURE_LOG.md` including the branch info
- Move the feature to `## #closed` in `PLAN.md`

If the merge has conflicts the agent stops and reports them — resolve manually, then re-run `/feature complete`.

---

## Git Branching

| Stage | Git action |
| ----- | ---------- |
| `#goahead` processing | `git checkout -b feature/<name>` from parent branch |
| `#executing` processing | `git checkout feature/<name>` before any fixes |
| `#complete` processing | `git merge feature/<name> --no-ff` into parent branch |

**Setting the parent branch** — add `git-branch: <name>` anywhere in the feature entry in `PLAN.md`:

```markdown
### My Feature
Short description.
git-branch: develop
```

If the parent branch does not exist yet, the agent creates it from the current HEAD.

---

## Tips

- **Filter by status** — use `/feature <status>` to work on one stage at a time. No argument processes everything.
- **Leave comments in PLAN.md, not in the execute doc** — the agent reads comments from PLAN.md and propagates them into the execute doc.
- **The execute doc is the source of truth** — the agent always reads it before making any code changes.
- **Multiple features at once** — features at different stages are handled independently in a single run.
- **Merge conflicts** — the agent will never force-resolve them. Fix manually and re-run `/feature complete`.

---

## Example PLAN.md Snapshot

```markdown
## #plan

### Merchant Alias Support
Let users add nicknames for merchants.
git-branch: develop

---

## #review

### Receipt Export to CSV
git-branch: main
> Comment: Include line items. Use semicolons as delimiter.

---

## #goahead

### Dark Mode Flag
Add a user preference toggle for dark mode.
git-branch: main

---

## #executing

### Budget Alerts
git-branch: main
> Bug: Alert fires even when the budget period has not started yet.

---

## #complete

### UDP Category System
```

Running `/feature` (no argument) against this would:

1. Create a plan doc for **Merchant Alias Support**
2. Update the plan doc for **Receipt Export to CSV** with the comments
3. Create branch `feature/dark-mode-flag` from `main` and implement **Dark Mode Flag**
4. Checkout `feature/budget-alerts`, fix the bug, commit — for **Budget Alerts**
5. Merge `feature/udp-category-system` into its parent branch and log **UDP Category System**
