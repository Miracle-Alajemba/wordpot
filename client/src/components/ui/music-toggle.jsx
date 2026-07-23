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
      // Auto-start if user previously enabled music
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
      onClick={handleToggle}
      className={`music-toggle-btn ${className}`}
      title={playing ? "Mute Background Music" : "Play Background Music"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 14px",
        borderRadius: "999px",
        background: playing
          ? "linear-gradient(135deg, rgba(99, 244, 202, 0.2), rgba(56, 189, 248, 0.2))"
          : "rgba(255, 255, 255, 0.08)",
        border: playing
          ? "1px solid rgba(99, 244, 202, 0.5)"
          : "1px solid rgba(255, 255, 255, 0.15)",
        color: playing ? "#38bdf8" : "#94a3b8",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
        transition: "all 0.3s ease",
        boxShadow: playing ? "0 4px 14px rgba(56, 189, 248, 0.25)" : "none",
      }}
    >
      <span style={{ fontSize: "15px" }}>{playing ? "🔊" : "🔇"}</span>
      <span>{playing ? "Music ON" : "Music OFF"}</span>
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
      <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{playing ? "🔊" : "🔇"}</span>
      <span className="bottom-nav__label">{playing ? "Music" : "Mute"}</span>
    </button>
  );
}
