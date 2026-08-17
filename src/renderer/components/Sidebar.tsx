import type { AgentSummary, SessionSummary } from '../../shared/types';

interface SidebarProps {
  agents: AgentSummary[];
  agentPanel: boolean;
  items: SessionSummary[];
  active: string | null;
  disabled: boolean;
  onAgents: () => void;
  onBack: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onSelectAgent: (id: AgentSummary['id']) => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ agents, agentPanel, items, active, disabled, onAgents, onBack, onNew, onSelect, onSelectAgent, onDelete }: SidebarProps): JSX.Element {
  return (
    <aside>
      <div className="brand">ArnAIv</div>
      {agentPanel ? (
        <>
          <button className="back-to-chats" onClick={onBack} disabled={disabled} aria-label="Back to chats">← Chats</button>
          <div className="agent-list" aria-label="Available agents">
            {agents.map((agent) => <button className="agent" key={agent.id} onClick={() => onSelectAgent(agent.id)} disabled={disabled}>{agent.name}</button>)}
          </div>
        </>
      ) : (
        <>
          <button className="agents-button" onClick={onAgents} disabled={disabled}>Agents</button>
          <button className="new-chat" onClick={onNew} disabled={disabled}>＋ New chat</button>
          <div className="sessions">
            {items.map((item) => (
              <div className={`session-row ${active === item.id ? 'active' : ''}`} key={item.id}>
                <button className="session" title={item.title} onClick={() => onSelect(item.id)} disabled={disabled}>
                  <span className="session-title">{item.title}</span>
                  {item.agentId && <span className="session-agent">Medical consultant</span>}
                </button>
                <button className="delete-session" aria-label={`Delete ${item.title}`} title="Delete chat" onClick={() => onDelete(item.id)} disabled={disabled}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
