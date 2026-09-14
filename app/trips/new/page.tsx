"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createJournal} from '@/lib/journal-template';

export default function NewTripPage(){
  const [title,setTitle]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const router=useRouter();
  async function create(event:React.FormEvent){
    event.preventDefault();if(!title.trim()||busy)return;setBusy(true);setMessage('正在開好這本遊記…');
    const trip=createJournal(title,`trip_${crypto.randomUUID()}`,new Date().toISOString());
    try{const response=await fetch('/api/trips/content',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trip})});const data=await response.json();if(!response.ok||!data.trip)throw new Error(data.error||'尚未建立，請再試一次。');router.push(`/trips/admin?trip=${encodeURIComponent(data.trip.id)}`);}
    catch(error){setMessage(error instanceof Error?error.message:'尚未建立，請再試一次。');setBusy(false);}
  }
  return <main className="journal-site jt-new"><Link href="/trips/admin" prefetch={false}>← 編輯現有遊記</Link><h1>新增遊記</h1><form onSubmit={create}><label>遊記名稱<input value={title} onChange={event=>setTitle(event.target.value)} placeholder="遊記名稱" required /></label><button type="submit" disabled={busy||!title.trim()}>{busy?'正在建立…':'建立並編輯'}</button><p role="status">{message}</p></form></main>;
}
