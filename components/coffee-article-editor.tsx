"use client";

import {useState} from 'react';
import type {CoffeeShop} from '@/lib/types';

export function CoffeeArticleEditor({shop,onChange,onSave,onAdvanced,busy,message}:{shop:CoffeeShop;onChange:(shop:CoffeeShop)=>void;onSave:()=>void;onAdvanced:()=>void;busy:boolean;message:string}) {
  const [reading,setReading]=useState(false);
  const field='w-full min-w-0 rounded-xl border border-stone-200 bg-white/50 p-3 text-inherit outline-none focus:border-teal-700';
  return <main className="min-h-screen bg-[#f7f4ed] pb-16 text-[#283d33]">
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-[#f7f4ed]/95 px-4 py-3 backdrop-blur"><a className="inline-flex min-h-11 items-center" href="/coffee/admin?view=list">← 咖啡記事</a><div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-full border border-stone-300 px-4" type="button" onClick={()=>setReading(!reading)}>{reading?'返回編輯':'閱讀效果'}</button><button className="min-h-11 rounded-full bg-[#285447] px-5 text-white disabled:opacity-50" type="button" onClick={onSave} disabled={busy}>{busy?'儲存中…':'儲存修改'}</button></div></header>
    <article className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="mb-5 flex flex-wrap justify-between gap-3 text-sm text-stone-500"><span>{shop.city} · 咖啡記事{shop.visibility==='private'?' · 草稿':''}</span><span role="status">{message}</span></div>
      {reading?<h1 className="mb-7 whitespace-pre-wrap break-words font-serif text-3xl leading-snug sm:text-5xl">{shop.name}</h1>:<textarea aria-label="文章標題" className={`${field} mb-7 font-serif text-3xl leading-snug sm:text-4xl`} rows={2} value={shop.name} onChange={e=>onChange({...shop,name:e.target.value})}/>}
      {reading?<p className="mb-8 whitespace-pre-wrap text-lg leading-9">{shop.comments}</p>:<textarea aria-label="開場文字" className={`${field} mb-8 text-lg leading-9`} rows={4} value={shop.comments} onChange={e=>onChange({...shop,comments:e.target.value})}/>}
      {shop.photos.map((photo,index)=><section key={photo.id} className="mb-10">
        <figure className="overflow-hidden rounded-2xl"><img alt={photo.caption||photo.originalFilename} src={photo.storageKey} className="max-h-[80vh] w-full object-contain" loading={index===0?'eager':'lazy'}/>{reading?<figcaption className="py-3 text-sm leading-7 text-stone-500">{photo.caption}</figcaption>:<textarea aria-label={`照片 ${index+1} 說明`} className={`${field} mt-3 text-sm leading-7`} rows={2} value={photo.caption??''} onChange={e=>onChange({...shop,photos:shop.photos.map(p=>p.id===photo.id?{...p,caption:e.target.value}:p)})}/>}</figure>
        {index===0?(reading?<div className="mt-8 whitespace-pre-wrap text-lg leading-9">{shop.lifeNote}</div>:<textarea aria-label="文章內文" className={`${field} mt-8 text-lg leading-9`} rows={10} value={shop.lifeNote} onChange={e=>onChange({...shop,lifeNote:e.target.value})}/>):null}
      </section>)}
      {!shop.photos.length?(reading?<p className="whitespace-pre-wrap leading-9">{shop.lifeNote}</p>:<textarea aria-label="文章內文" className={field} rows={10} value={shop.lifeNote} onChange={e=>onChange({...shop,lifeNote:e.target.value})}/>):null}
      {!reading?<button type="button" className="min-h-11 rounded-full border border-stone-300 px-5" onClick={onAdvanced}>照片排序・其他資料</button>:null}
    </article>
  </main>;
}

