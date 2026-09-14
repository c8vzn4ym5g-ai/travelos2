"use client";
import {useEffect, useRef, useState} from "react";
import {JournalReader} from "@/components/journal-reader";
import {ReaderPhoto} from "@/components/reader-media";
import {projectJournalForReader} from "@/lib/journal-entry-kind";
import {publishedTrip} from "@/lib/trip-publication";
import {setTripCover, tripCover} from "@/lib/trip-cover";
import {isTripPhotoVideo} from "@/lib/trip-photo";
import type {TripDetail} from "@/lib/types";
import {arrangeJournal,addJournalStory} from "@/lib/journal-template";
import {EditorDateLabel} from "@/components/editor-date-label";

export type ReaderEditTarget = {kind:"title"|"summary"|"cover"|"details"|"album"|"film"|"map"|"date"|"closing"} | {kind:"entry";id:string} | {kind:"photo";id:string;entryId?:string};
export function VisualJournalEditor({trip,onChange,onSave,onPublish,onLibrary,onAdvanced,dirty,busy,message}: {
  trip:TripDetail; onChange:(next:TripDetail)=>void; onSave:()=>void; onPublish:()=>void;
  onLibrary:()=>void; onAdvanced:(tab:"story"|"photos"|"videos"|"details")=>void; dirty:boolean;busy:boolean;message:string;
}) {
  const [mode,setMode]=useState<"edit"|"preview"|"published">("edit");
  const [target,setTarget]=useState<ReaderEditTarget|null>(null);
  const [value,setValue]=useState("");
  const [heading,setHeading]=useState("");
  const [caption,setCaption]=useState("");
  const [limit,setLimit]=useState(12);
  const [query,setQuery]=useState("");
  const [arrangement,setArrangement]=useState("");
  const [dateSettings,setDateSettings]=useState<Pick<TripDetail,'publicDateLabel'|'showEntryDates'>>({});
  const dialog=useRef<HTMLDivElement>(null);
  const visible = mode==="published" ? publishedTrip(trip) ?? projectJournalForReader(trip) : projectJournalForReader(trip);
  const entry=target?.kind==="entry" ? trip.journalEntries.find(e=>e.id===target.id) : null;
  const selectedPhoto=target?.kind==="photo" ? trip.photos.find(p=>p.id===target.id) : null;
  function open(next:ReaderEditTarget) {
    if (next.kind==="details" || next.kind==="map") return onAdvanced("details");
    if (next.kind==="album") return onAdvanced("photos");
    if (next.kind==="film") return onAdvanced("videos");
    setQuery("");setLimit(12);
    setDateSettings({publicDateLabel:trip.publicDateLabel,showEntryDates:trip.showEntryDates});
    const current=next.kind==="entry" ? trip.journalEntries.find(e=>e.id===next.id) : null;
    const photo=next.kind==="cover" ? tripCover(trip) : next.kind==="photo" ? trip.photos.find(p=>p.id===next.id) : null;
    setHeading(current?.title ?? "");
    setValue(next.kind==="title" ? trip.title : next.kind==="summary" ? trip.summary : next.kind==="closing" ? trip.closingNote??'' : current?.body ?? "");
    setCaption(photo?.caption ?? "");
    setTarget(next);
  }
  useEffect(()=>{
    if (!target) return;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";dialog.current?.focus();
    const keys=(event:KeyboardEvent)=>{
      if(event.key==="Escape") setTarget(null);
      if(event.key==="Tab") {
        const items=dialog.current?.querySelectorAll<HTMLElement>('button,input,textarea,[tabindex="0"]');
        if(!items?.length)return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",keys);
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",keys);previous?.focus();};
  },[target]);
  function apply() {
    if(!target)return;
    if(target.kind==="title") onChange({...trip,title:value});
    if(target.kind==="summary") onChange({...trip,summary:value});
    if(target.kind==="closing") onChange({...trip,closingNote:value});
    if(target.kind==='date') onChange({...trip,...dateSettings});
    if(target.kind==="entry") onChange({...trip,journalEntries:trip.journalEntries.map(e=>e.id===target.id?{...e,title:heading,body:value}:e)});
    const photo=target.kind==="cover"?tripCover(trip):selectedPhoto;
    if(photo&&(target.kind==="cover"||target.kind==="photo")) onChange({...trip,photos:trip.photos.map(p=>p.id===photo.id?{...p,caption}:p)});
    setTarget(null);
  }
  const choices=trip.photos.filter(p=>!isTripPhotoVideo(p)&&(!query||`${p.caption} ${p.originalFilename}`.toLowerCase().includes(query.toLowerCase())));
  return <div className="vj-workspace">
    <header className="vj-toolbar"><button type="button" onClick={onLibrary}>← 遊記目錄</button><strong>版面編輯</strong><div className="vj-modes" aria-label="版面模式">{([["edit","直接編輯"],["preview","讀者效果"],["published","目前公開"]] as const).map(([id,label])=><button type="button" key={id} aria-pressed={mode===id} disabled={id==="published"&&!publishedTrip(trip)} onClick={()=>setMode(id)}>{label}</button>)}</div><button type="button" disabled={busy||!dirty} onClick={onSave}>{busy?"儲存中…":"儲存工作稿"}</button><button type="button" className="vj-publish" disabled={busy} onClick={onPublish}>更新公開版</button></header>
    <div className="vj-note"><span>{mode==="edit"?"點文字或照片即可修改":mode==="preview"?"讀者效果":"目前公開版本"}</span><button type="button" onClick={()=>onAdvanced("story")}>段落排序</button><span role="status">{dirty?"工作稿尚未儲存":message}</span></div>
    {arrangement&&mode==='edit'?<p className="jt-arranged" role="status">{arrangement}</p>:null}
    <JournalReader trip={visible} onBack={onLibrary} previewLabel={mode==="published"?"目前公開":"工作稿"} editor={mode==="edit"?{onEdit:open,onArrange:()=>{const next=arrangeJournal(trip,new Date().toISOString());onChange(next);setArrangement(`已加入 ${next.journalEntries.length-trip.journalEntries.length} 段照片初稿，原內容保留。`);},onAddStory:()=>{const next=addJournalStory(trip,`journal_${crypto.randomUUID()}`,new Date().toISOString());onChange(next);setHeading("新的故事");setValue("");setTarget({kind:"entry",id:next.journalEntries[next.journalEntries.length-1].id});}}:undefined} hideHeader />
    {target?<div className="vj-overlay"><div className="vj-dialog" role="dialog" aria-modal="true" aria-label="修改這個位置" tabIndex={-1} ref={dialog}><header><h2>{target.kind==="cover"?"封面・第一張照片":target.kind==="entry"?"修改這段故事":target.kind==="photo"?"修改照片":target.kind==="title"?"修改遊記標題":target.kind==="date"?"公開日期":target.kind==="closing"?"旅程收尾":"修改開場介紹"}</h2><button type="button" onClick={()=>setTarget(null)}>取消</button></header>
      {target.kind==='date'?<EditorDateLabel startDate={trip.startDate} {...dateSettings} onChange={setDateSettings} />:null}
      {target.kind==="title"||target.kind==="summary"||target.kind==="entry"||target.kind==='closing'?<div className="vj-fields">{entry?<label>段落標題<input value={heading} onChange={e=>setHeading(e.target.value)} /></label>:null}<label>{target.kind==="title"?"遊記標題":target.kind==="summary"?"開場介紹":target.kind==='closing'?'旅程收尾':"段落內容"}<textarea autoFocus rows={target.kind==="title"?2:9} value={value} onChange={e=>setValue(e.target.value)} /></label></div>:null}
      {target.kind==="cover"||target.kind==="photo"?<div className="vj-fields"><label>照片說明<input value={caption} onChange={e=>setCaption(e.target.value)} /></label><button type="button" onClick={()=>{setTarget(null);onAdvanced("photos");}}>＋ 加入照片</button><label>搜尋照片<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(12);}} /></label><div className="vj-photo-grid">{choices.slice(0,limit).map(photo=><button type="button" key={photo.id} aria-label={`選擇照片：${photo.caption||photo.originalFilename}`} onClick={()=>{
        if(target.kind==="cover") onChange(setTripCover(trip,photo));
        else onChange({...trip,journalEntries:trip.journalEntries.map(e=>e.id===target.entryId?{...e,storyPhotoId:photo.id}:e)});
        setTarget(null);
      }}><ReaderPhoto photo={photo} /><span>{photo.caption||photo.originalFilename}</span></button>)}</div>{choices.length>limit?<button type="button" onClick={()=>setLimit(n=>n+12)}>再看 12 張</button>:null}</div>:null}
      <footer><button type="button" className="vj-publish" onClick={apply}>套用到這個版面</button></footer>
    </div></div>:null}
  </div>;
}

