import React, { useEffect, useState } from "react";
import {
  isMusicActive,
  startBackgroundMusic,
  stopBackgroundMusic,
  toggleBackgroundMusic,
} from "../../utils/bg-music.js";

const MUSIC_STORAGE_KEY = "wordpot_bg_music";

export function MusicToggle({ className = "" }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(MUSIC_STORAGE_KEY) : null;
    if (saved === "true") {
      const handleFirstGesture = () => {
        startBackgroundMusic();
        setPlaying(true);
        window.removeEventListener("click", handleFirstGesture);
        window.removeEventListener("keydown", handleFirstGesture);
        window.removeEventListener("touchstart", handleFirstGesture);
      };

      window.addEventListener("click", handleFirstGesture);
      window.addEventListener("keydown", handleFirstGesture);
      window.addEventListener("touchstart", handleFirstGesture);

      return () => {
        window.removeEventListener("click", handleFirstGesture);
        window.removeEventListener("keydown", handleFirstGesture);
        window.removeEventListener("touchstart", handleFirstGesture);
      };
    }
  }, []);

  const handleToggle = () => {
    const newState = toggleBackgroundMusic();
    setPlaying(newState);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUSIC_STORAGE_KEY, String(newState));
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`music-fab-btn ${className}`}
      aria-label={playing ? "Mute background music" : "Play background music"}
      title={playing ? "Mute Background Music" : "Play Background Music"}
      style={{
        position: "fixed",
        top: "14px",
        right: "14px",
        zIndex: 99999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        background: playing
          ? "linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))"
          : "rgba(15, 23, 42, 0.75)",
        border: playing
          ? "1.5px solid rgba(99, 244, 202, 0.6)"
          : "1px solid rgba(255, 255, 255, 0.2)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: playing ? "#38bdf8" : "#94a3b8",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: playing
          ? "0 6px 20px rgba(56, 189, 248, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
          : "0 4px 12px rgba(0, 0, 0, 0.3)",
      }}
    >
      <span style={{ fontSize: "18px", lineHeight: 1 }}>{playing ? "🔊" : "🔇"}</span>
    </button>
  );
}

export function NavItemMusicToggle() {
  return null;
}
