import * as vscode from 'vscode';
import { parsePlan, serializePlan } from './planParser';
import { WebviewToHostMessage } from './types';

const PLAN_PATH = 'feature/PLAN.md';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('cfm-ext.openPanel', () => {
        CfmPanel.createOrShow(context);
    });
    context.subscriptions.push(disposable);
}

export function deactivate() {}

class CfmPanel {
    private static current: CfmPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly planUri: vscode.Uri;
    private readonly disposables: vscode.Disposable[] = [];

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
        this.planUri = vscode.Uri.joinPath(workspaceRoot, PLAN_PATH);

        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(
            (msg: WebviewToHostMessage) => this.handleMessage(msg),
            null,
            this.disposables
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.loadAndSend();
    }

    private async loadAndSend() {
        try {
            let bytes: Uint8Array;
            try {
                bytes = await vscode.workspace.fs.readFile(this.planUri);
            } catch {
                this.panel.webview.postMessage({ type: 'noProject' });
                return;
            }

            const content = Buffer.from(bytes).toString('utf8');
            const data = parsePlan(content);
            this.panel.webview.postMessage({ type: 'updateView', data });
        } catch (err) {
            vscode.window.showErrorMessage(`CFM: Failed to load PLAN.md — ${err}`);
        }
    }

    private async handleMessage(msg: WebviewToHostMessage) {
        if (msg.type === 'initProject') {
            await this.initProject();
        } else if (msg.type === 'moveFeature') {
            await this.moveFeature(msg.featureId, msg.newStatus);
        }
    }

    private async initProject() {
        try {
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

            let movedCard = null;
            for (const col of data.columns) {
                const idx = col.cards.findIndex(c => c.id === featureId);
                if (idx !== -1) {
                    movedCard = col.cards.splice(idx, 1)[0];
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
            await vscode.workspace.fs.writeFile(
                this.planUri,
                Buffer.from(serializePlan(data), 'utf8')
            );
            this.panel.webview.postMessage({ type: 'updateView', data });
        } catch (err) {
            vscode.window.showErrorMessage(`CFM: Failed to move feature — ${err}`);
        }
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
