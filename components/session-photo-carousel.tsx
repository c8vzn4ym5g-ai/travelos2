"use client";

import { useEffect, useState } from "react";

type SessionPhoto = {
  alt: string;
  src: string;
};

const fadeMs = 2200;
const blankMs = 800;
const stayMs = 7000;

export function SessionPhotoCarousel({ photos }: { photos: SessionPhoto[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const photoCount = photos.length;

  useEffect(() => {
    if (activeIndex >= photoCount) {
      setActiveIndex(0);
      setVisible(true);
    }
  }, [activeIndex, photoCount]);

  useEffect(() => {
    if (photoCount <= 1) {
      setActiveIndex(0);
      setVisible(true);
      return;
    }

    let changeTimer: ReturnType<typeof setTimeout>;
    const stayTimer = setTimeout(() => {
      setVisible(false);
      changeTimer = setTimeout(() => {
        setActiveIndex((index) => (index + 1) % photoCount);
        setVisible(true);
      }, fadeMs + blankMs);
    }, stayMs);

    return () => {
      clearTimeout(stayTimer);
      clearTimeout(changeTimer);
    };
  }, [activeIndex, photoCount]);

  if (photoCount === 0) {
    return null;
  }

  return (
    <div className="relative h-56 overflow-hidden rounded-lg bg-stone-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={photos[activeIndex].alt}
        className={`h-full w-full object-cover transition-opacity duration-[2200ms] ease-in-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        src={photos[activeIndex].src}
      />
      {photoCount > 1 ? (
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          {photos.map((photo, index) => (
            <span
              className={`h-1.5 w-6 rounded-full shadow-sm ${index === activeIndex ? "bg-white" : "bg-white/45"}`}
              key={`${photo.src}-dot-${index}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
