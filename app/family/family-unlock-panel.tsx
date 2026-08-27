"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FAMILY_ADMIN_SESSION_KEY, fetchFamilyGate } from "@/lib/family-session";

export function FamilyUnlockPanel() {
  const router = useRouter();
  const [pinRequired, setPinRequired] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("輸入一次後，本次使用期間可直接切換旅行與咖啡編輯。");
  const [checking, setChecking] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchFamilyGate().then((gate) => {
      if (!cancelled) {
        setPinRequired(gate.required);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function unlock() {
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

      window.sessionStorage.setItem(FAMILY_ADMIN_SESSION_KEY, pin);
      setOpened(true);
      setMessage("家庭入口已開啟。");
      router.refresh();
    } catch {
      setMessage("目前無法連線確認，請檢查網路後再試。");
    } finally {
      setChecking(false);
    }
  }

  if (pinRequired !== true || opened) {
    return null;
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
        <button
          className="mt-5 min-h-12 w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-950 transition hover:bg-emerald-100 disabled:opacity-60"
          disabled={checking}
          onClick={() => void unlock()}
          type="button"
        >
          開啟家庭入口
        </button>
      </div>
    </section>
  );
}
