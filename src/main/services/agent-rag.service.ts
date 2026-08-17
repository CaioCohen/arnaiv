import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import type { AgentDefinition } from './agent-registry.service.js';

export interface EmbeddingProvider {
  embed(input: string): Promise<number[]>;
  embedMany?(inputs: string[]): Promise<number[][]>;
}

export interface RetrievedChunk {
  source: string;
  content: string;
  score: number;
}

interface StoredDocument {
  source: string;
  chunk: string;
  embedding: string;
}

interface SourceDocument {
  source: string;
  content: string;
  fingerprint: string;
}

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const TOP_K = 5;
// Short policy questions often share only a few exact terms with a source.
// The hybrid score still ranks results, while this cutoff avoids discarding
// useful reference material before the model can apply it.
const MIN_SCORE = 0.35;
const supportedExtensions = new Set(['.md', '.txt']);
const MAX_SOURCE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_INDEXED_CHUNKS = 500;
const require = createRequire(import.meta.url);
const sqlWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');

export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    const chunk = text.slice(start, start + size).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    dot += left * right;
    aMagnitude += left * left;
    bMagnitude += right * right;
  }
  return aMagnitude && bMagnitude ? dot / Math.sqrt(aMagnitude * bMagnitude) : 0;
}

export function keywordScore(query: string, chunk: string): number {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter((term) => term.length > 3);
  if (!terms.length) return 0;
  const haystack = chunk.toLocaleLowerCase();
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

export function hybridScore(semantic: number, keyword: number): number {
  return semantic * 0.7 + keyword * 0.3;
}

export class AgentRagService {
  public constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly indexDirectory: string,
    private readonly agentsDirectory: string,
  ) {}

  public async retrieve(agent: AgentDefinition, question: string): Promise<RetrievedChunk[]> {
    const sources = await this.documentsFor(agent);
    const { database } = await this.open(agent);
    let closed = false;
    try {
      const query = database.exec('SELECT source, chunk, embedding FROM documents')[0];
      const documents = query
        ? query.values.map(([source, chunk, embedding]) => ({ source, chunk, embedding }) as StoredDocument)
        : [];
      if (!this.isIndexCurrent(database, sources) || (sources.length > 0 && !documents.length)) {
        database.close();
        closed = true;
        const indexedChunks = await this.index(agent, sources);
        return indexedChunks ? this.retrieve(agent, question) : [];
      }
      if (!documents.length) return [];
      const queryEmbedding = await this.embeddings.embed(question);
      return documents
        .map((document) => ({
          source: document.source,
          content: document.chunk,
          score: hybridScore(cosineSimilarity(queryEmbedding, JSON.parse(document.embedding) as number[]), keywordScore(question, document.chunk)),
        }))
        .filter((document) => document.score >= MIN_SCORE)
        .sort((left, right) => right.score - left.score)
        .slice(0, TOP_K);
    } finally {
      if (!closed) database.close();
    }
  }

  public async index(agent: AgentDefinition, sourceDocuments?: SourceDocument[]): Promise<number> {
    const documents = sourceDocuments ?? await this.documentsFor(agent);
    const chunks = documents.flatMap((document) =>
      chunkText(document.content).map((chunk) => ({ source: document.source, chunk })),
    );
    if (chunks.length > MAX_INDEXED_CHUNKS) {
      throw new Error(`Agent document collection exceeds the ${MAX_INDEXED_CHUNKS}-chunk limit.`);
    }
    const embeddings = this.embeddings.embedMany
      ? await this.embeddings.embedMany(chunks.map((item) => item.chunk))
      : await Promise.all(chunks.map((item) => this.embeddings.embed(item.chunk)));
    if (embeddings.length !== chunks.length) throw new Error('OpenAI returned an incomplete embedding batch.');
    const { database, file } = await this.open(agent);
    let committed = false;
    try {
      database.run('BEGIN');
      database.run('DELETE FROM documents');
      database.run('DELETE FROM sources');
      let count = 0;
      for (const [index, chunk] of chunks.entries()) {
        const embedding = embeddings[index];
        if (!embedding) throw new Error('OpenAI returned an incomplete embedding batch.');
        database.run(
          'INSERT INTO documents (source, chunk, embedding) VALUES (?, ?, ?)',
          [chunk.source, chunk.chunk, JSON.stringify(embedding)],
        );
        count += 1;
      }
      for (const source of documents) {
        database.run('INSERT INTO sources (source, fingerprint) VALUES (?, ?)', [source.source, source.fingerprint]);
      }
      database.run('COMMIT');
      committed = true;
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, database.export());
      await rename(temporary, file);
      return count;
    } catch (error: unknown) {
      if (!committed) database.run('ROLLBACK');
      throw error;
    } finally {
      database.close();
    }
  }

  private async open(agent: AgentDefinition): Promise<{ database: Database; file: string }> {
    await mkdir(this.indexDirectory, { recursive: true });
    const file = path.join(this.indexDirectory, `${agent.id}.sqlite`);
    const persisted = await readFile(file).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    });
    const SQL = await initSqlJs({ locateFile: () => sqlWasmPath });
    const database = new SQL.Database(persisted);
    database.run(`CREATE TABLE IF NOT EXISTS documents (
      source TEXT NOT NULL,
      chunk TEXT NOT NULL,
      embedding TEXT NOT NULL
    )`);
    database.run(`CREATE TABLE IF NOT EXISTS sources (
      source TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL
    )`);
    return { database, file };
  }

  private isIndexCurrent(database: Database, sources: SourceDocument[]): boolean {
    const result = database.exec('SELECT source, fingerprint FROM sources ORDER BY source')[0];
    const indexed = result?.values.map(([source, fingerprint]) => ({ source, fingerprint })) ?? [];
    const current = [...sources].sort((left, right) => left.source.localeCompare(right.source));
    return indexed.length === current.length && indexed.every((source, index) =>
      source.source === current[index]?.source && source.fingerprint === current[index]?.fingerprint,
    );
  }

  private async documentsFor(agent: AgentDefinition): Promise<SourceDocument[]> {
    const root = path.resolve(this.agentsDirectory, agent.documentDirectoryName, 'docs');
    const permittedRoot = `${path.resolve(this.agentsDirectory)}${path.sep}`;
    if (!root.startsWith(permittedRoot)) throw new Error('Agent document directory is invalid.');
    return this.readDocuments(root, root);
  }

  private async readDocuments(root: string, directory: string): Promise<SourceDocument[]> {
    let entries: string[];
    try {
      entries = await readdir(directory, { encoding: 'utf8' });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const documents: SourceDocument[] = [];
    for (const entry of entries) {
      const file = path.resolve(directory, entry);
      if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Agent document path is invalid.');
      const metadata = await lstat(file);
      if (metadata.isSymbolicLink()) continue;
      if (metadata.isDirectory()) documents.push(...await this.readDocuments(root, file));
      else if (metadata.isFile() && metadata.size <= MAX_SOURCE_FILE_BYTES && supportedExtensions.has(path.extname(file).toLowerCase())) {
        const content = await readFile(file, 'utf8');
        documents.push({ source: path.relative(root, file), content, fingerprint: createHash('sha256').update(content).digest('hex') });
      }
    }
    return documents;
  }
}
