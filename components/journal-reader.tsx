"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { JourneyMap } from "@/components/journey-map";
import { JourneyMusicPlayer } from "@/components/journey-music-player";
import { ReaderAlbum, ReaderFilm, ReaderPhoto } from "@/components/reader-media";
import { ShareActions } from "@/components/share-actions";
import { journeyVideos } from "@/lib/journey-videos";
import { PhotoStoryFilm } from "@/components/photo-story-film";
import { isTripPhotoVideo } from "@/lib/trip-photo";
import { tripDisplayDate } from "@/lib/trip-display-date";
import { hidePublicTimestamps } from "@/lib/public-facing-text";
import type { ReaderEditTarget } from "@/components/visual-journal-editor";
import type { TripDetail } from "@/lib/types";

export type ReaderNavigation = {catalogHref:string;editHref:string;articleHref:string;backLabel:string};

export function ReaderBack({onBack,href="/trips",label}: {onBack?: () => void;href?:string;label?:string} = {}) {
  const router = useRouter();
  if (onBack) return <button type="button" className="jr-back" onClick={onBack}>{label ?? "← 返回編輯"}</button>;
  return <Link href={href} prefetch={false} className="jr-back" onClick={event => {
    try {
      const from = sessionStorage.getItem("travelos-reader-origin");
      if (href === "/trips" && (from === "/" || from === "/trips") && window.history.length > 1) {
        event.preventDefault(); sessionStorage.removeItem("travelos-reader-origin"); router.back();
      }
    } catch {}
  }}>{label ?? "← 旅行目錄"}</Link>;
}
export function JournalReader({ trip, onBack, previewLabel, editor, hideHeader = false, navigation }: { trip: TripDetail; onBack?: () => void; previewLabel?: string; editor?: {onEdit: (target: ReaderEditTarget) => void;onAddStory?:()=>void;onArrange?:()=>void}; hideHeader?: boolean; navigation?:ReaderNavigation }) {
  const [panel, setPanel] = useState<"chapters" | "map" | "film" | null>(null);
  const [active, setActive] = useState("");
  const [progress, setProgress] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const photos = trip.photos.filter(photo => photo.storageKey.startsWith("/") || photo.storageKey.startsWith("http"));
  const cover = photos.find(photo => photo.id === trip.coverPhotoId && !isTripPhotoVideo(photo)) ?? photos.find(photo => !isTripPhotoVideo(photo));
  const videos = journeyVideos(trip);
  const filmPhotos=photos.filter(photo=>!isTripPhotoVideo(photo));
  const hasMap=!!trip.coordinates || trip.places.length>0 || (trip.travelRoute?.length??0)>0;
  const entries = trip.journalEntries;
  const dateLabel = tripDisplayDate(trip);
  const summaryText = editor ? trip.summary : hidePublicTimestamps(trip.summary);
  useEffect(() => {
    const update = () => setProgress(Math.min(100, Math.round(window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight) * 100)));
    window.addEventListener("scroll", update, { passive: true });
    const observer = new IntersectionObserver(items => { for (const item of items) if (item.isIntersecting) setActive(item.target.id); }, { rootMargin: "-10% 0px -55% 0px" });
    document.querySelectorAll("[data-reader-chapter]").forEach(el => observer.observe(el));
    update();
    return () => { window.removeEventListener("scroll", update); observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (!panel) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
      if (event.key === "Tab") {
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, video[controls], [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [panel]);
  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    setPanel(null);
    window.history.replaceState(window.history.state, "", "#" + id);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }));
  }
  function editProps(target: ReaderEditTarget, label: string) {
    return editor ? {role: 'button' as const, tabIndex: 0, 'aria-label': label, className: 'jr-editable', onClick: () => editor.onEdit(target), onKeyDown: (event: React.KeyboardEvent) => {if(event.key==='Enter'||event.key===' '){event.preventDefault();editor.onEdit(target);}}} : {};
  }
  const chapters = <nav className="jr-chapters" aria-label="故事章節">{entries.map((entry, index) => <a key={entry.id} href={`#story-${entry.id}`} aria-current={active === `story-${entry.id}` ? "location" : undefined} onClick={event => jump(event, `story-${entry.id}`)}><span>{String(index + 1).padStart(2, "0")}</span>{entry.title}</a>)}</nav>;
  return <main className="journal-site jr-page">
    <JourneyMusicPlayer tracks={trip.musicTracks ?? []} />
    {!hideHeader ? <header className="jr-topbar"><ReaderBack onBack={onBack} href={navigation?.catalogHref} label={navigation?.backLabel} />{onBack ? <button type="button" className="jl-brand" onClick={onBack}>TravelOS</button> : <Link href="/" prefetch={false} className="jl-brand">TravelOS</Link>}{onBack ? <span className="jr-progress-label">{previewLabel}</span> : null}<div className="jr-progress" style={{ width: `${progress}%` }} /></header> : null}
    <section className="jr-hero" aria-label="封面與開場" data-music-zone={trip.title}>
      <div className="jr-title"><div {...editProps({kind:"details"},"編輯旅行資料")}><p className="jl-eyebrow">{[trip.country,trip.city].filter(Boolean).join(" ／ ") || (editor ? "加入旅行地點" : "")}</p></div><h1 {...editProps({kind:"title"},"編輯遊記標題")}>{trip.title}</h1><div {...editProps({kind:"summary"},"編輯開場介紹")}><p className="jr-intro">{summaryText || (editor ? "寫一段開場介紹，帶讀者走進旅程。" : "")}</p></div><div className="jr-meta">{editor ? <span {...editProps({kind:"date"},"編輯公開日期")} style={{overflowWrap:"anywhere"}}>{dateLabel || "加入公開日期"}</span> : null}{entries.length || editor ? <span>{entries.length} 段故事</span> : null}{videos.length || filmPhotos.length ? <button type="button" onClick={() => setPanel("film")}>▷ 看旅程短片</button> : null}</div></div>
      {cover ? <figure className="jr-cover"><div className="jr-edit-photo"><ReaderPhoto key={cover.id} photo={cover} priority />{editor ? <button className="jr-photo-edit" type="button" onClick={()=>editor.onEdit({kind:"cover"})}>更換封面・第一張照片</button> : null}</div><figcaption>{cover.caption || `${trip.city} · 旅途一瞬`}</figcaption></figure> : editor ? <button type="button" className="jr-photo-edit-static" onClick={()=>editor.onEdit({kind:"cover"})}>選擇封面・第一張照片</button> : null}
    </section>
    <div className="jr-layout"><aside className="jr-sidebar">{entries.length || editor ? <><p className="jl-eyebrow">IN THIS JOURNEY</p><h2>沿途的故事</h2>{chapters}</> : null}<div className="jr-side-actions">{hasMap || editor ? <button type="button" onClick={() => setPanel("map")}>⌖ 旅程地圖</button> : null}{photos.length || editor ? <a href="#album" onClick={event => jump(event, "album")}>▧ 旅途相簿</a> : null}{videos.length || filmPhotos.length ? <button type="button" onClick={() => setPanel("film")}>▷ 旅程短片</button> : null}</div><ShareActions title={trip.title} description={trip.summary} path={navigation?.articleHref ?? `/trips/${trip.slug}?id=${encodeURIComponent(trip.id)}`} /></aside>
      <div className="jr-story">{entries.length || editor ? <h2 className="jr-section-heading">沿途的故事</h2> : null}
        {entries.map((entry, index) => {
          const photo = photos.find(item => item.id === entry.storyPhotoId);
          return <article id={`story-${entry.id}`} data-reader-chapter className="jr-chapter" key={entry.id} data-music-zone={`${entry.title} ${entry.body}`}>
            <header><span className="jr-chapter-number">{String(index + 1).padStart(2, "0")}</span><div>{trip.showEntryDates === true && entry.entryDate ? <p className="jl-eyebrow">{entry.entryDate.slice(0, 10).replaceAll("-", ".")}</p> : null}<h2 {...editProps({kind:"entry",id:entry.id},`編輯段落：${entry.title}`)}>{entry.title}</h2></div></header>
            {photo ? <figure className="jr-story-photo"><div className="jr-edit-photo"><ReaderPhoto key={photo.id} photo={photo} />{editor ? <button className="jr-photo-edit" type="button" onClick={()=>editor.onEdit({kind:"photo",id:photo.id,entryId:entry.id})}>修改這張照片</button> : null}</div>{photo.caption ? <figcaption>{photo.caption}</figcaption> : null}</figure> : editor ? <button type="button" className="jr-photo-edit-static" onClick={()=>editor.onEdit({kind:"photo",id:"",entryId:entry.id})}>為這段故事選擇照片</button> : null}
            <div {...editProps({kind:"entry",id:entry.id},`編輯內文：${entry.title}`)}><div className="jr-prose">{entry.body.split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></div>
            {entry.voiceNoteUrl ? <audio controls preload="none" src={entry.voiceNoteUrl} aria-label={`${entry.title}的錄音`} /> : null}
          </article>;
        })}
        {editor ? <div className="jr-inline-actions"><button type="button" onClick={editor.onAddStory ?? (()=>editor.onEdit({kind:"summary"}))}>＋ 一段故事</button>{photos.length && editor.onArrange ? <button type="button" onClick={editor.onArrange}>用現有照片補段落</button> : null}</div> : null}
        {videos.length || filmPhotos.length || editor ? <section id="film" className="jr-film-shelf" aria-label="旅程短片區"><header><h2 className="jr-section-heading">旅程短片</h2>{editor ? <button type="button" className="jr-photo-edit-static" onClick={()=>editor.onEdit({kind:"film"})}>修改・加入短片</button> : null}</header>{videos.length || filmPhotos.length ? <button type="button" className="jr-film-preview" onClick={()=>setPanel("film")} aria-label="播放旅程短片">{videos[0]?.poster || cover ? <img src={videos[0]?.poster ?? cover?.storageKey} loading="lazy" alt="" /> : null}<span>▷ {videos[0]?.title ?? "照片小影集"}</span></button> : <p className="jr-empty-slot">尚未放入短片</p>}</section> : null}
        {photos.length || editor ? <section id="album" className="jr-album">{editor ? <button className="jr-photo-edit-static" type="button" onClick={()=>editor.onEdit({kind:"album"})}>加入照片・影片</button> : null}<ReaderAlbum photos={photos} />{!photos.length ? <p className="jr-empty-slot">尚未放入照片</p> : null}</section> : null}
        <footer className="jr-ending"><p className="jl-eyebrow">UNTIL THE NEXT JOURNEY</p><h2>旅程走完了，記憶還在。</h2>{trip.closingNote ? <div {...editProps({kind:"closing"},"編輯旅程結語")}><p className="jr-intro" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{trip.closingNote}</p></div> : editor ? <button type="button" className="jr-photo-edit-static" onClick={()=>editor.onEdit({kind:"closing"})}>寫下旅程結語</button> : null}<ShareActions title={trip.title} description={trip.summary} path={navigation?.articleHref ?? `/trips/${trip.slug}?id=${encodeURIComponent(trip.id)}`} />{!hideHeader ? <ReaderBack onBack={onBack} href={navigation?.catalogHref} label={navigation?.backLabel} /> : null}</footer>
      </div>
    </div>
    <nav className="jr-mobile-bar" aria-label="閱讀工具">{entries.length ? <button type="button" onClick={() => setPanel("chapters")}>☷ <span>章節</span></button> : null}{photos.length || editor ? <a href="#album" onClick={event => jump(event, "album")}>▧ <span>相簿</span></a> : null}{hasMap || editor ? <button type="button" onClick={() => setPanel("map")}>⌖ <span>地圖</span></button> : null}{videos.length || filmPhotos.length ? <button type="button" onClick={() => setPanel("film")}>▷ <span>短片</span></button> : <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ <span>頂端</span></button>}</nav>
    {panel ? <div className="jr-overlay" onClick={event => { if (event.target === event.currentTarget) setPanel(null); }}><div className="jr-dialog" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="jr-dialog-title"><header><h2 id="jr-dialog-title">{panel === "chapters" ? "沿途的故事" : panel === "map" ? "旅程地圖" : "旅程短片"}</h2><button type="button" onClick={() => setPanel(null)} aria-label="關閉">✕</button></header><div className="jr-dialog-body">{editor && (panel === "map" || panel === "film") ? <button className="jr-photo-edit-static" type="button" onClick={()=>{const kind=panel;setPanel(null);editor.onEdit({kind});}}>編輯{panel === "map" ? "地圖與行程" : "短片"}</button> : null}{panel === "chapters" ? chapters : panel === "film" ? <>{videos.length?<ReaderFilm videos={videos} poster={cover?.storageKey} />:null}{filmPhotos.length?<PhotoStoryFilm photos={filmPhotos} />:null}</> : <><p className="jr-map-note">地圖保留旅程停點與行前安排，不代表每站都已到訪。</p><JourneyMap center={trip.coordinates} city={trip.city} country={trip.country} journalEntries={trip.journalEntries} photos={trip.photos} places={trip.places} route={trip.travelRoute ?? []} title={trip.title} /></>}</div></div></div> : null}
  </main>;
}

