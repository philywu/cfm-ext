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
    hasDoc?: boolean;
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

export interface AddCardMessage {
    type: 'addCard';
    columnId: string;
    title: string;
}

export interface GetLogMessage {
    type: 'getLog';
    cardId: string;
}

export interface DeleteCardMessage {
    type: 'deleteCard';
    cardId: string;
}

export interface LogEntry {
    timestamp: string;
    actor: string;
    items: string[];
}

export interface LogDataMessage {
    type: 'logData';
    cardId: string;
    entries: LogEntry[];
}
