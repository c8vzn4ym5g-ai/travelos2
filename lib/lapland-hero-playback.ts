export type LaplandHeroPlaybackResult = "unmuted" | "blocked";

type HeroVideo = {
  muted: boolean;
  play: () => Promise<void>;
};

function isNotAllowedError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "NotAllowedError") ||
    (error instanceof Error && error.name === "NotAllowedError")
  );
}

export async function startLaplandHeroPlayback(video: HeroVideo): Promise<LaplandHeroPlaybackResult> {
  video.muted = false;
  try {
    await video.play();
    return video.muted ? "blocked" : "unmuted";
  } catch (error) {
    if (!isNotAllowedError(error) && !(error instanceof Error)) {
      throw error;
    }
    video.muted = true;
    try {
      await video.play();
    } catch {
      // Picture may wait for the tap. Sound still needs a gesture.
    }
    return "blocked";
  }
}

export function unmuteLaplandHero(video: HeroVideo): Promise<void> {
  video.muted = false;
  return video.play().then(() => undefined);
}
