"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const adminSessionKey = "travelos-admin-pin";

const adminTargets = [
  {
    description: "Create saved trip drafts, first notes, places, and starting cost records.",
    href: "/trips/new",
    label: "Travel admin",
    title: "Travel drafts",
    tone: "border-sky-100 bg-sky-50/70 text-sky-950",
  },
  {
    description: "Edit coffee shops, notes, addresses, links, and uploaded coffee photos.",
    href: "/coffee/admin",
    label: "Coffee admin",
    title: "Coffee map editor",
    tone: "border-rose-100 bg-rose-50/70 text-rose-950",
  },
];

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("Enter the admin PIN once, then choose Travel or Coffee.");

  useEffect(() => {
    const storedPin = window.sessionStorage.getItem(adminSessionKey);
    if (storedPin) {
      setPin(storedPin);
      setUnlocked(true);
      setMessage("Admin session unlocked for this browser tab.");
    }
  }, []);

  async function unlockAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setMessage("Checking admin PIN...");

    const response = await fetch("/api/coffee/admin", {
      headers: { "x-travelos-admin-pin": pin },
      method: "POST",
    });

    setChecking(false);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Admin PIN check failed.");
      return;
    }

    window.sessionStorage.setItem(adminSessionKey, pin);
    setUnlocked(true);
    setMessage("Unlocked. Choose the editor you need.");
  }

  function lockAdmin() {
    window.sessionStorage.removeItem(adminSessionKey);
    setPin("");
    setUnlocked(false);
    setMessage("Admin session locked.");
  }

  return (
    <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
      <section className="border-b border-amber-100 bg-[linear-gradient(135deg,_#fff7ed_0%,_#eef6ff_52%,_#fff1f2_100%)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-8 lg:px-10">
          <Link className="travel-label text-sm font-semibold uppercase tracking-[0.16em] text-amber-700" href="/">
            TravelOS
          </Link>
          <div>
            <p className="travel-script text-2xl text-rose-700">one private doorway</p>
            <h1 className="travel-display mt-2 text-4xl font-semibold sm:text-5xl">Admin workspace</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Unlock once, then manage Travel drafts and Coffee Map content from the same admin hub.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[20rem_1fr] lg:px-10">
        <form className="rounded-xl border border-amber-100 bg-white/95 p-5 shadow-sm" onSubmit={unlockAdmin}>
          <p className="travel-label text-xs font-semibold uppercase text-amber-700">Security</p>
          <h2 className="travel-display mt-2 text-2xl font-semibold">{unlocked ? "Unlocked" : "Admin PIN"}</h2>
          <input
            className="mt-4 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500"
            onChange={(event) => setPin(event.target.value)}
            placeholder="PIN"
            type="password"
            value={pin}
          />
          <button
            className="travel-label mt-4 w-full rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={checking || !pin.trim()}
            type="submit"
          >
            {checking ? "Checking" : unlocked ? "Refresh unlock" : "Unlock admin"}
          </button>
          {unlocked ? (
            <button
              className="travel-label mt-3 w-full rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700"
              onClick={lockAdmin}
              type="button"
            >
              Lock admin
            </button>
          ) : null}
          <p className="mt-4 text-sm leading-6 text-zinc-600">{message}</p>
        </form>

        <div className="grid gap-4 sm:grid-cols-2">
          {adminTargets.map((target) => (
            <article className={`flex flex-col rounded-xl border p-5 shadow-sm ${target.tone}`} key={target.href}>
              <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em]">{target.label}</p>
              <h2 className="travel-display mt-3 text-2xl font-semibold">{target.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-zinc-700">{target.description}</p>
              <Link
                className={`travel-label mt-5 rounded-full border px-4 py-2.5 text-center text-sm font-semibold ${
                  unlocked ? "border-white/80 bg-white/80" : "pointer-events-none border-white/40 bg-white/40 opacity-60"
                }`}
                href={target.href}
              >
                Open {target.label}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
