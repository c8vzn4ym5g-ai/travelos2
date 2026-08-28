import Link from "next/link";
import { FamIconWell } from "./family-icons";
import { FamilyUnlockPanel } from "./family-unlock-panel";

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
          <Link className="fam-back min-h-11" href="/">
            ← TravelOS 首頁
          </Link>
          <p className="fam-script">our family workspace</p>
          <h1 className="fam-title">
            <span className="fam-title-strong">家庭</span>編輯
          </h1>
          <p className="fam-lede">打開就能拍、看剛收下的。</p>
          <p className="fam-lede">
            Jason 與 Sana 都可以查看、增加、修改彼此的旅行、咖啡與照片。每次修改保留作者與版本，內容可以復原。
          </p>
          <Link className="fam-companion-sticker min-h-11" href="/family/trip">
            福岡 • 大分
          </Link>
        </div>
      </header>

      <FamilyUnlockPanel />

      <section className="fam-sheet">
        <h2 className="fam-section">入口</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link className="fam-tile fam-tile-blush" href="/family/capture">
            <FamIconWell name="camera" well="blush" />
            Capture
          </Link>
          <Link className="fam-tile fam-tile-sky" href="/trips/write">
            <FamIconWell name="pencil" well="sky" />
            Write
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
            <article className={`fam-album fam-album-${department.album}`} key={department.title}>
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
                <Link className="fam-quiet-action" href={department.viewHref}>
                  看看本子
                </Link>
                <Link className="fam-edit-link" href={department.editHref}>
                  {department.editLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="fam-sheet">
        <article className="fam-sticker">
          <p className="fam-label">安裝到 iPhone</p>
          <ol>
            <li>用 Safari 開啟 TravelOS。</li>
            <li>點分享按鈕。</li>
            <li>選「加入主畫面」。</li>
            <li>以後點 TravelOS 圖示直接進入。</li>
          </ol>
        </article>
      </section>
    </main>
  );
}
