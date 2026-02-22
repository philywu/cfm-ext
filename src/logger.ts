import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as os from 'os';
import { Action, Card, KanbanData } from './types';

// ── Public types ─────────────────────────────────────────────────────────────

export interface CardChange {
    cardId: string;
    cardTitle: string;
    entries: string[];
}

export interface LogEntry {
    timestamp: string;
    actor: string;
    items: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function getUserName(cwd: string): Promise<string> {
    return new Promise(resolve => {
        exec('git config user.name', { cwd }, (err, stdout) => {
            resolve(!err && stdout.trim() ? stdout.trim() : os.userInfo().username);
        });
    });
}

function formatTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function truncate(text: string, max = 100): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
}

// ── Action-level diff ─────────────────────────────────────────────────────────

function diffActions(oldActions: Action[], newActions: Action[]): string[] {
    const entries: string[] = [];
    const max = Math.max(oldActions.length, newActions.length);
    for (let i = 0; i < max; i++) {
        const o = oldActions[i];
        const n = newActions[i];
        if (!o && n) {
            entries.push(`Action added: \`${n.type}\` — ${n.description} [${n.status}]`);
        } else if (o && !n) {
            entries.push(`Action removed: \`${o.type}\` — ${o.description}`);
        } else if (o && n) {
            if (o.type !== n.type) {
                entries.push(`Action type changed: \`${o.type}\` → \`${n.type}\``);
            }
            if (o.status !== n.status) {
                entries.push(`Action \`${n.type}\` status: \`${o.status}\` → \`${n.status}\``);
            }
            if (o.description !== n.description) {
                entries.push(`Action \`${n.type}\` description: ${n.description}`);
            }
        }
    }
    return entries;
}

// ── Card-level diff ───────────────────────────────────────────────────────────

/** Diff a single card's editable fields with full detail. */
export function diffCard(oldCard: Card, newCard: Card): string[] {
    const entries: string[] = [];

    if (oldCard.title !== newCard.title) {
        entries.push(`Title: \`${oldCard.title}\` → \`${newCard.title}\``);
    }
    if ((oldCard.branch ?? '') !== (newCard.branch ?? '')) {
        entries.push(newCard.branch ? `Branch set: \`${newCard.branch}\`` : 'Branch removed');
    }
    if ((oldCard.description ?? '') !== (newCard.description ?? '')) {
        if (!newCard.description) {
            entries.push('Description cleared');
        } else {
            entries.push(`Description: ${truncate(newCard.description)}`);
        }
    }

    const oldAct = oldCard.actions ?? [];
    const newAct = newCard.actions ?? [];
    if (JSON.stringify(oldAct) !== JSON.stringify(newAct)) {
        entries.push(...diffActions(oldAct, newAct));
    }

    return entries;
}

// ── Board-level diff ──────────────────────────────────────────────────────────

/** Diff two KanbanData snapshots and return per-card change sets. */
export function diffKanbanData(oldData: KanbanData, newData: KanbanData): CardChange[] {
    const oldMap = new Map<string, { card: Card; columnTitle: string }>();
    for (const col of oldData.columns) {
        for (const card of col.cards) { oldMap.set(card.id, { card, columnTitle: col.title }); }
    }
    const newMap = new Map<string, { card: Card; columnTitle: string }>();
    for (const col of newData.columns) {
        for (const card of col.cards) { newMap.set(card.id, { card, columnTitle: col.title }); }
    }

    const changes: CardChange[] = [];

    for (const [id, { card, columnTitle }] of newMap) {
        if (!oldMap.has(id)) {
            changes.push({ cardId: id, cardTitle: card.title, entries: [`Card created in \`${columnTitle}\``] });
        }
    }
    for (const [id, { card, columnTitle }] of oldMap) {
        if (!newMap.has(id)) {
            changes.push({ cardId: id, cardTitle: card.title, entries: [`Card removed from \`${columnTitle}\``] });
        }
    }
    for (const [id, { card: newCard, columnTitle: newCol }] of newMap) {
        const old = oldMap.get(id);
        if (!old) { continue; }
        const { card: oldCard, columnTitle: oldCol } = old;
        const entries: string[] = [];

        if (oldCol !== newCol) {
            entries.push(`Status changed: \`${oldCol}\` → \`${newCol}\``);
        }
        entries.push(...diffCard(oldCard, newCard));

        if (entries.length > 0) {
            changes.push({ cardId: id, cardTitle: newCard.title, entries });
        }
    }

    return changes;
}

// ── Log file I/O ──────────────────────────────────────────────────────────────

/**
 * Append a log entry to `.feature/logs/<cardId>.md`.
 * Creates the logs directory and file if they don't exist.
 * Errors are silently swallowed so logging never breaks the main flow.
 */
export async function writeLogEntry(
    logsUri: vscode.Uri,
    cardId: string,
    cardTitle: string,
    actorLabel: string,
    entries: string[]
): Promise<void> {
    if (entries.length === 0) { return; }
    try {
        await vscode.workspace.fs.createDirectory(logsUri);
        const logUri = vscode.Uri.joinPath(logsUri, `${cardId}.md`);

        let content = '';
        try {
            const bytes = await vscode.workspace.fs.readFile(logUri);
            content = Buffer.from(bytes).toString('utf8');
        } catch {
            content = `# Log: ${cardTitle}\n`;
        }

        const block =
            `\n## ${formatTimestamp()} — ${actorLabel}\n` +
            entries.map(e => `- ${e}`).join('\n') + '\n';

        await vscode.workspace.fs.writeFile(logUri, Buffer.from(content + block, 'utf8'));
    } catch {
        // Logging must never crash the extension
    }
}

/**
 * Parse a log markdown file into structured LogEntry objects, newest-first.
 */
export function parseLogFile(content: string): LogEntry[] {
    const entries: LogEntry[] = [];
    // Each entry starts with a "## timestamp — actor" line
    const blocks = content.split(/\n(?=## )/);
    for (const block of blocks) {
        const match = block.match(/^## (.+?) — (.+)\n([\s\S]*)/);
        if (!match) { continue; }
        const [, timestamp, actor, body] = match;
        const items = body
            .split('\n')
            .filter(l => l.startsWith('- '))
            .map(l => l.slice(2).trim())
            .filter(Boolean);
        if (items.length > 0) {
            entries.push({ timestamp, actor, items });
        }
    }
    return entries.reverse(); // newest first
}
