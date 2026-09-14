"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { JourneyMap } from "@/components/journey-map";
import { JourneyMusicPlayer } from "@/components/journey-music-player";
import { ReaderAlbum, ReaderFilm, ReaderPhoto } from "@/components/reader-media";
import { ShareActions } from "@/components/share-actions";
import { getTripPromoVideos } from "@/lib/promo-videos";
import { isTripPhotoVideo } from "@/lib/trip-photo";
import type { ReaderEditTarget } from "@/components/visual-journal-editor";
import type { TripDetail } from "@/lib/types";

export function ReaderBack({onBack}: {onBack?: () => void} = {}) {
  const router = useRouter();
  if (onBack) return <button type="button" className="jr-back" onClick={onBack}>← 返回編輯</button>;
  return <Link href="/trips" prefetch={false} className="jr-back" onClick={event => {
    try {
      const from = sessionStorage.getItem("travelos-reader-origin");
      if ((from === "/" || from === "/trips") && window.history.length > 1) {
        event.preventDefault(); sessionStorage.removeItem("travelos-reader-origin"); router.back();
      }
    } catch {}
  }}>← 旅行目錄</Link>;
}
export function JournalReader({ trip, onBack, previewLabel, editor, hideHeader = false }: { trip: TripDetail; onBack?: () => void; previewLabel?: string; editor?: {onEdit: (target: ReaderEditTarget) => void}; hideHeader?: boolean }) {
  const [panel, setPanel] = useState<"chapters" | "map" | "film" | null>(null);
  const [active, setActive] = useState("");
  const [progress, setProgress] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const photos = trip.photos.filter(photo => photo.storageKey.startsWith("/") || photo.storageKey.startsWith("http"));
  const cover = photos.find(photo => photo.id === trip.coverPhotoId && !isTripPhotoVideo(photo)) ?? photos.find(photo => !isTripPhotoVideo(photo));
  const videos = getTripPromoVideos(trip.slug);
  const entries = trip.journalEntries;
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
  const editHref = `/trips/admin?trip=${encodeURIComponent(trip.id)}&returnTo=${encodeURIComponent(`/trips/${trip.slug}?id=${trip.id}`)}`;
  const chapters = <nav className="jr-chapters" aria-label="故事章節">{entries.map((entry, index) => <a key={entry.id} href={`#story-${entry.id}`} aria-current={active === `story-${entry.id}` ? "location" : undefined} onClick={event => jump(event, `story-${entry.id}`)}><span>{String(index + 1).padStart(2, "0")}</span>{entry.title}</a>)}</nav>;
  return <main className="journal-site jr-page">
    <JourneyMusicPlayer tracks={trip.musicTracks ?? []} />
    {!hideHeader ? <header className="jr-topbar"><ReaderBack onBack={onBack} />{onBack ? <button type="button" className="jl-brand" onClick={onBack}>TravelOS</button> : <Link href="/" prefetch={false} className="jl-brand">TravelOS</Link>}{onBack ? <span className="jr-progress-label">{previewLabel}</span> : <Link href={editHref} prefetch={false} className="jr-back">編輯這篇</Link>}<div className="jr-progress" style={{ width: `${progress}%` }} /></header> : null}
    <section className="jr-hero" data-music-zone={trip.title}>
      <div className="jr-title"><div {...editProps({kind:"details"},"編輯旅行資料")}><p className="jl-eyebrow">{trip.country} ／ {trip.city}</p></div><h1 {...editProps({kind:"title"},"編輯遊記標題")}>{trip.title}</h1><div {...editProps({kind:"summary"},"編輯開場介紹")}><p className="jr-intro">{trip.summary}</p></div><div className="jr-meta"><span>{trip.startDate ? trip.startDate.replaceAll("-", ".") : "旅行記憶"}</span><span>{entries.length} 段故事</span>{videos.length ? <button type="button" onClick={() => setPanel("film")}>▷ 看旅程短片</button> : null}</div></div>
      {cover ? <figure className="jr-cover"><div className="jr-edit-photo"><ReaderPhoto key={cover.id} photo={cover} priority />{editor ? <button className="jr-photo-edit" type="button" onClick={()=>editor.onEdit({kind:"cover"})}>更換封面・第一張照片</button> : null}</div><figcaption>{cover.caption || `${trip.city} · 旅途一瞬`}</figcaption></figure> : editor ? <button type="button" className="jr-photo-edit-static" onClick={()=>editor.onEdit({kind:"cover"})}>選擇封面・第一張照片</button> : null}
    </section>
    <div className="jr-layout"><aside className="jr-sidebar"><p className="jl-eyebrow">IN THIS JOURNEY</p><h2>沿途的故事</h2>{chapters}<div className="jr-side-actions"><button type="button" onClick={() => setPanel("map")}>⌖ 旅程地圖</button><a href="#album" onClick={event => jump(event, "album")}>▧ 旅途相簿</a>{videos.length ? <button type="button" onClick={() => setPanel("film")}>▷ 旅程短片</button> : null}</div><ShareActions title={trip.title} description={trip.summary} path={`/trips/${trip.slug}`} /></aside>
      <div className="jr-story"><p className="jr-opening">把腳步放慢，回到旅途裡。</p>
        {entries.map((entry, index) => {
          const photo = photos.find(item => item.id === entry.storyPhotoId);
          return <article id={`story-${entry.id}`} data-reader-chapter className="jr-chapter" key={entry.id} data-music-zone={`${entry.title} ${entry.body}`}>
            <header><span className="jr-chapter-number">{String(index + 1).padStart(2, "0")}</span><div><p className="jl-eyebrow">{entry.entryDate?.slice(0, 10).replaceAll("-", ".")}</p><h2 {...editProps({kind:"entry",id:entry.id},`編輯段落：${entry.title}`)}>{entry.title}</h2></div></header>
            {photo ? <figure className="jr-story-photo"><div className="jr-edit-photo"><ReaderPhoto key={photo.id} photo={photo} />{editor ? <button className="jr-photo-edit" type="button" onClick={()=>editor.onEdit({kind:"photo",id:photo.id,entryId:entry.id})}>修改這張照片</button> : null}</div>{photo.caption ? <figcaption>{photo.caption}</figcaption> : null}</figure> : editor ? <button type="button" className="jr-photo-edit-static" onClick={()=>editor.onEdit({kind:"photo",id:"",entryId:entry.id})}>為這段故事選擇照片</button> : null}
            <div {...editProps({kind:"entry",id:entry.id},`編輯內文：${entry.title}`)}><div className="jr-prose">{entry.body.split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></div>
            {entry.voiceNoteUrl ? <audio controls preload="none" src={entry.voiceNoteUrl} aria-label={`${entry.title}的錄音`} /> : null}
          </article>;
        })}
        <section id="album" className="jr-album">{editor ? <button className="jr-photo-edit-static" type="button" onClick={()=>editor.onEdit({kind:"album"})}>編輯相簿・上傳照片</button> : null}<ReaderAlbum photos={photos} /></section>
        <footer className="jr-ending"><p className="jl-eyebrow">UNTIL THE NEXT JOURNEY</p><h2>旅程走完了，記憶還在。</h2><ShareActions title={trip.title} description={trip.summary} path={`/trips/${trip.slug}`} />{!hideHeader ? <ReaderBack onBack={onBack} /> : null}</footer>
      </div>
    </div>
    <nav className="jr-mobile-bar" aria-label="閱讀工具"><button type="button" onClick={() => setPanel("chapters")}>☷ <span>章節</span></button><a href="#album" onClick={event => jump(event, "album")}>▧ <span>相簿</span></a><button type="button" onClick={() => setPanel("map")}>⌖ <span>地圖</span></button>{videos.length ? <button type="button" onClick={() => setPanel("film")}>▷ <span>短片</span></button> : <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ <span>頂端</span></button>}</nav>
    {panel ? <div className="jr-overlay" onClick={event => { if (event.target === event.currentTarget) setPanel(null); }}><div className="jr-dialog" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="jr-dialog-title"><header><h2 id="jr-dialog-title">{panel === "chapters" ? "沿途的故事" : panel === "map" ? "旅程地圖" : "旅程短片"}</h2><button type="button" onClick={() => setPanel(null)} aria-label="關閉">✕</button></header><div className="jr-dialog-body">{editor && (panel === "map" || panel === "film") ? <button className="jr-photo-edit-static" type="button" onClick={()=>{const kind=panel;setPanel(null);editor.onEdit({kind});}}>編輯{panel === "map" ? "地圖與行程" : "短片"}</button> : null}{panel === "chapters" ? chapters : panel === "film" ? <ReaderFilm videos={videos} poster={cover?.storageKey} /> : <><p className="jr-map-note">地圖保留旅程停點與行前安排，不代表每站都已到訪。</p><JourneyMap center={trip.coordinates} city={trip.city} country={trip.country} journalEntries={trip.journalEntries} photos={trip.photos} places={trip.places} route={trip.travelRoute ?? []} title={trip.title} /></>}</div></div></div> : null}
  </main>;
}

