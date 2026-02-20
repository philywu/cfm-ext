export interface Action {
    type: string;
    description: string;
    status: string;
}

export interface Card {
    id: string;
    title: string;
    branch?: string;
    description?: string;
    actions?: Action[];
}

export interface Column {
    id: string;
    title: string;
    cards: Card[];
}

export interface KanbanData {
    columns: Column[];
}

export interface UpdateCardMessage {
    type: 'updateCard';
    card: Card;
}

export interface PreviewFileMessage {
    type: 'previewFile';
    cardId: string;
}

export interface RunClaudeCommandMessage {
    type: 'runClaudeCommand';
    state: string;
}
