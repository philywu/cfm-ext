import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card, Column as ColumnType } from '../types';
import { FeatureCard } from './FeatureCard';
import { vscodeApi } from '../vscodeApi';

interface Props {
    column: ColumnType;
    onSelect: (card: Card) => void;
    nextColumnId?: string;
}

export function Column({ column, onSelect, nextColumnId }: Props) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });
    const isTodo = column.id === 'to-do';
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const didSubmit = useRef(false);

    function openAdd() {
        didSubmit.current = false;
        setNewTitle('');
        setAdding(true);
    }

    function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (didSubmit.current) { return; }
            didSubmit.current = true;
            const title = (e.currentTarget.value).trim();
            if (title) {
                vscodeApi.postMessage({ type: 'addCard', columnId: column.id, title });
            }
            setNewTitle('');
            setAdding(false);
        } else if (e.key === 'Escape') {
            didSubmit.current = true;
            setNewTitle('');
            setAdding(false);
        }
    }

    return (
        <div className="column">
            <div className="column-header">
                <div className="column-header-row">
                    <span className="column-title">
                        {column.title}
                        <span style={{ marginLeft: 6, opacity: 0.6 }}>({column.cards.length})</span>
                    </span>
                    {isTodo && (
                        <button
                            className="column-add-btn"
                            onClick={openAdd}
                            title="Add new item"
                        >+</button>
                    )}
                </div>
                <div className="column-cmd-hint">/featplan {column.id}</div>
            </div>
            <div ref={setNodeRef} className={`column-body${isOver ? ' over' : ''}`}>
                {column.cards.map(card => (
                    <FeatureCard key={card.id} card={card} columnId={column.id} onSelect={onSelect} nextColumnId={nextColumnId} />
                ))}
                {adding && (
                    <div className="column-add-form">
                        <input
                            autoFocus
                            className="column-add-input"
                            placeholder="New item title…"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={handleAddKeyDown}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
