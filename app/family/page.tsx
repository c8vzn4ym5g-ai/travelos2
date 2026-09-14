import Link from "next/link";
import { FamIconWell } from "./family-icons";
import { FamilyBackLink } from "./family-back";

const departments = [
  {
    album: "sky" as const,
    editHref: "/trips/admin",
    editLabel: "編輯旅行內容",
    title: "旅行遊記",
    viewHref: "/trips",
  },
  {
    album: "blush" as const,
    editHref: "/coffee/admin",
    editLabel: "編輯咖啡內容",
    title: "咖啡記憶",
    viewHref: "/coffee",
  },
];

export default function FamilyWorkspacePage() {
  return (
    <main className="fam-page">
      <header className="fam-hero">
        <div className="fam-hero-inner">
          <FamilyBackLink className="min-h-11" href="/">
            ← 首頁
          </FamilyBackLink>
          <p className="fam-script">our family workspace</p>
          <h1 className="fam-title">
            <span className="fam-title-strong">家庭</span>編輯
          </h1>
          <p className="fam-lede">打開就能拍、看剛收下的。</p>
          <p className="fam-lede">
            你們都可以在手機查看、增加與修改內容。先儲存工作稿，整理完成後再更新公開遊記。
          </p>
        </div>
      </header>

      <Link className="fam-pill fam-pill-sky mx-auto my-4 flex min-h-11 w-fit items-center px-5" href="/family/stats">🌱 小小足跡・看看訪客</Link>


      <div className="family-workspace-grid">
      <section className="fam-sheet">
        <h2 className="fam-section">入口</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link className="fam-tile fam-tile-blush" href="/family/capture">
            <FamIconWell name="camera" well="blush" />
            上傳素材
          </Link>
          <Link className="fam-tile fam-tile-sky" href="/trips/write">
            <FamIconWell name="pencil" well="sky" />
            寫下回憶
          </Link>
          <Link className="fam-press fam-pill fam-pill-blush min-h-11 w-full flex-col" href="/family/trip">
            <span>行程</span>
            <span className="fam-en">福岡・大分</span>
          </Link>
          <Link className="fam-press fam-pill fam-pill-blush min-h-11 w-full flex-col" href="/family/talk">
            <span>說說</span>
            <span className="fam-en">中日口譯</span>
          </Link>
        </div>
      </section>

      <section className="fam-sheet" style={{ paddingTop: 4 }}>
        <h2 className="fam-section">工作台</h2>
        <article className="fam-tray mt-4">
          <div className="fam-tray-head">
            <FamIconWell name="folder" well="honey" />
            <div className="fam-tray-copy">
              <strong>剛收下的</strong>
              <p className="fam-muted mt-1">還沒整理。旅行和咖啡都還沒進。</p>
            </div>
          </div>
          <p className="fam-sr">剛收下的，還沒整理。旅行和咖啡都還沒進。</p>
          <Link className="fam-pill fam-pill-white mt-5 w-full" href="/family/bench">
            打開
          </Link>
        </article>
      </section>

      <section className="fam-sheet" style={{ paddingTop: 4 }}>
        <h2 className="fam-section">編輯</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {departments.map((department) => (
            <div className="min-w-0" key={department.title}>
            <Link className={`fam-album fam-album-${department.album} fam-editor-card`} href={department.editHref} aria-label={department.editLabel}>
              <div className="fam-album-art" aria-hidden>
                {department.album === "sky" ? (
                  <>
                    <span className="fam-shape-circle" />
                    <span className="fam-shape-triangle" />
                  </>
                ) : (
                  <>
                    <span className="fam-shape-dot fam-shape-dot-pink" />
                    <span className="fam-shape-dot fam-shape-dot-honey" />
                  </>
                )}
              </div>
              <div>
                <h3 className="fam-album-title">{department.title}</h3>
                <span className="fam-editor-card-action">點這裡編輯 →</span>
              </div>
            </Link>
            <Link className="fam-editor-read" href={department.viewHref}>閱讀{department.title} →</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="fam-sheet">
        <article className="fam-sticker">
          <p className="fam-label">安裝到 iPhone</p>
          <ol>
            <li>用 Safari 開啟 travelos2.chao-jason.workers.dev/family。</li>
            <li>點分享按鈕。</li>
            <li>選「加入主畫面」。</li>
            <li>以後點 TravelOS 圖示直接進入。</li>
          </ol>
        </article>
      </section>
      </div>
    </main>
  );
}

