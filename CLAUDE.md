# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**Claude Feature Manager (CFM)** — a VS Code extension that renders a Kanban board UI synchronized with a `feature/PLAN.md` file stored in a `features-meta` orphan Git branch. It visualizes the Claude Code `feature/PLAN.md` workflow as draggable cards.

## Commands

```bash
npm run compile       # One-off TypeScript build (output → out/)
npm run watch         # Incremental TS build (used during development)
npm run lint          # ESLint over src/
npm run test          # Compile + lint + run vscode-test (launches Electron)
```

To run a single test file, there is no built-in filter — `vscode-test` discovers all `out/test/**/*.test.js` files. Add `.only` in Mocha (`suite.only` / `test.only`) to isolate a single test, then revert before committing.

Press **F5** in VS Code to launch the Extension Development Host (uses the `Run Extension` launch config, which triggers the `watch` build task first).

## Architecture

This extension is early-stage (currently at scaffold). The planned architecture from `discussion/CFM_Implementation_Guide.md`:

**MVC split across two runtimes:**

| Layer | Runtime | Role |
|---|---|---|
| Model | Extension Host | `feature/PLAN.md` on an orphan branch (`features-meta`) |
| View | Webview (iframe) | React + Tailwind Kanban board |
| Controller | Extension Host | File I/O, Git ops, postMessage routing |

**Planned `src/` modules (Extension Host — Node.js, full API access):**
- `extension.ts` — activation entry point, command registration, postMessage router
- `planParser.ts` — parses `feature/PLAN.md` using `unified` + `remark-parse`; maps `## #<Status>` headings → columns, `### <Title>` headings → cards
- `gitClient.ts` — Git operations for the `features-meta` orphan branch

**Planned `webview/` (React + Vite, browser sandbox):**
- Built as a single bundle; injected into a `vscode.WebviewPanel`
- `App.tsx` — `@dnd-kit/core` drag context + local optimistic state
- `components/Column.tsx`, `components/FeatureCard.tsx`
- `theme.css` — maps VS Code CSS variables to Tailwind/component tokens
- `vite.config.ts` — single-bundle output config

**postMessage API between the two runtimes:**

| Message | Direction | Payload |
|---|---|---|
| `updateView` | Host → Webview | Full `KanbanData` JSON |
| `moveFeature` | Webview → Host | `{ featureId, newStatus }` |
| `initProject` | Webview → Host | Triggers creation of `feature/` directory |

## Key Constraints

- The Webview runs in a sandboxed iframe with no Node.js or VS Code API access — all privileged operations must go through `postMessage` to the Extension Host.
- The `features-meta` branch is an **orphan branch** (no shared history with the working repo). Git operations must account for this (e.g., `git checkout --orphan`).
- Extension output compiles to `out/` (gitignored). The webview bundle will also need its own build step separate from `tsc`.
- `tsconfig.json` targets `ES2022` / `Node16` modules with strict mode enabled.
