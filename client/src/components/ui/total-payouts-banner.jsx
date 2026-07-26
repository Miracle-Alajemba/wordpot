import React, { useEffect, useState } from "react";

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
    fetch("/api/stats/payouts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && isMounted) {
          setStats((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {
        // Fallback to static initial state if offline
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      className={`my-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900/90 to-cyan-950/60 border border-emerald-500/30 shadow-lg shadow-emerald-950/40 backdrop-blur-md ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl shadow-inner">
            💎
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Verified Onchain Payouts
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
              {stats.totalPayoutsCelo} <span className="text-emerald-400">CELO</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-200">
            🏆 <strong className="text-amber-400">{stats.totalSettledMatches}</strong> Matches Paid
          </div>

          <a
            href={`https://celoscan.io/address/${stats.roomContract}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-medium text-emerald-300 transition-colors inline-flex items-center gap-1"
          >
            <span>📜 Celoscan Contract</span>
            <span className="text-[10px]">↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default TotalPayoutsBanner;
