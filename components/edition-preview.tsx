"use client";
import { useEffect, useRef, useState } from "react";
const pages = [
  ["/", "首頁"],
  ["/trips", "旅行目錄"],
  ["/trips/kyoto-maple-higashiyama?id=trip_kyoto_maple_higashiyama", "東山故事"],
  ["/trips/kyoto-maple-ginkaku?id=trip_kyoto_maple_ginkaku", "銀閣寺故事"],
  ["/family", "家庭工作台"],
  ["/trips/admin", "遊記編輯"],
  ["/family/capture", "上傳素材"],
];
export function EditionPreview() {
  const [phone, setPhone] = useState(true);
  const [path, setPath] = useState("/");
  const [width, setWidth] = useState(390);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const deviceWidth = phone ? 390 : 1366;
  const scale = Math.min(1, width / deviceWidth);
  return <main className="edition-preview"><header><div><b>TravelOS · 新版預覽</b><span>先看體驗，再決定定稿。此版本尚未發布。</span></div><div className="edition-switch"><button aria-pressed={phone} onClick={() => setPhone(true)}>手機</button><button aria-pressed={!phone} onClick={() => setPhone(false)}>電腦</button></div></header><nav aria-label="預覽頁面">{pages.map(([url,label]) => <button key={url} aria-pressed={url === path} onClick={() => { setPath(url); if (frame.current) frame.current.src = url; }}>{label}</button>)}<a href={path} target="_blank" rel="noreferrer">獨立開啟 ↗</a></nav><div className="edition-stage" ref={stage}><div style={{width:deviceWidth * scale,height:(phone ? 844 : 900) * scale,margin:"0 auto"}}><iframe ref={frame} src={path} title={phone ? "手機版 TravelOS" : "電腦版 TravelOS"} style={{width:deviceWidth,height:phone ? 844 : 900,transform:`scale(${scale})`,transformOrigin:"top left",border:0,borderRadius:phone ? 20 : 6,boxShadow:"0 12px 55px #182c2520",background:"#f7f5ef"}} /></div></div></main>;
}
