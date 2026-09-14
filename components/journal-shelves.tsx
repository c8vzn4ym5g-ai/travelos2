"use client";
import {JOURNAL_SHELVES} from '@/lib/journal-template';
import {isTripPhotoVideo} from '@/lib/trip-photo';
import type {TripDetail} from '@/lib/types';

export function JournalShelves({trip,onOpen,onArrange,onAddStory}:{trip:TripDetail;onOpen:(id:typeof JOURNAL_SHELVES[number]['id'])=>void;onArrange:()=>void;onAddStory:()=>void}) {
  const state={cover:trip.photos.some(photo=>!isTripPhotoVideo(photo))?'可選封面':'尚未放照片',summary:trip.summary.trim()?'已有介紹':'可以先空著',story:`${trip.journalEntries.length} 段故事`,film:trip.photos.some(isTripPhotoVideo)?'已有影片':trip.photos.length?'可播放照片小影集':'可以先空著',album:`${trip.photos.length} 個素材`,closing:trip.closingNote?.trim()?'已有感想':'可以先空著'};
  return <section className="jt-shelves" aria-label="遊記標準架構"><header><div><h2>這本遊記的架構</h2><p>素材多寡都可以。這裡的待補提示只給編輯者看。</p></div><div className="jt-actions"><button type="button" onClick={onOpen.bind(null,'album')}>一次放入素材</button><button type="button" onClick={onArrange} disabled={!trip.photos.length}>依素材整理初稿</button><button type="button" onClick={onAddStory}>＋ 一段故事</button></div></header><div className="jt-grid">{JOURNAL_SHELVES.map((shelf,index)=><button type="button" key={shelf.id} onClick={()=>onOpen(shelf.id)}><span className="jt-number">0{index+1}</span><strong>{shelf.title}</strong><span>{shelf.hint}</span><small>{state[shelf.id]}</small></button>)}</div></section>;
}
