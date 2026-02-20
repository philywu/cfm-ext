import { useDroppable } from '@dnd-kit/core';
import { Card, Column as ColumnType } from '../types';
import { FeatureCard } from './FeatureCard';
import { vscodeApi } from '../vscodeApi';

interface Props {
    column: ColumnType;
    onSelect: (card: Card) => void;
}

export function Column({ column, onSelect }: Props) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });

    function handleRun() {
        vscodeApi.postMessage({ type: 'runClaudeCommand', state: column.title });
    }

    return (
        <div className="column">
            <div className="column-header">
                <span className="column-title">
                    {column.title}
                    <span style={{ marginLeft: 6, opacity: 0.6 }}>({column.cards.length})</span>
                </span>
                <button className="column-run-btn" onClick={handleRun} title={`Run /feature ${column.title}`}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M3 2l11 6-11 6V2z"/>
                    </svg>
                </button>
            </div>
            <div ref={setNodeRef} className={`column-body${isOver ? ' over' : ''}`}>
                {column.cards.map(card => (
                    <FeatureCard key={card.id} card={card} columnId={column.id} onSelect={onSelect} />
                ))}
            </div>
        </div>
    );
}
