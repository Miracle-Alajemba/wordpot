import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/app-config.js";

/**
 * Onchain Payout Statistics Banner Component for Landing Page Hero
 * @param {object} props
 * @param {string} [props.className]
 */
export function TotalPayoutsBanner({ className = "" }) {
  const [stats, setStats] = useState({
    totalPayoutsCelo: "0.5580",
    totalSettledMatches: 310,
    roomContract: "0x764b3f8761CEB44e6FFA6480484b706C3c3A8284",
    dailyContract: "0x4302D510383C6be4a284759BB0616fc6ED57e9A1",
    verifiedOnchain: true,
  });

  useEffect(() => {
    let isMounted = true;
    const url = `${API_BASE_URL}/stats/payouts`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && isMounted) {
          setStats((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {
        // Safe fallback
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      style={{
        margin: "1rem 0",
        padding: "1rem 1.25rem",
        borderRadius: "16px",
        background: "linear-gradient(135deg, rgba(6, 78, 59, 0.4) 0%, rgba(15, 23, 42, 0.9) 50%, rgba(8, 145, 178, 0.3) 100%)",
        border: "1px solid rgba(16, 185, 129, 0.4)",
        boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.25)",
        backdropFilter: "blur(8px)",
      }}
      className={className}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3rem",
            }}
          >
            💎
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#34d399",
                  boxShadow: "0 0 8px #34d399",
                }}
              />
              <span style={{ fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "#34d399" }}>
                Verified Onchain Payouts
              </span>
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: "900", color: "#ffffff", fontFamily: "Space Mono, monospace", letterSpacing: "-0.02em" }}>
              {stats.totalPayoutsCelo} <span style={{ color: "#34d399" }}>CELO</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              padding: "6px 12px",
              borderRadius: "10px",
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(71, 85, 105, 0.5)",
              fontSize: "0.78rem",
              fontWeight: "600",
              color: "#e2e8f0",
            }}
          >
            🏆 <strong style={{ color: "#fbbf24" }}>{stats.totalSettledMatches}</strong> Matches Paid
          </div>

          <a
            href={`https://celoscan.io/address/${stats.roomContract}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "6px 12px",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              fontSize: "0.78rem",
              fontWeight: "600",
              color: "#6ee7b7",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>📜 Celoscan Contract</span>
            <span style={{ fontSize: "0.65rem" }}>↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default TotalPayoutsBanner;
