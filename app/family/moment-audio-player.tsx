"use client";

import { useEffect, useRef, useState } from "react";
import {
  UNPLAYABLE_MOMENT_AUDIO_COPY,
  cloneAudioBytes,
  formatAudioDurationLabel,
  isFragmentedMp4,
  sniffAudioMime,
} from "@/lib/moment-audio";
import { primePlaybackAudioContext, transcodeBytesToWavFile } from "@/lib/moment-audio-playback";

type MomentAudioPlayerProps = {
  bytes?: Uint8Array | null;
  durationSeconds: number | null;
  src: string;
};

export function MomentAudioPlayer({ bytes, durationSeconds, src }: MomentAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wavUrlRef = useRef<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [unplayable, setUnplayable] = useState(false);
  const [heardDuration, setHeardDuration] = useState(durationSeconds);

  useEffect(() => {
    setPlaying(false);
    setUnplayable(false);
    setHeardDuration(durationSeconds);
    if (wavUrlRef.current) {
      URL.revokeObjectURL(wavUrlRef.current);
      wavUrlRef.current = null;
    }
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    audioRef.current?.pause();
    videoRef.current?.pause();
    audioRef.current?.removeAttribute("src");
    videoRef.current?.removeAttribute("src");
  }, [src, durationSeconds]);

  useEffect(() => {
    return () => {
      if (wavUrlRef.current) {
        URL.revokeObjectURL(wavUrlRef.current);
        wavUrlRef.current = null;
      }
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, []);

  async function playableAudioSrc() {
    if (wavUrlRef.current) {
      return wavUrlRef.current;
    }

    if (bytes && isFragmentedMp4(bytes)) {
      const wav = await transcodeBytesToWavFile(bytes);
      if (wav) {
        wavUrlRef.current = URL.createObjectURL(wav.file);
        setHeardDuration((current) => (current && current > 0 ? current : wav.durationSeconds));
        return wavUrlRef.current;
      }
    }

    return src;
  }

  async function playViaVideo() {
    const node = videoRef.current;
    if (!node || !bytes || sniffAudioMime(bytes) !== "audio/mp4") {
      throw new Error("video fallback unavailable");
    }

    if (!videoUrlRef.current) {
      videoUrlRef.current = URL.createObjectURL(new Blob([cloneAudioBytes(bytes)], { type: "video/mp4" }));
    }
    if (node.src !== videoUrlRef.current) {
      node.src = videoUrlRef.current;
    }
    await node.play();
  }

  function activeMedia() {
    if (videoRef.current?.currentSrc && !videoRef.current.paused) {
      return videoRef.current;
    }
    if (audioRef.current?.currentSrc && !audioRef.current.paused) {
      return audioRef.current;
    }
    return null;
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || unplayable) {
      return;
    }

    const current = activeMedia();
    if (current) {
      current.pause();
      setPlaying(false);
      return;
    }

    try {
      primePlaybackAudioContext();
      const nextSrc = await playableAudioSrc();
      if (audio.src !== nextSrc) {
        audio.src = nextSrc;
      }
      await audio.play();
      setPlaying(true);
    } catch {
      try {
        await playViaVideo();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setUnplayable(true);
      }
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <audio
        className="hidden"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlaying={() => setPlaying(true)}
        playsInline
        preload="auto"
        ref={audioRef}
      />
      <video
        className="hidden"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlaying={() => setPlaying(true)}
        playsInline
        preload="auto"
        ref={videoRef}
      />
      <p className="text-sm font-semibold text-zinc-800">{formatAudioDurationLabel(heardDuration)}</p>
      {unplayable ? (
        <p className="mt-2 text-sm leading-6 text-stone-500">{UNPLAYABLE_MOMENT_AUDIO_COPY}</p>
      ) : (
        <button
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950"
          onClick={() => void togglePlayback()}
          type="button"
        >
          {playing ? "暫停" : "播放"}
        </button>
      )}
    </div>
  );
}
