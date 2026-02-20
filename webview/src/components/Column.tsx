import { useDroppable } from '@dnd-kit/core';
import { Column as ColumnType } from '../types';
import { FeatureCard } from './FeatureCard';

interface Props {
    column: ColumnType;
}

export function Column({ column }: Props) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });

    return (
        <div className="column">
            <div className="column-header">
                {column.title}
                <span style={{ marginLeft: 6, opacity: 0.6 }}>({column.cards.length})</span>
            </div>
            <div ref={setNodeRef} className={`column-body${isOver ? ' over' : ''}`}>
                {column.cards.map(card => (
                    <FeatureCard key={card.id} card={card} />
                ))}
            </div>
        </div>
    );
}
