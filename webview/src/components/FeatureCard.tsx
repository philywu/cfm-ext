import { useDraggable } from '@dnd-kit/core';
import { Card } from '../types';

interface Props {
    card: Card;
}

export function FeatureCard({ card }: Props) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: card.id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`card${isDragging ? ' dragging' : ''}`}
            {...listeners}
            {...attributes}
        >
            <div className="card-title">{card.title}</div>
            {card.branch && <div className="card-branch">{card.branch}</div>}
        </div>
    );
}
