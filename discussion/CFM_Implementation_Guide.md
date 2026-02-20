# Technical Specification: Claude Feature Manager (CFM)

## 1. Overview
The **Claude Feature Manager (CFM)** is a VS Code extension designed to provide a visual interface for the `feature/PLAN.md` workflow popularized by Claude Code. It bridges the gap between structured documentation and active development by providing a Kanban board that synchronizes with the local filesystem and Git metadata.

---

## 2. System Architecture
The extension follows a **Model-View-Controller (MVC)** pattern within the VS Code environment:
- **Model**: `feature/PLAN.md` (Stored in a `features-meta` orphan branch).
- **View**: A React-based Kanban board rendered in a VS Code Webview.
- **Controller**: The VS Code Extension Host, managing file I/O, Git operations, and communication.

# Technical Specification: Claude Feature Manager (CFM) Prototype

## 3. Core Tech Stack
The prototype utilizes a decoupled architecture to ensure both performance and ease of customization.

* **Extension Framework:** VS Code Extension API
* **Frontend UI:** React + Tailwind CSS (Running inside the VS Code Webview container)
* **Drag-and-Drop Library:** `@dnd-kit/core` (Lightweight and highly customizable)
* **Markdown Parsing:** `unified` + `remark-parse` (Superior to RegEx for handling complex Markdown structures reliably)

---

## 4. Core Module Design

### A. Backend: PlanParser (Extension Host)
The "Brain" of the extension. It manages the lifecycle of the `feature/PLAN.md` file.

* **File Watching:** Listens to the `onDidChangeTextDocument` event. It triggers a re-parse immediately upon file save to ensure the UI is always in sync with the source code.
* **Parsing Logic:**
    1.  **Column Identification:** Identifies secondary headings (`## #<Status>`) as the primary status columns.
    2.  **Task Extraction:** Extracts all tertiary headings (`### <Title>`) directly underneath a status heading as individual task cards.
    3.  **Data Serialization:** Aggregates the parsed titles, metadata (like `git-branch`), and descriptions into a structured JSON object to be sent to the Webview.



### B. Frontend: KanbanUI (Webview)
The "Face" of the extension. It provides the interactive visualization of the feature roadmap.

* **Standard Kanban Layout:**
    * **Columns:** Iteratively renders the seven lifecycle status columns defined by the Claude Code methodology.
    * **Cards:** Each card displays the Feature Title and its corresponding `git-branch` label.
* **Interaction Flow:**
    * **State Management:** Local React state handles the immediate drag-and-drop feedback (Optimistic UI).
    * **Message Dispatch:** Upon completion of a drag-and-drop action, it calculates the new status and sends a `moveFeature` message back to the Extension Host.



---

## 5. Communication Interface (API)
Communication between the Webview and the Extension Host is handled via the VS Code `postMessage` API.

| Message Type | Direction | Payload |
| :--- | :--- | :--- |
| `updateView` | Host -> Webview | The full `KanbanData` JSON object. |
| `moveFeature` | Webview -> Host | `{ featureId: string, newStatus: string }` |
| `initProject` | Webview -> Host | Command to create the initial `feature/` directory. |


---

## 6. Directory Structure
```text
cfm-extension/
├── src/                    # Backend (Extension Host)
│   ├── extension.ts        # Entry point & Message Router
│   ├── planParser.ts       # Unified/Remark Markdown engine
│   └── gitClient.ts        # Git commands for Meta-branching
├── webview/                # Frontend (React + Vite)
│   ├── src/
│   │   ├── App.tsx         # Dnd-kit Context & State
│   │   ├── components/     # Column.tsx, FeatureCard.tsx
│   │   └── theme.css       # VS Code variable mapping
│   └── vite.config.ts      # Single-bundle build config
├── package.json            # Manifest & Commands
└── README.md
