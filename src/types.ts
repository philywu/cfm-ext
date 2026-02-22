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

// postMessage payloads
export interface UpdateViewMessage {
    type: 'updateView';
    data: KanbanData;
}

export interface MoveFeatureMessage {
    type: 'moveFeature';
    featureId: string;
    newStatus: string;
}

export interface InitProjectMessage {
    type: 'initProject';
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

export type HostToWebviewMessage = UpdateViewMessage;
export type WebviewToHostMessage = MoveFeatureMessage | InitProjectMessage | UpdateCardMessage | PreviewFileMessage | RunClaudeCommandMessage | AddCardMessage;
