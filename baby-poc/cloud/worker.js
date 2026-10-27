import { DurableObject } from 'cloudflare:workers';
import { fixtures } from '../fixtures.mjs';
import { renderBook } from '../book.mjs';
import { arrange, transcribe } from '../ai.mjs';
import { createJournal } from '../../lib/journal-template.ts';
import { transferWritingToTrip } from '../../lib/write-photo-transfer.ts';

const json = value => Response.json(value);
const emptyState = () => ({ child: { name: '小禾', birthDate: '2025-10-01' }, moments: [], books: [] });
const warehouse = env => env.FICTIONAL_WAREHOUSE.get(env.FICTIONAL_WAREHOUSE.idFromName('fictional-family-poc-v1'));
const stateOf = env => warehouse(env).fetch('https://fictional-warehouse/api/state').then(response => response.json());
const mutation = (env, path, body) => warehouse(env).fetch(new Request('https://fictional-warehouse' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

function hydrateBook(book, moments) {
  const entries = book.entries.map(entry => ({ ...moments.find(moment => moment.id === entry.momentId), ...entry }));
  let trip = createJournal(book.title, book.id, book.updatedAt);
  for (const entry of entries) {
    const photos = entry.photo ? [{ id: `photo-${entry.momentId}`, momentId: entry.momentId, storageKey: entry.photo, originalStorageKey: entry.photo, originalFilename: `${entry.momentId}.svg`, mimeType: 'image/svg+xml', createdAt: book.updatedAt }] : [];
    trip = transferWritingToTrip({ trip, photos, draft: entry.body, sourceKey: `moment:${entry.momentId}`, now: book.updatedAt });
  }
  return { ...book, entries, trip };
}

// One independent namespace. Synchronous SQLite reads and writes happen together,
// after request parsing; model calls never hold or replace a warehouse snapshot.
export class FictionalWarehouse extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS moments (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
  }

  readState() {
    const child = this.sql.exec("SELECT payload FROM meta WHERE id = 'child'").toArray()[0];
    const moments = this.sql.exec('SELECT payload FROM moments ORDER BY rowid').toArray().map(row => JSON.parse(row.payload));
    const books = this.sql.exec('SELECT payload FROM books ORDER BY rowid').toArray().map(row => hydrateBook(JSON.parse(row.payload), moments));
    return { runtime: 'cloud', child: child ? JSON.parse(child.payload) : emptyState().child, moments, books };
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const body = request.method === 'POST' ? await request.json() : null;
    if (request.method === 'GET') return json(this.readState());
    let result;
    if (path === '/api/demo') {
      const demo = fixtures(body.lang);
      const moments = demo.moments.map((moment, i) => ({ ...moment, lang: body.lang, audio: `/assets/voice-${body.lang}-${i + 1}.wav`, audioLabel: body.lang === 'zh' ? '合成示範旁白' : 'Synthetic sample narration', createdAt: new Date().toISOString() }));
      this.sql.exec("INSERT OR REPLACE INTO meta (id, payload) VALUES ('child', ?)", JSON.stringify(demo.child));
      for (const moment of moments) this.sql.exec('INSERT OR REPLACE INTO moments (id, payload) VALUES (?, ?)', moment.id, JSON.stringify(moment));
      result = { state: this.readState(), moments };
    }
    if (path === '/api/capture') {
      const moment = { ...body, id: `fictional-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), draft: '' };
      this.sql.exec('INSERT INTO moments (id, payload) VALUES (?, ?)', moment.id, JSON.stringify(moment));
      result = { moment, state: this.readState() };
    }
    if (path === '/internal/draft') {
      const moment = JSON.parse(this.sql.exec('SELECT payload FROM moments WHERE id = ?', body.momentId).toArray()[0].payload);
      moment.draft = body.result.draft;
      moment.aiTitle = body.result.title;
      moment.storyModel = body.result.model;
      this.sql.exec('UPDATE moments SET payload = ? WHERE id = ?', JSON.stringify(moment), moment.id);
      result = body.result;
    }
    if (path === '/api/book') {
      const id = body.id || `book-${crypto.randomUUID()}`;
      const updatedAt = new Date().toISOString();
      const entries = body.entries.map(({ photo, audio, ...entry }) => entry);
      const book = { id, lang: body.lang, title: body.title, child: body.child || this.readState().child, entries, updatedAt };
      this.sql.exec('INSERT OR REPLACE INTO books (id, payload) VALUES (?, ?)', id, JSON.stringify(book));
      const state = this.readState();
      result = { book: state.books.find(saved => saved.id === id), state };
    }
    return json(result);
  }
}

function bookHtml(book, printing = false) {
  const label = book.lang === 'en' ? 'Print / save as PDF' : '列印／存成 PDF';
  const printControl = `<button onclick="window.print()" style="font:inherit;color:#285147;background:transparent;border:1px solid #285147;padding:7px 12px;cursor:pointer">${label}</button>`;
  let html = renderBook(book).replace(/<a href="\/api\/book\/[^\"]+\/pdf">[^<]+<\/a>/, printControl);
  if (printing) html = html.replace('</body>', '<script>addEventListener("load",async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));window.print();});</script></body>');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'GET' && path === '/api/state') return warehouse(env).fetch(request);
    if (request.method === 'GET' && path === '/api/capabilities') return json({ hosted: true, storyMode: 'ai-story', transcription: true, pdfMode: 'browser-print' });
    if (request.method === 'POST' && ['/api/demo', '/api/capture', '/api/book'].includes(path)) return warehouse(env).fetch(request);
    if (request.method === 'POST' && path === '/api/transcribe') {
      const { audio, lang } = await request.json();
      return json(await transcribe(env.AI, audio, lang));
    }
    if (request.method === 'POST' && path === '/api/arrange-text') {
      const { moment, lang } = await request.json();
      return json(await arrange(env.AI, moment, lang));
    }
    if (request.method === 'POST' && path === '/api/arrange') {
      const { momentId, lang } = await request.json();
      const state = await stateOf(env);
      const moment = state.moments.find(source => source.id === momentId);
      const result = await arrange(env.AI, moment, lang);
      return mutation(env, '/internal/draft', { momentId, result });
    }
    const match = path.match(/^\/api\/book\/([^/]+)(?:\/(pdf|audio))?$/);
    if (request.method === 'GET' && match) {
      const state = await stateOf(env);
      const book = state.books.find(saved => saved.id === match[1]);
      if (match[2] === 'pdf') return bookHtml(book, true);
      if (match[2] === 'audio') {
        const voice = book.entries.find(entry => entry.audio)?.audio;
        const response = voice.startsWith('data:') ? await fetch(voice) : await env.ASSETS.fetch(new Request(new URL(voice, request.url)));
        return new Response(response.body, { headers: { 'content-type': response.headers.get('content-type') || 'audio/wav', 'content-disposition': 'attachment; filename="fictional-story-voice.wav"' } });
      }
      return json(book);
    }
    const bookMatch = path.match(/^\/book\/([^/]+)$/);
    if (request.method === 'GET' && bookMatch) {
      const state = await stateOf(env);
      return bookHtml(state.books.find(book => book.id === bookMatch[1]));
    }
    return env.ASSETS.fetch(request);
  }
};
