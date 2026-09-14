"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createJournal,JOURNAL_SHELVES} from '@/lib/journal-template';

export default function NewTripPage(){
  const [title,setTitle]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const router=useRouter();
  async function create(event:React.FormEvent){
    event.preventDefault();if(!title.trim()||busy)return;setBusy(true);setMessage('正在開好這本遊記…');
    const trip=createJournal(title,`trip_${crypto.randomUUID()}`,new Date().toISOString());
    try{const response=await fetch('/api/trips/content',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trip})});const data=await response.json();if(!response.ok||!data.trip)throw new Error(data.error||'尚未建立，請再試一次。');router.push(`/trips/admin?trip=${encodeURIComponent(data.trip.id)}`);}
    catch(error){setMessage(error instanceof Error?error.message:'尚未建立，請再試一次。');setBusy(false);}
  }
  return <main className="journal-site jt-new"><Link href="/trips/admin" prefetch={false}>← 我的遊記</Link><p className="jl-eyebrow">A NEW JOURNEY</p><h1>先取個名字，開好一本遊記。</h1><p>只有幾張照片也可以。架構已準備好，內容慢慢放進來。</p><form onSubmit={create}><label>遊記名稱<input autoFocus value={title} onChange={event=>setTitle(event.target.value)} placeholder="例如：法國尼斯的初秋" required /></label><button type="submit" disabled={busy||!title.trim()}>{busy?'正在建立…':'開好這本遊記'}</button><p role="status">{message}</p></form><section className="jt-shelves"><h2>每本都有一樣清楚的架構</h2><div className="jt-grid">{JOURNAL_SHELVES.map((shelf,index)=><article key={shelf.id}><span className="jt-number">0{index+1}</span><strong>{shelf.title}</strong><p>{shelf.hint}</p><small>可以先空著</small></article>)}</div></section></main>;
}
