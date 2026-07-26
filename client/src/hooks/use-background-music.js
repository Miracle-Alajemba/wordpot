import { useEffect, useRef, useState } from "react";

const TRACKS = {
  lobby: "/audio/lobby-music.mp3",
  game: "/audio/game-music.mp3",
};

export function useBackgroundMusic(screen) {
  const audioRef = useRef(null);
  const userInteractedRef = useRef(false);
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

  // Handle global user interaction unlock for browser Autoplay policies
  useEffect(() => {
    function unlockAudio() {
      userInteractedRef.current = true;
      if (audioRef.current && !audioRef.current.muted && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    }

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

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
    audio.volume = 0.45;
    audio.muted = muted;
    audioRef.current = audio;
    setCurrentTrack(track);

    if (!muted) {
      audio.play().catch(() => {
        // Browser blocked autoplay until user clicks/taps anywhere on the page
      });
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [screen]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
      if (!muted) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
    try {
      localStorage.setItem("wordpot_music_muted", String(muted));
    } catch {}
  }, [muted]);

  function toggleMute() {
    setMuted((prev) => {
      const nextMuted = !prev;
      if (!nextMuted && audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(() => {});
      }
      return nextMuted;
    });
  }

  return { muted, toggleMute };
}
