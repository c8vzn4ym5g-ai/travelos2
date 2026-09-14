"use client";

import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {JournalReader} from '@/components/journal-reader';
import {VisualJournalEditor} from '@/components/visual-journal-editor';
import {ReaderPhoto} from '@/components/reader-media';
import {articleToNote,newNote,noteToArticle,type NoteCategory} from '@/lib/note-article';
import type {CoffeePhoto,CoffeeShop} from '@/lib/types';

type Advanced = 'story'|'photos'|'videos'|'details';
export function NoteWorkspace({category,id,slug,initialMode='public',create=false}: {category:NoteCategory;id?:string;slug?:string;initialMode?:'public'|'edit';create?:boolean}) {
  const router=useRouter();
  const [item,setItem]=useState<CoffeeShop|null>(null);
  const [title,setTitle]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(!create);
  const [message,setMessage]=useState('');
  const [dirty,setDirty]=useState(false);
  const [advanced,setAdvanced]=useState<Advanced|null>(null);
  const [reload,setReload]=useState(0);
  const revision=useRef(0);
  const dialog=useRef<HTMLDivElement>(null);
  const label=category==='coffee'?'咖啡記憶':'美食記事';
  const catalogHref=`/${category}?mode=${initialMode}`;
  function draftKey(noteId:string){return `travelos-note-draft-${category}-${noteId}`;}
  function rememberDraft(next:CoffeeShop){
    try{window.sessionStorage.setItem(draftKey(next.id),JSON.stringify({baseUpdatedAt:next.updatedAt,item:next}));return true;}catch{return false;}
  }
  useEffect(()=>{
    if(create)return;
    const controller=new AbortController();
    const params=new URLSearchParams({category,mode:initialMode});
    if(id)params.set('id',id);else if(slug)params.set('slug',slug);
    setLoading(true);setMessage('');
    fetch(`/api/notes/item?${params}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{
      const data=await response.json();if(!response.ok||!data.item)throw new Error(data.error||'這篇筆記尚未載入。');
      if(!controller.signal.aborted){
        let restored:CoffeeShop|null=null;
        if(initialMode==='edit'){
          try{
            const raw=window.sessionStorage.getItem(draftKey(data.item.id));
            const draft=raw?JSON.parse(raw) as {baseUpdatedAt:string;item:CoffeeShop}:null;
            if(draft?.item.id===data.item.id){
              if(draft.baseUpdatedAt===data.item.updatedAt){restored=draft.item;setMessage('已接回尚未儲存的工作稿。');}
              else{window.sessionStorage.setItem(`${draftKey(data.item.id)}:conflict:${draft.baseUpdatedAt}`,raw!);setMessage('已有較新的版本；先前工作稿仍保留在這個分頁，未套用到新版。');}
            }
          }catch{setMessage('本機工作稿暫時無法讀取，現在顯示已儲存版本。');}
        }
        setItem(restored??data.item);setDirty(!!restored);
      }
    }).catch(error=>{if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:'這篇筆記尚未載入。');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[category,id,slug,initialMode,create,reload]);
  useEffect(()=>{
    if(!advanced)return;
    const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';dialog.current?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setAdvanced(null);
      if(event.key==='Tab'){
        const items=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,a[href]');if(!items?.length)return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
  },[advanced]);
  function change(next:CoffeeShop){revision.current++;setItem(next);setDirty(true);setMessage(rememberDraft(next)?'':'這個分頁未能暫存工作稿，請先儲存再離開。');}
  async function save(publish:boolean){
    if(!item||busy)return;const submitted=item;const currentRevision=revision.current;setBusy(true);setMessage('正在儲存…');
    try{
      const response=await fetch('/api/notes/item',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({category,item:submitted,baseUpdatedAt:submitted.updatedAt,publish})});
      const data=await response.json();if(!response.ok||!data.item)throw new Error(data.error||'尚未儲存，請再試一次。');
      setItem(current=>{
        if(revision.current===currentRevision)return data.item;
        if(!current)return data.item;
        const next={...current,updatedAt:data.item.updatedAt,publishedSnapshot:data.item.publishedSnapshot,visibility:data.item.visibility};rememberDraft(next);return next;
      });
      if(revision.current===currentRevision){setDirty(false);try{window.sessionStorage.removeItem(draftKey(submitted.id));}catch{}}
      setMessage(publish?'公開版本已更新。':'工作稿已儲存。');
    }catch(error){setMessage(error instanceof Error?error.message:'尚未儲存，請再試一次。');}finally{setBusy(false);}
  }
  async function createItem(event:React.FormEvent){
    event.preventDefault();if(!title.trim()||busy)return;setBusy(true);setMessage('正在建立…');
    try{
      const draft=newNote(title,category,crypto.randomUUID(),new Date().toISOString());
      const response=await fetch('/api/notes/item',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category,item:draft})});
      const data=await response.json();if(!response.ok||!data.item)throw new Error(data.error||'尚未建立，請再試一次。');
      router.replace(`/${category}/${encodeURIComponent(data.item.slug)}?id=${encodeURIComponent(data.item.id)}&mode=edit`);
    }catch(error){setMessage(error instanceof Error?error.message:'尚未建立，請再試一次。');setBusy(false);}
  }
  async function upload(files:File[]){
    if(!item||busy||!files.length)return;setBusy(true);
    try{
      for(let index=0;index<files.length;index++){
        setMessage(`正在加入素材 ${index+1} / ${files.length}…`);
        const form=new FormData();form.set('category',category);form.set('itemId',item.id);form.set('file',files[index]);
        const response=await fetch('/api/notes/photos',{method:'POST',body:form});const data=await response.json();
        if(!response.ok||!data.photo)throw new Error(data.error||'素材未能加入，已加入的素材保留。');
        const photo=data.photo as CoffeePhoto;revision.current++;setItem(current=>{if(!current)return current;const next={...current,photos:[...current.photos,photo]};rememberDraft(next);return next;});setDirty(true);
      }
      setMessage('素材已加入工作稿；儲存後保留。');
    }catch(error){setMessage(error instanceof Error?error.message:'素材未能加入。');}finally{setBusy(false);}
  }
  function back(){router.push(catalogHref);}
  if(create)return <main className="journal-site jt-new"><Link href={`/${category}?mode=edit`} prefetch={false}>← {label}</Link><h1>新增{label}</h1><form onSubmit={createItem}><label>文章名稱<input value={title} onChange={event=>setTitle(event.target.value)} required /></label><button type="submit" disabled={busy||!title.trim()}>{busy?'正在建立…':'建立並編輯'}</button><p role="status">{message}</p></form></main>;
  if(loading)return <main className="journal-site jt-new"><Link href={catalogHref}>← {label}</Link><p role="status">正在打開這篇筆記…</p></main>;
  if(!item)return <main className="journal-site jt-new"><Link href={catalogHref}>← {label}</Link><p role="status">{message||'找不到這篇筆記。'}</p><button type="button" onClick={()=>setReload(value=>value+1)}>重新載入</button></main>;
  const article=noteToArticle(item);
  const articleHref=`/${category}/${encodeURIComponent(item.slug)}?id=${encodeURIComponent(item.id)}`;
  const navigation={catalogHref,articleHref,editHref:`${articleHref}&mode=edit`,backLabel:`← ${label}`};
  if(initialMode==='public')return <JournalReader trip={article} navigation={navigation} />;
  return <>
    <VisualJournalEditor trip={article} onChange={next=>change(articleToNote(next,item))} onSave={()=>void save(false)} onPublish={()=>void save(true)} onLibrary={back} onAdvanced={setAdvanced} dirty={dirty} busy={busy} message={message} libraryLabel={label} readerNavigation={navigation} />
    {advanced?<div className="vj-overlay"><div ref={dialog} className="vj-dialog" role="dialog" aria-modal="true" aria-label={advanced==='details'?'筆記資料':advanced==='story'?'段落排序':'照片與影片'} tabIndex={-1}>
      <header><h2>{advanced==='details'?'筆記資料':advanced==='story'?'段落排序':'照片與影片'}</h2><button type="button" onClick={()=>setAdvanced(null)}>完成</button></header>
      <div className="vj-fields">
        {advanced==='details'?<>{([['country','國家'],['city','城市'],['address','地址'],['coffeeOrdered',category==='coffee'?'咖啡與餐點':'餐點'],['mapUrl','地圖連結']] as const).map(([key,text])=><label key={key}>{text}<input value={item[key]??''} onChange={event=>change({...item,[key]:event.target.value})} /></label>)}</>:null}
        {advanced==='story'?article.journalEntries.length?article.journalEntries.map((entry,index)=><div key={entry.id} className="jt-actions"><span style={{flex:'1 1 180px',overflowWrap:'anywhere'}}>{entry.title}</span><button type="button" disabled={index===0} onClick={()=>{const entries=[...article.journalEntries];[entries[index-1],entries[index]]=[entries[index],entries[index-1]];change({...item,journalEntries:entries});}}>↑ 上移</button><button type="button" disabled={index===article.journalEntries.length-1} onClick={()=>{const entries=[...article.journalEntries];[entries[index+1],entries[index]]=[entries[index],entries[index+1]];change({...item,journalEntries:entries});}}>↓ 下移</button></div>):<p>先在文章中加入一段故事。</p>:null}
        {advanced==='photos'||advanced==='videos'?<><label>加入照片或影片<input type="file" multiple accept="image/*,video/*" disabled={busy} onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';void upload(files);}} /></label><div className="vj-photo-grid">{article.photos.map(photo=><figure key={photo.id} style={{minWidth:0,margin:0}}><ReaderPhoto photo={photo} /><label>素材說明<input value={photo.caption??''} onChange={event=>change({...item,photos:item.photos.map(current=>current.id===photo.id?{...current,caption:event.target.value}:current)})} /></label></figure>)}</div></>:null}
        <p role="status">{message||'修改已放入工作稿，回到版面後儲存。'}</p>
      </div>
    </div></div>:null}
  </>;
}
