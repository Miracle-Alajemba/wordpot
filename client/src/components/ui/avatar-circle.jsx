import React from "react";

/**
 * AvatarCircle — Generates a deterministic color avatar from a wallet address.
 * @param {{ address: string, size?: number, className?: string }} props
 */
export function AvatarCircle({ address = "", size = 36, className = "" }) {
  const hash = React.useMemo(() => {
    let h = 0;
    const str = String(address || "").toLowerCase();
    for (let i = 0; i < str.length; i++) {
      h = str.charCodeAt(i) + ((h << 5) - h);
    }
    return h;
  }, [address]);

  const hue = Math.abs(hash % 360);
  const bg = `hsl(${hue}, 70%, 50%)`;
  const initials = address ? address.slice(2, 4).toUpperCase() : "??";

  return (
    <span
      className={`avatar-circle ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${bg}, hsl(${(hue + 40) % 360}, 70%, 60%))`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 800,
        color: "#fff",
        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
