import { useEffect, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Card, KanbanData } from './types';
import { Column } from './components/Column';
import { CardDetail } from './components/CardDetail';
import './theme.css';
import { vscodeApi } from './vscodeApi';

type AppState =
    | { phase: 'loading' }
    | { phase: 'noProject' }
    | { phase: 'board'; data: KanbanData };

export function App() {
    const [state, setState] = useState<AppState>({ phase: 'loading' });
    const [selected, setSelected] = useState<{ card: Card; columnTitle: string } | null>(null);

    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: { distance: 5 },
    }));

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.type === 'updateView') {
                setState({ phase: 'board', data: msg.data });
                // Keep selected card in sync after a move
                setSelected(prev => {
                    if (!prev) { return null; }
                    for (const col of msg.data.columns) {
                        const card = col.cards.find((c: Card) => c.id === prev.card.id);
                        if (card) { return { card, columnTitle: col.title }; }
                    }
                    return null;
                });
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

    function handleSelect(card: Card) {
        const col = state.phase === 'board'
            ? state.data.columns.find(c => c.cards.some(ca => ca.id === card.id))
            : undefined;
        setSelected(col ? { card, columnTitle: col.title } : null);
    }

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="workspace">
                <div className="board">
                    {state.data.columns.map((col, idx) => (
                        <Column
                            key={col.id}
                            column={col}
                            onSelect={handleSelect}
                            nextColumnId={state.data.columns[idx + 1]?.id}
                        />
                    ))}
                </div>
                {selected && (
                    <CardDetail
                        card={selected.card}
                        columnTitle={selected.columnTitle}
                        onClose={() => setSelected(null)}
                        onUpdate={card => vscodeApi.postMessage({ type: 'updateCard', card })}
                    />
                )}
            </div>
        </DndContext>
    );
}
