import { useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '../types';
import { vscodeApi } from '../vscodeApi';

const HUMAN_ACTION_COLORS: Record<string, string> = {
    'backlog':     'card--todo',
    'ready':       'card--todo',
    'in-progress': 'card--executing',
    'review':      'card--review',
    'blocked':     'card--blocked',
};

interface Props {
    card: Card;
    columnId: string;
    onSelect: (card: Card) => void;
    nextColumnId?: string;
}

export function FeatureCard({ card, columnId, onSelect, nextColumnId }: Props) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });

    const dragActivated = useRef(false);
    useEffect(() => {
        if (isDragging) { dragActivated.current = true; }
    }, [isDragging]);

    function handleClick() {
        if (dragActivated.current) { dragActivated.current = false; return; }
        onSelect(card);
    }

    function handlePreview(e: React.MouseEvent) {
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'previewFile', cardId: card.id });
    }

    function handleMoveNext(e: React.MouseEvent) {
        e.stopPropagation();
        if (nextColumnId) {
            vscodeApi.postMessage({ type: 'moveFeature', featureId: card.id, newStatus: nextColumnId });
        }
    }

    const colorClass = HUMAN_ACTION_COLORS[columnId] ?? '';

    return (
        <div
            ref={setNodeRef}
            className={`card${isDragging ? ' dragging' : ''}${colorClass ? ` ${colorClass}` : ''}`}
            {...listeners}
            {...attributes}
            onClick={handleClick}
        >
            <div className="card-body">
                <div className="card-text">
                    <div className="card-title">{card.title}</div>
                    {card.branch && <div className="card-branch">{card.branch}</div>}
                </div>
                <div className="card-actions">
                    {card.hasDoc && (
                        <button
                            className="card-preview-btn"
                            onClick={handlePreview}
                            onPointerDown={e => e.stopPropagation()}
                            title="Preview feature plan"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M14 1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h5v-1H2V3h12v3h1V2a1 1 0 0 0-1-1z"/>
                                <path d="M10 8h4v1h-4zm0 2h4v1h-4zm0 2h2v1h-2z"/>
                                <path d="M6 6H3v1h3zm0 2H3v1h3zm0 2H3v1h3z"/>
                            </svg>
                        </button>
                    )}
                    {nextColumnId && (
                        <button
                            className="card-next-btn"
                            onClick={handleMoveNext}
                            onPointerDown={e => e.stopPropagation()}
                            title="Move to next stage"
                        >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 1l7 7-7 7-1.4-1.4L12.2 9H1V7h11.2L6.6 2.4z"/>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
