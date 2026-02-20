import { useEffect, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { KanbanData } from './types';
import { Column } from './components/Column';
import './theme.css';

// VS Code webview API
declare function acquireVsCodeApi(): {
    postMessage(msg: unknown): void;
};

const vscodeApi = acquireVsCodeApi();

type AppState =
    | { phase: 'loading' }
    | { phase: 'noProject' }
    | { phase: 'board'; data: KanbanData };

export function App() {
    const [state, setState] = useState<AppState>({ phase: 'loading' });

    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: { distance: 5 },
    }));

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.type === 'updateView') {
                setState({ phase: 'board', data: msg.data });
            } else if (msg.type === 'noProject') {
                setState({ phase: 'noProject' });
            }
        };
        window.addEventListener('message', handler);
        // Signal to the extension host that the webview is ready to receive messages
        vscodeApi.postMessage({ type: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, []);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over) { return; }
        if (state.phase !== 'board') { return; }

        const featureId = String(active.id);
        const newColumnId = String(over.id);

        // Find which column the card currently belongs to
        const currentColumn = state.data.columns.find(col =>
            col.cards.some(c => c.id === featureId)
        );
        if (!currentColumn || currentColumn.id === newColumnId) { return; }

        const targetColumn = state.data.columns.find(c => c.id === newColumnId);
        if (!targetColumn) { return; }

        // Optimistic update
        const newData: KanbanData = {
            columns: state.data.columns.map(col => {
                if (col.id === currentColumn.id) {
                    return { ...col, cards: col.cards.filter(c => c.id !== featureId) };
                }
                if (col.id === newColumnId) {
                    const card = currentColumn.cards.find(c => c.id === featureId)!;
                    return { ...col, cards: [...col.cards, card] };
                }
                return col;
            }),
        };
        setState({ phase: 'board', data: newData });

        vscodeApi.postMessage({ type: 'moveFeature', featureId, newStatus: newColumnId });
    }

    function handleInitProject() {
        vscodeApi.postMessage({ type: 'initProject' });
        setState({ phase: 'loading' });
    }

    if (state.phase === 'loading') {
        return (
            <div className="init-prompt">
                <p>Loading…</p>
            </div>
        );
    }

    if (state.phase === 'noProject') {
        return (
            <div className="init-prompt">
                <p>No <code>features-meta</code> branch found.</p>
                <button onClick={handleInitProject}>Initialize Feature Manager</button>
            </div>
        );
    }

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="board">
                {state.data.columns.map(col => (
                    <Column key={col.id} column={col} />
                ))}
            </div>
        </DndContext>
    );
}
