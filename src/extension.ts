import * as vscode from 'vscode';
import { exec } from 'child_process';
import { parsePlan, serializePlan } from './planParser';
import { Card, KanbanData, WebviewToHostMessage, AddCardMessage, GetLogMessage, DeleteCardMessage } from './types';
import { getUserName, writeLogEntry, diffKanbanData, diffCard, parseLogFile, LogEntry } from './logger';

const PLAN_PATH = '.feature/PLAN.md';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('cfm-ext.openPanel', () => {
            CfmPanel.createOrShow(context);
        }),
        vscode.commands.registerCommand('cfm-ext.init', () => {
            initFeatureFolder(context);
        })
    );
}

export function deactivate() {}

function runGitInit(cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec('git init', { cwd }, (err, _stdout, stderr) => {
            if (err) { reject(new Error(stderr || err.message)); } else { resolve(); }
        });
    });
}

async function initFeatureFolder(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('CFM: No workspace folder open.');
        return;
    }

    // Check if git is already initialised
    const gitDir = vscode.Uri.joinPath(workspaceRoot, '.git');
    let hasGit = false;
    try {
        await vscode.workspace.fs.stat(gitDir);
        hasGit = true;
    } catch {
        // .git does not exist
    }

    if (!hasGit) {
        const choice = await vscode.window.showInformationMessage(
            'This workspace has no git repository. Run git init?',
            { modal: true },
            'Yes',
            'No'
        );
        if (choice === 'Yes') {
            try {
                await runGitInit(workspaceRoot.fsPath);
                vscode.window.showInformationMessage('CFM: git init completed.');
            } catch (err) {
                vscode.window.showErrorMessage(`CFM: git init failed — ${err}`);
                return;
            }
        }
        // 'No' or dismissed: fall through and continue init
    }

    const featureDir = vscode.Uri.joinPath(workspaceRoot, '.feature');
    const claudeCommandsDir = vscode.Uri.joinPath(workspaceRoot, '.claude', 'commands');
    const templateDir = vscode.Uri.joinPath(context.extensionUri, 'out', 'template');

    async function copyIfAbsent(src: vscode.Uri, dest: vscode.Uri) {
        try {
            await vscode.workspace.fs.stat(dest);
            // File exists — skip
        } catch {
            await vscode.workspace.fs.copy(src, dest);
        }
    }

    try {
        await vscode.workspace.fs.createDirectory(featureDir);
        await vscode.workspace.fs.createDirectory(claudeCommandsDir);

        for (const file of ['PLAN.md', 'HOWTO.md']) {
            await copyIfAbsent(
                vscode.Uri.joinPath(templateDir, file),
                vscode.Uri.joinPath(featureDir, file)
            );
        }

        await copyIfAbsent(
            vscode.Uri.joinPath(templateDir, 'featplan.md'),
            vscode.Uri.joinPath(claudeCommandsDir, 'featplan.md')
        );

        vscode.window.showInformationMessage('CFM: Project initialised.');
    } catch (err) {
        vscode.window.showErrorMessage(`CFM: Init failed — ${err}`);
        return;
    }

    // Ensure .feature/ is in .gitignore (git must exist at this point)
    try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(workspaceRoot, '.git'));
        const gitignoreUri = vscode.Uri.joinPath(workspaceRoot, '.gitignore');
        let content = '';
        try {
            const bytes = await vscode.workspace.fs.readFile(gitignoreUri);
            content = Buffer.from(bytes).toString('utf8');
        } catch {
            // .gitignore does not yet exist — will be created
        }
        const alreadyIgnored = content.split('\n').map(l => l.trim()).some(l => l === '.feature' || l === '.feature/');
        if (!alreadyIgnored) {
            const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
            await vscode.workspace.fs.writeFile(
                gitignoreUri,
                Buffer.from(content + prefix + '.feature/\n', 'utf8')
            );
        }
    } catch {
        // No git repo — skip gitignore update silently
    }
}

