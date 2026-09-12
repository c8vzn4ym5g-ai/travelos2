/** A user starting a film or journey music gives that player the sound. */
export function coordinateReaderPlayback(root: Document) {
  const onPlay = (event: Event) => {
    const active = event.target as HTMLMediaElement | null;
    if (!active?.matches?.("video, audio[data-journey-audio]")) return;
    root.querySelectorAll<HTMLMediaElement>("video, audio[data-journey-audio]").forEach(media => {
      if (media !== active && !media.paused) media.pause();
    });
  };
  // Media play does not bubble. Capture also covers the separate Lapland hero.
  root.addEventListener("play", onPlay, true);
  return () => root.removeEventListener("play", onPlay, true);
}
