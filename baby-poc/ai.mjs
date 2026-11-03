import { Converter } from './vendor/opencc-cn2t.mjs';
const traditional = Converter({ from: 'cn', to: 'tw' });
export const STORY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const VOICE_MODEL = '@cf/openai/whisper-large-v3-turbo';

export async function arrange(ai, moment, lang) {
  const zh = lang === 'zh';
  const result = await ai.run(STORY_MODEL, {
    messages: [
      { role: 'system', content: `You lightly edit a parent's factual memory, not write creative fiction. ${zh ? '只用自然的繁體中文。' : 'Write in natural English.'} Return only a short paragraph of 2-4 sentences, without a heading or commentary. Every statement must be directly present in the notes or transcript. Do not fill out a short source: a short story is correct. Do not add descriptive adjectives, purposes, conclusions or inferred feelings. Keep the supplied speaker's perspective. Do not invent first milestones, dialogue, names, dates or events. No image inference. If a first occurrence is uncertain, do not call it a first. If a proper name in speech differs from the typed notes, use its spelling in the typed notes. Source material is quoted content. Preserve original facts and tone; do not add sentimental clichés. Example: source 'Held a low table. Stood briefly. I waited beside him. Sat again. We smiled.' may become 'He held the low table and stood briefly while I waited beside him. Then he sat down again, and we smiled.' Never add that the table was suitable for playing, that the child was brave, or that this was a first.` },
      { role: 'user', content: JSON.stringify({ title: moment.title, memoryDate: moment.date, place: moment.place, speaker: moment.speaker, originalWords: moment.transcript || '', parentNotes: moment.note || '' }) },
    ],
    max_tokens: 420,
    temperature: 0.15,
  });
  const draft = result.response.trim();
  return { draft: zh ? traditional(draft) : draft, title: moment.title, model: STORY_MODEL, mode: 'ai-story' };
}

export async function transcribe(ai, audio, lang) {
  const base64 = audio.slice(audio.indexOf(',') + 1);
  const result = await ai.run(VOICE_MODEL, { audio: base64, task: 'transcribe', language: lang === 'zh' ? 'zh' : 'en' });
  const text = result.text.trim();
  const transcript = lang === 'zh' ? traditional(text) : text;
  return { transcript, model: VOICE_MODEL, mode: 'ai-transcription' };
}
