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
    <section aria-labelledby="family-unlock-title" className="fam-sheet">
      <div className="fam-unlock">
        <p className="fam-script" style={{ marginTop: 0 }}>
          family workshop
        </p>
        <h2 className="fam-title" id="family-unlock-title" style={{ fontSize: 28 }}>
          輸入家庭編輯密碼
        </h2>
        <div className="mt-5">
          <label className="fam-label" htmlFor="family-pin">
            家庭密碼
          </label>
          <div className="fam-unlock-row">
            <input
              autoComplete="current-password"
              disabled={checking}
              id="family-pin"
              onChange={(event) => setPin(event.target.value)}
              placeholder="在這裡輸入"
              type={showPin ? "text" : "password"}
              value={pin}
            />
            <button
              aria-pressed={showPin}
              className="fam-pill fam-pill-blush-outline min-w-20 text-sm"
              onClick={() => setShowPin((current) => !current)}
              type="button"
            >
              {showPin ? "隱藏密碼" : "顯示密碼"}
            </button>
          </div>
        </div>
        <p aria-live="polite" className="fam-muted mt-3">
          {message}
        </p>
        <button
          className="fam-pill fam-pill-blush mt-5 w-full"
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
