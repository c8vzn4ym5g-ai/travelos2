"use client";

import { useState } from "react";

type ShareActionsProps = {
  description: string;
  path: string;
  title: string;
};

const siteUrl = "https://travelos2-63r3.vercel.app";

export function ShareActions({ description, path, title }: ShareActionsProps) {
  const [message, setMessage] = useState("Share");
  const url = `${siteUrl}${path}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedBody = encodeURIComponent(`${title}\n\n${description}\n\n${url}`);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied");
      window.setTimeout(() => setMessage("Share"), 1800);
    } catch {
      setMessage("Copy failed");
      window.setTimeout(() => setMessage("Share"), 1800);
    }
  }

  return (
    <div className="travel-soft-panel flex flex-wrap items-center gap-2 rounded-2xl p-2">
      <button className="travel-chip rounded-full px-4 py-2 text-sm font-semibold" onClick={copyLink} type="button">
        {message}
      </button>
      <a className="travel-chip rounded-full px-4 py-2 text-sm font-semibold" href={`https://wa.me/?text=${encodedBody}`}>
        WhatsApp
      </a>
      <a className="travel-chip rounded-full px-4 py-2 text-sm font-semibold" href={`mailto:?subject=${encodedTitle}&body=${encodedBody}`}>
        Email
      </a>
      <a className="travel-chip rounded-full px-4 py-2 text-sm font-semibold" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}>
        Facebook
      </a>
    </div>
  );
}
