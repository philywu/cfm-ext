import { useEffect, useRef, useState } from 'react';
import { Action, Card, LogEntry } from '../types';
import { vscodeApi } from '../vscodeApi';

interface Props {
    card: Card;
    columnTitle: string;
    onClose: () => void;
    onUpdate: (card: Card) => void;
}

export function CardDetail({ card, columnTitle, onClose, onUpdate }: Props) {
    function handleDelete() {
        vscodeApi.postMessage({ type: 'deleteCard', cardId: card.id });
        // Panel will auto-close via App when updateView removes this card
    }
    const [draft, setDraft] = useState<Card>(() => ({
        ...card,
        actions: card.actions ? card.actions.map(a => ({ ...a })) : [],
    }));
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    // Sync draft whenever the card prop changes (id change OR content change from external file update).
    const lastSyncedJson = useRef(JSON.stringify(card));
    const incomingJson = JSON.stringify(card);
    if (incomingJson !== lastSyncedJson.current) {
        lastSyncedJson.current = incomingJson;
        setDraft({ ...card, actions: card.actions ? card.actions.map(a => ({ ...a })) : [] });
    }

    // Request log when card changes, listen for logData responses
    useEffect(() => {
        setLogEntries([]);
        vscodeApi.postMessage({ type: 'getLog', cardId: card.id });

        function handler(event: MessageEvent) {
            const msg = event.data;
            if (msg.type === 'logData' && msg.cardId === card.id) {
                setLogEntries(msg.entries);
            }
        }
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [card.id]);

    function save(updated: Card) {
        setDraft(updated);
        onUpdate(updated);
    }

    function setField<K extends keyof Card>(key: K, value: Card[K]) {
        save({ ...draft, [key]: value });
    }

    function setAction(index: number, field: keyof Action, value: string) {
        const actions = draft.actions!.map((a, i) =>
            i === index ? { ...a, [field]: value } : a
        );
        save({ ...draft, actions });
    }

    function addAction() {
        const actions = [...(draft.actions ?? []), { type: '', description: '', status: '' }];
        save({ ...draft, actions });
    }

    function removeAction(index: number) {
        const actions = (draft.actions ?? []).filter((_, i) => i !== index);
        save({ ...draft, actions });
    }

    return (
        <div className="detail-panel">
            <div className="detail-header">
                <span className="detail-status">{columnTitle}</span>
                <div className="detail-header-actions">
                    <button className="detail-delete-btn" onClick={handleDelete} title="Delete card">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M6 2h4a1 1 0 0 0-2 0H6a1 1 0 0 0-2 0H2v1h1l1 11h8l1-11h1V2h-2a1 1 0 0 0-2 0zM5 14l-.9-10h7.8L11 14H5z"/>
                        </svg>
                    </button>
                    <button className="detail-close" onClick={onClose} title="Close">✕</button>
                </div>
            </div>

            <div className="detail-field">
                <span className="detail-label">Title</span>
                <input
                    className="detail-input"
                    value={draft.title}
                    onChange={e => setDraft({ ...draft, title: e.target.value })}
                    onBlur={e => setField('title', e.target.value)}
                />
            </div>

            <div className="detail-field">
                <span className="detail-label">Branch</span>
                <input
                    className="detail-input detail-input--mono"
                    value={draft.branch ?? ''}
                    placeholder="feature/branch-name"
                    onChange={e => setDraft({ ...draft, branch: e.target.value })}
                    onBlur={e => setField('branch', e.target.value || undefined)}
                />
            </div>

            <div className="detail-field">
                <span className="detail-label">Description</span>
                <textarea
                    className="detail-textarea"
                    value={draft.description ?? ''}
                    placeholder="Feature description…"
                    rows={4}
                    onChange={e => setDraft({ ...draft, description: e.target.value })}
                    onBlur={e => setField('description', e.target.value || undefined)}
                />
            </div>

            <div className="detail-field">
                <div className="detail-actions-header">
                    <span className="detail-label">Actions</span>
                    <button className="action-add-btn" onClick={addAction}>+ Add</button>
                </div>
                <table className="action-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {(draft.actions ?? []).map((action, i) => (
                            <tr key={i}>
                                <td>
                                    <input
                                        className="action-input"
                                        value={action.type}
                                        placeholder="type"
                                        onChange={e => {
                                            const actions = draft.actions!.map((a, j) => j === i ? { ...a, type: e.target.value } : a);
                                            setDraft({ ...draft, actions });
                                        }}
                                        onBlur={e => setAction(i, 'type', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="action-input"
                                        value={action.description}
                                        placeholder="description"
                                        onChange={e => {
                                            const actions = draft.actions!.map((a, j) => j === i ? { ...a, description: e.target.value } : a);
                                            setDraft({ ...draft, actions });
                                        }}
                                        onBlur={e => setAction(i, 'description', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="action-input"
                                        value={action.status}
                                        placeholder="status"
                                        onChange={e => {
                                            const actions = draft.actions!.map((a, j) => j === i ? { ...a, status: e.target.value } : a);
                                            setDraft({ ...draft, actions });
                                        }}
                                        onBlur={e => setAction(i, 'status', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <button className="action-del-btn" onClick={() => removeAction(i)} title="Remove">✕</button>
                                </td>
                            </tr>
                        ))}
                        {(draft.actions ?? []).length === 0 && (
                            <tr>
                                <td colSpan={4} className="action-empty">No actions yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* History log */}
            <div className="detail-log">
                <span className="detail-label">History</span>
                <div className="detail-log-list">
                    {logEntries.length === 0 ? (
                        <p className="detail-empty">No history yet.</p>
                    ) : (
                        logEntries.map((entry, i) => (
                            <div key={i} className="log-entry">
                                <div className="log-entry-header">
                                    <span className="log-timestamp">{entry.timestamp}</span>
                                    <span className="log-actor">{entry.actor}</span>
                                </div>
                                {entry.items.map((item, j) => (
                                    <div key={j} className="log-item">{item}</div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
