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
      className={`music-toggle-btn ${className}`}
      aria-label={playing ? "Mute background music" : "Play background music"}
      title={playing ? "Mute Background Music" : "Play Background Music"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: playing
          ? "linear-gradient(135deg, rgba(99, 244, 202, 0.25), rgba(56, 189, 248, 0.25))"
          : "rgba(255, 255, 255, 0.08)",
        border: playing
          ? "1.5px solid rgba(99, 244, 202, 0.6)"
          : "1px solid rgba(255, 255, 255, 0.18)",
        color: playing ? "#38bdf8" : "#94a3b8",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: playing ? "0 4px 16px rgba(56, 189, 248, 0.35)" : "none",
      }}
    >
      <span style={{ fontSize: "18px", lineHeight: 1 }}>{playing ? "🔊" : "🔇"}</span>
    </button>
  );
}

export function NavItemMusicToggle() {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(MUSIC_STORAGE_KEY) : null;
    if (saved === "true") {
      startBackgroundMusic();
      setPlaying(true);
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
      className={`bottom-nav__item ${playing ? "bottom-nav__item--active" : ""}`}
      onClick={handleToggle}
      aria-label={playing ? "Mute background music" : "Play background music"}
      title={playing ? "Mute Background Music" : "Play Background Music"}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.5rem 0.25rem",
        fontSize: "0.65rem",
        overflow: "hidden",
      }}
    >
      <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>{playing ? "🔊" : "🔇"}</span>
    </button>
  );
}
