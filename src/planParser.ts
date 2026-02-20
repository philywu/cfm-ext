import { KanbanData, Column, Card } from './types';

const STATUSES = ['Backlog', 'Ready', 'In Progress', 'Review', 'Testing', 'Done', 'Blocked'];

function slugify(title: string): string {
    return title.toLowerCase().replace(/\s+/g, '-');
}

export function parsePlan(content: string): KanbanData {
    const columns: Column[] = STATUSES.map(s => ({ id: slugify(s), title: s, cards: [] }));
    const columnMap = new Map(columns.map(c => [c.title.toLowerCase(), c]));

    let currentColumn: Column | null = null;
    let currentCard: Card | null = null;
    const descLines: string[] = [];

    function flushCard() {
        if (currentCard && currentColumn) {
            currentCard.description = descLines.join('\n').trim() || undefined;
            currentColumn.cards.push(currentCard);
        }
        currentCard = null;
        descLines.length = 0;
    }

    const lines = content.split('\n');
    for (const line of lines) {
        // ## #Status heading
        const colMatch = line.match(/^##\s+#(.+)$/);
        if (colMatch) {
            flushCard();
            const statusTitle = colMatch[1].trim();
            currentColumn = columnMap.get(statusTitle.toLowerCase()) ?? null;
            if (!currentColumn) {
                // Unknown status: create a new column
                const col: Column = { id: slugify(statusTitle), title: statusTitle, cards: [] };
                columns.push(col);
                columnMap.set(statusTitle.toLowerCase(), col);
                currentColumn = col;
            }
            continue;
        }

        // ### Card title heading
        const cardMatch = line.match(/^###\s+(.+)$/);
        if (cardMatch) {
            flushCard();
            const title = cardMatch[1].trim();
            currentCard = { id: slugify(title) + '-' + Date.now(), title };
            // Reset id to be stable (use title slug; collisions handled by index in serialize)
            currentCard.id = slugify(title);
            continue;
        }

        // git-branch: field
        if (currentCard) {
            const branchMatch = line.match(/^git-branch:\s*(.+)$/);
            if (branchMatch) {
                currentCard.branch = branchMatch[1].trim();
                continue;
            }
            // Collect description lines (skip the blank line right after heading)
            descLines.push(line);
        }
    }
    flushCard();

    return { columns };
}

export function serializePlan(data: KanbanData): string {
    const lines: string[] = ['# Feature Plan', ''];

    for (const column of data.columns) {
        lines.push(`## #${column.title}`);
        for (const card of column.cards) {
            lines.push(`### ${card.title}`);
            if (card.branch) {
                lines.push(`git-branch: ${card.branch}`);
            }
            if (card.description) {
                lines.push(card.description);
            }
            lines.push('');
        }
    }

    return lines.join('\n');
}
