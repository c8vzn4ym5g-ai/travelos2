"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const adminSessionKey = "travelos-admin-pin";

type EditorPath = "/coffee/admin" | "/trips/admin";

export function FamilyUnlockPanel() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("輸入一次後，本次使用期間可直接切換旅行與咖啡編輯。");
  const [checking, setChecking] = useState(false);
  const [showPin, setShowPin] = useState(false);

  async function unlock(editorPath: EditorPath) {
    if (!pin.trim()) {
      setMessage("請先輸入家庭編輯密碼。");
      return;
    }

    setChecking(true);
    setMessage("正在確認家庭編輯密碼…");

    try {
      const response = await fetch("/api/coffee/admin", {
        headers: { "x-travelos-admin-pin": pin },
        method: "POST",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setMessage(data.error ?? "密碼不正確，請再試一次。");
        return;
      }

      window.sessionStorage.setItem(adminSessionKey, pin);
      router.push(editorPath);
    } catch {
      setMessage("目前無法連線確認，請檢查網路後再試。");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section aria-labelledby="family-unlock-title" className="mx-auto max-w-5xl px-6 pt-8 lg:px-10">
      <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">開始編輯</p>
        <h2 className="travel-display mt-2 text-2xl font-semibold sm:text-3xl" id="family-unlock-title">
          輸入家庭編輯密碼
        </h2>
        <div className="mt-5">
          <label className="travel-label text-sm font-semibold text-zinc-700" htmlFor="family-pin">
            家庭密碼
          </label>
          <div className="mt-2 flex gap-2">
            <input
              autoComplete="current-password"
              className="min-h-12 min-w-0 flex-1 rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              disabled={checking}
              id="family-pin"
              onChange={(event) => setPin(event.target.value)}
              placeholder="在這裡輸入"
              type={showPin ? "text" : "password"}
              value={pin}
            />
            <button
              aria-pressed={showPin}
              className="min-h-12 min-w-20 rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-950"
              onClick={() => setShowPin((current) => !current)}
              type="button"
            >
              {showPin ? "隱藏密碼" : "顯示密碼"}
            </button>
          </div>
        </div>
        <p aria-live="polite" className="mt-3 text-sm leading-6 text-zinc-600">
          {message}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            className="min-h-12 rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 font-semibold text-sky-950 transition hover:bg-sky-100 disabled:opacity-60"
            disabled={checking}
            onClick={() => unlock("/trips/admin")}
            type="button"
          >
            前往旅行編輯
          </button>
          <button
            className="min-h-12 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 transition hover:bg-rose-100 disabled:opacity-60"
            disabled={checking}
            onClick={() => unlock("/coffee/admin")}
            type="button"
          >
            前往咖啡編輯
          </button>
        </div>
      </div>
    </section>
  );
}
