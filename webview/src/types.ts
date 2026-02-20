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
