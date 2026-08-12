import type { SessionSummary } from '../../shared/types';

interface SidebarProps { items: SessionSummary[]; active: string | null; onNew: () => void; onSelect: (id: string) => void; onDelete: (id: string) => void; }

export function Sidebar({ items, active, onNew, onSelect, onDelete }: SidebarProps): JSX.Element {
  return <aside><div className="brand">ArnAIv</div><button className="new-chat" onClick={onNew}>＋ New chat</button><div className="sessions">{items.map((item) => <div className={`session-row ${active === item.id ? 'active' : ''}`} key={item.id}><button className="session" title={item.title} onClick={() => onSelect(item.id)}>{item.title}</button><button className="delete-session" aria-label={`Delete ${item.title}`} title="Delete chat" onClick={() => onDelete(item.id)}>×</button></div>)}</div></aside>;
}
