import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const state = await fetch('http://127.0.0.1:3347/api/state').then(r => r.json());
const evidence = [];
for (const lang of ['zh', 'en']) {
  const book = state.books.filter(b => b.lang === lang).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const stem = lang === 'zh' ? '小禾的第一年-繁中四頁成長書' : 'Milo-Our-First-Year-English';
  const response = await fetch(`http://127.0.0.1:3347/api/book/${book.id}/pdf`);
  await writeFile(join(output, `${stem}.pdf`), Buffer.from(await response.arrayBuffer()));
  let html = await fetch(`http://127.0.0.1:3347/book/${book.id}`).then(r => r.text());
  html = html.replaceAll(`/api/book/${book.id}/pdf`, `./${stem}.pdf`);
  for (let i=0;i<book.entries.length;i++) {
    const audio = book.entries[i].audio;
    if (audio) {
      const audioName = `sample-narration-${lang}-${i+1}.wav`;
      await writeFile(join(output, audioName), Buffer.from(await fetch(`http://127.0.0.1:3347${audio}`).then(r=>r.arrayBuffer())));
      html = html.replaceAll(audio, `./${audioName}`);
    }
  }
  await writeFile(join(output, `${stem}.html`), html);
  evidence.push({ lang, id: book.id, title: book.title, updatedAt: book.updatedAt, pagesExpected: 4, entries: book.entries.map(e => ({ momentId: e.momentId, title: e.title, body: e.body, date: e.date })), sourceProjectionPhotos: book.trip.photos.length, sourceProjectionEntries: book.trip.journalEntries.length });
}
await writeFile(join(output, '親子記錄-作品來源證據.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence.map(({ entries,...item }) => item), null, 2));
