# Claude Feature Manager (CFM)

> Visual Kanban board for managing Claude Code feature development workflow

<div align="center">

**Status:** Early Development (v0.0.1) • **VS Code:** 1.109.0+

</div>

---

## Overview

**Claude Feature Manager (CFM)** is a VS Code extension that transforms the text-based `feature/PLAN.md` workflow into an interactive Kanban board. Designed for teams using [Claude Code](https://claude.ai/code), CFM provides a visual interface for tracking feature development from ideation to completion.

### Key Features

- 📋 **Visual Kanban Board** — Drag-and-drop interface for feature management
- 🔄 **Bidirectional Sync** — Changes in the board update `PLAN.md`, and vice versa
- 🎯 **Status-Driven Workflow** — Seven lifecycle stages from `#to-do` to `#closed`
- 🌲 **Git Branch Tracking** — Per-feature branch metadata automatically tracked
- 🎨 **VS Code Theming** — Seamlessly integrates with your editor theme

---

## Installation

### From Source

```bash
git clone <repository-url>
cd cfm-ext
npm install
npm run build
```

Then press **F5** in VS Code to launch the Extension Development Host.

### From Marketplace

*(Coming soon)*

---

## Quick Start

### 1. Initialize Your Project

Run the command:

```
Claude Feature Manager: Init
```

This creates:
- `.feature/PLAN.md` — The feature board file
- `.feature/HOWTO.md` — Usage guide
- `.claude/commands/feature lifecycle manager.md` — Claude command template

### 2. Open the Kanban Board

Run:

```
Claude Feature Manager: Open
```

The visual board opens, displaying seven status columns.

### 3. Add Your First Feature

Either:
- **Via Board**: Drag a card between columns (coming soon)
- **Via Markdown**: Edit `.feature/PLAN.md` directly:

```markdown
## #to-do

### Receipt Export to CSV
Allow users to download their receipts as a CSV file.
```

The board updates automatically on save.

---

## Feature Workflow

```
   #to-do  →  #plan  →  #review  →  #goahead  →  #executing  →  #complete  →  #closed
    Idea      Design    Approve     Implement     Test          Deploy       Archive
```

| Status | Purpose | Next Action |
|--------|---------|-------------|
| **#to-do** | Feature backlog | Move to `#plan` when ready |
| **#plan** | Design phase | Create design doc, move to `#review` |
| **#review** | Awaiting approval | Add comments, move to `#goahead` or back to `#plan` |
| **#goahead** | Ready to implement | Branch created, move to `#executing` |
| **#executing** | In development | Implement feature, move to `#complete` |
| **#complete** | Done, needs merge | Test, merge branch, move to `#closed` |
| **#closed** | Archived | Logged in `FEATURE_LOG.md` |

---

## Usage

### Adding Features

Edit `.feature/PLAN.md`:

```markdown
## #to-do

### Dark Mode Support
Add dark mode toggle to settings panel.

### User Profile Page
Display user info, avatar, and recent activity.
git-branch: main
```

The `git-branch:` field is optional and defaults to `features`.

### Moving Features

Drag cards between columns in the Kanban UI, or manually move entries between status sections in `PLAN.md`.

### Tracking Implementation

Features in `#goahead` or `#executing` can have detailed design documents:

```
.feature/
├── PLAN.md
├── HOWTO.md
├── execute/
│   ├── dark-mode-support.md
│   └── user-profile-page.md
└── FEATURE_LOG.md
```

---

## Architecture

CFM uses a **Model-View-Controller** pattern split across VS Code's runtime environments:

```
┌─────────────────────────────────────────┐
│  Extension Host (Node.js)               │
│  • File I/O (.feature/PLAN.md)          │
│  • Git operations (branch metadata)     │
│  • Markdown parsing (unified + remark)  │
│  • postMessage routing                  │
└──────────────┬──────────────────────────┘
               │
               │ postMessage API
               │
┌──────────────▼──────────────────────────┐
│  Webview (React + Tailwind)             │
│  • Kanban UI (@dnd-kit/core)            │
│  • Drag-and-drop state                  │
│  • VS Code theme integration            │
└─────────────────────────────────────────┘
```

### Message Protocol

| Message | Direction | Payload |
|---------|-----------|---------|
| `updateView` | Host → Webview | Full `KanbanData` JSON |
| `moveFeature` | Webview → Host | `{ featureId, newStatus }` |
| `updateCard` | Webview → Host | Modified card data |
| `initProject` | Webview → Host | Trigger project initialization |

---

## Development

### Prerequisites

- Node.js 22+
- VS Code 1.109.0+

### Build Commands

```bash
npm run compile       # One-off TypeScript build
npm run watch         # Incremental TS build (development)
npm run build:webview # Build React webview bundle
npm run build         # Full build (extension + webview + templates)
npm run lint          # ESLint check
npm run test          # Run vscode-test suite
```

### Project Structure

```
cfm-ext/
├── src/                          # Extension Host (Node.js)
│   ├── extension.ts              # Activation, commands, panel controller
│   ├── planParser.ts             # PLAN.md parsing/serialization
│   ├── gitClient.ts              # Git operations (planned)
│   ├── types.ts                  # Shared TypeScript types
│   └── template/                 # Initial project templates
│       ├── PLAN.md
│       ├── HOWTO.md
│       └── feature lifecycle manager.md
│
├── webview/                      # Webview UI (React)
│   ├── src/
│   │   ├── App.tsx               # Kanban board root
│   │   ├── main.tsx              # React entry point
│   │   ├── vscodeApi.ts          # postMessage wrapper
│   │   ├── theme.css             # VS Code theming
│   │   └── components/
│   │       ├── Column.tsx        # Status column
│   │       ├── FeatureCard.tsx   # Draggable card
│   │       └── CardDetail.tsx    # Card detail view
│   ├── vite.config.ts            # Vite bundler config
│   └── tsconfig.json
│
├── out/                          # Compiled output (gitignored)
├── package.json
└── tsconfig.json
```

### Running Locally

1. Clone the repository
2. `npm install`
3. Press **F5** in VS Code
4. In the Extension Development Host, run `Claude Feature Manager: Init`
5. Run `Claude Feature Manager: Open` to launch the board

---

## Roadmap

- [x] Basic Kanban board rendering
- [x] PLAN.md parsing
- [x] Project initialization command
- [ ] Full drag-and-drop functionality
- [ ] Real-time markdown sync
- [ ] Git branching integration (`features-meta` orphan branch)
- [ ] Card detail editing in webview
- [ ] Search and filter features
- [ ] Multi-workspace support
- [ ] VSCode marketplace publication

---

## Contributing

This project is in early development. Contributions welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Technical Details

### Markdown Parsing

CFM uses `unified` + `remark-parse` for robust markdown parsing:
- `## #<status>` headings → Kanban columns
- `### <title>` headings → Feature cards
- `git-branch: <name>` → Branch metadata
- `> comment` → Action items

### VS Code Integration

- **Commands**: `cfm-ext.openPanel`, `cfm-ext.init`
- **Activation**: On command invocation
- **File Watching**: `onDidChangeTextDocument` for live sync
- **Webview**: Persistent panel with script execution enabled

### Dependencies

- **Extension Host**: `unified`, `remark-parse` (planned)
- **Webview**: `react`, `@dnd-kit/core`, `tailwindcss`
- **Build**: `typescript`, `vite`, `eslint`

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Inspired by the [Claude Code](https://claude.ai/code) feature workflow
- Built with the [VS Code Extension API](https://code.visualstudio.com/api)
- UI powered by [@dnd-kit](https://dndkit.com/)

---

<div align="center">

Made with ❤️ for the Claude Code community

</div>
