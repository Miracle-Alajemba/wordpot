import { shortenWalletAddress } from "../../utils/ui-helpers.js";

function Icon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: "1.8",
    viewBox: "0 0 24 24",
  };

  const paths = {
    home: (
      <>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6.5 9.5V20h11V9.5" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M6 19c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" />
      </>
    ),
    leaderboard: (
      <>
        <path d="M6 19V10" />
        <path d="M12 19V6" />
        <path d="M18 19v-8" />
      </>
    ),
    wallet: (
      <>
        <path d="M4.5 8.5h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
        <path d="M6 8V7a2 2 0 0 1 2-2h9" />
        <circle cx="16.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
      </>
    ),
  };

  return <svg aria-hidden="true" {...common}>{paths[name] || paths.home}</svg>;
}

export function AppBottomNav({ screen, onNavigate, walletAddress, onWalletAction }) {
  const items = [
    { id: "home", label: "Home", icon: "home" },
    { id: "leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { id: "profile", label: "Profile", icon: "profile" },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item ${screen === item.id ? "bottom-nav__item--active" : ""}`}
          onClick={() => onNavigate(item.id)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}

      <button type="button" className="bottom-nav__item" onClick={onWalletAction}>
        <Icon name="wallet" />
        <span>{walletAddress ? shortenWalletAddress(walletAddress) : "Wallet"}</span>
      </button>
    </nav>
  );
}
