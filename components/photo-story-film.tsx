"use client";
import {useEffect,useState} from 'react';
import {ReaderPhoto} from '@/components/reader-media';
import type {Photo} from '@/lib/types';

/** Long galleries (e.g. ~90-photo trip film) flip fast; short sets keep a slower pace. */
function slideIntervalMs(count: number) {
  if (count >= 40) return 750;
  if (count >= 16) return 1200;
  if (count >= 8) return 2000;
  return 4000;
}

export function PhotoStoryFilm({photos}:{photos:Photo[]}) {
  const [index,setIndex]=useState(0);const [playing,setPlaying]=useState(false);
  const intervalMs=slideIntervalMs(photos.length);
  useEffect(()=>{if(!playing||photos.length<2)return;const timer=setInterval(()=>setIndex(value=>(value+1)%photos.length),intervalMs);return()=>clearInterval(timer);},[playing,photos.length,intervalMs]);
  if(!photos.length)return <p>先放幾張照片，就能播放照片小影集。</p>;
  const photo=photos[index%photos.length];
  return <section className="jt-slideshow" aria-label="照片小影集"><h3>照片小影集</h3><p>用現有照片慢慢回看這段旅程。</p><div className="jt-slide"><ReaderPhoto key={photo.id} photo={photo} priority /></div>{photo.caption?<p>{photo.caption}</p>:null}<div className="jt-actions"><button type="button" aria-label="上一張照片" onClick={()=>setIndex(value=>(value+photos.length-1)%photos.length)}>← 上一張</button><button type="button" onClick={()=>setPlaying(value=>!value)}>{playing?'暫停':'播放影集'}</button><button type="button" aria-label="下一張照片" onClick={()=>setIndex(value=>(value+1)%photos.length)}>下一張 →</button></div><p aria-live="polite">{index%photos.length+1} / {photos.length}</p></section>;
}
