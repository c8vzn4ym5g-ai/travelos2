import assert from "node:assert/strict";
import test from "node:test";
import { startLaplandHeroPlayback, unmuteLaplandHero } from "../lib/lapland-hero-playback.ts";

function notAllowed() {
  return new DOMException("The request is not allowed", "NotAllowedError");
}

test("unmuted autoplay wins when the browser allows sound", async () => {
  const video = { muted: true, play: async () => undefined };
  const result = await startLaplandHeroPlayback(video);
  assert.equal(result, "unmuted");
  assert.equal(video.muted, false);
});

test("NotAllowedError falls back to muted autoplay so the cut still moves", async () => {
  let plays = 0;
  const video = {
    muted: false,
    play: async () => {
      plays += 1;
      if (plays === 1) {
        throw notAllowed();
      }
    },
  };

  const result = await startLaplandHeroPlayback(video);
  assert.equal(result, "blocked");
  assert.equal(video.muted, true);
  assert.equal(plays, 2);
});

test("muted fallback still counts as blocked when even muted play is refused", async () => {
  const video = {
    muted: false,
    play: async () => {
      throw notAllowed();
    },
  };

  const result = await startLaplandHeroPlayback(video);
  assert.equal(result, "blocked");
  assert.equal(video.muted, true);
});

test("tap-to-unmute turns sound on during the same gesture", async () => {
  let plays = 0;
  const video = {
    muted: true,
    play: async () => {
      plays += 1;
    },
  };

  await unmuteLaplandHero(video);
  assert.equal(video.muted, false);
  assert.equal(plays, 1);
});
