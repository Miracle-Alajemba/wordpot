import { useEffect, useRef, useState } from "react";

const TRACKS = {
  lobby: "/audio/lobby-music.mp3",
  game: "/audio/game-music.mp3",
};

export function useBackgroundMusic(screen) {
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("wordpot_music_muted") === "true";
    } catch {
      return false;
    }
  });
  const [currentTrack, setCurrentTrack] = useState(null);

  function getTrackForScreen(s) {
    if (
      s === "match-room" ||
      s === "practice" ||
      s === "daily-challenge"
    ) {
      return TRACKS.game;
    }
    return TRACKS.lobby;
  }

  useEffect(() => {
    const track = getTrackForScreen(screen);

    if (track === currentTrack && audioRef.current) {
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(track);
    audio.loop = true;
    audio.volume = 0.35;
    audio.muted = muted;
    audioRef.current = audio;
    setCurrentTrack(track);

    audio.play().catch(() => {
      // browser blocked autoplay — user will need to click mute button to start
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [screen]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
      if (!muted && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }
    try {
      localStorage.setItem("wordpot_music_muted", String(muted));
    } catch {}
  }, [muted]);

  function toggleMute() {
    setMuted((prev) => !prev);
  }

  return { muted, toggleMute };
}
