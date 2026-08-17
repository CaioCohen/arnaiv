import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentRagService, chunkText, cosineSimilarity, hybridScore, keywordScore } from './agent-rag.service.js';
import { getAgent } from './agent-registry.service.js';

const directories: string[] = [];
async function temporaryDirectory(): Promise<string> { const directory = await mkdtemp(path.join(os.tmpdir(), 'arnaiv-rag-')); directories.push(directory); return directory; }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe('agent RAG', () => {
  it('uses overlap and hybrid semantic/keyword scoring', () => {
    expect(chunkText('abcdefgh', 4, 2)).toEqual(['abcd', 'cdef', 'efgh', 'gh']);
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(keywordScore('medical guidance', 'Medical guidance is available.')).toBe(1);
    expect(hybridScore(1, 0)).toBe(0.7);
  });

  it('indexes only the selected agent documents and returns labelled relevant chunks', async () => {
    const root = await temporaryDirectory();
    const docs = path.join(root, 'medical-consultant', 'docs');
    await mkdir(docs, { recursive: true });
    await writeFile(path.join(docs, 'care.txt'), 'Medical guidance for recurring headaches.', 'utf8');
    const embedMany = vi.fn(async (inputs: string[]) => inputs.map(() => [1, 0]));
    const service = new AgentRagService({ embed: async () => [1, 0], embedMany }, path.join(root, 'index'), root);
    const agent = getAgent('medical-consultant');
    if (!agent) throw new Error('Missing agent fixture.');

    await expect(service.retrieve(agent, 'medical headache guidance')).resolves.toEqual([
      expect.objectContaining({ source: 'care.txt', content: expect.stringContaining('headaches') }),
    ]);
    expect(embedMany).toHaveBeenCalledTimes(1);

    await writeFile(path.join(docs, 'care.txt'), 'Updated policy: employees receive 10 paid sick days.', 'utf8');
    await expect(service.retrieve(agent, 'how many paid sick days')).resolves.toEqual([
      expect.objectContaining({ source: 'care.txt', content: expect.stringContaining('10 paid sick days') }),
    ]);
    expect(embedMany).toHaveBeenCalledTimes(2);
  });
});
