import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from './Sidebar.js';

const handlers = {
  onAgents: vi.fn(), onBack: vi.fn(), onNew: vi.fn(), onSelect: vi.fn(), onSelectAgent: vi.fn(), onDelete: vi.fn(),
};

describe('Sidebar', () => {
  it('renders the combined chat list with the Agents entry above New chat', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, {
        ...handlers,
        agents: [{ id: 'medical-consultant', name: 'Medical consultant' }],
        agentPanel: false,
        active: 'agent-session',
        disabled: false,
        items: [
          { id: 'agent-session', title: 'Sick days', updatedAt: '2026-01-01', agentId: 'medical-consultant' },
          { id: 'chat-session', title: 'Regular chat', updatedAt: '2026-01-01' },
        ],
      }),
    );

    expect(markup.indexOf('Agents')).toBeLessThan(markup.indexOf('New chat'));
    expect(markup).toContain('Medical consultant');
    expect(markup).toContain('Regular chat');
  });

  it('renders the back control and available agent in the agents panel', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, { ...handlers, agents: [{ id: 'medical-consultant', name: 'Medical consultant' }], agentPanel: true, active: null, disabled: false, items: [] }),
    );

    expect(markup).toContain('Back to chats');
    expect(markup).toContain('Medical consultant');
  });
});
