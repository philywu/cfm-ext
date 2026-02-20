export interface Card {
    id: string;
    title: string;
    branch?: string;
    description?: string;
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

export type HostToWebviewMessage = UpdateViewMessage;
export type WebviewToHostMessage = MoveFeatureMessage | InitProjectMessage;
