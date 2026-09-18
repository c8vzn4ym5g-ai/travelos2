"use client";

import { useEffect, useState } from "react";
import { FamilyBackLink } from "../family-back";
import { createJournal, journalShelfState } from "@/lib/journal-template";
import { newNote, type NoteCategory } from "@/lib/note-article";
import type { TripDetail } from "@/lib/types";

type NoteCard = { id: string; title: string; summary: string; city?: string; coverPhoto?: { storageKey: string } | null };
type Shelf = { title: string; ready: boolean };

function noteShelves(item: NoteCard): Shelf[] {
  return [
    { title: "名稱", ready: Boolean(item.title?.trim()) },
    { title: "開場", ready: Boolean(item.summary?.trim()) },
    { title: "地方", ready: Boolean(item.city?.trim()) },
    { title: "封面", ready: Boolean(item.coverPhoto) },
  ];
}

function ShelfList({ shelves }: { shelves: Shelf[] }) {
  return (
    <ul className="mt-2 grid gap-1">
      {shelves.map((shelf) => (
        <li key={shelf.title} className="fam-muted">
          {shelf.ready ? "已有" : "還沒有"}・{shelf.title}
        </li>
      ))}
    </ul>
  );
}

export default function FamilyDeskPage() {
  const [trips, setTrips] = useState<TripDetail[]>([]);
  const [coffee, setCoffee] = useState<NoteCard[]>([]);
  const [food, setFood] = useState<NoteCard[]>([]);
  const [message, setMessage] = useState("正在讀倉庫…");
  const [busy, setBusy] = useState(false);

  async function load(done?: string) {
    setMessage(done ? "正在放進倉庫…" : "正在讀倉庫…");
    const [tripResponse, coffeeResponse, foodResponse] = await Promise.all([
      fetch("/api/trips/content", { cache: "no-store" }),
      fetch("/api/notes/catalog?category=coffee&mode=edit&limit=100", { cache: "no-store" }),
      fetch("/api/notes/catalog?category=food&mode=edit&limit=100", { cache: "no-store" }),
    ]);
    const tripData = await tripResponse.json();
    const coffeeData = await coffeeResponse.json();
    const foodData = await foodResponse.json();
    if (!tripResponse.ok) throw new Error(tripData.error || "遊記倉庫暫時讀不到");
    setTrips(tripData.content?.trips ?? []);
    setCoffee(coffeeResponse.ok ? coffeeData.items ?? [] : []);
    setFood(foodResponse.ok ? foodData.items ?? [] : []);
    setMessage(done ?? "倉庫已讀到。缺的格子標成還沒有。完整修改用筆電。");
  }

  useEffect(() => {
    void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "倉庫暫時讀不到"));
  }, []);

  async function createTrip() {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const trip = createJournal("新的遊記", `trip_${crypto.randomUUID()}`, now);
      const response = await fetch("/api/trips/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trip }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "遊記架構還沒建立");
      await load("遊記架構已放進倉庫。六格貨架都在，完整修改用筆電。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "遊記架構還沒建立");
    } finally {
      setBusy(false);
    }
  }

  async function createNote(category: NoteCategory) {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const item = newNote(category === "coffee" ? "新的咖啡" : "新的餐廳", category, crypto.randomUUID(), now);
      const response = await fetch("/api/notes/item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, item }),
      });
      const data = await response.json();
      if (!response.ok || !data.item) throw new Error(data.error || "架構還沒建立");
      await load(category === "coffee" ? "咖啡架構已放進倉庫。" : "餐廳架構已放進倉庫。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "架構還沒建立");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="fam-page">
      <header className="fam-hero">
        <div className="fam-hero-inner">
          <FamilyBackLink className="min-h-11" href="/family">← 編輯版</FamilyBackLink>
          <h1 className="fam-title">架構和缺漏</h1>
          <p className="fam-lede" role="status">{message}</p>
        </div>
      </header>
      <div className="family-workspace-grid">
        <section className="fam-sheet">
          <h2 className="fam-section">生成一格新架構</h2>
          <div className="mt-4 grid gap-2">
            <button className="fam-pill fam-pill-blush min-h-11" type="button" disabled={busy} onClick={() => void createTrip()}>新的遊記架構</button>
            <button className="fam-pill fam-pill-sky min-h-11" type="button" disabled={busy} onClick={() => void createNote("coffee")}>新的咖啡架構</button>
            <button className="fam-pill fam-pill-white min-h-11" type="button" disabled={busy} onClick={() => void createNote("food")}>新的餐廳架構</button>
          </div>
        </section>
        <section className="fam-sheet">
          <h2 className="fam-section">遊記貨架</h2>
          {trips.map((trip) => (
            <article className="fam-tray mt-4" key={trip.id}>
              <strong>{trip.title || "未命名遊記"}</strong>
              <ShelfList shelves={journalShelfState(trip)} />
            </article>
          ))}
        </section>
        <section className="fam-sheet">
          <h2 className="fam-section">咖啡貨架</h2>
          {coffee.map((item) => (
            <article className="fam-tray mt-4" key={item.id}>
              <strong>{item.title || "未命名咖啡"}</strong>
              <ShelfList shelves={noteShelves(item)} />
            </article>
          ))}
          {coffee.length === 0 ? <p className="fam-muted mt-3">還沒有咖啡架構。</p> : null}
        </section>
        <section className="fam-sheet">
          <h2 className="fam-section">餐廳貨架</h2>
          {food.map((item) => (
            <article className="fam-tray mt-4" key={item.id}>
              <strong>{item.title || "未命名餐廳"}</strong>
              <ShelfList shelves={noteShelves(item)} />
            </article>
          ))}
          {food.length === 0 ? <p className="fam-muted mt-3">還沒有餐廳架構。</p> : null}
        </section>
      </div>
    </main>
  );
}
