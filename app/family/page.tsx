import Link from "next/link";
import { FamIconWell } from "./family-icons";
export default function FamilyWorkspacePage() {
  return (
    <main className="fam-page">
      <header className="fam-hero">
        <div className="fam-hero-inner">
          <p className="fam-script">family editor</p>
          <h1 className="fam-title">
            <span className="fam-title-strong">TravelOS</span> 編輯版
          </h1>
          <p className="fam-lede">手機先把素材放進倉庫，架構放好，缺的一眼看見。</p>
          <p className="fam-lede">完整修改標題、正文和照片順序，用筆電。</p>
        </div>
      </header>

      <div className="family-workspace-grid">
        <section className="fam-sheet">
          <h2 className="fam-section">手機上做這些</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link className="fam-tile fam-tile-blush" href="/family/capture">
              <FamIconWell name="camera" well="blush" />
              上傳照片和資料
            </Link>
            <Link className="fam-tile fam-tile-sky" href="/family/bench">
              <FamIconWell name="folder" well="sky" />
              檢查是否進倉
            </Link>
            <Link className="fam-press fam-pill fam-pill-blush min-h-11 w-full flex-col" href="/family/desk">
              <span>生成架構</span>
              <span className="fam-en">遊記・咖啡・餐廳</span>
            </Link>
            <Link className="fam-press fam-pill fam-pill-sky min-h-11 w-full flex-col" href="/family/desk">
              <span>看還缺什麼</span>
              <span className="fam-en">清楚標籤</span>
            </Link>
          </div>
        </section>

        <section className="fam-sheet">
          <h2 className="fam-section">筆電才做完整編輯</h2>
          <p className="fam-lede">這三個入口給筆電。手機不必走進長編輯。</p>
          <div className="mt-4 grid gap-2">
            <Link className="fam-pill fam-pill-white min-h-11" href="/trips/admin">旅行遊記</Link>
            <Link className="fam-pill fam-pill-white min-h-11" href="/coffee/admin">咖啡記憶</Link>
            <Link className="fam-pill fam-pill-white min-h-11" href="/food/admin">餐廳美食</Link>
          </div>
        </section>

        <section className="fam-sheet">
          <h2 className="fam-section">還在手邊的</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link className="fam-press fam-pill fam-pill-blush min-h-11" href="/family/talk">說說</Link>
            <Link className="fam-press fam-pill fam-pill-blush min-h-11" href="/family/trip">這趟行程</Link>
            <Link className="fam-press fam-pill fam-pill-sky min-h-11" href="/family/stats">小小足跡</Link>
          </div>
        </section>

        <section className="fam-sheet">
          <article className="fam-sticker">
            <p className="fam-label">手機上放兩個圖示</p>
            <ol>
              <li>公開版：Safari 打開首頁，分享，加入主畫面。名稱是 TravelOS。</li>
              <li>編輯版：Safari 打開這個頁面，分享，加入主畫面。名稱是 TravelOS 編輯版。</li>
              <li>如果主畫面已經有舊的單一圖示，刪掉再加一次。</li>
            </ol>
          </article>
        </section>
      </div>
    </main>
  );
}
