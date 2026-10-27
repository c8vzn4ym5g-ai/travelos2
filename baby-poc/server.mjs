// Fictional-data prototype. No production application, warehouse or environment imports.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createJournal } from '../lib/journal-template.ts';
import { transferWritingToTrip } from '../lib/write-photo-transfer.ts';
import { fixtures } from './fixtures.mjs';
import { renderBook } from './book.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const scratch = join(root, 'scratch');
await mkdir(scratch, { recursive: true });
const statePath = join(scratch, 'fictional-state.json');
let state = existsSync(statePath) ? JSON.parse(await readFile(statePath, 'utf8')) : { child: { name: '小禾', birthDate: '2025-10-01' }, moments: [], books: [] };
const persist = () => writeFile(statePath, JSON.stringify(state, null, 2));
const run = promisify(execFile);
const port = Number(process.env.BABY_POC_PORT || 3347);
const send = (res, data, type = 'application/json; charset=utf-8') => { res.setHeader('Content-Type', type); res.end(type.startsWith('application/json') ? JSON.stringify(data) : data); };
const json = async req => { let data = ''; for await (const part of req) data += part; return JSON.parse(data || '{}'); };

function audioFor(lang, index) {
  const path = join(root, 'assets', `voice-${lang}-${index + 1}.wav`);
  return existsSync(path) ? `/assets/voice-${lang}-${index + 1}.wav` : '';
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const path = url.pathname;
  if (path === '/favicon.ico') { res.statusCode = 204; return res.end(); }
  if (req.method === 'GET' && path === '/api/state') return send(res, state);
  if (req.method === 'POST' && path === '/api/demo') {
    const { lang } = await json(req);
    const demo = fixtures(lang);
    const moments = demo.moments.map((m, i) => ({ ...m, lang, audio: audioFor(lang, i), audioLabel: lang === 'zh' ? '英語合成示範旁白' : 'Synthetic sample narration', createdAt: new Date().toISOString() }));
    state.child = demo.child;
    state.moments = [...state.moments.filter(m => !moments.some(n => n.id === m.id)), ...moments];
    await persist();
    return send(res, { state, moments });
  }
  if (req.method === 'POST' && path === '/api/capture') {
    const body = await json(req);
    const moment = { ...body, id: `fictional-${randomUUID()}`, createdAt: new Date().toISOString(), draft: '' };
    state.moments.push(moment);
    await persist();
    return send(res, { moment, state });
  }
  if (req.method === 'POST' && path === '/api/arrange') {
    const { momentId, lang } = await json(req);
    const moment = state.moments.find(m => m.id === momentId);
    const result = await fetch(`${process.env.BABY_AI_ORIGIN}/api/arrange-text`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ moment, lang }) }).then(r => r.json());
    moment.draft = result.draft;
    moment.aiModel = result.model;
    await persist();
    return send(res, result);
  }
  if (req.method === 'POST' && path === '/api/transcribe') {
    const body = await json(req);
    const result = await fetch(`${process.env.BABY_AI_ORIGIN}/api/transcribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    return send(res, result);
  }
  if (req.method === 'POST' && path === '/api/book') {
    const body = await json(req);
    const id = body.id || `book-${randomUUID()}`;
    const previous = state.books.find(b => b.id === id);
    const updatedAt = new Date().toISOString();
    const entries = body.entries.map(entry => {
      const source = state.moments.find(m => m.id === entry.momentId);
      return { ...source, ...entry, photo: entry.photo || source?.photo || '', audio: entry.audio || source?.audio || '', transcript: entry.transcript || source?.transcript || '' };
    });
    let trip = previous?.trip || createJournal(body.title, id, updatedAt);
    for (const entry of entries) {
      const photos = entry.photo ? [{ id: `photo-${entry.momentId}`, momentId: entry.momentId, storageKey: entry.photo, originalStorageKey: entry.photo, originalFilename: `${entry.momentId}.svg`, mimeType: 'image/svg+xml', createdAt: updatedAt }] : [];
      trip = transferWritingToTrip({ trip, photos, draft: entry.body, sourceKey: `moment:${entry.momentId}`, now: updatedAt });
    }
    trip.title = body.title;
    const book = { id, lang: body.lang, title: body.title, child: body.child || state.child, entries, trip, updatedAt };
    state.books = [...state.books.filter(b => b.id !== id), book];
    await persist();
    return send(res, { book, state });
  }
  const match = path.match(/^\/api\/book\/([^/]+)(?:\/(pdf|audio))?$/);
  if (req.method === 'GET' && match) {
    const book = state.books.find(b => b.id === match[1]);
    if (match[2] === 'pdf') {
      const html = join(scratch, `${book.id}.html`);
      const pdf = join(scratch, `${book.id}.pdf`);
      await writeFile(html, renderBook(book));
      await run(process.execPath, [join(root, 'print.mjs'), html, pdf], { cwd: root });
      res.setHeader('Content-Disposition', `attachment; filename="growing-story-${book.lang}.pdf"`);
      return send(res, await readFile(pdf), 'application/pdf');
    }
    if (match[2] === 'audio') {
      const voice = book.entries.find(e => e.audio)?.audio;
      const bytes = voice?.startsWith('data:') ? Buffer.from(voice.split(',')[1], 'base64') : await readFile(join(root, voice.slice(1)));
      res.setHeader('Content-Disposition', 'attachment; filename="sample-original-voice.wav"');
      return send(res, bytes, 'audio/wav');
    }
    return send(res, book);
  }
  const bookMatch = path.match(/^\/book\/([^/]+)$/);
  if (req.method === 'GET' && bookMatch) return send(res, renderBook(state.books.find(b => b.id === bookMatch[1])), 'text/html; charset=utf-8');
  const file = path === '/' ? join(root, 'web', 'index.html') : path.startsWith('/assets/') ? join(root, path.slice(1)) : join(root, 'web', path.slice(1));
  if (!existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  const ext = file.split('.').at(-1);
  return send(res, await readFile(file), { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', wav: 'audio/wav' }[ext] || 'application/octet-stream');
}).listen(port, '127.0.0.1', () => console.log(`Fictional Baby POC http://127.0.0.1:${port} (isolated local files only)`));