class CfmPanel {
    private static current: CfmPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly planUri: vscode.Uri;
    private readonly logsUri: vscode.Uri;
    private readonly workspaceRootUri: vscode.Uri;
    private readonly disposables: vscode.Disposable[] = [];

    /** Snapshot of the last-sent board state, used for Claude-change diffing. */
    private lastData: KanbanData | null = null;

    /**
     * Incremented before each internal PLAN.md write so the file-watcher
     * callback can tell the difference between a user action and an external
     * (Claude) edit.
     */
    private internalWriteCount = 0;

    /** Git user name, resolved once at construction time. */
    private userName = '';

    static createOrShow(context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (CfmPanel.current) {
            CfmPanel.current.panel.reveal(column);
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('CFM: No workspace folder open.');
            return;
        }

        const outWebviewDir = vscode.Uri.joinPath(context.extensionUri, 'out', 'webview');
        const panel = vscode.window.createWebviewPanel(
            'cfmKanban',
            'Feature Manager',
            column ?? vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [outWebviewDir],
                retainContextWhenHidden: true,
            }
        );

        CfmPanel.current = new CfmPanel(panel, context, workspaceRoot);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly context: vscode.ExtensionContext,
        workspaceRoot: vscode.Uri
    ) {
        this.panel = panel;
        this.workspaceRootUri = workspaceRoot;
        this.planUri = vscode.Uri.joinPath(workspaceRoot, PLAN_PATH);
        this.logsUri = vscode.Uri.joinPath(workspaceRoot, '.feature', 'logs');

        // Resolve git user name asynchronously; fall back to OS username if git is unavailable
        getUserName(workspaceRoot.fsPath).then(name => { this.userName = name; }).catch(() => {});

        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(
            (msg: WebviewToHostMessage) => this.handleMessage(msg),
            null,
            this.disposables
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Watch PLAN.md for changes
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceRoot, PLAN_PATH)
        );
        // onDidChange: may be internal (user via UI) or external (Claude editing directly)
        watcher.onDidChange(() => this.handleWatcherChange(), null, this.disposables);
        watcher.onDidCreate(() => this.loadAndSend(), null, this.disposables);
        watcher.onDidDelete(() => this.loadAndSend(), null, this.disposables);
        this.disposables.push(watcher);
    }

    /**
     * Called by the file-system watcher when PLAN.md changes.
     * If the change was caused by an internal write (user action via the UI),
     * just refresh the view.  Otherwise diff with lastData and log as Claude.
     */
    private async handleWatcherChange() {
        if (this.internalWriteCount > 0) {
            this.internalWriteCount--;
            // Internal write — already logged in the specific method; just refresh
            await this.loadAndSend();
            return;
        }

        // External change — Claude (or any other tool) edited PLAN.md directly
        if (this.lastData) {
            try {
                const bytes = await vscode.workspace.fs.readFile(this.planUri);
                const newData = parsePlan(Buffer.from(bytes).toString('utf8'));
                const changes = diffKanbanData(this.lastData, newData);
                for (const change of changes) {
                    await writeLogEntry(this.logsUri, change.cardId, change.cardTitle, 'Claude', change.entries);
                }
            } catch {
                // Logging errors must not interrupt the refresh
            }
        }

        await this.loadAndSend();
    }

    private async loadAndSend() {
        try {
            let content = '';
            try {
                const bytes = await vscode.workspace.fs.readFile(this.planUri);
                content = Buffer.from(bytes).toString('utf8');
            } catch {
                // File not found — show empty board
            }
            const data = parsePlan(content);

            // Annotate cards with hasDoc: true when .feature/execute/<id>.md exists
            const checks = data.columns.flatMap(col =>
                col.cards.map(async card => {
                    const docUri = vscode.Uri.joinPath(this.workspaceRootUri, '.feature', 'execute', `${card.id}.md`);
                    try {
                        await vscode.workspace.fs.stat(docUri);
                        card.hasDoc = true;
                    } catch {
                        card.hasDoc = false;
                    }
                })
            );
            await Promise.all(checks);

            this.lastData = data;
            this.panel.webview.postMessage({ type: 'updateView', data });
        } catch (err) {
            vscode.window.showErrorMessage(`CFM: Failed to load PLAN.md — ${err}`);
        }
    }

    private async handleMessage(msg: WebviewToHostMessage | { type: 'ready' }) {
        if (msg.type === 'ready') {
            await this.loadAndSend();
        } else if (msg.type === 'initProject') {
            await this.initProject();
        } else if (msg.type === 'moveFeature') {
            await this.moveFeature(msg.featureId, msg.newStatus);
        } else if (msg.type === 'updateCard') {
            await this.updateCard(msg.card);
        } else if (msg.type === 'previewFile') {
            this.previewFeatureDoc(msg.cardId);
        } else if (msg.type === 'runClaudeCommand') {
            this.runClaudeCommand(msg.state);
        } else if (msg.type === 'addCard') {
            await this.addCard((msg as AddCardMessage).columnId, (msg as AddCardMessage).title);
        } else if (msg.type === 'getLog') {
            await this.sendLogData((msg as GetLogMessage).cardId);
        } else if (msg.type === 'deleteCard') {
            await this.deleteCard((msg as DeleteCardMessage).cardId);
        }
    }

    private async initProject() {
        try {
            this.internalWriteCount++;
            const initial = serializePlan({ columns: [] });
            await vscode.workspace.fs.writeFile(
                this.planUri,
                Buffer.from(initial, 'utf8')
            );
            await this.loadAndSend();
        } catch (err) {
            vscode.window.showErrorMessage(`CFM: Failed to init project — ${err}`);
        }
    }

    private async moveFeature(featureId: string, newStatus: string) {
        try {
            const bytes = await vscode.workspace.fs.readFile(this.planUri);
            const data = parsePlan(Buffer.from(bytes).toString('utf8'));

            let movedCard: Card | null = null;
            let fromColumnTitle = '';
            for (const col of data.columns) {
                const idx = col.cards.findIndex(c => c.id === featureId);
                if (idx !== -1) {
                    movedCard = col.cards.splice(idx, 1)[0];
                    fromColumnTitle = col.title;
                    break;
                }
            }

            if (!movedCard) {
                vscode.window.showWarningMessage(`CFM: Card "${featureId}" not found.`);
                return;
            }

            const targetCol = data.columns.find(
                c => c.title.toLowerCase() === newStatus.toLowerCase() || c.id === newStatus
            );
            if (!targetCol) {
                vscode.window.showWarningMessage(`CFM: Column "${newStatus}" not found.`);
                return;
            }

            targetCol.cards.push(movedCard);

            this.internalWriteCount++;
            await vscode.workspace.fs.writeFile(
                this.planUri,
                Buffer.from(serializePlan(data), 'utf8')
            );

            const actor = `User (${this.userName})`;
            await writeLogEntry(
                this.logsUri, movedCard.id, movedCard.title, actor,
                [`Status changed: \`${fromColumnTitle}\` → \`${targetCol.title}\``]
            );

            await this.loadAndSend();
        } catch (err) {
            vscode.window.showErrorMessage(`CFM: Failed to move feature — ${err}`);
        }
    }

    private async updateCard(updated: Card) {
        try {
            const bytes = await vscode.workspace.fs.readFile(this.planUri);
            const data = parsePlan(Buffer.from(bytes).toString('utf8'));

            let oldCard: Card | null = null;
            for (const col of data.columns) {
                const idx = col.cards.findIndex(c => c.id === updated.id);
                if (idx !== -1) {
                    oldCard = col.cards[idx];
                    col.cards[idx] = updated;
                    break;
                }
            }

            this.internalWriteCount++;
            await vscode.workspace.fs.writeFile(
                this.planUri,
                Buffer.from(serializePlan(data), 'utf8')
            );

            if (oldCard) {
                const entries = diffCard(oldCard, updated);
                if (entries.length > 0) {
                    const actor = `User (${this.userName})`;
                    await writeLogEntry(this.logsUri, updated.id, updated.title, actor, entries);
                }
            }

            await this.loadAndSend();
        } catch (err) {
            vscode.window.showErrorMessage(`CFM: Failed to update card — ${err}`);
        }
    }

    private async addCard(columnId: string, title: string) {
        try {
            const bytes = await vscode.workspace.fs.readFile(this.planUri);
            const data = parsePlan(Buffer.from(bytes).toString('utf8'));

            const col = data.columns.find(c => c.id === columnId);
            if (!col) {
                vscode.window.showWarningMessage(`CFM: Column "${columnId}" not found.`);
                return;
            }

            const id = title.toLowerCase().replace(/\s+/g, '-');
            col.cards.push({ id, title });

            this.internalWriteCount++;
            await vscode.workspace.fs.writeFile(
                this.planUri,
                Buffer.from(serializePlan(data), 'utf8')
            );

            const actor = `User (${this.userName})`;
            await writeLogEntry(
                this.logsUri, id, title, actor,
                [`Card created in \`${col.title}\``]
            );

            await this.loadAndSend();
        } catch (err) {
            vscode.window.showErrorMessage(`CFM: Failed to add card — ${err}`);
        }
    }

    private async deleteCard(cardId: string) {
        try {
            const bytes = await vscode.workspace.fs.readFile(this.planUri);
            const data = parsePlan(Buffer.from(bytes).toString('utf8'));

            let deletedCard: Card | null = null;
            let fromColumnTitle = '';
            for (const col of data.columns) {
                const idx = col.cards.findIndex(c => c.id === cardId);
                if (idx !== -1) {
                    deletedCard = col.cards.splice(idx, 1)[0];
                    fromColumnTitle = col.title;
                    break;
                }
            }

            if (!deletedCard) {
                vscode.window.showWarningMessage(`CFM: Card "${cardId}" not found.`);
                return;
            }

            this.internalWriteCount++;
            await vscode.workspace.fs.writeFile(
                this.planUri,
                Buffer.from(serializePlan(data), 'utf8')
            );

            // Log the deletion — log file is intentionally kept
            const actor = `User (${this.userName})`;
            await writeLogEntry(
                this.logsUri, deletedCard.id, deletedCard.title, actor,
                [`Card deleted from \`${fromColumnTitle}\``]
            );

            await this.loadAndSend();
        } catch (err) {
            vscode.window.showErrorMessage(`CFM: Failed to delete card — ${err}`);
        }
    }

    private async sendLogData(cardId: string) {
        let entries: LogEntry[] = [];
        try {
            const logUri = vscode.Uri.joinPath(this.logsUri, `${cardId}.md`);
            const bytes = await vscode.workspace.fs.readFile(logUri);
            entries = parseLogFile(Buffer.from(bytes).toString('utf8'));
        } catch {
            // No log file yet — return empty list
        }
        this.panel.webview.postMessage({ type: 'logData', cardId, entries });
    }

    private runClaudeCommand(state: string) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        let terminal = vscode.window.terminals.find(
            t => t.name === 'Claude Feature Manager' && t.exitStatus === undefined
        );
        if (!terminal) {
            terminal = vscode.window.createTerminal({
                name: 'Claude Feature Manager',
                cwd: workspaceRoot,
            });
        }
        terminal.show(true);
        terminal.sendText(`claude -p "/feature ${state}"`);
    }

    private previewFeatureDoc(cardId: string) {
        const fileUri = vscode.Uri.joinPath(this.workspaceRootUri, '.feature', 'execute', `${cardId}.md`);
        vscode.commands.executeCommand('markdown.showPreview', fileUri);
    }

    private getHtml(): string {
        const webview = this.panel.webview;
        const outWebviewDir = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview');
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(outWebviewDir, 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(outWebviewDir, 'assets', 'index.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Feature Manager</title>
    <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private dispose() {
        CfmPanel.current = undefined;
        this.panel.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
