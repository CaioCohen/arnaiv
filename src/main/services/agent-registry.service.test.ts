import { describe, expect, it } from 'vitest';
import { getAgent, isAgentId, listAgents } from './agent-registry.service.js';

describe('agent registry', () => {
  it('exposes the medical consultant without exposing its prompt to callers', () => {
    expect(listAgents()).toEqual([{ id: 'medical-consultant', name: 'Medical consultant' }]);
    expect(getAgent('medical-consultant')?.systemPrompt).toContain('health-information');
    expect(getAgent('medical-consultant')?.systemPrompt).toContain('internal hospital reference documents');
    expect(getAgent('medical-consultant')?.systemPrompt).not.toContain('material provided by the user');
  });

  it('rejects unregistered agent ids', () => {
    expect(isAgentId('other-agent')).toBe(false);
    expect(getAgent('../medical-consultant')).toBeNull();
  });
});
